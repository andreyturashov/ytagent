/**
 * Content Extraction Service
 * Multi-strategy content extractor supporting YouTube transcripts and generic page scraping.
 *
 * YouTube 2025+ uses new web component tags:
 *   - <transcript-segment-view-model> for each transcript line
 *   - <macro-markers-panel-item-view-model> as wrapper
 *   - <span class="ytAttributedStringHost ..."> for text content
 */

import { getPageType, extractPageId } from '../utils/page-detection.js';

export class ContentExtractorService {
    /**
     * Detect page type from URL.
     * @param {string} url
     * @returns {'youtube' | 'generic'}
     */
    static getPageType(url) {
        return getPageType(url);
    }

    /**
     * Generate a stable page ID from a URL.
     * @param {string} url
     * @returns {string|null}
     */
    static extractPageId(url) {
        return extractPageId(url);
    }

    /**
     * Extract page metadata (title, source, thumbnail).
     * Dispatches to YouTube oEmbed or generic page metadata extraction.
     * @param {string} pageId
     * @param {number|null} tabId
     * @param {string} url - The full page URL
     * @returns {Promise<{pageId: string, title: string, source: string, thumbnailUrl: string}>}
     */
    static async extractMetadata(pageId, tabId = null, url = '') {
        const pageType = url ? getPageType(url) : 'generic';

        if (pageType === 'youtube') {
            return this._youtubeMetadata(pageId);
        }

        return this._genericMetadata(pageId, tabId, url);
    }

    /**
     * Extract page content (transcript for YouTube, body text for other pages).
     * Tries multiple strategies in order.
     * @param {string} pageId
     * @param {number|null} tabId
     * @param {string} url - The full page URL
     * @returns {Promise<string|null>}
     */
    static async extractContent(pageId, tabId = null, url = '') {
        const pageType = url ? getPageType(url) : 'generic';

        if (pageType === 'youtube') {
            return this._youtubeExtractContent(pageId, tabId);
        }

        return this._genericExtractContent(tabId);
    }

    // ===================================================================
    // YouTube-specific metadata
    // ===================================================================

    /**
     * Fetch video metadata via YouTube's oEmbed endpoint.
     */
    static async _youtubeMetadata(videoId) {
        const oembedUrl = `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`;
        const fallbackThumbnail = `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;

        try {
            const res = await fetch(oembedUrl);
            if (res.ok) {
                const data = await res.json();
                return {
                    pageId: videoId,
                    title: data.title || `Video ${videoId}`,
                    source: data.author_name || 'YouTube Creator',
                    thumbnailUrl: data.thumbnail_url || fallbackThumbnail,
                };
            }
        } catch (e) {
            console.warn('oEmbed metadata fetch failed, using fallback:', e);
        }

        return {
            pageId: videoId,
            title: `YouTube Video (${videoId})`,
            source: 'Unknown Channel',
            thumbnailUrl: fallbackThumbnail,
        };
    }

    // ===================================================================
    // YouTube-specific content extraction (multi-strategy)
    // ===================================================================

    /**
     * Extract YouTube transcript using multiple fallback strategies.
     */
    static async _youtubeExtractContent(videoId, tabId) {
        // Strategy 1: Direct DOM scrape via executeScript
        if (tabId && chrome.scripting) {
            try {
                const domScraped = await this._youtubeScrapeDom(tabId);
                if (domScraped && domScraped.trim().length > 50) {
                    console.log(`[Content Extractor] Scraped ${domScraped.length} chars from YouTube DOM`);
                    return domScraped;
                }
            } catch (err) {
                console.warn('[Content Extractor] YouTube DOM scrape error:', err);
            }
        }

        // Strategy 2: Content script automation (clicks "Show transcript")
        if (tabId) {
            try {
                const domTranscript = await this._youtubeFetchFromContentScript(tabId);
                if (domTranscript && domTranscript.trim().length > 50) {
                    console.log(`[Content Extractor] Extracted ${domTranscript.length} chars via content script`);
                    return domTranscript;
                }
            } catch (e) {
                console.warn('[Content Extractor] Content script extraction error:', e);
            }
        }

        // Strategy 3: In-page player execution (MAIN world)
        if (tabId && chrome.scripting) {
            try {
                const pageTranscript = await this._youtubeExtractFromPlayer(tabId);
                if (pageTranscript && pageTranscript.trim().length > 50) {
                    const parsed = this._parseTimedTextContent(pageTranscript);
                    if (parsed && parsed.length > 50) {
                        console.log('[Content Extractor] Extracted transcript via in-page movie_player');
                        return parsed;
                    }
                }
            } catch (err) {
                console.warn('[Content Extractor] In-page player extraction failed:', err);
            }
        }

        // Strategy 4: Android Innertube Client
        try {
            const innertubeTranscript = await this._youtubeInnertubeApi(videoId);
            if (innertubeTranscript && innertubeTranscript.trim().length > 50) {
                console.log(`[Content Extractor] Extracted ${innertubeTranscript.length} chars via Android Innertube`);
                return innertubeTranscript;
            }
        } catch (err) {
            console.warn('[Content Extractor] Android Innertube extraction failed:', err);
        }

        return null;
    }

    /**
     * Strategy 1: Direct DOM scrape covering new (2025+) and legacy YouTube markup.
     */
    static async _youtubeScrapeDom(tabId) {
        const results = await chrome.scripting.executeScript({
            target: { tabId },
            func: () => {
                // --- NEW YOUTUBE (2025+) ---
                const newSegments = document.querySelectorAll('transcript-segment-view-model');
                if (newSegments && newSegments.length > 0) {
                    const lines = [];
                    for (const seg of newSegments) {
                        const textEl = seg.querySelector('span[role="text"]') ||
                                       seg.querySelector('span.ytAttributedStringHost') ||
                                       seg.querySelector('span');
                        const txt = textEl ? (textEl.innerText || textEl.textContent || '').trim() : '';
                        if (txt) lines.push(txt);
                    }
                    if (lines.length > 0) {
                        return lines.join(' ').replace(/\s+/g, ' ');
                    }
                }

                // Also try via wrapper elements
                const macroItems = document.querySelectorAll('macro-markers-panel-item-view-model');
                if (macroItems && macroItems.length > 0) {
                    const lines = [];
                    for (const item of macroItems) {
                        const seg = item.querySelector('transcript-segment-view-model');
                        if (seg) {
                            const textEl = seg.querySelector('span[role="text"]') ||
                                           seg.querySelector('span.ytAttributedStringHost') ||
                                           seg.querySelector('span');
                            const txt = textEl ? (textEl.innerText || textEl.textContent || '').trim() : '';
                            if (txt) lines.push(txt);
                        }
                    }
                    if (lines.length > 0) {
                        return lines.join(' ').replace(/\s+/g, ' ');
                    }
                }

                // --- ENGAGEMENT PANEL (any version) ---
                const panel = document.querySelector('ytd-engagement-panel-section-list-renderer[target-id="engagement-panel-transcript"]') ||
                              document.querySelector('#panels ytd-transcript-renderer');
                if (panel) {
                    const panelSegs = panel.querySelectorAll('transcript-segment-view-model');
                    if (panelSegs && panelSegs.length > 0) {
                        const lines = [];
                        for (const seg of panelSegs) {
                            const textEl = seg.querySelector('span[role="text"]') ||
                                           seg.querySelector('span.ytAttributedStringHost') ||
                                           seg.querySelector('span');
                            const txt = textEl ? (textEl.innerText || textEl.textContent || '').trim() : '';
                            if (txt) lines.push(txt);
                        }
                        if (lines.length > 0) {
                            return lines.join(' ').replace(/\s+/g, ' ');
                        }
                    }

                    const legacyItems = panel.querySelectorAll('yt-formatted-string.segment-text, .segment-text');
                    if (legacyItems && legacyItems.length > 0) {
                        const lines = [];
                        for (const el of legacyItems) {
                            const t = (el.innerText || el.textContent || '').trim();
                            if (t) lines.push(t);
                        }
                        if (lines.length > 0) {
                            return lines.join(' ').replace(/\s+/g, ' ');
                        }
                    }
                }

                // --- LEGACY YOUTUBE ---
                const oldSegments = document.querySelectorAll('ytd-transcript-segment-renderer .segment-text');
                if (oldSegments && oldSegments.length > 0) {
                    const lines = [];
                    oldSegments.forEach(el => {
                        const t = (el.innerText || el.textContent || '').trim();
                        if (t) lines.push(t);
                    });
                    if (lines.length > 0) {
                        return lines.join(' ').replace(/\s+/g, ' ');
                    }
                }

                return null;
            }
        });

        return results?.[0]?.result || null;
    }

    /**
     * Strategy 2: Content script message to extract transcript.
     */
    static async _youtubeFetchFromContentScript(tabId) {
        if (!tabId) return null;

        // Auto-inject content.js if needed
        if (chrome.scripting) {
            try {
                await chrome.scripting.executeScript({
                    target: { tabId },
                    files: ['content.js']
                });
            } catch (e) {}
        }

        return new Promise((resolve) => {
            chrome.tabs.sendMessage(tabId, { type: 'EXTRACT_TRANSCRIPT' }, (response) => {
                if (chrome.runtime.lastError || !response || !response.transcript) {
                    resolve(null);
                } else {
                    resolve(response.transcript);
                }
            });
        });
    }

    /**
     * Strategy 3: Execute in YouTube's MAIN world to read caption track URLs.
     */
    static async _youtubeExtractFromPlayer(tabId) {
        const results = await chrome.scripting.executeScript({
            target: { tabId },
            world: 'MAIN',
            func: async () => {
                try {
                    const moviePlayer = document.getElementById('movie_player');
                    let tracks = moviePlayer?.getPlayerResponse?.()?.captions?.playerCaptionsTracklistRenderer?.captionTracks;

                    if (!tracks || tracks.length === 0) {
                        tracks = moviePlayer?.getOption?.('captions', 'tracklist');
                    }

                    if (!tracks || tracks.length === 0) {
                        tracks = window.ytInitialPlayerResponse?.captions?.playerCaptionsTracklistRenderer?.captionTracks;
                    }

                    if (!tracks || tracks.length === 0) return null;

                    const track = tracks.find(t =>
                        t.languageCode === 'en' ||
                        t.vssId?.includes('.en') ||
                        (t.name?.simpleText && t.name.simpleText.toLowerCase().includes('english'))
                    ) || tracks[0];

                    const baseUrl = track.baseUrl || track.url;
                    if (!baseUrl) return null;

                    const response = await fetch(baseUrl);
                    return await response.text();
                } catch (e) {
                    return null;
                }
            }
        });

        return results?.[0]?.result || null;
    }

    /**
     * Strategy 4: Android Innertube Client API.
     */
    static async _youtubeInnertubeApi(videoId) {
        const apiKey = 'AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8';
        const endpoint = `https://www.youtube.com/youtubei/v1/player?key=${apiKey}`;
        const payload = {
            context: {
                client: {
                    clientName: 'ANDROID',
                    clientVersion: '20.10.38',
                    hl: 'en',
                    gl: 'US'
                }
            },
            videoId
        };

        const response = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!response.ok) return null;

        const data = await response.json();
        const captionTracks = data?.captions?.playerCaptionsTracklistRenderer?.captionTracks;
        if (!captionTracks || captionTracks.length === 0) return null;

        const track = captionTracks.find(t =>
            t.languageCode === 'en' ||
            t.vssId?.includes('.en') ||
            (t.name?.simpleText && t.name.simpleText.toLowerCase().includes('english'))
        ) || captionTracks[0];

        if (!track || !track.baseUrl) return null;

        const timedTextRes = await fetch(track.baseUrl);
        if (!timedTextRes.ok) return null;

        const rawText = await timedTextRes.text();
        return this._parseTimedTextContent(rawText);
    }

    // ===================================================================
    // Generic page content extraction
    // ===================================================================

    /**
     * Extract metadata from a generic web page using executeScript.
     */
    static async _genericMetadata(pageId, tabId, url) {
        const fallback = {
            pageId,
            title: pageId,
            source: '',
            thumbnailUrl: '',
        };

        if (!tabId || !chrome.scripting) {
            try {
                const parsed = new URL(url);
                fallback.source = parsed.hostname;
            } catch (e) {}
            return fallback;
        }

        try {
            const results = await chrome.scripting.executeScript({
                target: { tabId },
                func: () => {
                    const title = document.title ||
                                  document.querySelector('meta[property="og:title"]')?.content ||
                                  document.querySelector('h1')?.innerText ||
                                  '';

                    const description = document.querySelector('meta[name="description"]')?.content ||
                                        document.querySelector('meta[property="og:description"]')?.content ||
                                        '';

                    const thumbnail = document.querySelector('meta[property="og:image"]')?.content ||
                                      document.querySelector('link[rel="icon"]')?.href ||
                                      '';

                    const siteName = document.querySelector('meta[property="og:site_name"]')?.content ||
                                     window.location.hostname;

                    return { title, description, thumbnail, siteName };
                }
            });

            const meta = results?.[0]?.result;
            if (meta) {
                return {
                    pageId,
                    title: meta.title || pageId,
                    source: meta.siteName || '',
                    thumbnailUrl: meta.thumbnail || '',
                    description: meta.description || '',
                };
            }
        } catch (err) {
            console.warn('[Content Extractor] Generic metadata extraction failed:', err);
        }

        try {
            const parsed = new URL(url);
            fallback.source = parsed.hostname;
        } catch (e) {}
        return fallback;
    }

    /**
     * Extract main content from a generic web page.
     * Tries <article>, <main>, then falls back to <body> with noise stripped.
     */
    static async _genericExtractContent(tabId) {
        if (!tabId || !chrome.scripting) return null;

        try {
            const results = await chrome.scripting.executeScript({
                target: { tabId },
                func: () => {
                    // Helper: strip elements that are typically navigation/boilerplate
                    function cleanNode(container) {
                        const clone = container.cloneNode(true);
                        const removeSelectors = [
                            'nav', 'header', 'footer', 'aside',
                            'script', 'style', 'noscript', 'iframe',
                            '[role="navigation"]', '[role="banner"]',
                            '[role="complementary"]', '[role="contentinfo"]',
                            '.sidebar', '.nav', '.menu', '.footer', '.header',
                            '.ad', '.advertisement', '.social-share',
                            '#cookie-banner', '.cookie-notice',
                        ];
                        for (const sel of removeSelectors) {
                            clone.querySelectorAll(sel).forEach(el => el.remove());
                        }
                        return clone;
                    }

                    // 1. Try <article> element
                    const article = document.querySelector('article');
                    if (article) {
                        const cleaned = cleanNode(article);
                        const text = cleaned.innerText?.trim();
                        if (text && text.length > 100) return text;
                    }

                    // 2. Try <main> element
                    const main = document.querySelector('main, [role="main"]');
                    if (main) {
                        const cleaned = cleanNode(main);
                        const text = cleaned.innerText?.trim();
                        if (text && text.length > 100) return text;
                    }

                    // 3. Fallback: body with noise stripped
                    const cleaned = cleanNode(document.body);
                    const text = cleaned.innerText?.trim();

                    // Truncate to ~80K chars to avoid overwhelming the AI context
                    if (text && text.length > 0) {
                        return text.slice(0, 80000);
                    }

                    return null;
                }
            });

            return results?.[0]?.result || null;
        } catch (err) {
            console.warn('[Content Extractor] Generic content extraction failed:', err);
            return null;
        }
    }

    // ===================================================================
    // Shared parsers
    // ===================================================================

    /**
     * Unified parser supporting XML and JSON3 caption formats.
     */
    static _parseTimedTextContent(rawContent) {
        if (!rawContent || !rawContent.trim()) return null;
        const trimmed = rawContent.trim();

        // JSON format
        if (trimmed.startsWith('{')) {
            try {
                const json = JSON.parse(trimmed);
                if (json.events && Array.isArray(json.events)) {
                    const segments = [];
                    for (const event of json.events) {
                        if (event.segs && Array.isArray(event.segs)) {
                            for (const seg of event.segs) {
                                if (seg.utf8 && seg.utf8.trim() && seg.utf8 !== '\n') {
                                    segments.push(seg.utf8.trim());
                                }
                            }
                        }
                    }
                    if (segments.length > 0) {
                        return segments.join(' ').replace(/\s+/g, ' ');
                    }
                }
            } catch (e) {}
        }

        // XML format (<p> or <text> tags)
        try {
            const parser = new DOMParser();
            const xmlDoc = parser.parseFromString(trimmed, 'text/xml');

            for (const tagName of ['p', 'text']) {
                const nodes = xmlDoc.getElementsByTagName(tagName);
                if (nodes && nodes.length > 0) {
                    const snippets = [];
                    for (let i = 0; i < nodes.length; i++) {
                        const text = nodes[i].textContent;
                        if (text && text.trim()) {
                            snippets.push(this._decodeHtml(text.trim()));
                        }
                    }
                    if (snippets.length > 0) {
                        return snippets.join(' ').replace(/\s+/g, ' ');
                    }
                }
            }
        } catch (e) {}

        return null;
    }

    /**
     * Decode common HTML entities.
     */
    static _decodeHtml(str) {
        return str
            .replace(/&amp;/g, '&')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&quot;/g, '"')
            .replace(/&#39;/g, "'")
            .replace(/&apos;/g, "'")
            .replace(/\n/g, ' ');
    }
}
