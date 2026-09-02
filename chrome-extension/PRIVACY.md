# Privacy Policy for AIst Chrome Extension

**Last Updated:** September 2, 2026

AIst ("we", "our", or "us") is committed to protecting your privacy. This Privacy Policy describes how the **AIst Chrome Extension** handles user data.

---

## 1. Overview & Privacy Principles
AIst is designed from the ground up as a **100% private, on-device AI assistant**. All artificial intelligence features (summarization, page analysis, chat, transcript analysis) process data locally on your device using Chrome's built-in AI (Gemini Nano).

**We do not collect, store, or transmit your personal data, browsing history, or conversation history to any remote server or third party.**

---

## 2. Information Handled by the Extension

### A. Browsing Data & Web Page Content
- **What is accessed:** Page titles, URLs, YouTube video transcripts, and article text from tabs you actively interact with.
- **How it is used:** Page contents are processed directly by your local Chrome Gemini Nano AI model to provide summaries, answers, and context-aware assistance.
- **Where it is stored:** Data is stored locally in your browser's IndexedDB storage (`AIstDB`) and `chrome.storage` on your device. It never leaves your computer.

### B. User Inputs & Chat History
- **What is processed:** Questions, prompts, and text selections you submit to AIst.
- **Where it is stored:** All conversation threads are saved locally on your device in IndexedDB (`AIstDB`).
- **Data retention:** Chat history remains on your local machine until you clear extension data or uninstall the extension.

### C. Web Search Grounding (Optional)
- **What is sent:** When enabled by user request, keyword search terms (with page titles for contextual search) are sent directly to DuckDuckGo (`api.duckduckgo.com` and `html.duckduckgo.com`) to retrieve instant web search results.
- **Privacy:** DuckDuckGo does not store personally identifiable information or tracking data. No AIst account data or identity markers are attached to these requests.

---

## 3. Permissions Requested & Purpose

AIst requests the minimum set of permissions necessary to function:

- **`contextMenus`**: Adds an "Ask AIst about this..." right-click menu item for highlighted text on any page.
- **`tabs`**: Reads the title and URL of the active tab so the AI assistant can provide context-aware summaries.
- **`activeTab`**: Accesses the active tab when the extension action or context menu is clicked.
- **`storage`**: Persists user settings, prompt preferences, and session state locally on the user's device.
- **`sidePanel`**: Renders the AIst chat interface docked inside Chrome's side panel alongside active web pages.
- **`scripting`**: Injects isolated content extraction functions to read YouTube transcripts and article body text.
- **Host Permissions (`youtube.com`, `duckduckgo.com`, `<all_urls>`)**: Enables fetching YouTube transcripts/metadata, DuckDuckGo instant web search grounding, and page content extraction across web pages.

---

## 4. Data Sharing & Third-Party Disclosure
- We **do not sell, rent, trade, or share** your personal data with third parties.
- We **do not collect telemetry, analytics, or tracking data**.
- All AI processing occurs **100% locally** via Chrome's on-device Gemini Nano.

---

## 5. User Control & Data Deletion
You have complete control over your data:
- You can clear your local chat history at any time from the extension interface.
- Removing or uninstalling the AIst Chrome Extension immediately deletes all locally stored data and databases associated with the extension from your browser.

---

## 6. Contact & Support
If you have any questions or concerns about this Privacy Policy, please open an issue or contact the developer on the project repository.
