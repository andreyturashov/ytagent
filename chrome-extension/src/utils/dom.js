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
 * Converts links, bold, italic, inline code, lists, and line breaks.
 * @param {string} text - Raw markdown text
 * @returns {string} HTML string
 */
export function formatMarkdown(text) {
    if (!text) return '';

    let formatted = text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');

    // Markdown links [text](url)
    formatted = formatted.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');

    // Autolink bare URLs that aren't already part of an anchor tag
    formatted = formatted.replace(/(^|[\s(])(https?:\/\/[^\s)<]+)/g, '$1<a href="$2" target="_blank" rel="noopener noreferrer">$2</a>');

    // Bold
    formatted = formatted.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    // Italic
    formatted = formatted.replace(/\*(.*?)\*/g, '<em>$1</em>');
    // Inline code
    formatted = formatted.replace(/`([^`]+)`/g, '<code>$1</code>');
    // Bullet points
    formatted = formatted.replace(/^\s*[-*]\s+(.*)$/gm, '<li>$1</li>');
    // Numbered list
    formatted = formatted.replace(/^\s*(\d+)\.\s+(.*)$/gm, '<li>$2</li>');
    // Line breaks
    formatted = formatted.replace(/\n/g, '<br/>');

    return formatted;
}
