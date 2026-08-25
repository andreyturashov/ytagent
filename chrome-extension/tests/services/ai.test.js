/**
 * Tests for src/services/ai.js (Chrome Built-in Gemini Nano)
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { AIService } from '../../src/services/ai.js';
import { WebSearchService } from '../../src/services/websearch.js';

describe('AIService (Gemini Nano)', () => {
    beforeEach(() => {
        vi.restoreAllMocks();
        delete globalThis.ai;
    });

    afterEach(() => {
        delete globalThis.ai;
    });

    describe('constructor', () => {
        it('sets default settings', () => {
            const ai = new AIService();
            expect(ai.enableWebSearch).toBe(true);
            expect(ai.systemPrompt).toContain('AI assistant');
            expect(ai.isConfigured()).toBe(true);
        });

        it('applies custom settings', () => {
            const ai = new AIService({
                enableWebSearch: false,
                systemPrompt: 'Custom instructions',
            });
            expect(ai.enableWebSearch).toBe(false);
            expect(ai.systemPrompt).toBe('Custom instructions');
        });
    });

    describe('budgetContext', () => {
        it('returns short content unchanged', () => {
            const short = 'Short transcript';
            expect(AIService.budgetContext(short, 1000)).toBe(short);
        });

        it('truncates content exceeding limit and keeps head and tail', () => {
            const long = 'START_' + 'A'.repeat(500) + '_MIDDLE_' + 'B'.repeat(500) + '_END';
            const budgeted = AIService.budgetContext(long, 200);
            expect(budgeted.length).toBeLessThan(long.length);
            expect(budgeted).toContain('START_');
            expect(budgeted).toContain('_END');
            expect(budgeted).toContain('[... content truncated for on-device context limit ...]');
        });
    });

    describe('checkAvailability', () => {
        it('returns "no" when ai.languageModel is missing', async () => {
            const status = await AIService.checkAvailability();
            expect(status.available).toBe('no');
            expect(status.message).toContain('not detected');
        });

        it('returns "readily" when capabilities report readily available', async () => {
            globalThis.ai = {
                languageModel: {
                    capabilities: vi.fn().mockResolvedValue({ available: 'readily' })
                }
            };

            const status = await AIService.checkAvailability();
            expect(status.available).toBe('readily');
            expect(status.message).toContain('ready');
        });

        it('returns "after-download" when model is downloading', async () => {
            globalThis.ai = {
                languageModel: {
                    capabilities: vi.fn().mockResolvedValue({ available: 'after-download' })
                }
            };

            const status = await AIService.checkAvailability();
            expect(status.available).toBe('after-download');
            expect(status.message).toContain('downloading');
        });
    });

    describe('generateResponse', () => {
        it('throws helpful error when Gemini Nano API is unavailable in browser', async () => {
            const ai = new AIService();
            await expect(ai.generateResponse({
                userPrompt: 'Hello',
                pageTitle: 'Test',
            })).rejects.toThrow('chrome://flags/#prompt-api-for-gemini-nano');
        });

        it('generates non-streaming response via session.prompt', async () => {
            const mockSession = {
                prompt: vi.fn().mockResolvedValue('Summary of page'),
                destroy: vi.fn(),
            };

            globalThis.ai = {
                languageModel: {
                    create: vi.fn().mockResolvedValue(mockSession)
                }
            };

            const ai = new AIService({ enableWebSearch: false });
            const result = await ai.generateResponse({
                userPrompt: 'Summarize',
                pageContent: 'Full article text here',
                pageTitle: 'My Article',
                pageUrl: 'https://example.com/article'
            });

            expect(result).toBe('Summary of page');
            expect(globalThis.ai.languageModel.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    systemPrompt: expect.stringContaining('My Article')
                })
            );
            expect(mockSession.prompt).toHaveBeenCalledWith(expect.stringContaining('Summarize'));
            expect(mockSession.destroy).toHaveBeenCalled();
        });

        it('streams response chunks via session.promptStreaming', async () => {
            async function* mockStream() {
                yield 'Hello ';
                yield 'Hello world ';
                yield 'Hello world!';
            }

            const mockSession = {
                promptStreaming: vi.fn().mockReturnValue(mockStream()),
                destroy: vi.fn(),
            };

            globalThis.ai = {
                languageModel: {
                    create: vi.fn().mockResolvedValue(mockSession)
                }
            };

            const ai = new AIService({ enableWebSearch: false });
            const chunks = [];
            const onChunk = (delta, full) => chunks.push({ delta, full });

            const result = await ai.generateResponse({
                userPrompt: 'Greet me',
                onChunk
            });

            expect(result).toBe('Hello world!');
            expect(chunks.length).toBeGreaterThan(0);
            expect(mockSession.destroy).toHaveBeenCalled();
        });

        it('integrates web search context when enabled', async () => {
            const mockSession = {
                prompt: vi.fn().mockResolvedValue('Answer with search'),
                destroy: vi.fn(),
            };

            globalThis.ai = {
                languageModel: {
                    create: vi.fn().mockResolvedValue(mockSession)
                }
            };

            vi.spyOn(WebSearchService, 'search').mockResolvedValueOnce('[Search Result] Latest news');

            const ai = new AIService({ enableWebSearch: true });
            await ai.generateResponse({
                userPrompt: 'What is the latest release?',
            });

            const createCall = globalThis.ai.languageModel.create.mock.calls[0][0];
            expect(createCall.systemPrompt).toContain('--- WEB SEARCH CONTEXT ---');
            expect(createCall.systemPrompt).toContain('[Search Result] Latest news');
        });
    });
});
