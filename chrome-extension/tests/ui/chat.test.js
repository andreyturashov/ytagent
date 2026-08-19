/**
 * Tests for src/ui/chat.js
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { appendMessage, resetChatFeed, setGenerating, getIsGenerating } from '../../src/ui/chat.js';
import { resetChromeMocks } from '../setup.js';

describe('Chat UI', () => {
    beforeEach(() => {
        resetChromeMocks();
        // Set up minimal DOM structure that chat.js expects
        document.body.innerHTML = `
            <div id="chat-messages">
                <div class="message-row assistant">
                    <div class="message-sender">YT Agent</div>
                    <div class="message-bubble">Welcome message</div>
                </div>
                <div id="typing" class="message-row assistant typing-row" style="display: none;">
                    <div class="message-sender">YT Agent</div>
                    <div class="typing-indicator">
                        <div class="typing-dot"></div>
                    </div>
                </div>
            </div>
            <button id="send">Send</button>
        `;
    });

    describe('appendMessage', () => {
        it('adds a user message bubble', () => {
            appendMessage('user', 'Hello world');
            const messages = document.querySelectorAll('.message-row');
            // Welcome + typing + new message = 3
            expect(messages.length).toBe(3);
            const lastMsg = messages[1]; // inserted before typing indicator
            expect(lastMsg.classList.contains('user')).toBe(true);
            expect(lastMsg.querySelector('.message-bubble').innerHTML).toContain('Hello world');
        });

        it('adds an assistant message bubble', () => {
            appendMessage('assistant', 'I can help with that');
            const messages = document.querySelectorAll('.message-row.assistant');
            // Welcome + typing + new assistant = 3 assistant rows
            expect(messages.length).toBe(3);
        });

        it('marks error messages with error class', () => {
            appendMessage('assistant', 'Something went wrong', true);
            const errorRows = document.querySelectorAll('.message-row.error');
            expect(errorRows.length).toBe(1);
        });

        it('returns the bubble element', () => {
            const bubble = appendMessage('user', 'test');
            expect(bubble).not.toBeNull();
            expect(bubble.classList.contains('message-bubble')).toBe(true);
        });

        it('renders markdown in bubble', () => {
            const bubble = appendMessage('assistant', '**bold** text');
            expect(bubble.innerHTML).toContain('<strong>bold</strong>');
        });

        it('returns null when chat container is missing', () => {
            document.body.innerHTML = '';
            const result = appendMessage('user', 'test');
            expect(result).toBeNull();
        });
    });

    describe('resetChatFeed', () => {
        it('removes all messages except the welcome message', () => {
            appendMessage('user', 'msg1');
            appendMessage('assistant', 'msg2');

            resetChatFeed();

            const container = document.getElementById('chat-messages');
            const messages = container.querySelectorAll('.message-row');
            // Only welcome message remains (typing indicator is also removed as :not(:first-child))
            expect(messages.length).toBe(1);
        });
    });

    describe('setGenerating', () => {
        it('disables send button when generating', () => {
            setGenerating(true);
            expect(document.getElementById('send').disabled).toBe(true);
            expect(getIsGenerating()).toBe(true);
        });

        it('enables send button when not generating', () => {
            setGenerating(true);
            setGenerating(false);
            expect(document.getElementById('send').disabled).toBe(false);
            expect(getIsGenerating()).toBe(false);
        });

        it('shows typing indicator when generating', () => {
            setGenerating(true);
            const typing = document.getElementById('typing');
            expect(typing.classList.contains('visible')).toBe(true);
        });

        it('hides typing indicator when not generating', () => {
            setGenerating(true);
            setGenerating(false);
            const typing = document.getElementById('typing');
            expect(typing.classList.contains('visible')).toBe(false);
        });
    });
});
