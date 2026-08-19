/**
 * Tests for src/services/ai.js
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AIService } from '../../src/services/ai.js';
import { resetChromeMocks, mockFetchResponse } from '../setup.js';

describe('AIService', () => {
    describe('constructor', () => {
        it('sets defaults when no settings provided', () => {
            const ai = new AIService();
            expect(ai.provider).toBe('ollama');
            expect(ai.ollamaEndpoint).toBe('http://localhost:11434');
            expect(ai.ollamaModel).toBe('qwen2.5:14b');
            expect(ai.enableWebSearch).toBe(true);
        });

        it('applies provided settings', () => {
            const ai = new AIService({
                provider: 'openai',
                openaiKey: 'sk-test123',
                openaiModel: 'gpt-4o',
                enableWebSearch: false,
            });
            expect(ai.provider).toBe('openai');
            expect(ai.openaiKey).toBe('sk-test123');
            expect(ai.openaiModel).toBe('gpt-4o');
            expect(ai.enableWebSearch).toBe(false);
        });

        it('migrates legacy llama3.2 model to qwen2.5:14b', () => {
            const ai = new AIService({ ollamaModel: 'llama3.2' });
            expect(ai.ollamaModel).toBe('qwen2.5:14b');
        });

        it('strips trailing slash from Ollama endpoint', () => {
            const ai = new AIService({ ollamaEndpoint: 'http://localhost:11434///' });
            expect(ai.ollamaEndpoint).toBe('http://localhost:11434');
        });
    });

    describe('isConfigured', () => {
        it('returns true for Ollama with endpoint and model', () => {
            const ai = new AIService({ provider: 'ollama', ollamaEndpoint: 'http://localhost:11434', ollamaModel: 'qwen2.5:14b' });
            expect(ai.isConfigured()).toBe(true);
        });

        it('returns false for Ollama when model is cleared after construction', () => {
            const ai = new AIService({ provider: 'ollama' });
            ai.ollamaModel = '';
            expect(ai.isConfigured()).toBe(false);
        });

        it('returns true for OpenAI with API key', () => {
            const ai = new AIService({ provider: 'openai', openaiKey: 'sk-test' });
            expect(ai.isConfigured()).toBe(true);
        });

        it('returns false for OpenAI without API key', () => {
            const ai = new AIService({ provider: 'openai', openaiKey: '' });
            expect(ai.isConfigured()).toBe(false);
        });

        it('returns true for Gemini with API key', () => {
            const ai = new AIService({ provider: 'gemini', geminiKey: 'AIzaSy-test' });
            expect(ai.isConfigured()).toBe(true);
        });

        it('returns false for Gemini without API key', () => {
            const ai = new AIService({ provider: 'gemini', geminiKey: '   ' });
            expect(ai.isConfigured()).toBe(false);
        });

        it('returns false for unknown provider', () => {
            const ai = new AIService({ provider: 'unknown' });
            expect(ai.isConfigured()).toBe(false);
        });
    });

    describe('fetchOllamaModels', () => {
        beforeEach(() => {
            vi.restoreAllMocks();
        });

        it('returns model names from Ollama API', async () => {
            const mockModels = { models: [{ name: 'qwen2.5:14b' }, { name: 'mistral' }] };
            vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(mockFetchResponse(mockModels));

            const models = await AIService.fetchOllamaModels('http://localhost:11434');
            expect(models).toEqual(['qwen2.5:14b', 'mistral']);
        });

        it('throws on non-OK response', async () => {
            vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
                mockFetchResponse('Not Found', { ok: false, status: 404 })
            );

            await expect(AIService.fetchOllamaModels('http://localhost:11434'))
                .rejects.toThrow('Failed to reach Ollama');
        });

        it('returns empty array when no models', async () => {
            vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(mockFetchResponse({ models: [] }));

            const models = await AIService.fetchOllamaModels();
            expect(models).toEqual([]);
        });
    });

    describe('generateResponse', () => {
        beforeEach(() => {
            vi.restoreAllMocks();
        });

        it('throws when provider is not configured', async () => {
            const ai = new AIService({ provider: 'openai', openaiKey: '' });

            await expect(ai.generateResponse({
                userPrompt: 'test',
            })).rejects.toThrow('Configuration for OPENAI is missing');
        });

        it('calls Ollama for ollama provider (non-streaming)', async () => {
            const ai = new AIService({
                provider: 'ollama',
                ollamaEndpoint: 'http://localhost:11434',
                ollamaModel: 'qwen2.5:14b',
                enableWebSearch: false,
            });

            const mockResponse = { message: { content: 'Hello from Ollama!' } };
            vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(mockFetchResponse(mockResponse));

            const result = await ai.generateResponse({
                userPrompt: 'Hello',
                pageContent: 'Some page content',
                pageTitle: 'Test Page',
            });

            expect(result).toBe('Hello from Ollama!');
            expect(globalThis.fetch).toHaveBeenCalledWith(
                'http://localhost:11434/api/chat',
                expect.objectContaining({ method: 'POST' })
            );
        });

        it('includes page context in system prompt', async () => {
            const ai = new AIService({
                provider: 'ollama',
                ollamaEndpoint: 'http://localhost:11434',
                ollamaModel: 'qwen2.5:14b',
                enableWebSearch: false,
            });

            vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
                mockFetchResponse({ message: { content: 'response' } })
            );

            await ai.generateResponse({
                userPrompt: 'summarize',
                pageContent: 'This is the page content about testing.',
                pageTitle: 'Testing Guide',
            });

            const call = globalThis.fetch.mock.calls[0];
            const body = JSON.parse(call[1].body);
            const systemMsg = body.messages[0].content;
            expect(systemMsg).toContain('PAGE CONTEXT');
            expect(systemMsg).toContain('Testing Guide');
            expect(systemMsg).toContain('This is the page content about testing.');
        });
    });
});
