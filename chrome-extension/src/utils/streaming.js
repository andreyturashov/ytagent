/**
 * Streaming Delta Extraction Utility
 *
 * Extracts the incremental delta from a streaming chunk by comparing it
 * against the previously accumulated full text. Handles three Prompt API
 * streaming patterns:
 *   1. Cumulative: chunk is the full text so far (prefix-extends previous)
 *   2. Partial overlap: chunk shares ≥60% common prefix with previous
 *   3. Pure delta: chunk is entirely new content to append
 *
 * @sync-with background.js — extractStreamDelta() is inlined there because
 * the service worker cannot use ES module imports. Keep both copies in sync.
 */

/**
 * Extract the new delta content from a streaming chunk.
 * @param {string} chunk - The latest chunk received from the stream
 * @param {string} previousFullText - The accumulated text from prior chunks
 * @returns {{ delta: string, fullText: string }}
 */
export function extractStreamDelta(chunk, previousFullText) {
    if (typeof chunk !== 'string') {
        return { delta: '', fullText: previousFullText || '' };
    }

    const prev = previousFullText || '';

    // Pattern 1: Cumulative — chunk starts with the full previous text
    if (chunk.startsWith(prev)) {
        const delta = chunk.slice(prev.length);
        return { delta, fullText: chunk };
    }

    // Pattern 2: Partial overlap — significant common prefix (≥60%)
    let commonPrefixLen = 0;
    const minLen = Math.min(chunk.length, prev.length);
    while (commonPrefixLen < minLen && chunk[commonPrefixLen] === prev[commonPrefixLen]) {
        commonPrefixLen++;
    }

    if (commonPrefixLen > 0 && commonPrefixLen >= prev.length * 0.6) {
        const delta = chunk.slice(commonPrefixLen);
        return { delta, fullText: chunk };
    }

    // Pattern 3: Pure delta — entirely new content, append to previous
    return { delta: chunk, fullText: prev + chunk };
}
