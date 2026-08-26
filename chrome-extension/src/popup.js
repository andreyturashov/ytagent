/**
 * AIst Main Popup / Side Panel Controller
 * Thin orchestrator that wires up all modules and manages shared state.
 */

import { localDB } from './services/storage.js';
import { MIN_CONTENT_LENGTH } from './constants.js';
import { ContentExtractorService } from './services/content-extractor.js';
import { getActiveTab, extractPageId, getPageType } from './utils/page-detection.js';
import { getEl } from './utils/dom.js';
import { updateStatus } from './ui/status.js';
import { showPageBanner } from './ui/page-banner.js';
import { initSettings, saveSettingsHandler, checkGeminiNanoStatus } from './ui/settings.js';
import { handleSendMessage, resetChatFeed, loadChatHistory, generateInitialBriefing, getIsGenerating } from './ui/chat.js';
import { openContentOverlay, closeContentOverlay, handleResyncContent, handleSaveContent } from './ui/transcript.js';
import { showFetchButton, hideFetchButton } from './ui/fetch-content.js';

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
        hideFetchButton();
        return;
    }

    try {
        const pageId = extractPageId(tab.url);
        if (!pageId) {
            updateStatus('inactive', 'No Page');
            hideFetchButton();
            return;
        }

        currentPageId = pageId;
        const pageType = getPageType(tab.url);
        updateStatus('warning', 'Loading...');

        // 1. Check local IndexedDB for cached content
        let pageRecord = await localDB.getPage(pageId);
        const hasCachedContent = pageRecord && pageRecord.content && pageRecord.content.trim().length > MIN_CONTENT_LENGTH;

        // 2. Fetch metadata only (lightweight)
        const meta = await ContentExtractorService.extractMetadata(pageId, tab.id, tab.url);

        if (!hasCachedContent) {
            // Build a minimal record with metadata only — no content extraction yet
            pageRecord = {
                page_id: pageId,
                page_type: pageType,
                source_url: tab.url,
                title: meta.title || pageRecord?.title || tab.title || 'Untitled',
                source: meta.source || pageRecord?.source || '',
                thumbnail_url: meta.thumbnailUrl || pageRecord?.thumbnail_url || '',
                content: '',
                created_at: pageRecord?.created_at || Date.now(),
            };
        } else {
            // Update metadata even if content is cached
            pageRecord.title = meta.title || pageRecord.title;
            pageRecord.source = meta.source || pageRecord.source;
            pageRecord.thumbnail_url = meta.thumbnailUrl || pageRecord.thumbnail_url;
            pageRecord.source_url = tab.url || pageRecord.source_url;
        }

        currentPageData = pageRecord;

        // Persist page metadata, URL, and timestamp in local database
        await localDB.savePage(pageRecord);

        // Update UI banner
        showPageBanner(pageRecord);

        // Update Status & show/hide fetch button
        if (!hasCachedContent) {
            const isYouTube = pageType === 'youtube';
            updateStatus('warning', isYouTube ? 'Loading Transcript…' : 'Loading Content…');
            showFetchButton(isYouTube);
            handleFetchContent();
        } else {
            updateStatus('active', 'Ready');
            hideFetchButton();
        }

        // Load existing messages or generate initial page briefing
        await loadChatHistory(pageId, settings, getContext());

    } catch (err) {
        console.error('Page detection error:', err);
        updateStatus('inactive', 'Detection Error');
        hideFetchButton();
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
// Explicit Content Fetch
// ===================================================================

async function handleFetchContent() {
    if (!currentPageId || !currentTab) return;

    const btn = getEl('fetch-content-btn');
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<span class="fetch-spinner"></span> Fetching…';
    }

    updateStatus('warning', 'Fetching…');

    try {
        const content = await ContentExtractorService.extractContent(
            currentPageId,
            currentTab.id,
            currentTab.url || ''
        );

        if (content && content.trim().length > MIN_CONTENT_LENGTH) {
            if (!currentPageData) {
                currentPageData = { page_id: currentPageId };
            }
            currentPageData.content = content;
            await localDB.savePage(currentPageData);
            hideFetchButton();
            updateStatus('active', 'Ready');

            // Trigger initial brief analysis for new page content
            await generateInitialBriefing(getContext());
        } else {
            updateStatus('warning', 'No Content Found');
            if (btn) {
                btn.disabled = false;
                const pageType = getPageType(currentTab.url || '');
                const isYouTube = pageType === 'youtube';
                btn.innerHTML = isYouTube ? '📥 Get Transcript' : '📥 Get Page Content';
            }
        }
    } catch (err) {
        console.error('Content fetch error:', err);
        updateStatus('warning', 'Fetch Failed');
        if (btn) {
            btn.disabled = false;
            btn.textContent = '⚠️ Retry';
        }
    }
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


        // Clear chat history
        if (e.target.closest('#action-clear')) {
            e.preventDefault();
            if (currentPageId) {
                await localDB.clearMessages(currentPageId);
            }
            resetChatFeed();
            await generateInitialBriefing(getContext());
            return;
        }

        // Fetch content button (the main new action)
        if (e.target.closest('#fetch-content-btn')) {
            e.preventDefault();
            await handleFetchContent();
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

        // Open Help / Setup Guide modal
        if (e.target.closest('#help-btn') || e.target.closest('#open-guide-btn')) {
            e.preventDefault();
            getEl('help-overlay')?.classList.add('open');
            return;
        }

        // Close Help / Setup Guide modal
        if (e.target.closest('#close-help') || e.target.closest('#got-it-btn')) {
            e.preventDefault();
            getEl('help-overlay')?.classList.remove('open');
            return;
        }

        // Open settings
        if (e.target.closest('#settings-btn')) {
            e.preventDefault();
            getEl('settings-overlay')?.classList.add('open');
            checkGeminiNanoStatus();
            return;
        }

        // Close settings
        if (e.target.closest('#close-settings')) {
            e.preventDefault();
            getEl('settings-overlay')?.classList.remove('open');
            return;
        }

        // Check Gemini Nano status button
        if (e.target.closest('#check-nano-btn')) {
            e.preventDefault();
            const btn = e.target.closest('#check-nano-btn');
            await checkGeminiNanoStatus(btn);
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

    // 2. Textarea Enter key & auto-grow
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
