/**
 * YT Agent Main Popup / Side Panel Controller
 * Thin orchestrator that wires up all modules and manages shared state.
 */

import { localDB } from './services/storage.js';
import { ContentExtractorService } from './services/content-extractor.js';
import { getActiveTab, extractPageId, getPageType } from './utils/page-detection.js';
import { getEl } from './utils/dom.js';
import { updateStatus } from './ui/status.js';
import { showPageBanner } from './ui/page-banner.js';
import { initSettings, toggleProviderVisibility, saveSettingsHandler, handleDetectOllamaModels } from './ui/settings.js';
import { handleSendMessage, resetChatFeed, loadChatHistory, getIsGenerating } from './ui/chat.js';
import { openContentOverlay, closeContentOverlay, handleResyncContent, handleSaveContent } from './ui/transcript.js';

// ===================================================================
// Shared Application State
// ===================================================================

let currentTab = null;
let currentPageId = null;
let currentPageData = null;
let settings = null;
let aiService = null;

/**
 * Get the current shared context object for passing to UI modules.
 */
function getContext() {
    return {
        get currentPageId() { return currentPageId; },
        get currentPageData() { return currentPageData; },
        set currentPageData(val) { currentPageData = val; },
        get currentTab() { return currentTab; },
        get settings() { return settings; },
        get aiService() { return aiService; },
        detectCurrentPage,
    };
}

// ===================================================================
// Bootstrap
// ===================================================================

async function bootstrap() {
    initEventDelegation();

    try {
        const result = await initSettings();
        settings = result.settings;
        aiService = result.aiService;
    } catch (e) {
        console.error('Failed to init settings:', e);
    }

    await detectCurrentPage();
}

// Ensure bootstrap runs regardless of document ready state
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootstrap);
} else {
    bootstrap();
}

// ===================================================================
// Page Detection
// ===================================================================

async function detectCurrentPage() {
    const tab = await getActiveTab();
    currentTab = tab;

    if (!tab || !tab.url) {
        updateStatus('inactive', 'No Tab');
        return;
    }

    try {
        const pageId = extractPageId(tab.url);
        if (!pageId) {
            updateStatus('inactive', 'No Page');
            return;
        }

        currentPageId = pageId;
        const pageType = getPageType(tab.url);
        updateStatus('warning', 'Loading...');

        // 1. Check local IndexedDB
        let pageRecord = await localDB.getPage(pageId);
        const hasCachedContent = pageRecord && pageRecord.content && pageRecord.content.trim().length > 50;

        // 2. Fetch metadata
        const meta = await ContentExtractorService.extractMetadata(pageId, tab.id, tab.url);

        // 3. Extract content if not cached
        if (!hasCachedContent) {
            const content = await ContentExtractorService.extractContent(pageId, tab.id, tab.url);

            pageRecord = {
                page_id: pageId,
                page_type: pageType,
                source_url: tab.url,
                title: meta.title || pageRecord?.title,
                source: meta.source || pageRecord?.source,
                thumbnail_url: meta.thumbnailUrl || pageRecord?.thumbnail_url,
                content: content || '',
                created_at: pageRecord?.created_at || Date.now(),
            };

            // Only persist if we got real content
            if (content && content.trim().length > 50) {
                await localDB.savePage(pageRecord);
            }
        } else {
            // Update metadata even if content is cached
            pageRecord.title = meta.title || pageRecord.title;
            pageRecord.source = meta.source || pageRecord.source;
            pageRecord.thumbnail_url = meta.thumbnailUrl || pageRecord.thumbnail_url;
        }

        currentPageData = pageRecord;

        // Update UI banner
        showPageBanner(pageRecord);

        // Update Status
        if (!pageRecord.content || pageRecord.content.trim().length < 50) {
            updateStatus('warning', 'No Content');
        } else if (!aiService || !aiService.isConfigured()) {
            updateStatus('warning', settings?.provider === 'ollama' ? 'Start Ollama' : 'Set API Key');
        } else {
            updateStatus('active', 'Ready');
        }

        // Load existing messages
        await loadChatHistory(pageId);

    } catch (err) {
        console.error('Page detection error:', err);
        updateStatus('inactive', 'Detection Error');
    }
}

// Auto-detect when user navigates to a new page
if (chrome.tabs && chrome.tabs.onUpdated) {
    chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
        if (tab.active && (changeInfo.url || changeInfo.status === 'complete')) {
            detectCurrentPage();
        }
    });
}

// ===================================================================
// Event Delegation
// ===================================================================

function initEventDelegation() {
    // 1. Click events
    document.addEventListener('click', async (e) => {
        // Send button
        if (e.target.closest('#send')) {
            e.preventDefault();
            await handleSendMessage(getContext());
            return;
        }

        // Quick action: Summarize
        if (e.target.closest('#action-summary')) {
            e.preventDefault();
            await handleSendMessage(getContext(), 'Please provide a concise, structured summary of this page with key sections and bullet points.');
            return;
        }

        // Quick action: Key Takeaways
        if (e.target.closest('#action-takeaways')) {
            e.preventDefault();
            await handleSendMessage(getContext(), 'What are the top 3-5 actionable takeaways or main lessons from this page?');
            return;
        }

        // Quick action: Clear chat
        if (e.target.closest('#action-clear')) {
            e.preventDefault();
            if (currentPageId) {
                await localDB.clearMessages(currentPageId);
                resetChatFeed();
            }
            return;
        }

        // Open content overlay (from button or status badge)
        if (e.target.closest('#action-content') || e.target.closest('#page-status')) {
            e.preventDefault();
            openContentOverlay(currentPageData);
            return;
        }

        // Close content overlay
        if (e.target.closest('#close-content')) {
            e.preventDefault();
            closeContentOverlay();
            return;
        }

        // Re-sync content from page
        if (e.target.closest('#resync-content-btn')) {
            e.preventDefault();
            const btn = e.target.closest('#resync-content-btn');
            await handleResyncContent(getContext(), btn);
            return;
        }

        // Save edited content
        if (e.target.closest('#save-content-btn')) {
            e.preventDefault();
            await handleSaveContent(getContext());
            return;
        }

        // Open settings
        if (e.target.closest('#settings-btn')) {
            e.preventDefault();
            getEl('settings-overlay')?.classList.add('open');
            return;
        }

        // Close settings
        if (e.target.closest('#close-settings')) {
            e.preventDefault();
            getEl('settings-overlay')?.classList.remove('open');
            return;
        }

        // Auto-detect Ollama models
        if (e.target.closest('#detect-ollama-models-btn')) {
            e.preventDefault();
            const btn = e.target.closest('#detect-ollama-models-btn');
            await handleDetectOllamaModels(btn);
            return;
        }

        // Save settings
        if (e.target.closest('#save-settings')) {
            e.preventDefault();
            const result = await saveSettingsHandler(currentPageId);
            settings = result.settings;
            aiService = result.aiService;
            return;
        }
    });

    // 2. Change events (Provider dropdown)
    document.addEventListener('change', (e) => {
        if (e.target && e.target.id === 'provider-select') {
            toggleProviderVisibility(e.target.value);
        }
    });

    // 3. Textarea Enter key & auto-grow
    document.addEventListener('keydown', (e) => {
        if (e.target && e.target.id === 'message') {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSendMessage(getContext());
            }
        }
    });

    document.addEventListener('input', (e) => {
        if (e.target && e.target.id === 'message') {
            const textarea = e.target;
            textarea.style.height = '38px';
            textarea.style.height = `${Math.min(textarea.scrollHeight, 90)}px`;
        }
    });
}
