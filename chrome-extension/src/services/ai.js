/**
 * Direct Client-Side AI Service (Ollama, Gemini, OpenAI)
 * With Web Search Grounding.
 * Generalized to support any page content, not just YouTube transcripts.
 */

import { WebSearchService } from './websearch.js';

export class AIService {
    constructor(settings = {}) {
        const s = settings || {};
        this.provider = s.provider || 'ollama';
        this.ollamaEndpoint = (s.ollamaEndpoint || 'http://localhost:11434').replace(/\/+$/, '');
        const model = s.ollamaModel || 'qwen2.5:14b';
        this.ollamaModel = (model === 'llama3.2') ? 'qwen2.5:14b' : model;
        this.openaiKey = s.openaiKey || '';
        this.openaiModel = s.openaiModel || 'gpt-4o-mini';
        this.geminiKey = s.geminiKey || '';
        this.geminiModel = s.geminiModel || 'gemini-3.6-flash';
        this.enableWebSearch = s.enableWebSearch !== false;
        this.systemPrompt = s.systemPrompt || 'You are an intelligent AI assistant that helps users understand web page content.';
    }

    /**
     * Check if the currently selected provider is properly configured.
     */
    isConfigured() {
        if (this.provider === 'ollama') {
            return Boolean(this.ollamaEndpoint && this.ollamaModel);
        }
        if (this.provider === 'openai') {
            return Boolean(this.openaiKey && this.openaiKey.trim().length > 0);
        }
        if (this.provider === 'gemini') {
            return Boolean(this.geminiKey && this.geminiKey.trim().length > 0);
        }
        return false;
    }

    /**
     * Helper to fetch locally installed models from a running Ollama instance.
     */
    static async fetchOllamaModels(endpoint = 'http://localhost:11434') {
        const cleanUrl = endpoint.replace(/\/+$/, '');
        const response = await fetch(`${cleanUrl}/api/tags`);
        if (!response.ok) {
            throw new Error(`Failed to reach Ollama at ${cleanUrl} (HTTP ${response.status})`);
        }
        const data = await response.json();
        return (data?.models || []).map(m => m.name);
    }

    /**
     * Generate response with optional streaming callback.
     * @param {object} options
     * @param {string} options.userPrompt - The user's message
     * @param {Array} options.history - Prior chat messages
     * @param {string} options.pageContent - Extracted page content (transcript, article text, etc.)
     * @param {string} options.pageTitle - Page title
     * @param {string} options.pageUrl - Page source URL
     * @param {string} options.historyContext - Optional browsing history context for cross-page queries
     * @param {Function|null} options.onChunk - Streaming callback(delta, fullText)
     */
    async generateResponse({ userPrompt, history = [], pageContent = '', pageTitle = '', pageUrl = '', historyContext = '', onChunk = null }) {
        if (!this.isConfigured()) {
            throw new Error(`Configuration for ${this.provider.toUpperCase()} is missing. Please check settings.`);
        }

        let webSearchBlock = '';

        // Web search grounding for Ollama and OpenAI
        if ((this.provider === 'ollama' || this.provider === 'openai') && this.enableWebSearch) {
            try {
                const searchResults = await WebSearchService.search(userPrompt);
                if (searchResults) {
                    webSearchBlock = `\n\n--- WEB SEARCH CONTEXT ---\n${searchResults}\n--------------------------\n`;
                }
            } catch (e) {
                console.warn('Web search lookup bypassed:', e);
            }
        }

        const contextBlock = (pageContent || pageTitle || pageUrl)
            ? `\n\n--- CURRENT PAGE CONTEXT ---\nTitle: ${pageTitle || 'Untitled'}\nURL: ${pageUrl || 'N/A'}\n${pageContent ? `Content:\n${pageContent.slice(0, 80000)}` : ''}\n-----------------------------\n`
            : '';

        const historyBlock = historyContext
            ? `\n\n--- BROWSING HISTORY ---\nThe user has previously visited and discussed the following pages and videos. Each entry contains the title, author/source, relative visit date, and URL.\n${historyContext}\n------------------------\n`
            : '';

        const enhancedSystemPrompt = `${this.systemPrompt}\n${contextBlock}${historyBlock}${webSearchBlock}\nInstructions:\n1. Prioritize answering based on the provided page content.\n2. When asked for the link, URL, or source of the current video or page, provide the URL from CURRENT PAGE CONTEXT as a markdown link: [${pageTitle || 'Link'}](${pageUrl}).\n3. When asked about previously watched videos, visited pages, or articles from history, use the BROWSING HISTORY context and always provide the exact markdown link [Title](URL).\n4. Never claim that you cannot provide links or browse when URLs are provided in the context above.\n5. If the user asks for external information or definitions not present in the page, use web search context and your knowledge to answer accurately.`;


        if (this.provider === 'ollama') {
            return this._callOllama({ enhancedSystemPrompt, history, userPrompt, onChunk });
        } else if (this.provider === 'openai') {
            return this._callOpenAI({ enhancedSystemPrompt, history, userPrompt, onChunk });
        } else if (this.provider === 'gemini') {
            return this._callGemini({ enhancedSystemPrompt, history, userPrompt, onChunk });
        } else {
            throw new Error(`Unsupported AI provider: ${this.provider}`);
        }
    }

    /**
     * Local Ollama Chat Completion API (NDJSON Streaming)
     */
    async _callOllama({ enhancedSystemPrompt, history, userPrompt, onChunk }) {
        const messages = [
            { role: 'system', content: enhancedSystemPrompt }
        ];

        for (const msg of history) {
            messages.push({
                role: msg.role === 'user' ? 'user' : 'assistant',
                content: msg.content
            });
        }

        messages.push({ role: 'user', content: userPrompt });

        const url = `${this.ollamaEndpoint}/api/chat`;

        let response;
        try {
            response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    model: this.ollamaModel,
                    messages,
                    stream: Boolean(onChunk)
                })
            });
        } catch (fetchErr) {
            throw new Error(`Could not connect to Ollama at ${this.ollamaEndpoint}. Please make sure Ollama is running ('ollama serve' or open Ollama app). Error: ${fetchErr.message}`);
        }

        if (!response.ok) {
            const errText = await response.text().catch(() => '');
            throw new Error(`Ollama request failed (HTTP ${response.status}): ${errText || response.statusText}`);
        }

        if (!onChunk) {
            const data = await response.json();
            return data?.message?.content || '';
        }

        // Ollama NDJSON Streaming
        const reader = response.body.getReader();
        const decoder = new TextDecoder('utf-8');
        let fullText = '';
        let buffer = '';

        while (true) {
            const { value, done } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop();

            for (const line of lines) {
                const trimmed = line.trim();
                if (!trimmed) continue;

                try {
                    const parsed = JSON.parse(trimmed);
                    const delta = parsed?.message?.content || '';
                    if (delta) {
                        fullText += delta;
                        onChunk(delta, fullText);
                    }
                    if (parsed?.done) {
                        break;
                    }
                } catch (e) {}
            }
        }

        return fullText;
    }

    /**
     * OpenAI Chat Completions (SSE Streaming)
     */
    async _callOpenAI({ enhancedSystemPrompt, history, userPrompt, onChunk }) {
        const messages = [
            { role: 'system', content: enhancedSystemPrompt }
        ];

        for (const msg of history) {
            messages.push({
                role: msg.role === 'user' ? 'user' : 'assistant',
                content: msg.content
            });
        }

        messages.push({ role: 'user', content: userPrompt });

        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.openaiKey.trim()}`
            },
            body: JSON.stringify({
                model: this.openaiModel,
                messages,
                stream: Boolean(onChunk)
            })
        });

        if (!response.ok) {
            const errData = await response.json().catch(() => ({}));
            throw new Error(errData?.error?.message || `OpenAI request failed (HTTP ${response.status})`);
        }

        if (!onChunk) {
            const data = await response.json();
            return data.choices?.[0]?.message?.content || '';
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder('utf-8');
        let fullText = '';
        let buffer = '';

        while (true) {
            const { value, done } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop();

            for (const line of lines) {
                const trimmed = line.trim();
                if (!trimmed || !trimmed.startsWith('data: ')) continue;
                if (trimmed === 'data: [DONE]') break;

                try {
                    const parsed = JSON.parse(trimmed.slice(6));
                    const delta = parsed.choices?.[0]?.delta?.content || '';
                    if (delta) {
                        fullText += delta;
                        onChunk(delta, fullText);
                    }
                } catch (e) {}
            }
        }

        return fullText;
    }

    /**
     * Google Gemini API with Google Search Tool Grounding (SSE Streaming)
     */
    async _callGemini({ enhancedSystemPrompt, history, userPrompt, onChunk }) {
        const contents = [];

        for (const msg of history) {
            contents.push({
                role: msg.role === 'user' ? 'user' : 'model',
                parts: [{ text: msg.content }]
            });
        }

        contents.push({
            role: 'user',
            parts: [{ text: userPrompt }]
        });

        const streamEndpoint = onChunk ? 'streamGenerateContent?alt=sse&' : 'generateContent?';
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.geminiModel}:${streamEndpoint}key=${this.geminiKey.trim()}`;

        const payload = {
            contents,
            systemInstruction: {
                parts: [{ text: enhancedSystemPrompt }]
            }
        };

        if (this.enableWebSearch) {
            payload.tools = [
                { googleSearch: {} }
            ];
        }

        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const errData = await response.json().catch(() => ({}));
            throw new Error(errData?.error?.message || `Gemini request failed (HTTP ${response.status})`);
        }

        if (!onChunk) {
            const data = await response.json();
            return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder('utf-8');
        let fullText = '';
        let buffer = '';

        while (true) {
            const { value, done } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop();

            for (const line of lines) {
                const trimmed = line.trim();
                if (!trimmed || !trimmed.startsWith('data: ')) continue;

                try {
                    const parsed = JSON.parse(trimmed.slice(6));
                    const chunk = parsed.candidates?.[0]?.content?.parts?.[0]?.text || '';
                    if (chunk) {
                        fullText += chunk;
                        onChunk(chunk, fullText);
                    }
                } catch (e) {}
            }
        }

        return fullText;
    }
}
