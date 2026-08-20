/**
 * Storage Service: IndexedDB for pages & chat messages, chrome.storage.local for settings.
 * Generalized from YouTube-only to support any page type.
 */

const DB_NAME = 'YTAgentDB';
const DB_VERSION = 2;

class LocalDB {
    constructor() {
        this.db = null;
        this._initPromise = null;
    }

    async _init() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, DB_VERSION);

            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                const oldVersion = event.oldVersion;

                if (oldVersion < 1) {
                    // Fresh install: create stores with new schema
                    if (!db.objectStoreNames.contains('pages')) {
                        const pageStore = db.createObjectStore('pages', { keyPath: 'page_id' });
                        pageStore.createIndex('updated_at', 'updated_at', { unique: false });
                    }

                    if (!db.objectStoreNames.contains('messages')) {
                        const messageStore = db.createObjectStore('messages', { keyPath: 'id', autoIncrement: true });
                        messageStore.createIndex('page_id', 'page_id', { unique: false });
                        messageStore.createIndex('created_at', 'created_at', { unique: false });
                    }
                }

                if (oldVersion >= 1 && oldVersion < 2) {
                    // Migration from v1: rename 'videos' → 'pages', update field names
                    const tx = event.target.transaction;

                    // Migrate videos → pages
                    if (db.objectStoreNames.contains('videos')) {
                        const videoStore = tx.objectStore('videos');
                        const getAllReq = videoStore.getAll();
                        getAllReq.onsuccess = () => {
                            const videos = getAllReq.result || [];
                            db.deleteObjectStore('videos');

                            const pageStore = db.createObjectStore('pages', { keyPath: 'page_id' });
                            pageStore.createIndex('updated_at', 'updated_at', { unique: false });

                            for (const video of videos) {
                                pageStore.put({
                                    page_id: video.youtube_video_id,
                                    page_type: 'youtube',
                                    source_url: `https://www.youtube.com/watch?v=${video.youtube_video_id}`,
                                    title: video.title,
                                    source: video.channel_title,
                                    thumbnail_url: video.thumbnail_url,
                                    content: video.transcript,
                                    created_at: video.created_at,
                                    updated_at: video.updated_at || Date.now(),
                                });
                            }
                        };
                    }

                    // Migrate messages: rename video_id index → page_id
                    if (db.objectStoreNames.contains('messages')) {
                        const messageStore = tx.objectStore('messages');

                        // Read all existing messages
                        const getAllMsgReq = messageStore.getAll();
                        getAllMsgReq.onsuccess = () => {
                            const messages = getAllMsgReq.result || [];
                            db.deleteObjectStore('messages');

                            const newMessageStore = db.createObjectStore('messages', { keyPath: 'id', autoIncrement: true });
                            newMessageStore.createIndex('page_id', 'page_id', { unique: false });
                            newMessageStore.createIndex('created_at', 'created_at', { unique: false });

                            for (const msg of messages) {
                                newMessageStore.add({
                                    page_id: msg.video_id || msg.page_id,
                                    role: msg.role,
                                    content: msg.content,
                                    created_at: msg.created_at,
                                });
                            }
                        };
                    }
                }
            };

            request.onsuccess = (event) => {
                this.db = event.target.result;
                resolve(this.db);
            };

            request.onerror = (event) => {
                console.error('IndexedDB open error:', event.target.error);
                reject(event.target.error);
            };
        });
    }

    async getDb() {
        if (!this.db) {
            if (!this._initPromise) {
                this._initPromise = this._init();
            }
            await this._initPromise;
        }
        return this.db;
    }

    // Page Operations

    /**
     * Get a page record by its page_id.
     * @param {string} pageId
     * @returns {Promise<object|null>}
     */
    async getPage(pageId) {
        const db = await this.getDb();
        return new Promise((resolve, reject) => {
            const tx = db.transaction('pages', 'readonly');
            const store = tx.objectStore('pages');
            const req = store.get(pageId);
            req.onsuccess = () => resolve(req.result || null);
            req.onerror = () => reject(req.error);
        });
    }

    /**
     * Save or update a page record.
     * @param {object} pageData - Must include page_id
     * @returns {Promise<object>}
     */
    async savePage(pageData) {
        const db = await this.getDb();
        return new Promise((resolve, reject) => {
            const tx = db.transaction('pages', 'readwrite');
            const store = tx.objectStore('pages');
            const record = {
                ...pageData,
                updated_at: Date.now()
            };
            const req = store.put(record);
            req.onsuccess = () => resolve(record);
            req.onerror = () => reject(req.error);
        });
    }

    // Message Operations

    /**
     * Get all messages for a page, sorted by creation time.
     * @param {string} pageId
     * @returns {Promise<Array>}
     */
    async getMessages(pageId) {
        const db = await this.getDb();
        return new Promise((resolve, reject) => {
            const tx = db.transaction('messages', 'readonly');
            const store = tx.objectStore('messages');
            const index = store.index('page_id');
            const req = index.getAll(pageId);
            req.onsuccess = () => {
                const results = req.result || [];
                results.sort((a, b) => (a.created_at || 0) - (b.created_at || 0));
                resolve(results);
            };
            req.onerror = () => reject(req.error);
        });
    }

    /**
     * Add a new message for a page.
     * @param {string} pageId
     * @param {string} role - 'user' or 'assistant'
     * @param {string} content
     * @returns {Promise<object>}
     */
    async addMessage(pageId, role, content) {
        const db = await this.getDb();
        return new Promise((resolve, reject) => {
            const tx = db.transaction('messages', 'readwrite');
            const store = tx.objectStore('messages');
            const msg = {
                page_id: pageId,
                role,
                content,
                created_at: Date.now()
            };
            const req = store.add(msg);
            req.onsuccess = () => {
                msg.id = req.result;
                resolve(msg);
            };
            req.onerror = () => reject(req.error);
        });
    }

    /**
     * Clear all messages for a page.
     * @param {string} pageId
     * @returns {Promise<boolean>}
     */
    async clearMessages(pageId) {
        const db = await this.getDb();
        const messages = await this.getMessages(pageId);
        return new Promise((resolve, reject) => {
            const tx = db.transaction('messages', 'readwrite');
            const store = tx.objectStore('messages');
            for (const msg of messages) {
                store.delete(msg.id);
            }
            tx.oncomplete = () => resolve(true);
            tx.onerror = () => reject(tx.error);
        });
    }

    // Search Operations

    /**
     * Get all page records, sorted by updated_at descending (most recent first).
     * @returns {Promise<Array>}
     */
    async getAllPages() {
        const db = await this.getDb();
        return new Promise((resolve, reject) => {
            const tx = db.transaction('pages', 'readonly');
            const store = tx.objectStore('pages');
            const req = store.getAll();
            req.onsuccess = () => {
                const results = req.result || [];
                results.sort((a, b) => (b.updated_at || 0) - (a.updated_at || 0));
                resolve(results);
            };
            req.onerror = () => reject(req.error);
        });
    }

    /**
     * Search across all pages and their chat messages.
     * Returns matching pages with context snippets from messages.
     * @param {string} query - Search query (case-insensitive)
     * @returns {Promise<Array<{page: object, matchedIn: string[], messageSnippets: string[]}>>}
     */
    async searchHistory(query) {
        if (!query || !query.trim()) return [];

        const normalizedQuery = query.trim().toLowerCase();
        const allPages = await this.getAllPages();
        const db = await this.getDb();

        // Get all messages in one transaction
        const allMessages = await new Promise((resolve, reject) => {
            const tx = db.transaction('messages', 'readonly');
            const store = tx.objectStore('messages');
            const req = store.getAll();
            req.onsuccess = () => resolve(req.result || []);
            req.onerror = () => reject(req.error);
        });

        // Group messages by page_id
        const messagesByPage = {};
        for (const msg of allMessages) {
            if (!messagesByPage[msg.page_id]) {
                messagesByPage[msg.page_id] = [];
            }
            messagesByPage[msg.page_id].push(msg);
        }

        const results = [];

        for (const page of allPages) {
            const matchedIn = [];
            const messageSnippets = [];

            // Check page title
            if (page.title && page.title.toLowerCase().includes(normalizedQuery)) {
                matchedIn.push('title');
            }

            // Check page source / channel
            if (page.source && page.source.toLowerCase().includes(normalizedQuery)) {
                matchedIn.push('source');
            }

            // Check page content
            if (page.content && page.content.toLowerCase().includes(normalizedQuery)) {
                matchedIn.push('content');
            }

            // Check chat messages for this page
            const pageMessages = messagesByPage[page.page_id] || [];
            for (const msg of pageMessages) {
                if (msg.content && msg.content.toLowerCase().includes(normalizedQuery)) {
                    // Extract a snippet around the match
                    const idx = msg.content.toLowerCase().indexOf(normalizedQuery);
                    const start = Math.max(0, idx - 40);
                    const end = Math.min(msg.content.length, idx + normalizedQuery.length + 40);
                    let snippet = msg.content.slice(start, end).trim();
                    if (start > 0) snippet = '…' + snippet;
                    if (end < msg.content.length) snippet = snippet + '…';
                    messageSnippets.push(snippet);

                    if (!matchedIn.includes('messages')) {
                        matchedIn.push('messages');
                    }
                }
            }

            if (matchedIn.length > 0) {
                results.push({
                    page,
                    matchedIn,
                    messageSnippets: messageSnippets.slice(0, 3), // Limit to 3 snippets
                });
            }
        }

        return results;
    }
}

// User Settings Storage (chrome.storage.local)
export const SettingsService = {
    async getSettings() {
        return new Promise((resolve) => {
            chrome.storage.local.get({
                provider: 'ollama', // 'ollama' | 'gemini' | 'openai'
                ollamaEndpoint: 'http://localhost:11434',
                ollamaModel: 'qwen2.5:14b',
                openaiKey: '',
                openaiModel: 'gpt-4o-mini',
                geminiKey: '',
                geminiModel: 'gemini-3.6-flash',
                enableWebSearch: true,
                systemPrompt: 'You are an intelligent AI assistant that helps users understand web page content. Answer user questions grounded in the page content provided.'
            }, (items) => resolve(items));
        });
    },

    async saveSettings(newSettings) {
        return new Promise((resolve) => {
            chrome.storage.local.set(newSettings, () => resolve());
        });
    }
};

export const localDB = new LocalDB();
