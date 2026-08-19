/**
 * Transcript / Content Overlay UI Component
 * Handles the content viewer/editor overlay for viewing and editing extracted page content.
 */

import { getEl } from '../utils/dom.js';
import { localDB } from '../services/storage.js';
import { ContentExtractorService } from '../services/content-extractor.js';
import { updateStatus } from './status.js';

/**
 * Open the content overlay and populate it with current page data.
 * @param {object|null} pageData - Current page data record
 */
export function openContentOverlay(pageData) {
    const editor = getEl('content-editor');
    const wordCount = getEl('content-word-count');
    const text = pageData?.content || '';

    if (editor) editor.value = text;
    if (wordCount) {
        const words = text.trim() ? text.trim().split(/\s+/).length : 0;
        wordCount.textContent = `${words.toLocaleString()} words`;
    }
    getEl('content-overlay')?.classList.add('open');
}

/**
 * Close the content overlay.
 */
export function closeContentOverlay() {
    getEl('content-overlay')?.classList.remove('open');
}

/**
 * Re-fetch content from the current page.
 * @param {object} context - Shared application state
 * @param {string} context.currentPageId
 * @param {object} context.currentPageData
 * @param {object} context.currentTab
 * @param {HTMLElement} btn - The resync button element
 */
export async function handleResyncContent(context, btn) {
    btn.textContent = '⏳ Fetching...';
    btn.disabled = true;

    try {
        if (context.currentPageId) {
            const { getActiveTab } = await import('../utils/page-detection.js');
            const tab = context.currentTab || await getActiveTab();

            const fresh = await ContentExtractorService.extractContent(
                context.currentPageId,
                tab?.id,
                tab?.url || ''
            );

            if (fresh) {
                if (!context.currentPageData) {
                    context.currentPageData = { page_id: context.currentPageId };
                }
                context.currentPageData.content = fresh;
                await localDB.savePage(context.currentPageData);

                const editor = getEl('content-editor');
                if (editor) editor.value = fresh;

                const wordCount = getEl('content-word-count');
                if (wordCount) {
                    const words = fresh.trim().split(/\s+/).length;
                    wordCount.textContent = `${words.toLocaleString()} words`;
                }
                updateStatus('active', 'Ready');
            }
        }
    } finally {
        btn.textContent = '🔄 Re-fetch from Page';
        btn.disabled = false;
    }
}

/**
 * Save manually edited content from the overlay.
 * @param {object} context - Shared application state
 * @param {string} context.currentPageId
 * @param {object} context.currentPageData
 */
export async function handleSaveContent(context) {
    const editor = getEl('content-editor');
    const text = editor?.value?.trim() || '';

    if (context.currentPageId) {
        if (!context.currentPageData) {
            context.currentPageData = { page_id: context.currentPageId };
        }
        context.currentPageData.content = text;
        await localDB.savePage(context.currentPageData);

        if (text.length > 0) {
            updateStatus('active', 'Ready');
        } else {
            updateStatus('warning', 'No Content');
        }
    }
    closeContentOverlay();
}
