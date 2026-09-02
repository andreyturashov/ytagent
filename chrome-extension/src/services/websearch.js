/**
 * Web Search Service (Client-Side)
 * Provides instant web search results using DuckDuckGo Instant Answer and HTML Search.
 */

export class WebSearchService {
    /**
     * Fetch search results from DuckDuckGo Instant Answer and HTML Search endpoints.
     * @param {string} term
     * @returns {Promise<string|null>}
     */
    static async fetchDuckDuckGo(term) {
        if (!term || !term.trim()) return null;
        const cleanTerm = term.trim();

        try {
            // 1. DuckDuckGo Instant Answer API
            const apiUrl = `https://api.duckduckgo.com/?q=${encodeURIComponent(cleanTerm)}&format=json&no_html=1&skip_disambig=1`;
            const response = await fetch(apiUrl);

            if (response.ok) {
                const data = await response.json();
                const snippets = [];

                if (data.AbstractText) {
                    snippets.push(`Abstract: ${data.AbstractText}`);
                }
                if (data.Answer) {
                    snippets.push(`Answer: ${data.Answer}`);
                }
                if (data.RelatedTopics && Array.isArray(data.RelatedTopics)) {
                    for (const topic of data.RelatedTopics.slice(0, 4)) {
                        if (topic.Text) {
                            snippets.push(`• ${topic.Text}`);
                        }
                    }
                }

                if (snippets.length > 0) {
                    return snippets.join('\n');
                }
            }
        } catch (_) {}

        try {
            // 2. DuckDuckGo HTML Search for organic web results
            const htmlUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(cleanTerm)}`;
            const htmlRes = await fetch(htmlUrl);
            if (htmlRes.ok) {
                const htmlText = await htmlRes.text();
                const parser = new DOMParser();
                const doc = parser.parseFromString(htmlText, 'text/html');
                const snippetNodes = doc.querySelectorAll('.result__snippet');
                const snippets = [];
                for (const node of Array.from(snippetNodes).slice(0, 5)) {
                    const txt = node.textContent?.trim();
                    if (txt && txt.length > 15) {
                        snippets.push(`• ${txt}`);
                    }
                }
                if (snippets.length > 0) {
                    return snippets.join('\n');
                }
            }
        } catch (_) {}

        return null;
    }

    /**
     * Extract the main subject from a page title (strips site suffixes, branding, parentheses).
     * @param {string} pageTitle
     * @returns {string}
     */
    static extractMainTopic(pageTitle) {
        if (!pageTitle) return '';
        let cleaned = pageTitle
            .replace(/\s*[-–—|•].*$/, '') // Remove site suffixes after separators
            .replace(/\(.*?\)/g, '')      // Remove parenthetical details
            .replace(/[^\w\s\u0400-\u04FF]/gi, ' ') // Support Latin & Cyrillic
            .replace(/\s+/g, ' ')
            .trim();
        return cleaned.split(' ').slice(0, 5).join(' ');
    }

    /**
     * Search web with intelligent query resolution and history topic extraction.
     * Always anchors queries with pronouns ("they", "it", "he") to the active topic/title.
     * @param {string} query - User search query
     * @param {string} pageTitle - Contextual page title
     * @param {Array} history - Prior conversation history
     */
    static async search(query, pageTitle = '', history = []) {
        if (!query || !query.trim()) return null;
        const userQuery = query.trim();

        const shortTitle = this.extractMainTopic(pageTitle);

        // Check if query is pronoun-heavy or referential (e.g. "Do they have...", "Where can I find it?")
        const hasPronounOrReferential = /\b(they|them|their|theirs|it|its|he|him|his|she|her|this|that|these|those|the show|the channel|the video|the author|the creator|official)\b/i.test(userQuery);
        const isFollowUpPattern = /^(yes|no|what else|more|tell me|is there|are there|how about|and|so|why|do they|does it|can i|where|who)\b/i.test(userQuery);

        // Check word overlap between query and page topic
        const titleWords = shortTitle ? shortTitle.toLowerCase().split(/\s+/).filter(w => w.length > 2) : [];
        const queryWords = userQuery.toLowerCase().split(/\s+/).filter(w => w.length > 2);
        const queryMentionsTitle = titleWords.some(w => queryWords.includes(w));

        // Detect OFF-TOPIC queries: long enough, no pronoun references, no follow-up pattern,
        // and zero word overlap with page title
        const isLikelyOffTopic = userQuery.length > 20
            && !hasPronounOrReferential
            && !isFollowUpPattern
            && !queryMentionsTitle
            && titleWords.length > 0;

        // For off-topic queries, search raw query FIRST (don't pollute with page title)
        if (isLikelyOffTopic) {
            const rawResults = await this.fetchDuckDuckGo(userQuery);
            if (rawResults) return rawResults;
        }

        // For contextual queries, enrich with page title
        const shouldEnrichWithTitle = shortTitle && (!queryMentionsTitle || hasPronounOrReferential || isFollowUpPattern);
        if (shouldEnrichWithTitle && !isLikelyOffTopic) {
            const enrichedQuery = `${shortTitle} ${userQuery}`;
            const contextualResults = await this.fetchDuckDuckGo(enrichedQuery);
            if (contextualResults) return contextualResults;
        }

        // Fallback: raw query search (for contextual queries where enriched search missed)
        if (!isLikelyOffTopic) {
            const rawResults = await this.fetchDuckDuckGo(userQuery);
            if (rawResults) return rawResults;
        }

        // Pass 3: Extract topic from conversation history if follow-up
        if (history && history.length > 0) {
            const priorUserMsgs = history.filter(m => m.role === 'user').reverse();
            for (const prevMsg of priorUserMsgs) {
                const text = (prevMsg.content || '').trim();
                if (text && text !== userQuery) {
                    const topicMatch = text.replace(/^(who is|what is|tell me about|where is|how is)\s+/i, '').trim();
                    if (topicMatch && topicMatch.length > 3) {
                        const historySearchTerm = shortTitle ? `${shortTitle} ${topicMatch}` : topicMatch;
                        const historyResults = await this.fetchDuckDuckGo(historySearchTerm);
                        if (historyResults) return historyResults;
                    }
                }
            }
        }

        return null;
    }
}
