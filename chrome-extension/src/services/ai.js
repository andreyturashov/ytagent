/**
 * Chrome Built-in AI Service (Gemini Nano)
 * Direct on-device inference via standard Prompt API (ai.languageModel).
 * 100% private, offline-capable, zero external API keys.
 */

import { WebSearchService } from './websearch.js';

export class AIService {
    constructor(settings = {}) {
        const s = settings || {};
        this.enableWebSearch = s.enableWebSearch !== false;
        this.systemPrompt = s.systemPrompt || 'You are a helpful, direct AI assistant. Answer user questions naturally in a plain conversation with short, direct, highly useful answers, factual info, and code snippets immediately. NEVER issue disclaimers like "The provided text does not contain...", "The text does not mention...", "I cannot fulfill based solely on the transcript...", or "According to the transcript...". If the user asks for code samples, facts, explanations, or details not present in the page context, IMMEDIATELY fulfill their request using your general knowledge and web search. ALWAYS place the final Yes/No question on its own separate paragraph line (separated by \\n\\n) at the very end of your response.';
    }

    /**
     * Resolve the browser's LanguageModel factory in the current execution context.
     */
    static getLanguageModelApi() {
        if (typeof LanguageModel !== 'undefined') return LanguageModel;
        if (typeof globalThis !== 'undefined' && globalThis.LanguageModel) return globalThis.LanguageModel;
        if (typeof globalThis !== 'undefined' && globalThis.ai?.languageModel) return globalThis.ai.languageModel;
        if (typeof window !== 'undefined' && window.LanguageModel) return window.LanguageModel;
        if (typeof window !== 'undefined' && window.ai?.languageModel) return window.ai.languageModel;
        if (typeof window !== 'undefined' && window.ai) return window.ai;
        if (typeof self !== 'undefined' && self.LanguageModel) return self.LanguageModel;
        if (typeof self !== 'undefined' && self.ai?.languageModel) return self.ai.languageModel;
        return null;
    }

    /**
     * Check if Gemini Nano is available (directly or via Background Service Worker).
     * @returns {Promise<{available: 'readily' | 'after-download' | 'no', message: string}>}
     */
    static async checkAvailability() {
        // 1. Query Background Service Worker first (privileged context)
        if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
            try {
                const response = await new Promise((resolve) => {
                    chrome.runtime.sendMessage({ action: 'checkNanoAvailability' }, (res) => {
                        if (chrome.runtime.lastError || !res) {
                            resolve(null);
                        } else {
                            resolve(res);
                        }
                    });
                });

                if (response && (response.available === 'readily' || response.available === 'after-download')) {
                    return response;
                }
            } catch (_) {}
        }

        // 2. Fallback to direct scope check
        const api = this.getLanguageModelApi();
        if (api) {
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
                    return { available: 'after-download', message: 'Gemini Nano model is downloading in Chrome components.' };
                }
            } catch (_) {}
        }

        return {
            available: 'no',
            message: 'Chrome Built-in AI (Gemini Nano) API is not detected. Please enable flags in chrome://flags.'
        };
    }

    /**
     * Check if provider is configured (Gemini Nano needs no API keys or servers).
     */
    isConfigured() {
        return true;
    }

    /**
     * Smartly trim long text to fit inside Gemini Nano's context window (~4k-8k tokens).
     * Keeps the opening context and the conclusion/latest content.
     */
    static budgetContext(content, maxChars = 12000) {
        if (!content || content.length <= maxChars) {
            return content || '';
        }
        const half = Math.floor((maxChars - 100) / 2);
        const head = content.slice(0, half);
        const tail = content.slice(-half);
        return `${head}\n\n[... content truncated for on-device context limit ...]\n\n${tail}`;
    }

    /**
     * Generate response using on-device Gemini Nano with optional streaming.
     * Tries direct API first, falls back to Background Service Worker port.
     */
    async generateResponse({ userPrompt, history = [], pageContent = '', pageTitle = '', pageUrl = '', historyContext = '', onChunk = null }) {
        let webSearchBlock = '';
        if (this.enableWebSearch) {
            try {
                const searchResults = await WebSearchService.search(userPrompt, pageTitle, history);
                if (searchResults) {
                    webSearchBlock = `\n\n--- WEB SEARCH CONTEXT ---\n${searchResults}\n--------------------------\n`;
                }
            } catch (e) {
                console.warn('Web search lookup bypassed:', e);
            }
        }

        const trimmedContent = AIService.budgetContext(pageContent, 12000);
        const contextBlock = (trimmedContent || pageTitle || pageUrl)
            ? `\n\n--- CURRENT PAGE CONTEXT ---\nTitle: ${pageTitle || 'Untitled'}\nURL: ${pageUrl || 'N/A'}\n${trimmedContent ? `Content:\n${trimmedContent}` : ''}\n-----------------------------\n`
            : '';

        const historyBlock = historyContext
            ? `\n\n--- BROWSING HISTORY ---\n${historyContext}\n------------------------\n`
            : '';

        const enhancedSystemPrompt = `${this.systemPrompt}\n${contextBlock}${historyBlock}${webSearchBlock}\nCRITICAL KNOWLEDGE & ANSWER INSTRUCTIONS:\n1. NEVER REFUSE OR DISCLAIM: STRICTLY FORBIDDEN PHRASES: Never write "The provided text does not contain...", "The text doesn't mention...", "I cannot fulfill your request based solely on the transcript...", "According to the transcript...", or any meta-disclaimers.\n2. FULFILL REQUESTS IMMEDIATELY: Whenever the user asks for code samples, examples, explanations, facts, history, or details (e.g. "provide some code samples"), IMMEDIATELY write the requested code samples and answers using your general knowledge and web search results!\n3. STRICT TOPIC ALIGNMENT: Always stay aligned with the current page topic and conversation context.\n4. NO OPEN-ENDED QUESTIONS: NEVER ask open-ended opinion questions that demand long answers.\n5. STRICT YES/NO OFFER QUESTIONS ONLY: ALWAYS conclude your response with 1 simple follow-up offer that requires only a simple "Yes" or "No" reply (e.g. "Would you like to see another code example?", "Should I explain this further?").\n6. PARAGRAPH SEPARATION: ALWAYS place the final Yes/No question on its own separate line (separated by a blank line \\n\\n) at the very end of your response, so it is visually separated from the main info content.\n7. When asked for links, provide markdown links: [Title](URL).`;

        // Build final conversation prompt with system instruction & context prepended
        let promptBody = '';
        if (history && history.length > 0) {
            const recentHistory = history.slice(-6);
            for (const msg of recentHistory) {
                const role = msg.role === 'user' ? 'User' : 'Assistant';
                promptBody += `${role}: ${msg.content}\n`;
            }
            promptBody += `User: ${userPrompt}\nAssistant:`;
        } else {
            promptBody = `User: ${userPrompt}\nAssistant:`;
        }

        const fullPrompt = `${enhancedSystemPrompt}\n\n${promptBody}`;

        const directApi = AIService.getLanguageModelApi();

        // Path A: Direct Execution in Current Window/Frame
        if (directApi) {
            let session;
            try {
                session = await directApi.create({
                    systemPrompt: enhancedSystemPrompt,
                    temperature: 0.7,
                    topK: 3
                });
            } catch (createErr) {
                throw new Error(`Failed to initialize Gemini Nano session: ${createErr.message}. Ensure model download is complete in chrome://components.`);
            }

            try {
                if (!onChunk && typeof session.prompt === 'function') {
                    return await session.prompt(fullPrompt);
                }

                if (typeof session.promptStreaming === 'function') {
                    const stream = session.promptStreaming(fullPrompt);
                    let fullText = '';

                    for await (const chunk of stream) {
                        if (typeof chunk === 'string') {
                            if (chunk.startsWith(fullText)) {
                                const delta = chunk.slice(fullText.length);
                                fullText = chunk;
                                if (onChunk && delta) onChunk(delta, fullText);
                            } else {
                                let commonPrefixLen = 0;
                                const minLen = Math.min(chunk.length, fullText.length);
                                while (commonPrefixLen < minLen && chunk[commonPrefixLen] === fullText[commonPrefixLen]) {
                                    commonPrefixLen++;
                                }

                                if (commonPrefixLen > 0 && commonPrefixLen >= fullText.length * 0.6) {
                                    const delta = chunk.slice(commonPrefixLen);
                                    fullText = chunk;
                                    if (onChunk && delta) onChunk(delta, fullText);
                                } else {
                                    const delta = chunk;
                                    fullText += delta;
                                    if (onChunk && delta) onChunk(delta, fullText);
                                }
                            }
                        }
                    }
                    return fullText;
                } else if (typeof session.prompt === 'function') {
                    const result = await session.prompt(fullPrompt);
                    if (onChunk && result) onChunk(result, result);
                    return result;
                }
            } finally {
                if (session && typeof session.destroy === 'function') {
                    try { session.destroy(); } catch (_) {}
                }
            }
        }

        // Path B: Route to Background Service Worker via Chrome Extension Port
        if (typeof chrome !== 'undefined' && chrome.runtime?.connect) {
            return new Promise((resolve, reject) => {
                try {
                    const port = chrome.runtime.connect({ name: 'gemini-nano-stream' });
                    let lastFullText = '';

                    port.onMessage.addListener((msg) => {
                        if (msg.type === 'chunk') {
                            lastFullText = msg.fullText;
                            if (onChunk) onChunk(msg.delta, msg.fullText);
                        } else if (msg.type === 'done') {
                            resolve(msg.fullText || lastFullText);
                            port.disconnect();
                        } else if (msg.type === 'error') {
                            reject(new Error(msg.error || 'Gemini Nano generation failed.'));
                            port.disconnect();
                        }
                    });

                    port.onDisconnect.addListener(() => {
                        if (chrome.runtime.lastError) {
                            reject(new Error(chrome.runtime.lastError.message));
                        }
                    });

                    port.postMessage({
                        action: 'generate',
                        systemPrompt: enhancedSystemPrompt,
                        prompt: fullPrompt
                    });
                } catch (portErr) {
                    reject(portErr);
                }
            });
        }

        throw new Error(
            'Gemini Nano is not enabled in your browser.\n\n' +
            'To enable on-device AI:\n' +
            '1. Open chrome://flags/#prompt-api-for-gemini-nano -> Set to "Enabled"\n' +
            '2. Open chrome://flags/#optimization-guide-on-device-model -> Set to "Enabled BypassPerfRequirement"\n' +
            '3. Open chrome://components -> Click "Check for update" on "Optimization Guide On Device Model"\n' +
            '4. Relaunch Chrome.'
        );
    }
}
