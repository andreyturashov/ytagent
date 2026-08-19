/**
 * Content Script for Web Pages
 * Extracts content from any page. For YouTube, extracts transcripts from the DOM and player.
 *
 * YouTube 2025+ uses new web component tags:
 *   - <transcript-segment-view-model> for each transcript line
 *   - <macro-markers-panel-item-view-model> as wrapper
 *   - <span class="ytAttributedStringHost ..."> for text content
 */

// Avoid duplicate listener registration if re-injected
if (!window.__ytAgentListenerAttached) {
    window.__ytAgentListenerAttached = true;

    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        if (request.type === 'GET_PAGE_STATE') {
            const isYouTube = window.location.hostname.includes('youtube.com');

            const result = {
                title: document.title,
                url: window.location.href,
                isYouTube,
            };

            if (isYouTube) {
                const videoEl = document.querySelector('video');
                const titleEl = document.querySelector('h1.ytd-watch-metadata yt-formatted-string') || document.querySelector('h1.title');
                const channelEl = document.querySelector('ytd-channel-name yt-formatted-string a');

                result.currentTime = videoEl ? videoEl.currentTime : 0;
                result.duration = videoEl ? videoEl.duration : 0;
                result.isPaused = videoEl ? videoEl.paused : true;
                result.title = titleEl ? titleEl.innerText.trim() : document.title;
                result.channel = channelEl ? channelEl.innerText.trim() : '';
            }

            sendResponse(result);
            return true;
        }

        // Legacy support: keep EXTRACT_TRANSCRIPT for YouTube
        if (request.type === 'EXTRACT_TRANSCRIPT') {
            extractTranscript().then((transcript) => {
                sendResponse({ transcript });
            }).catch((err) => {
                sendResponse({ transcript: null, error: err.message });
            });
            return true;
        }

        // Generic page content extraction
        if (request.type === 'EXTRACT_PAGE_CONTENT') {
            try {
                const content = extractPageContent();
                sendResponse({ content });
            } catch (err) {
                sendResponse({ content: null, error: err.message });
            }
            return true;
        }
    });
}

/**
 * Extract cleaned text content from any web page.
 * Tries <article>, <main>, then falls back to <body> with noise stripped.
 */
function extractPageContent() {
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

    if (text && text.length > 0) {
        return text.slice(0, 80000);
    }

    return null;
}

// ===================================================================
// YouTube-specific transcript extraction (unchanged logic)
// ===================================================================

async function extractTranscript() {
    // 1. Check if transcript segments already exist in the DOM
    let text = readTranscriptFromDom();
    if (text) return text;

    // 2. Open the description and click "Show transcript"
    try {
        const expandBtn = document.querySelector('#expand') ||
                          document.querySelector('tp-yt-paper-button#expand') ||
                          document.querySelector('#description-inline-expander #expand') ||
                          document.querySelector('ytd-text-inline-expander #expand');
        if (expandBtn) {
            expandBtn.click();
            await wait(400);
        }

        const transcriptButton = findTranscriptButton();
        if (transcriptButton) {
            transcriptButton.click();

            for (let i = 0; i < 25; i++) {
                await wait(200);
                text = readTranscriptFromDom();
                if (text) return text;
            }
        }
    } catch (e) {
        console.warn('[YT Agent] DOM automation failed:', e);
    }

    // 3. Fallback: Try reading caption tracks from the player object
    try {
        const injectedTranscript = await extractFromInjectedScript();
        if (injectedTranscript) return injectedTranscript;
    } catch (e) {}

    return null;
}

function findTranscriptButton() {
    const ariaBtn = document.querySelector('button[aria-label*="transcript" i]') ||
                    document.querySelector('button[aria-label*="Transcript" i]');
    if (ariaBtn) return ariaBtn;

    const rendererBtn = document.querySelector('ytd-video-description-transcript-section-renderer button') ||
                        document.querySelector('ytd-structured-description-content-renderer button[aria-label*="transcript" i]');
    if (rendererBtn) return rendererBtn;

    const allButtons = document.querySelectorAll('button');
    for (const b of allButtons) {
        const txt = (b.innerText || b.textContent || '').trim().toLowerCase();
        if (txt === 'show transcript' || txt === 'transcript') {
            return b;
        }
    }

    return null;
}

function readTranscriptFromDom() {
    // === New YouTube (2025+) ===
    const newSegments = document.querySelectorAll('transcript-segment-view-model');
    if (newSegments && newSegments.length > 0) {
        const parts = [];
        for (const seg of newSegments) {
            const textEl = seg.querySelector('span[role="text"]') ||
                           seg.querySelector('span.ytAttributedStringHost') ||
                           seg.querySelector('span');
            const txt = textEl ? (textEl.innerText || textEl.textContent || '').trim() : '';
            if (txt) parts.push(txt);
        }
        if (parts.length > 0) {
            return parts.join(' ').replace(/\s+/g, ' ');
        }
    }

    const markerItems = document.querySelectorAll('macro-markers-panel-item-view-model');
    if (markerItems && markerItems.length > 0) {
        const parts = [];
        for (const item of markerItems) {
            const seg = item.querySelector('transcript-segment-view-model');
            if (seg) {
                const textEl = seg.querySelector('span[role="text"]') ||
                               seg.querySelector('span.ytAttributedStringHost') ||
                               seg.querySelector('span');
                const txt = textEl ? (textEl.innerText || textEl.textContent || '').trim() : '';
                if (txt) parts.push(txt);
            }
        }
        if (parts.length > 0) {
            return parts.join(' ').replace(/\s+/g, ' ');
        }
    }

    // === Legacy YouTube ===
    const legacySegments = document.querySelectorAll('ytd-transcript-segment-renderer .segment-text');
    if (legacySegments && legacySegments.length > 0) {
        const parts = [];
        legacySegments.forEach(el => {
            const t = (el.innerText || el.textContent || '').trim();
            if (t) parts.push(t);
        });
        if (parts.length > 0) {
            return parts.join(' ').replace(/\s+/g, ' ');
        }
    }

    // === Broadest fallback ===
    const scrollContainer = document.querySelector('.ytSectionListRendererContents[scrollable="true"]');
    if (scrollContainer) {
        const spans = scrollContainer.querySelectorAll('span[role="text"], span.ytAttributedStringHost');
        if (spans && spans.length > 0) {
            const parts = [];
            for (const s of spans) {
                const txt = (s.innerText || s.textContent || '').trim();
                if (txt && txt.length > 1 && !txt.toLowerCase().includes('search transcript')) {
                    parts.push(txt);
                }
            }
            if (parts.length > 0) {
                return parts.join(' ').replace(/\s+/g, ' ');
            }
        }
    }

    return null;
}

function extractFromInjectedScript() {
    return new Promise((resolve) => {
        const handler = (event) => {
            if (event.source !== window || !event.data || event.data.type !== 'YT_AGENT_INJECTED_TRANSCRIPT') return;
            window.removeEventListener('message', handler);
            resolve(event.data.transcript || null);
        };

        window.addEventListener('message', handler);

        const script = document.createElement('script');
        script.textContent = `
            (async () => {
                try {
                    const moviePlayer = document.getElementById('movie_player');
                    let tracks = moviePlayer?.getPlayerResponse?.()?.captions?.playerCaptionsTracklistRenderer?.captionTracks;
                    if (!tracks || tracks.length === 0) {
                        tracks = moviePlayer?.getOption?.('captions', 'tracklist');
                    }
                    if (!tracks || tracks.length === 0) {
                        tracks = window.ytInitialPlayerResponse?.captions?.playerCaptionsTracklistRenderer?.captionTracks;
                    }

                    if (tracks && tracks.length > 0) {
                        const track = tracks.find(t => t.languageCode === 'en' || t.vssId?.includes('.en')) || tracks[0];
                        const baseUrl = track.baseUrl || track.url;
                        if (baseUrl) {
                            const res = await fetch(baseUrl);
                            if (res.ok) {
                                const xmlText = await res.text();
                                const parser = new DOMParser();
                                const xmlDoc = parser.parseFromString(xmlText, 'text/xml');
                                const nodes = xmlDoc.querySelectorAll('p, text');
                                const parts = [];
                                nodes.forEach(n => {
                                    if (n.textContent && n.textContent.trim()) {
                                        parts.push(n.textContent.trim());
                                    }
                                });
                                if (parts.length > 0) {
                                    window.postMessage({ type: 'YT_AGENT_INJECTED_TRANSCRIPT', transcript: parts.join(' ') }, '*');
                                    return;
                                }
                            }
                        }
                    }
                } catch(e) {}
                window.postMessage({ type: 'YT_AGENT_INJECTED_TRANSCRIPT', transcript: null }, '*');
            })();
        `;
        document.documentElement.appendChild(script);
        script.remove();

        setTimeout(() => {
            window.removeEventListener('message', handler);
            resolve(null);
        }, 2000);
    });
}

function wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
