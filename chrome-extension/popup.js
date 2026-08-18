/**
 * YT Agent Main Popup / Side Panel Controller
 */

import { localDB, SettingsService } from './services/storage.js';
import { YouTubeService } from './services/youtube.js';
import { AIService } from './services/ai.js';

let currentTab = null;
let currentVideoId = null;
let currentVideoData = null;
let settings = null;
let aiService = null;
let isGenerating = false;

// DOM Helper functions (evaluated dynamically)
const getEl = (id) => document.getElementById(id);

/**
 * Bootstrap Application
 */
async function bootstrap() {
    initEventDelegation();
    await initSettings();
    await detectCurrentVideo();
}

// Ensure bootstrap runs regardless of document ready state
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootstrap);
} else {
    bootstrap();
}

/**
 * Load user settings and configure AI Service
 */
async function initSettings() {
    try {
        settings = await SettingsService.getSettings();
        aiService = new AIService(settings);

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
    } catch (e) {
        console.error('Failed to init settings:', e);
    }
}

function toggleProviderVisibility(provider) {
    const ollamaSettings = getEl('ollama-settings');
    const geminiSettings = getEl('gemini-settings');
    const openaiSettings = getEl('openai-settings');

    if (ollamaSettings) ollamaSettings.style.display = provider === 'ollama' ? 'block' : 'none';
    if (geminiSettings) geminiSettings.style.display = provider === 'gemini' ? 'block' : 'none';
    if (openaiSettings) openaiSettings.style.display = provider === 'openai' ? 'block' : 'none';
}

/**
 * Event Delegation: Attaches listeners to `document` so they NEVER fail or get detached
 */
function initEventDelegation() {
    // 1. Click events
    document.addEventListener('click', async (e) => {
        // Send button
        if (e.target.closest('#send')) {
            e.preventDefault();
            await handleSendMessage();
            return;
        }

        // Quick action: Summarize
        if (e.target.closest('#action-summary')) {
            e.preventDefault();
            await handleSendMessage('Please provide a concise, structured summary of this video with key chapters and bullet points.');
            return;
        }

        // Quick action: Key Takeaways
        if (e.target.closest('#action-takeaways')) {
            e.preventDefault();
            await handleSendMessage('What are the top 3-5 actionable takeaways or main lessons from this video?');
            return;
        }

        // Quick action: Clear chat
        if (e.target.closest('#action-clear')) {
            e.preventDefault();
            if (currentVideoId) {
                await localDB.clearMessages(currentVideoId);
                resetChatFeed();
            }
            return;
        }

        // Open transcript modal (from button or status badge)
        if (e.target.closest('#action-transcript') || e.target.closest('#video-status')) {
            e.preventDefault();
            const editor = getEl('transcript-editor');
            const wordCount = getEl('transcript-word-count');
            const text = currentVideoData?.transcript || '';
            if (editor) editor.value = text;
            if (wordCount) {
                const words = text.trim() ? text.trim().split(/\s+/).length : 0;
                wordCount.textContent = `${words.toLocaleString()} words`;
            }
            getEl('transcript-overlay')?.classList.add('open');
            return;
        }

        // Close transcript modal
        if (e.target.closest('#close-transcript')) {
            e.preventDefault();
            getEl('transcript-overlay')?.classList.remove('open');
            return;
        }

        // Re-sync transcript from YouTube page
        if (e.target.closest('#resync-transcript-btn')) {
            e.preventDefault();
            const btn = e.target.closest('#resync-transcript-btn');
            btn.textContent = '⏳ Fetching...';
            btn.disabled = true;
            try {
                const tab = await getActiveYouTubeTab();
                if (currentVideoId) {
                    const fresh = await YouTubeService.fetchTranscript(currentVideoId, tab?.id);
                    if (fresh) {
                        if (!currentVideoData) currentVideoData = { youtube_video_id: currentVideoId };
                        currentVideoData.transcript = fresh;
                        await localDB.saveVideo(currentVideoData);
                        const editor = getEl('transcript-editor');
                        if (editor) editor.value = fresh;
                        const wordCount = getEl('transcript-word-count');
                        if (wordCount) {
                            const words = fresh.trim().split(/\s+/).length;
                            wordCount.textContent = `${words.toLocaleString()} words`;
                        }
                        updateStatus('active', 'Ready');
                    }
                }
            } finally {
                btn.textContent = '🔄 Fetch from YouTube Page';
                btn.disabled = false;
            }
            return;
        }

        // Save edited transcript
        if (e.target.closest('#save-transcript-btn')) {
            e.preventDefault();
            const editor = getEl('transcript-editor');
            const text = editor?.value?.trim() || '';
            if (currentVideoId) {
                if (!currentVideoData) currentVideoData = { youtube_video_id: currentVideoId };
                currentVideoData.transcript = text;
                await localDB.saveVideo(currentVideoData);
                if (text.length > 0) {
                    updateStatus('active', 'Ready');
                } else {
                    updateStatus('warning', 'No Transcript');
                }
            }
            getEl('transcript-overlay')?.classList.remove('open');
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
            return;
        }

        // Save settings
        if (e.target.closest('#save-settings')) {
            e.preventDefault();
            await saveSettingsHandler();
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
                handleSendMessage();
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

/**
 * Handle Save Settings
 */
async function saveSettingsHandler() {
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
    settings = updated;
    aiService = new AIService(settings);
    getEl('settings-overlay')?.classList.remove('open');

    // Update status badge
    if (!aiService.isConfigured()) {
        updateStatus('warning', settings.provider === 'ollama' ? 'Start Ollama' : 'Set API Key');
    } else if (currentVideoId) {
        updateStatus('active', 'Ready');
    }
}

/**
 * Find active YouTube video tab
 */
async function getActiveYouTubeTab() {
    try {
        // 1. Try active tab in last focused window
        const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
        if (tab && tab.url && tab.url.includes('youtube.com/watch')) {
            return tab;
        }

        // 2. Try active tab in current window
        const [currTab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (currTab && currTab.url && currTab.url.includes('youtube.com/watch')) {
            return currTab;
        }

        // 3. Fallback: Any open youtube watch tab
        const allTabs = await chrome.tabs.query({ url: '*://*.youtube.com/watch*' });
        return allTabs[0] || null;
    } catch (e) {
        console.error('Tab query error:', e);
        return null;
    }
}

/**
 * Detect active video on current tab
 */
async function detectCurrentVideo() {
    const tab = await getActiveYouTubeTab();
    currentTab = tab;

    if (!tab || !tab.url) {
        updateStatus('inactive', 'No Tab');
        return;
    }

    try {
        const url = new URL(tab.url);
        if (!url.hostname.includes('youtube.com')) {
            updateStatus('inactive', 'Not YouTube');
            return;
        }

        const videoId = url.searchParams.get('v');
        if (!videoId) {
            updateStatus('inactive', 'No Video ID');
            return;
        }

        currentVideoId = videoId;
        updateStatus('warning', 'Loading video...');

        // 1. Check local IndexedDB
        let videoRecord = await localDB.getVideo(videoId);
        const hasCachedTranscript = videoRecord && videoRecord.transcript && videoRecord.transcript.trim().length > 50;

        // 2. Fetch metadata
        const meta = await YouTubeService.fetchMetadata(videoId);

        // 3. Always try to fetch transcript if not cached (or if cached is empty/short)
        if (!hasCachedTranscript) {
            const transcript = await YouTubeService.fetchTranscript(videoId, tab.id);

            videoRecord = {
                youtube_video_id: videoId,
                title: meta.title || videoRecord?.title,
                channel_title: meta.channelTitle || videoRecord?.channel_title,
                thumbnail_url: meta.thumbnailUrl || videoRecord?.thumbnail_url,
                transcript: transcript || '',
                created_at: videoRecord?.created_at || Date.now()
            };

            // Only save to IndexedDB if we got a real transcript (avoid caching empty)
            if (transcript && transcript.trim().length > 50) {
                await localDB.saveVideo(videoRecord);
            }
        } else {
            // Update metadata even if transcript is cached
            videoRecord.title = meta.title || videoRecord.title;
            videoRecord.channel_title = meta.channelTitle || videoRecord.channel_title;
            videoRecord.thumbnail_url = meta.thumbnailUrl || videoRecord.thumbnail_url;
        }

        currentVideoData = videoRecord;

        // Update UI banner
        showVideoBanner(videoRecord);

        // Update Status
        if (!videoRecord.transcript || videoRecord.transcript.trim().length < 50) {
            updateStatus('warning', 'No Transcript');
        } else if (!aiService || !aiService.isConfigured()) {
            updateStatus('warning', settings?.provider === 'ollama' ? 'Start Ollama' : 'Set API Key');
        } else {
            updateStatus('active', 'Ready');
        }

        // Load existing messages
        await loadChatHistory(videoId);

    } catch (err) {
        console.error('Video detection error:', err);
        updateStatus('inactive', 'Detection Error');
    }
}

// Auto-detect when user navigates to a new YouTube video
if (chrome.tabs && chrome.tabs.onUpdated) {
    chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
        if (tab.active && (changeInfo.url || changeInfo.status === 'complete')) {
            detectCurrentVideo();
        }
    });
}

/**
 * Display Video banner
 */
function showVideoBanner(record) {
    const thumbEl = getEl('video-thumb');
    const titleEl = getEl('video-title');
    const channelEl = getEl('video-channel');
    const bannerEl = getEl('video-banner');

    if (thumbEl) thumbEl.src = record.thumbnail_url || '';
    if (titleEl) titleEl.textContent = record.title || `Video ${record.youtube_video_id}`;
    if (channelEl) channelEl.textContent = record.channel_title || 'YouTube Channel';
    if (bannerEl) bannerEl.classList.add('visible');
}

/**
 * Update Header Status Badge
 */
function updateStatus(state, text) {
    const badge = getEl('video-status');
    const label = getEl('status-text');
    if (!badge || !label) return;

    badge.className = 'status-badge';
    if (state === 'active') badge.classList.add('active');
    if (state === 'warning') badge.classList.add('warning');
    label.textContent = text;
}

/**
 * Load Chat History for Video
 */
async function loadChatHistory(videoId) {
    resetChatFeed();
    const history = await localDB.getMessages(videoId);

    for (const msg of history) {
        appendMessage(msg.role, msg.content, false);
    }
}

function resetChatFeed() {
    const container = getEl('chat-messages');
    if (container) {
        container.querySelectorAll('.message-row:not(:first-child)').forEach(el => el.remove());
    }
}

/**
 * Send Message Handler with Live Streaming
 */
async function handleSendMessage(overrideText = null) {
    if (isGenerating) return;

    const messageInput = getEl('message');
    const messageText = (overrideText || messageInput?.value || '').trim();
    if (!messageText) return;

    // If video not detected yet, re-attempt detection
    if (!currentVideoId) {
        await detectCurrentVideo();
    }

    if (!currentVideoId) {
        appendMessage('assistant', 'Please open a YouTube video first.', true);
        return;
    }

    if (!aiService || !aiService.isConfigured()) {
        const msg = settings?.provider === 'ollama'
            ? 'Please ensure Ollama is running at ' + (settings?.ollamaEndpoint || 'http://localhost:11434') + ' and a model is chosen in settings (⚙️ icon).'
            : `Please enter your ${settings?.provider ? settings.provider.toUpperCase() : 'AI'} API key in settings (⚙️ icon at the top).`;
        appendMessage('assistant', msg, true);
        getEl('settings-overlay')?.classList.add('open');
        return;
    }

    // Append and save user message
    appendMessage('user', messageText);
    await localDB.addMessage(currentVideoId, 'user', messageText);

    if (!overrideText && messageInput) {
        messageInput.value = '';
        messageInput.style.height = '38px';
    }

    setGenerating(true);
    let assistantBubble = null;

    try {
        // Ensure transcript is loaded
        if ((!currentVideoData?.transcript || currentVideoData.transcript.trim().length === 0) && currentVideoId) {
            const freshTranscript = await YouTubeService.fetchTranscript(currentVideoId, currentTab?.id);
            if (freshTranscript) {
                if (!currentVideoData) {
                    currentVideoData = { youtube_video_id: currentVideoId };
                }
                currentVideoData.transcript = freshTranscript;
                await localDB.saveVideo(currentVideoData);
                updateStatus('active', 'Ready');
            }
        }

        const history = await localDB.getMessages(currentVideoId);
        const priorHistory = history.slice(0, -1);

        const responseText = await aiService.generateResponse({
            userPrompt: messageText,
            history: priorHistory,
            transcript: currentVideoData?.transcript || '',
            videoTitle: currentVideoData?.title || '',
            onChunk: (_delta, fullText) => {
                if (!assistantBubble) {
                    setGenerating(false);
                    assistantBubble = appendMessage('assistant', fullText);
                } else {
                    assistantBubble.innerHTML = formatMarkdown(fullText);
                }
                const container = getEl('chat-messages');
                if (container) container.scrollTop = container.scrollHeight;
            }
        });

        if (!assistantBubble) {
            setGenerating(false);
            assistantBubble = appendMessage('assistant', responseText);
        } else {
            assistantBubble.innerHTML = formatMarkdown(responseText);
        }

        await localDB.addMessage(currentVideoId, 'assistant', responseText);

    } catch (err) {
        console.error('AI Generation Error:', err);
        setGenerating(false);
        if (!assistantBubble) {
            appendMessage('assistant', `⚠️ **Error:** ${err.message}`, true);
        } else {
            assistantBubble.innerHTML = formatMarkdown(`⚠️ **Error:** ${err.message}`);
            assistantBubble.parentElement?.classList.add('error');
        }
    } finally {
        setGenerating(false);
        const container = getEl('chat-messages');
        if (container) container.scrollTop = container.scrollHeight;
    }
}

/**
 * Append Message Bubble to UI
 */
function appendMessage(sender, text, isError = false) {
    const container = getEl('chat-messages');
    const indicator = getEl('typing');
    if (!container) return null;

    const messageRow = document.createElement('div');
    messageRow.className = `message-row ${sender.toLowerCase()} ${isError ? 'error' : ''}`;

    const senderName = document.createElement('div');
    senderName.className = 'message-sender';
    senderName.textContent = sender === 'user' ? 'You' : 'YT Agent';

    const bubble = document.createElement('div');
    bubble.className = 'message-bubble';
    bubble.innerHTML = formatMarkdown(text);

    messageRow.appendChild(senderName);
    messageRow.appendChild(bubble);

    if (indicator) {
        container.insertBefore(messageRow, indicator);
    } else {
        container.appendChild(messageRow);
    }

    container.scrollTop = container.scrollHeight;
    return bubble;
}

function setGenerating(generating) {
    isGenerating = generating;
    const sendButton = getEl('send');
    const indicator = getEl('typing');
    const container = getEl('chat-messages');

    if (sendButton) sendButton.disabled = generating;
    if (indicator) {
        if (generating) {
            indicator.classList.add('visible');
            if (container) container.scrollTop = container.scrollHeight;
        } else {
            indicator.classList.remove('visible');
        }
    }
}

/**
 * Minimal lightweight Markdown to HTML formatter
 */
function formatMarkdown(text) {
    if (!text) return '';

    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        // Bold
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        // Italic
        .replace(/\*(.*?)\*/g, '<em>$1</em>')
        // Inline code
        .replace(/`([^`]+)`/g, '<code>$1</code>')
        // Bullet points
        .replace(/^\s*[-*]\s+(.*)$/gm, '<li>$1</li>')
        // Numbered list
        .replace(/^\s*(\d+)\.\s+(.*)$/gm, '<li>$2</li>')
        // Line breaks
        .replace(/\n/g, '<br/>');
}
