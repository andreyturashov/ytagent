/**
 * Chat UI Component
 * Handles message rendering, chat history, streaming, and typing indicator.
 */

import { getEl, formatMarkdown } from '../utils/dom.js';
import { localDB } from '../services/storage.js';

let isGenerating = false;

/**
 * Patterns that suggest the user is asking about their browsing history.
 */
const HISTORY_PATTERNS = [
    /\b(what|which)\s+(video|page|article|site|doc)/i,
    /\b(watched|visited|browsed|read|seen|opened)\b/i,
    /\b(yesterday|last\s+week|last\s+month|today|recently|earlier|before|ago)\b/i,
    /\b(history|remember|recall|find|search|look\s+up)\b/i,
    /\b(did\s+i|have\s+i|i\s+watched|i\s+visited|i\s+read|i\s+saw|i\s+browsed)\b/i,
    /\b(previous|past)\s+(video|page|article|session)/i,
    /\b(about\s+(?:ai|machine\s+learning|python|react|javascript|coding|programming|tutorial))\b/i,
];

/**
 * Patterns that directly request a link/URL — these are always history queries.
 */
const LINK_PATTERNS = [
    /\b(link|url)\s+(to|for|of)\b/i,
    /\b(provide|give|share|send|get)\s+(a\s+|the\s+|me\s+)*(link|url)\b/i,
    /\b(where\s+is|where\s+can\s+i\s+find)\b/i,
];

/**
 * Check if a user message is asking about their browsing/watching history.
 * @param {string} message
 * @returns {boolean}
 */
function isHistoryQuery(message) {
    // Link/URL requests always trigger history lookup
    for (const pattern of LINK_PATTERNS) {
        if (pattern.test(message)) return true;
    }

    // General history queries need 2+ pattern matches
    let matchCount = 0;
    for (const pattern of HISTORY_PATTERNS) {
        if (pattern.test(message)) matchCount++;
        if (matchCount >= 2) return true;
    }
    return false;
}

/**
 * Format a timestamp into a human-readable relative date.
 * @param {number} timestamp
 * @returns {string}
 */
function formatRelativeDate(timestamp) {
    if (!timestamp) return 'unknown date';
    const now = Date.now();
    const diff = now - timestamp;
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (days === 0) return 'today';
    if (days === 1) return 'yesterday';
    if (days < 7) return `${days} days ago`;
    if (days < 30) return `${Math.floor(days / 7)} weeks ago`;

    const date = new Date(timestamp);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

/**
 * Build a browsing history context string from all stored pages.
 * Extracts keywords from the user query to filter relevant pages.
 * @param {string} userQuery
 * @returns {Promise<string>}
 */
async function buildHistoryContext(userQuery) {
    try {
        const allPages = await localDB.getAllPages();
        if (!allPages || allPages.length === 0) return '';

        // Extract meaningful keywords from query (skip stop words)
        const stopWords = new Set([
            'what', 'which', 'did', 'i', 'do', 'the', 'a', 'an', 'is', 'was', 'were',
            'have', 'has', 'had', 'about', 'that', 'this', 'with', 'from', 'for',
            'and', 'or', 'but', 'not', 'my', 'me', 'can', 'you', 'tell', 'show',
            'find', 'search', 'look', 'up', 'watched', 'visited', 'read', 'saw',
            'browsed', 'opened', 'video', 'page', 'article', 'site', 'remember',
            'yesterday', 'today', 'recently', 'last', 'week', 'month', 'ago',
            'any', 'some', 'all', 'how', 'when', 'where', 'why', 'please',
        ]);
        const queryWords = userQuery.toLowerCase()
            .replace(/[^a-z0-9\s]/g, ' ')
            .split(/\s+/)
            .filter(w => w.length > 2 && !stopWords.has(w));

        // Score and rank pages by relevance
        const scored = allPages.map(page => {
            let score = 0;
            const titleLower = (page.title || '').toLowerCase();
            const sourceLower = (page.source || '').toLowerCase();
            const contentLower = (page.content || '').toLowerCase().slice(0, 5000);

            for (const word of queryWords) {
                if (titleLower.includes(word)) score += 3;
                if (sourceLower.includes(word)) score += 2;
                if (contentLower.includes(word)) score += 1;
            }

            // Boost recent pages
            const ageHours = (Date.now() - (page.updated_at || 0)) / (1000 * 60 * 60);
            if (ageHours < 24) score += 2;
            else if (ageHours < 168) score += 1; // within a week

            return { page, score };
        });

        // Sort by score descending, then by recency
        scored.sort((a, b) => b.score - a.score || (b.page.updated_at || 0) - (a.page.updated_at || 0));

        // Take top results (keyword-matched + recent)
        const keywordMatches = scored.filter(s => s.score > 0).slice(0, 15);
        const recentFallback = scored.slice(0, 10);
        const topResults = keywordMatches.length > 0 ? keywordMatches : recentFallback;

        // Format as context string
        const lines = topResults.map(({ page, score }) => {
            const date = formatRelativeDate(page.updated_at || page.created_at);
            const type = page.page_type === 'youtube' ? 'YouTube Video' :
                page.page_type === 'article' ? 'Article' : 'Web Page';
            const source = page.source ? ` | By: ${page.source}` : '';
            const url = page.source_url ? ` | URL: ${page.source_url}` : '';
            return `- [${type}] "${page.title || 'Untitled'}"${source} | Visited: ${date}${url}`;
        });

        return lines.join('\n');
    } catch (e) {
        console.warn('Failed to build history context:', e);
        return '';
    }
}

/**
 * Check if the chat is currently generating a response.
 * @returns {boolean}
 */
export function getIsGenerating() {
    return isGenerating;
}

/**
 * Append a message bubble to the chat feed.
 * @param {'user' | 'assistant'} sender
 * @param {string} text - Message content (markdown)
 * @param {boolean} isError - Whether to style as error
 * @returns {HTMLElement|null} The message bubble element (for streaming updates)
 */
export function appendMessage(sender, text, isError = false) {
    const container = getEl('chat-messages');
    const indicator = getEl('typing');
    if (!container) return null;

    const messageRow = document.createElement('div');
    messageRow.className = `message-row ${sender.toLowerCase()} ${isError ? 'error' : ''}`;

    const senderName = document.createElement('div');
    senderName.className = 'message-sender';
    senderName.textContent = sender === 'user' ? 'You' : 'YT Agent';

    const bubble = document.createElement('div');
    bubble.className = 'message-bubble';
    bubble.innerHTML = formatMarkdown(text);

    messageRow.appendChild(senderName);
    messageRow.appendChild(bubble);

    if (indicator) {
        container.insertBefore(messageRow, indicator);
    } else {
        container.appendChild(messageRow);
    }

    container.scrollTop = container.scrollHeight;
    return bubble;
}

/**
 * Reset the chat feed to its initial state (keeps the welcome message).
 */
export function resetChatFeed() {
    const container = getEl('chat-messages');
    if (container) {
        container.querySelectorAll('.message-row:not(:first-child)').forEach(el => el.remove());
    }
}

/**
 * Toggle the typing indicator and send button state.
 * @param {boolean} generating
 */
export function setGenerating(generating) {
    isGenerating = generating;
    const sendButton = getEl('send');
    const indicator = getEl('typing');
    const container = getEl('chat-messages');

    if (sendButton) sendButton.disabled = generating;
    if (indicator) {
        if (generating) {
            indicator.classList.add('visible');
            if (container) container.scrollTop = container.scrollHeight;
        } else {
            indicator.classList.remove('visible');
        }
    }
}

/**
 * Load and render chat history for a page.
 * @param {string} pageId
 */
export async function loadChatHistory(pageId) {
    resetChatFeed();
    const history = await localDB.getMessages(pageId);

    for (const msg of history) {
        appendMessage(msg.role, msg.content, false);
    }
}

/**
 * Handle sending a message with streaming AI response.
 * @param {object} context - Shared application state
 * @param {string} context.currentPageId
 * @param {object} context.currentPageData
 * @param {object} context.currentTab
 * @param {object} context.settings
 * @param {object} context.aiService
 * @param {Function} context.detectCurrentPage - Re-detection function
 * @param {string|null} overrideText - Pre-filled message text (for quick actions)
 */
export async function handleSendMessage(context, overrideText = null) {
    if (isGenerating) return;

    const messageInput = getEl('message');
    const messageText = (overrideText || messageInput?.value || '').trim();
    if (!messageText) return;

    // If page not detected yet, re-attempt detection
    if (!context.currentPageId) {
        await context.detectCurrentPage();
    }

    if (!context.currentPageId) {
        appendMessage('assistant', 'Please open a web page first.', true);
        return;
    }

    if (!context.aiService || !context.aiService.isConfigured()) {
        const msg = context.settings?.provider === 'ollama'
            ? 'Please ensure Ollama is running at ' + (context.settings?.ollamaEndpoint || 'http://localhost:11434') + ' and a model is chosen in settings (⚙️ icon).'
            : `Please enter your ${context.settings?.provider ? context.settings.provider.toUpperCase() : 'AI'} API key in settings (⚙️ icon at the top).`;
        appendMessage('assistant', msg, true);
        getEl('settings-overlay')?.classList.add('open');
        return;
    }

    // Append and save user message
    appendMessage('user', messageText);
    await localDB.addMessage(context.currentPageId, 'user', messageText);

    if (!overrideText && messageInput) {
        messageInput.value = '';
        messageInput.style.height = '38px';
    }

    setGenerating(true);
    let assistantBubble = null;

    try {
        // Ensure content is loaded
        if ((!context.currentPageData?.content || context.currentPageData.content.trim().length === 0) && context.currentPageId) {
            const { ContentExtractorService } = await import('../services/content-extractor.js');
            const freshContent = await ContentExtractorService.extractContent(
                context.currentPageId,
                context.currentTab?.id,
                context.currentTab?.url || ''
            );
            if (freshContent) {
                if (!context.currentPageData) {
                    context.currentPageData = { page_id: context.currentPageId };
                }
                context.currentPageData.content = freshContent;
                await localDB.savePage(context.currentPageData);
                const { updateStatus } = await import('./status.js');
                updateStatus('active', 'Ready');
            }
        }

        const history = await localDB.getMessages(context.currentPageId);
        const priorHistory = history.slice(0, -1);

        // Detect history queries and build context
        let historyContext = '';
        if (isHistoryQuery(messageText)) {
            historyContext = await buildHistoryContext(messageText);
        }

        const responseText = await context.aiService.generateResponse({
            userPrompt: messageText,
            history: priorHistory,
            pageContent: context.currentPageData?.content || '',
            pageTitle: context.currentPageData?.title || '',
            pageUrl: context.currentPageData?.source_url || context.currentTab?.url || '',
            historyContext,
            onChunk: (_delta, fullText) => {
                if (!assistantBubble) {
                    setGenerating(false);
                    assistantBubble = appendMessage('assistant', fullText);
                } else {
                    assistantBubble.innerHTML = formatMarkdown(fullText);
                }
                const container = getEl('chat-messages');
                if (container) container.scrollTop = container.scrollHeight;
            }
        });

        if (!assistantBubble) {
            setGenerating(false);
            assistantBubble = appendMessage('assistant', responseText);
        } else {
            assistantBubble.innerHTML = formatMarkdown(responseText);
        }

        await localDB.addMessage(context.currentPageId, 'assistant', responseText);

    } catch (err) {
        console.error('AI Generation Error:', err);
        setGenerating(false);
        if (!assistantBubble) {
            appendMessage('assistant', `⚠️ **Error:** ${err.message}`, true);
        } else {
            assistantBubble.innerHTML = formatMarkdown(`⚠️ **Error:** ${err.message}`);
            assistantBubble.parentElement?.classList.add('error');
        }
    } finally {
        setGenerating(false);
        const container = getEl('chat-messages');
        if (container) container.scrollTop = container.scrollHeight;
    }
}
