/**
 * Page Detection Utilities
 * Tab queries and page identification for any website.
 */

/**
 * Determine the page type from a URL.
 * @param {string} url
 * @returns {'youtube' | 'generic'}
 */
export function getPageType(url) {
    try {
        const parsed = new URL(url);
        if (parsed.hostname.includes('youtube.com') && parsed.searchParams.has('v')) {
            return 'youtube';
        }
    } catch (e) {
        // Invalid URL
    }
    return 'generic';
}

/**
 * Extract a stable page ID from a URL.
 * - YouTube watch pages: returns the video ID (e.g., 'dQw4w9WgXcQ')
 * - Generic pages: returns a normalized URL string (origin + pathname)
 * @param {string} url
 * @returns {string|null}
 */
export function extractPageId(url) {
    try {
        const parsed = new URL(url);

        // YouTube: use video ID
        if (parsed.hostname.includes('youtube.com')) {
            const videoId = parsed.searchParams.get('v');
            if (videoId) return videoId;
        }

        // Generic: normalized URL (origin + pathname, strip trailing slash)
        return (parsed.origin + parsed.pathname).replace(/\/+$/, '');
    } catch (e) {
        return null;
    }
}

/**
 * Find the active browser tab.
 * Tries active tab in last focused window, then current window.
 * @returns {Promise<chrome.tabs.Tab|null>}
 */
export async function getActiveTab() {
    try {
        // 1. Try active tab in last focused window
        const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
        if (tab && tab.url) {
            return tab;
        }

        // 2. Try active tab in current window
        const [currTab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (currTab && currTab.url) {
            return currTab;
        }

        return null;
    } catch (e) {
        console.error('Tab query error:', e);
        return null;
    }
}
