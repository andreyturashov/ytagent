/**
 * Tests for src/services/content-extractor.js
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ContentExtractorService } from '../../src/services/content-extractor.js';
import { resetChromeMocks, mockFetchResponse } from '../setup.js';

describe('ContentExtractorService', () => {
    describe('getPageType', () => {
        it('returns "youtube" for YouTube watch URLs', () => {
            expect(ContentExtractorService.getPageType('https://www.youtube.com/watch?v=abc')).toBe('youtube');
        });

        it('returns "generic" for non-YouTube URLs', () => {
            expect(ContentExtractorService.getPageType('https://example.com')).toBe('generic');
        });
    });

    describe('extractPageId', () => {
        it('returns video ID for YouTube', () => {
            expect(ContentExtractorService.extractPageId('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
        });

        it('returns normalized URL for generic pages', () => {
            expect(ContentExtractorService.extractPageId('https://example.com/article')).toBe('https://example.com/article');
        });
    });

    describe('extractMetadata', () => {
        beforeEach(() => {
            vi.restoreAllMocks();
            resetChromeMocks();
        });

        it('fetches YouTube metadata via oEmbed', async () => {
            const oembedData = {
                title: 'Test Video',
                author_name: 'Test Channel',
                thumbnail_url: 'https://i.ytimg.com/vi/abc/hqdefault.jpg',
            };
            vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(mockFetchResponse(oembedData));

            const meta = await ContentExtractorService.extractMetadata('abc123', null, 'https://www.youtube.com/watch?v=abc123');
            expect(meta.title).toBe('Test Video');
            expect(meta.source).toBe('Test Channel');
            expect(meta.pageId).toBe('abc123');
        });

        it('returns fallback metadata when oEmbed fails', async () => {
            vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new Error('Network error'));

            const meta = await ContentExtractorService.extractMetadata('abc123', null, 'https://www.youtube.com/watch?v=abc123');
            expect(meta.title).toContain('abc123');
            expect(meta.pageId).toBe('abc123');
        });

        it('extracts generic page metadata via executeScript', async () => {
            chrome.scripting.executeScript.mockResolvedValueOnce([{
                result: {
                    title: 'Article Title',
                    description: 'An article about testing',
                    thumbnail: 'https://example.com/og.png',
                    siteName: 'Example',
                }
            }]);

            const meta = await ContentExtractorService.extractMetadata(
                'https://example.com/article',
                42,
                'https://example.com/article'
            );
            expect(meta.title).toBe('Article Title');
            expect(meta.source).toBe('Example');
            expect(meta.thumbnailUrl).toBe('https://example.com/og.png');
        });

        it('returns fallback for generic pages without tab', async () => {
            const meta = await ContentExtractorService.extractMetadata(
                'https://example.com/article',
                null,
                'https://example.com/article'
            );
            expect(meta.source).toBe('example.com');
            expect(meta.pageId).toBe('https://example.com/article');
        });
    });

    describe('_parseTimedTextContent', () => {
        it('parses JSON3 caption format', () => {
            const json = JSON.stringify({
                events: [
                    { segs: [{ utf8: 'Hello ' }] },
                    { segs: [{ utf8: 'world' }] },
                ]
            });
            const result = ContentExtractorService._parseTimedTextContent(json);
            expect(result).toBe('Hello world');
        });

        it('skips newline-only segments in JSON3', () => {
            const json = JSON.stringify({
                events: [
                    { segs: [{ utf8: 'Hello' }] },
                    { segs: [{ utf8: '\n' }] },
                    { segs: [{ utf8: 'world' }] },
                ]
            });
            const result = ContentExtractorService._parseTimedTextContent(json);
            expect(result).toBe('Hello world');
        });

        it('parses XML caption format with <text> tags', () => {
            const xml = `<?xml version="1.0" encoding="utf-8"?>
                <transcript>
                    <text start="0" dur="5">Hello there</text>
                    <text start="5" dur="3">General Kenobi</text>
                </transcript>`;
            const result = ContentExtractorService._parseTimedTextContent(xml);
            expect(result).toContain('Hello there');
            expect(result).toContain('General Kenobi');
        });

        it('returns null for empty input', () => {
            expect(ContentExtractorService._parseTimedTextContent('')).toBeNull();
            expect(ContentExtractorService._parseTimedTextContent(null)).toBeNull();
            expect(ContentExtractorService._parseTimedTextContent('   ')).toBeNull();
        });

        it('returns null for unparseable content', () => {
            expect(ContentExtractorService._parseTimedTextContent('random garbage')).toBeNull();
        });
    });

    describe('_decodeHtml', () => {
        it('decodes HTML entities', () => {
            expect(ContentExtractorService._decodeHtml('&amp;')).toBe('&');
            expect(ContentExtractorService._decodeHtml('&lt;')).toBe('<');
            expect(ContentExtractorService._decodeHtml('&gt;')).toBe('>');
            expect(ContentExtractorService._decodeHtml('&quot;')).toBe('"');
            expect(ContentExtractorService._decodeHtml('&#39;')).toBe("'");
            expect(ContentExtractorService._decodeHtml('&apos;')).toBe("'");
        });

        it('replaces newlines with spaces', () => {
            expect(ContentExtractorService._decodeHtml('line1\nline2')).toBe('line1 line2');
        });

        it('handles multiple entities in one string', () => {
            expect(ContentExtractorService._decodeHtml('a &amp; b &lt; c')).toBe('a & b < c');
        });
    });
});
