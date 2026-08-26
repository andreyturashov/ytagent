/**
 * Tests for src/ui/fetch-content.js
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { showFetchButton, hideFetchButton } from '../../src/ui/fetch-content.js';

describe('Fetch Content UI', () => {
    beforeEach(() => {
        document.body.innerHTML = `
            <div id="chat-messages">
                <div class="message-row assistant">
                    <div class="message-bubble">Welcome</div>
                </div>
                <div id="typing" class="message-row assistant typing-row">
                    <div class="typing-indicator"></div>
                </div>
            </div>
        `;
    });

    describe('showFetchButton', () => {
        it('creates fetch content container and button', () => {
            showFetchButton(false);

            const container = document.getElementById('fetch-content-container');
            expect(container).not.toBeNull();

            const btn = document.getElementById('fetch-content-btn');
            expect(btn).not.toBeNull();
            expect(btn.textContent).toContain('Get Page Content');
        });

        it('uses YouTube-specific copy when isYouTube is true', () => {
            showFetchButton(true);

            const icon = document.querySelector('.fetch-icon');
            const title = document.querySelector('.fetch-title');
            const btn = document.getElementById('fetch-content-btn');

            expect(icon.textContent).toBe('🎬');
            expect(title.textContent).toContain('Transcript');
            expect(btn.textContent).toContain('Get Transcript');
        });

        it('uses generic page copy when isYouTube is false', () => {
            showFetchButton(false);

            const icon = document.querySelector('.fetch-icon');
            const title = document.querySelector('.fetch-title');
            const desc = document.querySelector('.fetch-description');

            expect(icon.textContent).toBe('📄');
            expect(title.textContent).toContain('Page content');
            expect(desc.textContent).toContain('Extract the page content');
        });

        it('inserts container before typing indicator', () => {
            showFetchButton(false);

            const chatMessages = document.getElementById('chat-messages');
            const children = Array.from(chatMessages.children);
            const containerIdx = children.findIndex(el => el.id === 'fetch-content-container');
            const typingIdx = children.findIndex(el => el.id === 'typing');

            expect(containerIdx).toBeLessThan(typingIdx);
        });

        it('updates existing button when called again', () => {
            showFetchButton(false);
            showFetchButton(true);

            // Should still only be one container
            const containers = document.querySelectorAll('#fetch-content-container');
            expect(containers.length).toBe(1);

            // Should now show YouTube copy
            const btn = document.getElementById('fetch-content-btn');
            expect(btn.textContent).toContain('Get Transcript');
        });

        it('appends to chat container when typing indicator is missing', () => {
            document.body.innerHTML = `
                <div id="chat-messages">
                    <div class="message-row">Welcome</div>
                </div>
            `;

            showFetchButton(false);

            const container = document.getElementById('fetch-content-container');
            expect(container).not.toBeNull();
            expect(container.parentElement.id).toBe('chat-messages');
        });
    });

    describe('hideFetchButton', () => {
        it('removes the fetch content container', () => {
            showFetchButton(false);
            expect(document.getElementById('fetch-content-container')).not.toBeNull();

            hideFetchButton();
            expect(document.getElementById('fetch-content-container')).toBeNull();
        });

        it('does nothing when container does not exist', () => {
            // Should not throw
            expect(() => hideFetchButton()).not.toThrow();
        });
    });
});
