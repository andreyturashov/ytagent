/**
 * Background Service Worker (Manifest V3)
 *
 * NOTE: Service workers use classic script format — ES module imports are not
 * available. Helper functions here are intentionally inlined.
 */

// Configure side panel to open on action click if supported
if (chrome.sidePanel && chrome.sidePanel.setPanelBehavior) {
    chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch((err) => {
        console.warn('Failed to set panel behavior:', err);
    });
}

/**
 * Resolve the Prompt API LanguageModel factory in Service Worker context.
 *
 * @sync-with src/services/ai.js — AIService.getLanguageModelApi()
 * Both copies discover the same API; keep lookup order in sync.
 */
function getLanguageModelApi() {
    if (typeof LanguageModel !== 'undefined') return LanguageModel;
    if (typeof globalThis !== 'undefined' && globalThis.LanguageModel) return globalThis.LanguageModel;
    if (typeof globalThis !== 'undefined' && globalThis.ai?.languageModel) return globalThis.ai.languageModel;
    if (typeof self !== 'undefined' && self.LanguageModel) return self.LanguageModel;
    if (typeof self !== 'undefined' && self.ai?.languageModel) return self.ai.languageModel;
    return null;
}

/**
 * Extract the incremental delta from a streaming chunk.
 *
 * @sync-with src/utils/streaming.js — extractStreamDelta()
 * Inlined here because service workers cannot use ES module imports.
 *
 * @param {string} chunk - The latest chunk from the stream
 * @param {string} previousFullText - Accumulated text from prior chunks
 * @returns {{ delta: string, fullText: string }}
 */
function extractStreamDelta(chunk, previousFullText) {
    if (typeof chunk !== 'string') {
        return { delta: '', fullText: previousFullText || '' };
    }

    const prev = previousFullText || '';

    // Pattern 1: Cumulative — chunk starts with the full previous text
    if (chunk.startsWith(prev)) {
        const delta = chunk.slice(prev.length);
        return { delta, fullText: chunk };
    }

    // Pattern 2: Partial overlap — significant common prefix (≥60%)
    let commonPrefixLen = 0;
    const minLen = Math.min(chunk.length, prev.length);
    while (commonPrefixLen < minLen && chunk[commonPrefixLen] === prev[commonPrefixLen]) {
        commonPrefixLen++;
    }

    if (commonPrefixLen > 0 && commonPrefixLen >= prev.length * 0.6) {
        const delta = chunk.slice(commonPrefixLen);
        return { delta, fullText: chunk };
    }

    // Pattern 3: Pure delta — entirely new content, append to previous
    return { delta: chunk, fullText: prev + chunk };
}

/**
 * Check Gemini Nano availability in Service Worker context.
 */
async function checkNanoAvailability() {
    const api = getLanguageModelApi();
    if (!api) {
        return {
            available: 'no',
            message: 'LanguageModel / Prompt API is not detected in browser. Check chrome://flags.'
        };
    }

    try {
        let status = null;
        if (typeof api.capabilities === 'function') {
            const caps = await api.capabilities();
            status = caps?.available;
        } else if (typeof api.availability === 'function') {
            status = await api.availability();
        } else {
            status = 'readily';
        }

        if (status === 'readily' || status === 'available') {
            return { available: 'readily', message: 'Gemini Nano is ready and hardware-accelerated.' };
        } else if (status === 'after-download' || status === 'downloadable') {
            return { available: 'after-download', message: 'Gemini Nano is downloading in Chrome components.' };
        }

        // Test if session creation works directly in service worker
        try {
            const testSession = await api.create();
            if (testSession) {
                if (typeof testSession.destroy === 'function') testSession.destroy();
                return { available: 'readily', message: 'Gemini Nano is ready and active.' };
            }
        } catch (_) {}

        return { available: 'no', message: 'Gemini Nano is not ready or disabled in flags.' };
    } catch (err) {
        return { available: 'no', message: err.message };
    }
}

// Port name constant (keep in sync with src/constants.js STREAM_PORT_NAME)
const STREAM_PORT_NAME = 'gemini-nano-stream';

// 1. One-shot message listener
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'checkNanoAvailability') {
        checkNanoAvailability().then(sendResponse);
        return true; // Keep message channel open for async response
    }

    if (request.action === 'promptGemini') {
        (async () => {
            const api = getLanguageModelApi();
            if (!api) {
                sendResponse({ success: false, error: 'Gemini Nano LanguageModel API is not available.' });
                return;
            }

            let session = null;
            try {
                session = await api.create({
                    systemPrompt: request.systemPrompt || '',
                    temperature: 0.7,
                    topK: 3
                });
                const reply = await session.prompt(request.prompt);
                sendResponse({ success: true, text: reply });
            } catch (err) {
                sendResponse({ success: false, error: err.message });
            } finally {
                if (session && typeof session.destroy === 'function') {
                    try { session.destroy(); } catch (_) {}
                }
            }
        })();
        return true;
    }
});

// 2. Port connection listener for streaming responses
chrome.runtime.onConnect.addListener((port) => {
    if (port.name !== STREAM_PORT_NAME) return;

    let session = null;
    let isAborted = false;

    port.onDisconnect.addListener(() => {
        isAborted = true;
        if (session && typeof session.destroy === 'function') {
            try { session.destroy(); } catch (_) {}
        }
    });

    port.onMessage.addListener(async (msg) => {
        if (msg.action !== 'generate') return;

        const api = getLanguageModelApi();
        if (!api) {
            port.postMessage({ type: 'error', error: 'Gemini Nano Prompt API is not detected.' });
            return;
        }

        try {
            session = await api.create({
                systemPrompt: msg.systemPrompt || '',
                temperature: 0.7,
                topK: 3
            });

            if (typeof session.promptStreaming === 'function') {
                const stream = session.promptStreaming(msg.prompt);
                let fullText = '';

                for await (const chunk of stream) {
                    if (isAborted) break;
                    const result = extractStreamDelta(chunk, fullText);
                    if (result.delta) {
                        fullText = result.fullText;
                        port.postMessage({ type: 'chunk', delta: result.delta, fullText });
                    }
                }
                if (!isAborted) {
                    port.postMessage({ type: 'done', fullText });
                }
            } else if (typeof session.prompt === 'function') {
                const fullText = await session.prompt(msg.prompt);
                if (!isAborted) {
                    port.postMessage({ type: 'chunk', delta: fullText, fullText });
                    port.postMessage({ type: 'done', fullText });
                }
            } else {
                port.postMessage({ type: 'error', error: 'Session does not support prompt or promptStreaming.' });
            }
        } catch (err) {
            if (!isAborted) {
                port.postMessage({ type: 'error', error: err.message });
            }
        } finally {
            if (session && typeof session.destroy === 'function') {
                try { session.destroy(); } catch (_) {}
            }
        }
    });
});
