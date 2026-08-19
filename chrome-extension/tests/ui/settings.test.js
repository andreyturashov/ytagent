/**
 * Tests for src/ui/settings.js
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { toggleProviderVisibility } from '../../src/ui/settings.js';
import { resetChromeMocks } from '../setup.js';

describe('Settings UI', () => {
    beforeEach(() => {
        resetChromeMocks();
        document.body.innerHTML = `
            <div id="ollama-settings" style="display: block;"></div>
            <div id="gemini-settings" style="display: none;"></div>
            <div id="openai-settings" style="display: none;"></div>
        `;
    });

    describe('toggleProviderVisibility', () => {
        it('shows ollama settings when provider is ollama', () => {
            toggleProviderVisibility('ollama');
            expect(document.getElementById('ollama-settings').style.display).toBe('block');
            expect(document.getElementById('gemini-settings').style.display).toBe('none');
            expect(document.getElementById('openai-settings').style.display).toBe('none');
        });

        it('shows gemini settings when provider is gemini', () => {
            toggleProviderVisibility('gemini');
            expect(document.getElementById('ollama-settings').style.display).toBe('none');
            expect(document.getElementById('gemini-settings').style.display).toBe('block');
            expect(document.getElementById('openai-settings').style.display).toBe('none');
        });

        it('shows openai settings when provider is openai', () => {
            toggleProviderVisibility('openai');
            expect(document.getElementById('ollama-settings').style.display).toBe('none');
            expect(document.getElementById('gemini-settings').style.display).toBe('none');
            expect(document.getElementById('openai-settings').style.display).toBe('block');
        });

        it('hides all for unknown provider', () => {
            toggleProviderVisibility('unknown');
            expect(document.getElementById('ollama-settings').style.display).toBe('none');
            expect(document.getElementById('gemini-settings').style.display).toBe('none');
            expect(document.getElementById('openai-settings').style.display).toBe('none');
        });
    });
});
