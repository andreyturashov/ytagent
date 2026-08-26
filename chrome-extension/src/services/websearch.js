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
        const userQuery = userQueryClean(query);

        const cleanTitle = (pageTitle || '').replace(/[^\w\s]/gi, ' ').replace(/\s+/g, ' ').trim();
        const shortTitle = cleanTitle ? cleanTitle.split(' ').slice(0, 4).join(' ') : '';
        const isAffirmative = /^(yes|yep|yeah|sure|ok|okay|y|interesting|tell me|more|why not|please|go on|definitely|absolutely|да|ага|давай|конечно|интересно|расскажи|подробнее)\b/i.test(userQuery);

        // Pass 1: If user is affirming an assistant proposal, search the exact proposed topic from the last question
        if (isAffirmative && history && history.length > 0) {
            const lastAssistantMsg = [...history].reverse().find(m => m.role === 'assistant');
            if (lastAssistantMsg && lastAssistantMsg.content) {
                const questionMatch = lastAssistantMsg.content.match(/([A-ZА-ЯЁ¿¡][^.!?\n]*\?)\s*$/i) ||
                                      lastAssistantMsg.content.match(/([^.!?\n]+\?)\s*$/);
                if (questionMatch) {
                    const topic = questionMatch[1]
                        .replace(/\?/g, '')
                        .replace(/^(Would you like to (?:know|learn|hear|see)?(?: more)?(?: about)?|Do you want (?:to know|to learn)?(?: more)?(?: about)?|Should I (?:explain|tell)?|Хотите (?:узнать|услышать)?(?: больше| подробнее)?(?: о| про)?|¿Te gustaría (?:saber|conocer)?(?: más)?(?: sobre)?)\s+/i, '')
                        .trim();
                    if (topic.length > 3) {
                        const targetSearch = shortTitle && !topic.toLowerCase().includes(shortTitle.toLowerCase())
                            ? `${shortTitle} ${topic}`
                            : topic;
                        const searchResults = await this.fetchDuckDuckGo(targetSearch);
                        if (searchResults) return searchResults;
                    }
                }
            }
        }

        const isShortOrAmbiguous = userQuery.length < 35 || /^(yes|no|what else|more|tell me|is there|are there|how about|and|so|why)\b/i.test(userQuery);

        // Pass 2: If pageTitle is available and query is contextual/ambiguous, search enriched query first
        if (shortTitle && isShortOrAmbiguous && !isAffirmative) {
            const contextualResults = await this.fetchDuckDuckGo(`${shortTitle} ${userQuery}`);
            if (contextualResults) return contextualResults;
        }

        // Pass 3: Try searching for the exact raw query
        const rawResults = await this.fetchDuckDuckGo(userQuery);
        if (rawResults) return rawResults;

        // Pass 4: Extract topic from prior user messages in conversation history if follow-up
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

function userQueryClean(query) {
    return (query || '').trim();
}
