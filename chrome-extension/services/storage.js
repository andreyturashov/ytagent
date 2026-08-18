/**
 * Storage Service: IndexedDB for videos & chat messages, chrome.storage.local for settings.
 */

const DB_NAME = 'YTAgentDB';
const DB_VERSION = 1;

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

                // Videos table: indexed by youtube_video_id
                if (!db.objectStoreNames.contains('videos')) {
                    const videoStore = db.createObjectStore('videos', { keyPath: 'youtube_video_id' });
                    videoStore.createIndex('updated_at', 'updated_at', { unique: false });
                }

                // Messages table: auto-incrementing id, indexed by video_id
                if (!db.objectStoreNames.contains('messages')) {
                    const messageStore = db.createObjectStore('messages', { keyPath: 'id', autoIncrement: true });
                    messageStore.createIndex('video_id', 'video_id', { unique: false });
                    messageStore.createIndex('created_at', 'created_at', { unique: false });
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

    // Video Operations
    async getVideo(videoId) {
        const db = await this.getDb();
        return new Promise((resolve, reject) => {
            const tx = db.transaction('videos', 'readonly');
            const store = tx.objectStore('videos');
            const req = store.get(videoId);
            req.onsuccess = () => resolve(req.result || null);
            req.onerror = () => reject(req.error);
        });
    }

    async saveVideo(videoData) {
        const db = await this.getDb();
        return new Promise((resolve, reject) => {
            const tx = db.transaction('videos', 'readwrite');
            const store = tx.objectStore('videos');
            const record = {
                ...videoData,
                updated_at: Date.now()
            };
            const req = store.put(record);
            req.onsuccess = () => resolve(record);
            req.onerror = () => reject(req.error);
        });
    }

    // Message Operations
    async getMessages(videoId) {
        const db = await this.getDb();
        return new Promise((resolve, reject) => {
            const tx = db.transaction('messages', 'readonly');
            const store = tx.objectStore('messages');
            const index = store.index('video_id');
            const req = index.getAll(videoId);
            req.onsuccess = () => {
                const results = req.result || [];
                results.sort((a, b) => (a.created_at || 0) - (b.created_at || 0));
                resolve(results);
            };
            req.onerror = () => reject(req.error);
        });
    }

    async addMessage(videoId, role, content) {
        const db = await this.getDb();
        return new Promise((resolve, reject) => {
            const tx = db.transaction('messages', 'readwrite');
            const store = tx.objectStore('messages');
            const msg = {
                video_id: videoId,
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

    async clearMessages(videoId) {
        const db = await this.getDb();
        const messages = await this.getMessages(videoId);
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
                systemPrompt: 'You are an intelligent YouTube AI assistant. Answer user questions grounded in the video transcript provided.'
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
