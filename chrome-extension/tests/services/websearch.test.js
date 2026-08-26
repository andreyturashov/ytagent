/**
 * Tests for src/services/websearch.js
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { WebSearchService } from '../../src/services/websearch.js';
import { mockFetchResponse } from '../setup.js';

describe('WebSearchService', () => {
    beforeEach(() => {
        vi.restoreAllMocks();
    });

    it('returns null for empty query', async () => {
        expect(await WebSearchService.search('')).toBeNull();
        expect(await WebSearchService.search(null)).toBeNull();
        expect(await WebSearchService.search('   ')).toBeNull();
    });

    it('returns formatted results with abstract', async () => {
        const mockData = {
            AbstractText: 'JavaScript is a programming language.',
            Answer: '',
            RelatedTopics: [],
        };
        vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(mockFetchResponse(mockData));

        const result = await WebSearchService.search('javascript');
        expect(result).toContain('Abstract: JavaScript is a programming language.');
    });

    it('returns formatted results with answer', async () => {
        const mockData = {
            AbstractText: '',
            Answer: '42',
            RelatedTopics: [],
        };
        vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(mockFetchResponse(mockData));

        const result = await WebSearchService.search('meaning of life');
        expect(result).toContain('Answer: 42');
    });

    it('includes related topics (up to 4)', async () => {
        const mockData = {
            AbstractText: '',
            Answer: '',
            RelatedTopics: [
                { Text: 'Topic 1' },
                { Text: 'Topic 2' },
                { Text: 'Topic 3' },
                { Text: 'Topic 4' },
                { Text: 'Topic 5 (should be excluded)' },
            ],
        };
        vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(mockFetchResponse(mockData));

        const result = await WebSearchService.search('test');
        expect(result).toContain('• Topic 1');
        expect(result).toContain('• Topic 4');
        expect(result).not.toContain('Topic 5');
    });

    it('returns null when no relevant data in response', async () => {
        const mockData = { AbstractText: '', Answer: '', RelatedTopics: [] };
        vi.spyOn(globalThis, 'fetch').mockResolvedValue(mockFetchResponse(mockData));

        const result = await WebSearchService.search('obscure query');
        expect(result).toBeNull();
    });

    it('returns null on fetch error', async () => {
        vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Network error'));

        const result = await WebSearchService.search('test');
        expect(result).toBeNull();
    });

    it('extracts proposed topic when user responds affirmatively to assistant question', async () => {
        const mockData = {
            AbstractText: 'Season 17 of Expedition Unknown was announced for 2026.',
            Answer: '',
            RelatedTopics: [],
        };
        vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(mockFetchResponse(mockData));

        const history = [
            {
                role: 'assistant',
                content: 'Expedition Unknown is an adventure show.\n\nWould you like to know more about the upcoming season 17 of Expedition Unknown?'
            }
        ];

        const result = await WebSearchService.search('yep, interesting', 'Expedition Unknown', history);
        expect(result).toContain('Season 17 of Expedition Unknown');
    });

    it('returns null on non-OK response', async () => {
        vi.spyOn(globalThis, 'fetch').mockResolvedValue(
            mockFetchResponse('Rate limited', { ok: false, status: 429 })
        );

        const result = await WebSearchService.search('test');
        expect(result).toBeNull();
    });
});
