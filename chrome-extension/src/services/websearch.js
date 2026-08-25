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
     * Search web with intelligent query resolution and history topic extraction.
     * @param {string} query - User search query
     * @param {string} pageTitle - Contextual page title
     * @param {Array} history - Prior conversation history
     */
    static async search(query, pageTitle = '', history = []) {
        if (!query || !query.trim()) return null;
        const userQuery = query.trim();

        // Pass 1: Try searching for the exact raw query first
        const rawResults = await this.fetchDuckDuckGo(userQuery);
        if (rawResults) return rawResults;

        // Pass 2: If query is a generic follow-up (e.g. "but maybe you know?", "tell me more"), extract topic from history
        const isFollowUp = /^(but|maybe|what about|tell me|who is|do you know|and|so|why)\b/i.test(userQuery) || userQuery.length < 25;
        if (isFollowUp && history && history.length > 0) {
            const priorUserMsgs = history.filter(m => m.role === 'user').reverse();
            for (const prevMsg of priorUserMsgs) {
                const text = (prevMsg.content || '').trim();
                if (text && text !== userQuery) {
                    const topicMatch = text.replace(/^(who is|what is|tell me about|where is|how is)\s+/i, '').trim();
                    if (topicMatch && topicMatch.length > 3) {
                        const historyResults = await this.fetchDuckDuckGo(topicMatch);
                        if (historyResults) return historyResults;
                    }
                }
            }
        }

        // Pass 3: Try enriching with page title if applicable
        const cleanTitle = (pageTitle || '').replace(/[^\w\s]/gi, ' ').replace(/\s+/g, ' ').trim();
        if (cleanTitle && userQuery.length < 30) {
            const shortTitle = cleanTitle.split(' ').slice(0, 4).join(' ');
            const titleResults = await this.fetchDuckDuckGo(`${shortTitle} ${userQuery}`);
            if (titleResults) return titleResults;
        }

        return null;
    }
}
