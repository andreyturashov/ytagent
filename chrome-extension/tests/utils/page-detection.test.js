/**
 * Tests for src/utils/page-detection.js
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { getPageType, extractPageId, getActiveTab } from '../../src/utils/page-detection.js';
import { resetChromeMocks } from '../setup.js';

describe('getPageType', () => {
    it('returns "youtube" for YouTube watch URLs', () => {
        expect(getPageType('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBe('youtube');
        expect(getPageType('https://youtube.com/watch?v=abc123')).toBe('youtube');
    });

    it('returns "generic" for YouTube non-watch pages', () => {
        expect(getPageType('https://www.youtube.com/')).toBe('generic');
        expect(getPageType('https://www.youtube.com/channel/UCxyz')).toBe('generic');
    });

    it('returns "generic" for non-YouTube URLs', () => {
        expect(getPageType('https://example.com/article')).toBe('generic');
        expect(getPageType('https://en.wikipedia.org/wiki/Test')).toBe('generic');
        expect(getPageType('https://developer.mozilla.org/en-US/docs')).toBe('generic');
    });

    it('returns "generic" for invalid URLs', () => {
        expect(getPageType('not-a-url')).toBe('generic');
        expect(getPageType('')).toBe('generic');
    });
});

describe('extractPageId', () => {
    it('extracts video ID from YouTube watch URLs', () => {
        expect(extractPageId('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
        expect(extractPageId('https://youtube.com/watch?v=abc123&t=60')).toBe('abc123');
    });

    it('returns normalized URL for generic pages', () => {
        expect(extractPageId('https://example.com/article/123')).toBe('https://example.com/article/123');
        expect(extractPageId('https://example.com/path/')).toBe('https://example.com/path');
    });

    it('strips query params and fragments for generic pages', () => {
        const result = extractPageId('https://example.com/article');
        expect(result).toBe('https://example.com/article');
        // Query params and fragments should be stripped (only origin + pathname)
        const resultWithQuery = extractPageId('https://example.com/article?foo=bar#section');
        expect(resultWithQuery).toBe('https://example.com/article');
    });

    it('returns null for invalid URLs', () => {
        expect(extractPageId('not-a-url')).toBeNull();
    });
});

describe('getActiveTab', () => {
    beforeEach(() => {
        resetChromeMocks();
    });

    it('returns active tab from last focused window', async () => {
        const mockTab = { id: 1, url: 'https://example.com', active: true };
        chrome.tabs.query.mockResolvedValueOnce([mockTab]);

        const tab = await getActiveTab();
        expect(tab).toEqual(mockTab);
        expect(chrome.tabs.query).toHaveBeenCalledWith({ active: true, lastFocusedWindow: true });
    });

    it('falls back to current window if last focused has no URL', async () => {
        const noUrlTab = { id: 1, active: true };
        const goodTab = { id: 2, url: 'https://example.com', active: true };

        chrome.tabs.query
            .mockResolvedValueOnce([noUrlTab])   // lastFocusedWindow
            .mockResolvedValueOnce([goodTab]);     // currentWindow

        const tab = await getActiveTab();
        expect(tab).toEqual(goodTab);
    });

    it('returns null when no tabs found', async () => {
        chrome.tabs.query.mockResolvedValue([]);

        const tab = await getActiveTab();
        expect(tab).toBeNull();
    });

    it('returns null on error', async () => {
        chrome.tabs.query.mockRejectedValue(new Error('Permission denied'));

        const tab = await getActiveTab();
        expect(tab).toBeNull();
    });
});
