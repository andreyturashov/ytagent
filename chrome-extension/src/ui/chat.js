/**
 * Chat UI Component
 * Handles message rendering, chat history, streaming, and typing indicator.
 */

import { getEl, formatMarkdown } from '../utils/dom.js';
import { localDB } from '../services/storage.js';

let isGenerating = false;

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

        const responseText = await context.aiService.generateResponse({
            userPrompt: messageText,
            history: priorHistory,
            pageContent: context.currentPageData?.content || '',
            pageTitle: context.currentPageData?.title || '',
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
