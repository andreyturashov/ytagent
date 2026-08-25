/**
 * Settings UI Component
 * Handles settings overlay: Gemini Nano status check, system prompt, and web search toggle.
 */

import { getEl } from '../utils/dom.js';
import { SettingsService } from '../services/storage.js';
import { AIService } from '../services/ai.js';

/**
 * Load user settings and check Gemini Nano availability.
 * Returns { settings, aiService } for the caller to store.
 * @returns {Promise<{ settings: object, aiService: AIService }>}
 */
export async function initSettings() {
    const settings = await SettingsService.getSettings();
    const aiService = new AIService(settings);

    // Populate Settings UI
    const systemPromptInput = getEl('system-prompt-input');
    const webSearchToggle = getEl('web-search-toggle');
    const saveHistoryToggle = getEl('save-history-toggle');

    if (systemPromptInput) systemPromptInput.value = settings.systemPrompt || '';
    if (webSearchToggle) webSearchToggle.checked = settings.enableWebSearch !== false;
    if (saveHistoryToggle) saveHistoryToggle.checked = settings.saveChatHistory !== false;

    // Check Gemini Nano status in background
    checkGeminiNanoStatus();

    return { settings, aiService };
}

/**
 * Check and update Gemini Nano status UI badge and description.
 */
export async function checkGeminiNanoStatus(btn = null) {
    const badge = getEl('nano-status-badge');
    const desc = getEl('nano-status-desc');
    let originalBtnText = '';

    if (btn) {
        originalBtnText = btn.innerHTML;
        btn.textContent = 'Checking...';
        btn.disabled = true;
    }

    if (badge) {
        badge.textContent = 'Checking...';
        badge.style.color = 'var(--text-muted)';
    }

    try {
        const status = await AIService.checkAvailability();

        if (badge) {
            if (status.available === 'readily') {
                badge.textContent = '🟢 Ready';
                badge.style.color = 'var(--success)';
            } else if (status.available === 'after-download') {
                badge.textContent = '🟡 Downloading';
                badge.style.color = 'var(--warning)';
            } else {
                badge.textContent = '🔴 Disabled';
                badge.style.color = 'var(--danger)';
            }
        }

        if (desc) {
            if (status.available === 'readily') {
                desc.textContent = 'Gemini Nano is active and ready for ultra-fast, private on-device analysis.';
            } else if (status.available === 'after-download') {
                desc.textContent = 'Model is downloading. Check chrome://components -> "Optimization Guide On Device Model".';
            } else {
                desc.textContent = 'To enable Gemini Nano, turn on #prompt-api-for-gemini-nano in chrome://flags and relaunch Chrome.';
            }
        }
    } catch (err) {
        if (badge) {
            badge.textContent = '⚠️ Error';
            badge.style.color = 'var(--danger)';
        }
        if (desc) {
            desc.textContent = `Status check error: ${err.message}`;
        }
    } finally {
        if (btn) {
            setTimeout(() => {
                btn.innerHTML = originalBtnText;
                btn.disabled = false;
            }, 1000);
        }
    }
}

/**
 * Read settings from the UI, save them, and return the updated state.
 * @param {string|null} currentPageId - Current page ID for status badge update
 * @returns {Promise<{ settings: object, aiService: AIService }>}
 */
export async function saveSettingsHandler(currentPageId) {
    const systemPromptInput = getEl('system-prompt-input');
    const webSearchToggle = getEl('web-search-toggle');
    const saveHistoryToggle = getEl('save-history-toggle');

    const updated = {
        systemPrompt: systemPromptInput?.value?.trim() || 'You are a helpful, direct AI assistant. Answer user questions naturally as a plain conversation. Provide short, highly useful answers, code snippets, and key information immediately without any meta-phrases like "According to the transcript", "The video says", or "Based on the article".',
        enableWebSearch: Boolean(webSearchToggle ? webSearchToggle.checked : true),
        saveChatHistory: Boolean(saveHistoryToggle ? saveHistoryToggle.checked : true)
    };

    await SettingsService.saveSettings(updated);
    const aiService = new AIService(updated);
    getEl('settings-overlay')?.classList.remove('open');

    // Update status badge
    const { updateStatus } = await import('./status.js');
    if (currentPageId) {
        updateStatus('active', 'Ready');
    }

    return { settings: updated, aiService };
}
