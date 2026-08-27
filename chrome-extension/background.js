/**
 * Background Service Worker (Manifest V3)
 */

// Configure side panel to open on action click if supported
if (chrome.sidePanel && chrome.sidePanel.setPanelBehavior) {
    chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch((err) => {
        console.warn('Failed to set panel behavior:', err);
    });
}

// Register Context Menu on install / reload
chrome.runtime.onInstalled.addListener(() => {
    if (chrome.contextMenus && chrome.contextMenus.create) {
        chrome.contextMenus.removeAll(() => {
            chrome.contextMenus.create({
                id: 'aist-ask-selection',
                title: 'Ask AIst about this...',
                contexts: ['selection']
            });
        });
    }
});

// Handle Context Menu click
if (chrome.contextMenus && chrome.contextMenus.onClicked) {
    chrome.contextMenus.onClicked.addListener(async (info, tab) => {
        if (info.menuItemId === 'aist-ask-selection' && info.selectionText) {
            const text = info.selectionText.trim();
            if (!text) return;

            // 1. Open the side panel for this tab
            if (chrome.sidePanel && chrome.sidePanel.open && tab?.id) {
                try {
                    await chrome.sidePanel.open({ tabId: tab.id });
                } catch (err) {
                    console.warn('Failed to open side panel from context menu:', err);
                }
            }

            // 2. Save pending selection in storage (session/local fallback) for newly opened panel
            const storage = chrome.storage.session || chrome.storage.local;
            if (storage && storage.set) {
                await storage.set({
                    pendingSelection: {
                        text,
                        timestamp: Date.now(),
                        pageUrl: tab?.url || '',
                        pageTitle: tab?.title || ''
                    }
                });
            }

            // 3. Broadcast runtime message in case the side panel is already open
            try {
                chrome.runtime.sendMessage({
                    type: 'aist_selection_query',
                    text,
                    pageUrl: tab?.url || '',
                    pageTitle: tab?.title || ''
                });
            } catch (_) {}
        }
    });
}

/**
 * Resolve the Prompt API LanguageModel factory in Service Worker context.
 */
function getLanguageModelApi() {
    if (typeof LanguageModel !== 'undefined') return LanguageModel;
    if (typeof self !== 'undefined' && self.LanguageModel) return self.LanguageModel;
    if (typeof self !== 'undefined' && self.ai?.languageModel) return self.ai.languageModel;
    if (typeof globalThis !== 'undefined' && globalThis.LanguageModel) return globalThis.LanguageModel;
    if (typeof globalThis !== 'undefined' && globalThis.ai?.languageModel) return globalThis.ai.languageModel;
    return null;
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
    if (port.name !== 'gemini-nano-stream') return;

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
                    if (typeof chunk === 'string') {
                        if (chunk.startsWith(fullText)) {
                            const delta = chunk.slice(fullText.length);
                            fullText = chunk;
                            port.postMessage({ type: 'chunk', delta, fullText });
                        } else {
                            let commonPrefixLen = 0;
                            const minLen = Math.min(chunk.length, fullText.length);
                            while (commonPrefixLen < minLen && chunk[commonPrefixLen] === fullText[commonPrefixLen]) {
                                commonPrefixLen++;
                            }

                            if (commonPrefixLen > 0 && commonPrefixLen >= fullText.length * 0.6) {
                                const delta = chunk.slice(commonPrefixLen);
                                fullText = chunk;
                                port.postMessage({ type: 'chunk', delta, fullText });
                            } else {
                                const delta = chunk;
                                fullText += delta;
                                port.postMessage({ type: 'chunk', delta, fullText });
                            }
                        }
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
