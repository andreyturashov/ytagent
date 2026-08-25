/**
 * Tests for src/ui/settings.js
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { initSettings, checkGeminiNanoStatus, saveSettingsHandler } from '../../src/ui/settings.js';
import { AIService } from '../../src/services/ai.js';
import { resetChromeMocks } from '../setup.js';

describe('Settings UI', () => {
    beforeEach(() => {
        resetChromeMocks();
        document.body.innerHTML = `
            <div id="settings-overlay" class="settings-overlay"></div>
            <span id="nano-status-badge"></span>
            <p id="nano-status-desc"></p>
            <button id="check-nano-btn">Re-check</button>
            <textarea id="system-prompt-input"></textarea>
            <input id="web-search-toggle" type="checkbox" checked />
        `;
    });

    describe('initSettings', () => {
        it('loads settings and populates form elements', async () => {
            const { settings, aiService } = await initSettings();
            expect(settings.enableWebSearch).toBe(true);
            expect(aiService).toBeInstanceOf(AIService);
            expect(document.getElementById('web-search-toggle').checked).toBe(true);
        });
    });

    describe('checkGeminiNanoStatus', () => {
        it('updates badge to Ready when available', async () => {
            vi.spyOn(AIService, 'checkAvailability').mockResolvedValueOnce({
                available: 'readily',
                message: 'Ready'
            });

            await checkGeminiNanoStatus();
            expect(document.getElementById('nano-status-badge').textContent).toBe('🟢 Ready');
            expect(document.getElementById('nano-status-desc').textContent).toContain('active and ready');
        });

        it('updates badge to Downloading when model downloading', async () => {
            vi.spyOn(AIService, 'checkAvailability').mockResolvedValueOnce({
                available: 'after-download',
                message: 'Downloading'
            });

            await checkGeminiNanoStatus();
            expect(document.getElementById('nano-status-badge').textContent).toBe('🟡 Downloading');
            expect(document.getElementById('nano-status-desc').textContent).toContain('Model is downloading');
        });

        it('updates badge to Disabled when not available', async () => {
            vi.spyOn(AIService, 'checkAvailability').mockResolvedValueOnce({
                available: 'no',
                message: 'Disabled'
            });

            await checkGeminiNanoStatus();
            expect(document.getElementById('nano-status-badge').textContent).toBe('🔴 Disabled');
            expect(document.getElementById('nano-status-desc').textContent).toContain('flags');
        });
    });

    describe('saveSettingsHandler', () => {
        it('saves updated settings from form inputs', async () => {
            document.getElementById('system-prompt-input').value = 'Be extra concise';
            document.getElementById('web-search-toggle').checked = false;

            const { settings, aiService } = await saveSettingsHandler('page123');
            expect(settings.systemPrompt).toBe('Be extra concise');
            expect(settings.enableWebSearch).toBe(false);
            expect(aiService.enableWebSearch).toBe(false);
        });
    });
});
