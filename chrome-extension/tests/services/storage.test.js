/**
 * Tests for src/services/storage.js
 * Note: IndexedDB is hard to mock in jsdom, so we test SettingsService (chrome.storage.local)
 * and verify LocalDB method signatures exist.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { SettingsService, localDB } from '../../src/services/storage.js';
import { resetChromeMocks } from '../setup.js';

describe('SettingsService', () => {
    beforeEach(() => {
        resetChromeMocks();
    });

    it('getSettings returns defaults', async () => {
        const settings = await SettingsService.getSettings();
        expect(settings.enableWebSearch).toBe(true);
        expect(settings.systemPrompt).toContain('AI assistant');
    });

    it('saveSettings persists data', async () => {
        await SettingsService.saveSettings({ enableWebSearch: false, systemPrompt: 'Custom prompt' });

        // Subsequent getSettings should reflect saved values
        const settings = await SettingsService.getSettings();
        expect(settings.enableWebSearch).toBe(false);
        expect(settings.systemPrompt).toBe('Custom prompt');
    });

    it('saveSettings overwrites previous values', async () => {
        await SettingsService.saveSettings({ enableWebSearch: false });
        await SettingsService.saveSettings({ enableWebSearch: true });

        const settings = await SettingsService.getSettings();
        expect(settings.enableWebSearch).toBe(true);
    });
});

describe('LocalDB', () => {
    it('has getPage method', () => {
        expect(typeof localDB.getPage).toBe('function');
    });

    it('has savePage method', () => {
        expect(typeof localDB.savePage).toBe('function');
    });

    it('has getMessages method', () => {
        expect(typeof localDB.getMessages).toBe('function');
    });

    it('has addMessage method', () => {
        expect(typeof localDB.addMessage).toBe('function');
    });

    it('has getAllMessages method', () => {
        expect(typeof localDB.getAllMessages).toBe('function');
    });

    it('has clearMessages method', () => {
        expect(typeof localDB.clearMessages).toBe('function');
    });
});
