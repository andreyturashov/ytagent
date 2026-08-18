/**
 * YouTube Data & Transcript Extraction Service (In-Browser)
 *
 * YouTube 2025+ uses new web component tags:
 *   - <transcript-segment-view-model> for each transcript line
 *   - <macro-markers-panel-item-view-model> as wrapper
 *   - <span class="ytAttributedStringHost ..."> for text content
 */

export class YouTubeService {
    /**
     * Fetch video metadata using YouTube's official CORS-enabled oEmbed endpoint.
     */
    static async fetchMetadata(videoId) {
        const url = `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`;
        const fallbackThumbnail = `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;

        try {
            const res = await fetch(url);
            if (res.ok) {
                const data = await res.json();
                return {
                    videoId,
                    title: data.title || `Video ${videoId}`,
                    channelTitle: data.author_name || 'YouTube Creator',
                    thumbnailUrl: data.thumbnail_url || fallbackThumbnail
                };
            }
        } catch (e) {
            console.warn('oEmbed metadata fetch failed, using fallback:', e);
        }

        return {
            videoId,
            title: `YouTube Video (${videoId})`,
            channelTitle: 'Unknown Channel',
            thumbnailUrl: fallbackThumbnail
        };
    }

    /**
     * Extracts transcript for a YouTube video directly in the browser.
     */
    static async fetchTranscript(videoId, tabId = null) {
        // Strategy 1: Direct DOM scrape via executeScript (reads already-open transcript panel)
        if (tabId && chrome.scripting) {
            try {
                const domScraped = await this._scrapeDomDirect(tabId);
                if (domScraped && domScraped.trim().length > 50) {
                    console.log(`[YT Agent] Scraped ${domScraped.length} chars directly from tab DOM`);
                    return domScraped;
                }
            } catch (err) {
                console.warn('[YT Agent] Direct DOM scrape error:', err);
            }
        }

        // Strategy 2: Content script automation (clicks "Show transcript" and reads it)
        if (tabId) {
            try {
                const domTranscript = await this._fetchFromContentScript(tabId);
                if (domTranscript && domTranscript.trim().length > 50) {
                    console.log(`[YT Agent] Extracted ${domTranscript.length} chars via content script`);
                    return domTranscript;
                }
            } catch (e) {
                console.warn('[YT Agent] Content script extraction error:', e);
            }
        }

        // Strategy 3: In-page player execution (MAIN world - reads caption tracks from movie_player)
        if (tabId && chrome.scripting) {
            try {
                const pageTranscript = await this._extractDirectFromPage(tabId);
                if (pageTranscript && pageTranscript.trim().length > 50) {
                    const parsed = this._parseTimedTextContent(pageTranscript);
                    if (parsed && parsed.length > 50) {
                        console.log(`[YT Agent] Extracted transcript via in-page movie_player`);
                        return parsed;
                    }
                }
            } catch (err) {
                console.warn('[YT Agent] In-page player extraction failed:', err);
            }
        }

        // Strategy 4: Android Innertube Client
        try {
            const innertubeTranscript = await this._fetchViaAndroidInnertube(videoId);
            if (innertubeTranscript && innertubeTranscript.trim().length > 50) {
                console.log(`[YT Agent] Extracted ${innertubeTranscript.length} chars via Android Innertube`);
                return innertubeTranscript;
            }
        } catch (err) {
            console.warn('[YT Agent] Android Innertube extraction failed:', err);
        }

        return null;
    }

    /**
     * Strategy 1: Direct DOM scrape covering both new (2025+) and legacy YouTube markup
     */
    static async _scrapeDomDirect(tabId) {
        const results = await chrome.scripting.executeScript({
            target: { tabId },
            func: () => {
                // --- NEW YOUTUBE (2025+) ---
                // <transcript-segment-view-model> contains transcript text
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
                    // Try new-style segments within the panel
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

                    // Try legacy segments within the panel
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
     * Strategy 2: Talk to content script on active tab (auto-injects if missing)
     */
    static async _fetchFromContentScript(tabId) {
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
     * Strategy 3: Execute in YouTube's MAIN world to read caption track URLs
     */
    static async _extractDirectFromPage(tabId) {
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
     * Strategy 4: Android Innertube Client
     */
    static async _fetchViaAndroidInnertube(videoId) {
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

    /**
     * Unified parser supporting XML and JSON3 caption formats
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
