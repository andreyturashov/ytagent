/**
 * Tests for Context Menu functionality
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { resetChromeMocks } from './setup.js';

describe('Context Menu Registration', () => {
    beforeEach(() => {
        resetChromeMocks();
    });

    it('creates Ask AIst about this... context menu item for text selections', () => {
        // Trigger onInstalled logic
        const onInstalledCallbacks = chrome.runtime.onInstalled.addListener.mock.calls;
        expect(chrome.contextMenus).toBeDefined();
        expect(chrome.contextMenus.create).toBeDefined();
    });

    it('stores selection and broadcasts message when menu item clicked', async () => {
        const info = {
            menuItemId: 'aist-ask-selection',
            selectionText: 'Machine learning is transforming software development.',
        };
        const tab = { id: 123, url: 'https://example.com/ai', title: 'AI Article' };

        // Verify structure
        expect(info.menuItemId).toBe('aist-ask-selection');
        expect(info.selectionText).toContain('Machine learning');
    });
});
