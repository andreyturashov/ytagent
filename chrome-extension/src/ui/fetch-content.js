/**
 * Fetch Content Button UI Component
 * Manages the prominent "Get Content" / "Get Transcript" button shown
 * before content has been loaded from the page.
 */

import { getEl } from '../utils/dom.js';

const BUTTON_ID = 'fetch-content-btn';
const CONTAINER_ID = 'fetch-content-container';

/**
 * Show the fetch content button in the chat area.
 * Creates the button container if it doesn't already exist.
 * @param {boolean} isYouTube - Whether the current page is a YouTube video
 */
export function showFetchButton(isYouTube = false) {
    let container = getEl(CONTAINER_ID);

    if (!container) {
        container = document.createElement('div');
        container.id = CONTAINER_ID;
        container.className = 'fetch-content-container';

        container.innerHTML = `
            <div class="fetch-content-card">
                <div class="fetch-icon">${isYouTube ? '🎬' : '📄'}</div>
                <div class="fetch-title">${isYouTube ? 'Transcript available' : 'Page content available'}</div>
                <div class="fetch-description">${isYouTube
                    ? 'Fetch the video transcript to start asking questions about this video.'
                    : 'Extract the page content to start asking questions about this page.'
                }</div>
                <button id="${BUTTON_ID}" class="fetch-content-btn">
                    📥 ${isYouTube ? 'Get Transcript' : 'Get Page Content'}
                </button>
            </div>
        `;

        const chatContainer = getEl('chat-messages');
        const typingIndicator = getEl('typing');

        if (chatContainer && typingIndicator) {
            chatContainer.insertBefore(container, typingIndicator);
        } else if (chatContainer) {
            chatContainer.appendChild(container);
        }
    } else {
        // Update existing button text for page type
        const icon = container.querySelector('.fetch-icon');
        const title = container.querySelector('.fetch-title');
        const desc = container.querySelector('.fetch-description');
        const btn = container.querySelector(`#${BUTTON_ID}`);

        if (icon) icon.textContent = isYouTube ? '🎬' : '📄';
        if (title) title.textContent = isYouTube ? 'Transcript available' : 'Page content available';
        if (desc) desc.textContent = isYouTube
            ? 'Fetch the video transcript to start asking questions about this video.'
            : 'Extract the page content to start asking questions about this page.';
        if (btn) btn.innerHTML = `📥 ${isYouTube ? 'Get Transcript' : 'Get Page Content'}`;

        container.style.display = '';
    }
}

/**
 * Hide and remove the fetch content button.
 */
export function hideFetchButton() {
    const container = getEl(CONTAINER_ID);
    if (container) {
        container.remove();
    }
}
