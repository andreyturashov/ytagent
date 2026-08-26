/**
 * Shared Constants
 * Centralized magic numbers, thresholds, and default configuration values.
 */

/** Maximum characters for AI context budgeting (Gemini Nano ~4k-8k token window). */
export const CONTEXT_MAX_CHARS = 12000;

/** Maximum characters to keep when extracting generic page content. */
export const PAGE_CONTENT_MAX_CHARS = 80000;

/** Minimum character length to consider extracted content as valid/meaningful. */
export const MIN_CONTENT_LENGTH = 50;

/** Number of recent conversation messages to include in AI prompt context. */
export const MAX_HISTORY_MESSAGES = 6;

/** Chrome extension port name for Gemini Nano streaming communication. */
export const STREAM_PORT_NAME = 'gemini-nano-stream';

/**
 * Default system prompt used across AIService constructor, SettingsService defaults,
 * and settings save fallback. Keep all three in sync by importing this constant.
 */
export const DEFAULT_SYSTEM_PROMPT =
    'You are a helpful, direct AI assistant. Answer user questions naturally as a plain conversation. ' +
    'Provide short, highly useful answers, code snippets, and key information immediately without any ' +
    'meta-phrases like "According to the transcript", "The video says", or "Based on the article".';
