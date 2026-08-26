/**
 * Tests for src/ui/transcript.js
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { openContentOverlay, closeContentOverlay, handleSaveContent } from '../../src/ui/transcript.js';
import { localDB } from '../../src/services/storage.js';
import { resetChromeMocks } from '../setup.js';

describe('Transcript / Content Overlay UI', () => {
    beforeEach(() => {
        resetChromeMocks();
        document.body.innerHTML = `
            <div id="content-overlay" class="content-overlay">
                <textarea id="content-editor"></textarea>
                <span id="content-word-count">0 words</span>
                <button id="save-content-btn">Save</button>
                <button id="resync-content-btn">🔄 Re-fetch from Page</button>
                <button id="close-content">Close</button>
            </div>
            <div id="page-status" class="status-badge">
                <span id="status-text">Detecting...</span>
            </div>
        `;
    });

    describe('openContentOverlay', () => {
        it('populates editor with page content', () => {
            openContentOverlay({ content: 'Hello world this is a test' });

            const editor = document.getElementById('content-editor');
            expect(editor.value).toBe('Hello world this is a test');
        });

        it('updates word count display', () => {
            openContentOverlay({ content: 'one two three four five' });

            const wordCount = document.getElementById('content-word-count');
            expect(wordCount.textContent).toBe('5 words');
        });

        it('shows 0 words for empty content', () => {
            openContentOverlay({ content: '' });

            const wordCount = document.getElementById('content-word-count');
            expect(wordCount.textContent).toBe('0 words');
        });

        it('handles null pageData gracefully', () => {
            openContentOverlay(null);

            const editor = document.getElementById('content-editor');
            expect(editor.value).toBe('');
        });

        it('adds open class to overlay', () => {
            openContentOverlay({ content: 'test' });

            const overlay = document.getElementById('content-overlay');
            expect(overlay.classList.contains('open')).toBe(true);
        });
    });

    describe('closeContentOverlay', () => {
        it('removes open class from overlay', () => {
            openContentOverlay({ content: 'test' });
            closeContentOverlay();

            const overlay = document.getElementById('content-overlay');
            expect(overlay.classList.contains('open')).toBe(false);
        });

        it('handles missing overlay element gracefully', () => {
            document.body.innerHTML = '';
            expect(() => closeContentOverlay()).not.toThrow();
        });
    });

    describe('handleSaveContent', () => {
        it('saves edited content to localDB', async () => {
            const saveSpy = vi.spyOn(localDB, 'savePage').mockResolvedValue({});

            document.getElementById('content-editor').value = 'Edited content here';

            const context = {
                currentPageId: 'page_123',
                currentPageData: { page_id: 'page_123', title: 'Test' },
            };

            await handleSaveContent(context);

            expect(saveSpy).toHaveBeenCalledWith(
                expect.objectContaining({
                    page_id: 'page_123',
                    content: 'Edited content here',
                })
            );

            saveSpy.mockRestore();
        });

        it('updates status to Ready when content is non-empty', async () => {
            vi.spyOn(localDB, 'savePage').mockResolvedValue({});

            document.getElementById('content-editor').value = 'Some content';

            const context = {
                currentPageId: 'page_123',
                currentPageData: { page_id: 'page_123' },
            };

            await handleSaveContent(context);

            const statusText = document.getElementById('status-text');
            expect(statusText.textContent).toBe('Ready');

            vi.restoreAllMocks();
        });

        it('updates status to No Content when content is empty', async () => {
            vi.spyOn(localDB, 'savePage').mockResolvedValue({});

            document.getElementById('content-editor').value = '';

            const context = {
                currentPageId: 'page_123',
                currentPageData: { page_id: 'page_123' },
            };

            await handleSaveContent(context);

            const statusText = document.getElementById('status-text');
            expect(statusText.textContent).toBe('No Content');

            vi.restoreAllMocks();
        });

        it('closes overlay after saving', async () => {
            vi.spyOn(localDB, 'savePage').mockResolvedValue({});

            document.getElementById('content-editor').value = 'content';
            document.getElementById('content-overlay').classList.add('open');

            const context = {
                currentPageId: 'page_123',
                currentPageData: { page_id: 'page_123' },
            };

            await handleSaveContent(context);

            const overlay = document.getElementById('content-overlay');
            expect(overlay.classList.contains('open')).toBe(false);

            vi.restoreAllMocks();
        });

        it('creates pageData if it does not exist', async () => {
            const saveSpy = vi.spyOn(localDB, 'savePage').mockResolvedValue({});

            document.getElementById('content-editor').value = 'New content';

            const context = {
                currentPageId: 'page_456',
                currentPageData: null,
            };

            await handleSaveContent(context);

            expect(saveSpy).toHaveBeenCalledWith(
                expect.objectContaining({
                    page_id: 'page_456',
                    content: 'New content',
                })
            );
            // context.currentPageData should now be set
            expect(context.currentPageData).toBeTruthy();

            saveSpy.mockRestore();
        });

        it('does nothing when currentPageId is missing', async () => {
            const saveSpy = vi.spyOn(localDB, 'savePage').mockResolvedValue({});

            const context = {
                currentPageId: null,
                currentPageData: null,
            };

            await handleSaveContent(context);

            expect(saveSpy).not.toHaveBeenCalled();

            saveSpy.mockRestore();
        });
    });
});
