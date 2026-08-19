/**
 * Test Setup — Chrome Extension API Mocks
 * Provides mock implementations of chrome.* APIs used throughout the extension.
 */

import { vi } from 'vitest';

// --- chrome.storage.local mock ---
const storageData = {};

const chromeStorageLocal = {
    get: vi.fn((defaults, callback) => {
        const result = { ...defaults };
        for (const key of Object.keys(defaults)) {
            if (key in storageData) {
                result[key] = storageData[key];
            }
        }
        if (callback) callback(result);
        return Promise.resolve(result);
    }),
    set: vi.fn((items, callback) => {
        Object.assign(storageData, items);
        if (callback) callback();
        return Promise.resolve();
    }),
    clear: vi.fn((callback) => {
        for (const key of Object.keys(storageData)) {
            delete storageData[key];
        }
        if (callback) callback();
        return Promise.resolve();
    }),
};

// --- chrome.tabs mock ---
const chromeTabs = {
    query: vi.fn(() => Promise.resolve([])),
    sendMessage: vi.fn((tabId, message, callback) => {
        if (callback) callback({});
        return Promise.resolve({});
    }),
    onUpdated: {
        addListener: vi.fn(),
        removeListener: vi.fn(),
    },
};

// --- chrome.scripting mock ---
const chromeScripting = {
    executeScript: vi.fn(() => Promise.resolve([{ result: null }])),
};

// --- chrome.runtime mock ---
const chromeRuntime = {
    onMessage: {
        addListener: vi.fn(),
        removeListener: vi.fn(),
    },
    onInstalled: {
        addListener: vi.fn(),
    },
    lastError: null,
};

// --- chrome.sidePanel mock ---
const chromeSidePanel = {
    setPanelBehavior: vi.fn(() => Promise.resolve()),
};

// --- chrome.declarativeNetRequest mock ---
const chromeDeclarativeNetRequest = {
    updateDynamicRules: vi.fn(() => Promise.resolve()),
};

// --- Assemble global chrome object ---
globalThis.chrome = {
    storage: {
        local: chromeStorageLocal,
    },
    tabs: chromeTabs,
    scripting: chromeScripting,
    runtime: chromeRuntime,
    sidePanel: chromeSidePanel,
    declarativeNetRequest: chromeDeclarativeNetRequest,
};

/**
 * Helper: reset all chrome mock state between tests.
 * Call this in beforeEach() if needed.
 */
export function resetChromeMocks() {
    vi.clearAllMocks();
    for (const key of Object.keys(storageData)) {
        delete storageData[key];
    }
    chromeRuntime.lastError = null;
}

/**
 * Helper: create a mock fetch response.
 * @param {*} body - Response body (object for JSON, string for text)
 * @param {object} [options] - Optional overrides { ok, status, headers }
 * @returns {Response}
 */
export function mockFetchResponse(body, options = {}) {
    const { ok = true, status = 200, headers = {} } = options;
    const isString = typeof body === 'string';
    const responseBody = isString ? body : JSON.stringify(body);

    return new Response(responseBody, {
        status,
        headers: {
            'Content-Type': isString ? 'text/plain' : 'application/json',
            ...headers,
        },
    });
}
