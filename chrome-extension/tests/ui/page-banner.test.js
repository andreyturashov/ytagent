/**
 * Tests for src/ui/page-banner.js
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { showPageBanner } from '../../src/ui/page-banner.js';

describe('Page Banner UI', () => {
    beforeEach(() => {
        document.body.innerHTML = `
            <div id="page-banner" class="page-banner">
                <img id="page-thumb" src="" alt="thumbnail" />
                <div class="page-info">
                    <span id="page-title"></span>
                    <span id="page-source"></span>
                </div>
            </div>
        `;
    });

    describe('showPageBanner', () => {
        it('populates title, source, and thumbnail', () => {
            showPageBanner({
                title: 'Test Video Title',
                source: 'Test Channel',
                thumbnail_url: 'https://example.com/thumb.jpg',
                page_id: 'abc123',
            });

            expect(document.getElementById('page-title').textContent).toBe('Test Video Title');
            expect(document.getElementById('page-source').textContent).toBe('Test Channel');
            expect(document.getElementById('page-thumb').src).toBe('https://example.com/thumb.jpg');
        });

        it('adds visible class to banner', () => {
            showPageBanner({
                title: 'Test',
                source: '',
                thumbnail_url: '',
                page_id: 'abc',
            });

            const banner = document.getElementById('page-banner');
            expect(banner.classList.contains('visible')).toBe(true);
        });

        it('falls back to page_id when title is missing', () => {
            showPageBanner({
                title: '',
                source: '',
                thumbnail_url: '',
                page_id: 'fallback-id',
            });

            expect(document.getElementById('page-title').textContent).toBe('fallback-id');
        });

        it('falls back to "Unknown Page" when both title and page_id are missing', () => {
            showPageBanner({
                title: '',
                source: '',
                thumbnail_url: '',
                page_id: '',
            });

            expect(document.getElementById('page-title').textContent).toBe('Unknown Page');
        });

        it('handles empty source gracefully', () => {
            showPageBanner({
                title: 'Title',
                source: '',
                thumbnail_url: '',
                page_id: 'id',
            });

            expect(document.getElementById('page-source').textContent).toBe('');
        });

        it('handles empty thumbnail gracefully', () => {
            showPageBanner({
                title: 'Title',
                source: 'Source',
                thumbnail_url: '',
                page_id: 'id',
            });

            // In jsdom, setting src="" resolves to the base URL; check the attribute directly
            expect(document.getElementById('page-thumb').getAttribute('src')).toBe('');
        });

        it('handles missing DOM elements gracefully', () => {
            document.body.innerHTML = '';

            // Should not throw
            expect(() => showPageBanner({
                title: 'Test',
                source: 'Source',
                thumbnail_url: 'url',
                page_id: 'id',
            })).not.toThrow();
        });
    });
});
