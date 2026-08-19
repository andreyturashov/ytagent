/**
 * Tests for src/utils/dom.js
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { getEl, formatMarkdown } from '../../src/utils/dom.js';

describe('getEl', () => {
    beforeEach(() => {
        document.body.innerHTML = '';
    });

    it('returns element by ID', () => {
        document.body.innerHTML = '<div id="test-el">Hello</div>';
        const el = getEl('test-el');
        expect(el).not.toBeNull();
        expect(el.textContent).toBe('Hello');
    });

    it('returns null for non-existent ID', () => {
        const el = getEl('does-not-exist');
        expect(el).toBeNull();
    });
});

describe('formatMarkdown', () => {
    it('returns empty string for falsy input', () => {
        expect(formatMarkdown('')).toBe('');
        expect(formatMarkdown(null)).toBe('');
        expect(formatMarkdown(undefined)).toBe('');
    });

    it('escapes HTML entities', () => {
        const result = formatMarkdown('<script>alert("xss")</script>');
        expect(result).not.toContain('<script>');
        expect(result).toContain('&lt;script&gt;');
    });

    it('converts bold text', () => {
        const result = formatMarkdown('This is **bold** text');
        expect(result).toContain('<strong>bold</strong>');
    });

    it('converts italic text', () => {
        const result = formatMarkdown('This is *italic* text');
        expect(result).toContain('<em>italic</em>');
    });

    it('converts inline code', () => {
        const result = formatMarkdown('Use `console.log()` for debugging');
        expect(result).toContain('<code>console.log()</code>');
    });

    it('converts bullet points', () => {
        const result = formatMarkdown('- item one\n- item two');
        expect(result).toContain('<li>item one</li>');
        expect(result).toContain('<li>item two</li>');
    });

    it('converts numbered list', () => {
        const result = formatMarkdown('1. first\n2. second');
        expect(result).toContain('<li>first</li>');
        expect(result).toContain('<li>second</li>');
    });

    it('converts line breaks', () => {
        const result = formatMarkdown('line one\nline two');
        expect(result).toContain('<br/>');
    });

    it('handles complex markdown', () => {
        const input = '**Bold** and *italic* with `code`\n- bullet';
        const result = formatMarkdown(input);
        expect(result).toContain('<strong>Bold</strong>');
        expect(result).toContain('<em>italic</em>');
        expect(result).toContain('<code>code</code>');
        expect(result).toContain('<li>bullet</li>');
    });
});
