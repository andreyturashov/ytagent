/**
 * Page Banner UI Component
 * Renders the page info banner (title, source, thumbnail).
 */

import { getEl } from '../utils/dom.js';

/**
 * Display the page info banner.
 * @param {object} record - Page data record
 * @param {string} record.title - Page title
 * @param {string} record.source - Source name (channel for YT, hostname for generic)
 * @param {string} record.thumbnail_url - Thumbnail/favicon URL
 * @param {string} record.page_id - Page identifier
 */
export function showPageBanner(record) {
    const thumbEl = getEl('page-thumb');
    const titleEl = getEl('page-title');
    const sourceEl = getEl('page-source');
    const bannerEl = getEl('page-banner');

    if (thumbEl) thumbEl.src = record.thumbnail_url || '';
    if (titleEl) titleEl.textContent = record.title || record.page_id || 'Unknown Page';
    if (sourceEl) sourceEl.textContent = record.source || '';
    if (bannerEl) bannerEl.classList.add('visible');
}
