/**
 * Web Search Service (Client-Side)
 * Provides instant web search results for external queries.
 */

export class WebSearchService {
    /**
     * Search DuckDuckGo Instant Answer API
     */
    static async search(query) {
        if (!query || !query.trim()) return null;

        try {
            const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(query.trim())}&format=json&no_html=1&skip_disambig=1`;
            const response = await fetch(url);

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
        } catch (err) {
            console.warn('[WebSearch] Search query failed:', err);
        }

        return null;
    }
}
