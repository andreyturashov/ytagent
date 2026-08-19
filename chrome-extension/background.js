/**
 * Background Service Worker (Manifest V3)
 */

// Configure side panel to open on action click if supported
if (chrome.sidePanel && chrome.sidePanel.setPanelBehavior) {
    chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch((err) => {
        console.warn('Failed to set panel behavior:', err);
    });
}

/**
 * Configure DeclarativeNetRequest to rewrite Origin on Ollama localhost requests.
 * This bypasses Ollama's default 403 Forbidden CORS check for chrome-extension origins.
 */
function setupOllamaHeaderRules() {
    if (!chrome.declarativeNetRequest) return;

    chrome.declarativeNetRequest.updateDynamicRules({
        removeRuleIds: [101, 102],
        addRules: [
            {
                id: 101,
                priority: 1,
                action: {
                    type: 'modifyHeaders',
                    requestHeaders: [
                        { header: 'Origin', operation: 'set', value: 'http://localhost' }
                    ]
                },
                condition: {
                    urlFilter: 'http://localhost:11434/*',
                    resourceTypes: ['xmlhttprequest', 'other']
                }
            },
            {
                id: 102,
                priority: 1,
                action: {
                    type: 'modifyHeaders',
                    requestHeaders: [
                        { header: 'Origin', operation: 'set', value: 'http://127.0.0.1' }
                    ]
                },
                condition: {
                    urlFilter: 'http://127.0.0.1:11434/*',
                    resourceTypes: ['xmlhttprequest', 'other']
                }
            }
        ]
    }).catch(err => {
        console.warn('Failed to register Ollama header rules:', err);
    });
}

chrome.runtime.onInstalled.addListener(() => {
    console.log('YT Agent (Local-First) Extension installed — supports any web page.');
    setupOllamaHeaderRules();
});

// Also run on service worker startup
setupOllamaHeaderRules();
