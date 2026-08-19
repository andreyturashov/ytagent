/**
 * DOM Utility Helpers
 */

/**
 * Shorthand for document.getElementById
 * @param {string} id
 * @returns {HTMLElement|null}
 */
export function getEl(id) {
    return document.getElementById(id);
}

/**
 * Minimal lightweight Markdown to HTML formatter.
 * Converts bold, italic, inline code, lists, and line breaks.
 * @param {string} text - Raw markdown text
 * @returns {string} HTML string
 */
export function formatMarkdown(text) {
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
