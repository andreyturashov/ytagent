/**
 * Settings UI Component
 * Handles settings overlay: loading, displaying, saving, and provider switching.
 */

import { getEl } from '../utils/dom.js';
import { SettingsService } from '../services/storage.js';
import { AIService } from '../services/ai.js';

/**
 * Load user settings and populate the settings UI.
 * Returns { settings, aiService } for the caller to store.
 * @returns {Promise<{ settings: object, aiService: AIService }>}
 */
export async function initSettings() {
    let settings = await SettingsService.getSettings();
    let aiService = new AIService(settings);

    if (settings.ollamaModel === 'llama3.2' || !settings.ollamaModel) {
        settings.ollamaModel = 'qwen2.5:14b';
        await SettingsService.saveSettings(settings);
        aiService = new AIService(settings);
    }

    // Populate Settings UI
    const providerSelect = getEl('provider-select');
    const ollamaEndpointInput = getEl('ollama-endpoint');
    const ollamaModelInput = getEl('ollama-model');
    const openaiKeyInput = getEl('openai-key');
    const openaiModelSelect = getEl('openai-model');
    const geminiKeyInput = getEl('gemini-key');
    const geminiModelSelect = getEl('gemini-model');
    const webSearchToggle = getEl('web-search-toggle');

    if (providerSelect) providerSelect.value = settings.provider || 'ollama';
    if (ollamaEndpointInput) ollamaEndpointInput.value = settings.ollamaEndpoint || 'http://localhost:11434';
    if (ollamaModelInput) ollamaModelInput.value = settings.ollamaModel || 'qwen2.5:14b';
    if (openaiKeyInput) openaiKeyInput.value = settings.openaiKey || '';
    if (openaiModelSelect) openaiModelSelect.value = settings.openaiModel || 'gpt-4o-mini';
    if (geminiKeyInput) geminiKeyInput.value = settings.geminiKey || '';
    if (geminiModelSelect) geminiModelSelect.value = settings.geminiModel || 'gemini-3.6-flash';
    if (webSearchToggle) webSearchToggle.checked = settings.enableWebSearch !== false;

    toggleProviderVisibility(settings.provider || 'ollama');

    return { settings, aiService };
}

/**
 * Show/hide provider-specific settings sections.
 * @param {string} provider - 'ollama' | 'gemini' | 'openai'
 */
export function toggleProviderVisibility(provider) {
    const ollamaSettings = getEl('ollama-settings');
    const geminiSettings = getEl('gemini-settings');
    const openaiSettings = getEl('openai-settings');

    if (ollamaSettings) ollamaSettings.style.display = provider === 'ollama' ? 'block' : 'none';
    if (geminiSettings) geminiSettings.style.display = provider === 'gemini' ? 'block' : 'none';
    if (openaiSettings) openaiSettings.style.display = provider === 'openai' ? 'block' : 'none';
}

/**
 * Read settings from the UI, save them, and return the updated state.
 * @param {string|null} currentPageId - Current page ID for status badge update
 * @returns {Promise<{ settings: object, aiService: AIService }>}
 */
export async function saveSettingsHandler(currentPageId) {
    const providerSelect = getEl('provider-select');
    const ollamaEndpointInput = getEl('ollama-endpoint');
    const ollamaModelInput = getEl('ollama-model');
    const openaiKeyInput = getEl('openai-key');
    const openaiModelSelect = getEl('openai-model');
    const geminiKeyInput = getEl('gemini-key');
    const geminiModelSelect = getEl('gemini-model');
    const webSearchToggle = getEl('web-search-toggle');

    const updated = {
        provider: providerSelect?.value || 'ollama',
        ollamaEndpoint: ollamaEndpointInput?.value.trim() || 'http://localhost:11434',
        ollamaModel: ollamaModelInput?.value.trim() || 'qwen2.5:14b',
        openaiKey: openaiKeyInput?.value.trim() || '',
        openaiModel: openaiModelSelect?.value || 'gpt-4o-mini',
        geminiKey: geminiKeyInput?.value.trim() || '',
        geminiModel: geminiModelSelect?.value || 'gemini-3.6-flash',
        enableWebSearch: Boolean(webSearchToggle ? webSearchToggle.checked : true)
    };

    await SettingsService.saveSettings(updated);
    const aiService = new AIService(updated);
    getEl('settings-overlay')?.classList.remove('open');

    // Update status badge
    const { updateStatus } = await import('./status.js');
    if (!aiService.isConfigured()) {
        updateStatus('warning', updated.provider === 'ollama' ? 'Start Ollama' : 'Set API Key');
    } else if (currentPageId) {
        updateStatus('active', 'Ready');
    }

    return { settings: updated, aiService };
}

/**
 * Handle auto-detection of Ollama models.
 * @param {HTMLElement} btn - The detect button element
 */
export async function handleDetectOllamaModels(btn) {
    const endpointInput = getEl('ollama-endpoint');
    const endpoint = (endpointInput?.value || 'http://localhost:11434').trim();
    const originalText = btn.textContent;
    btn.textContent = '⏳ Checking...';
    btn.disabled = true;

    try {
        const models = await AIService.fetchOllamaModels(endpoint);
        const dataList = getEl('ollama-models-list');
        const modelInput = getEl('ollama-model');

        if (models.length > 0) {
            if (dataList) {
                dataList.innerHTML = models.map(m => `<option value="${m}">${m}</option>`).join('');
            }
            if (modelInput && (!modelInput.value || !models.includes(modelInput.value))) {
                modelInput.value = models[0];
            }
            btn.textContent = `✅ ${models.length} model(s) found`;
        } else {
            btn.textContent = '⚠️ No models found (pull one via ollama pull)';
        }
    } catch (err) {
        console.warn('Ollama detect error:', err);
        btn.textContent = '❌ Ollama offline';
    } finally {
        setTimeout(() => {
            btn.textContent = originalText;
            btn.disabled = false;
        }, 3000);
    }
}
