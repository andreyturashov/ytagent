/**
 * Tests for src/utils/streaming.js
 */

import { describe, it, expect } from 'vitest';
import { extractStreamDelta } from '../../src/utils/streaming.js';

describe('extractStreamDelta', () => {
    describe('Pattern 1: Cumulative chunks (prefix-extends)', () => {
        it('extracts delta when chunk extends previous text', () => {
            const result = extractStreamDelta('Hello world', 'Hello ');
            expect(result.delta).toBe('world');
            expect(result.fullText).toBe('Hello world');
        });

        it('handles first chunk with empty previous text', () => {
            const result = extractStreamDelta('Hello', '');
            expect(result.delta).toBe('Hello');
            expect(result.fullText).toBe('Hello');
        });

        it('handles first chunk with undefined previous text', () => {
            const result = extractStreamDelta('Hello', undefined);
            expect(result.delta).toBe('Hello');
            expect(result.fullText).toBe('Hello');
        });

        it('returns empty delta when chunk equals previous text', () => {
            const result = extractStreamDelta('Hello', 'Hello');
            expect(result.delta).toBe('');
            expect(result.fullText).toBe('Hello');
        });

        it('handles multi-step cumulative streaming', () => {
            let fullText = '';

            const r1 = extractStreamDelta('H', fullText);
            fullText = r1.fullText;
            expect(r1.delta).toBe('H');

            const r2 = extractStreamDelta('He', fullText);
            fullText = r2.fullText;
            expect(r2.delta).toBe('e');

            const r3 = extractStreamDelta('Hello', fullText);
            fullText = r3.fullText;
            expect(r3.delta).toBe('llo');

            const r4 = extractStreamDelta('Hello world!', fullText);
            expect(r4.delta).toBe(' world!');
            expect(r4.fullText).toBe('Hello world!');
        });
    });

    describe('Pattern 2: Partial overlap (≥60% common prefix)', () => {
        it('extracts delta from chunk with significant overlap', () => {
            // previous = "ABCDE" (5 chars), chunk starts with "ABCDE" prefix = 5/5 = 100%
            // But this case is actually caught by Pattern 1 (startsWith)
            // For true partial overlap: chunk diverges after common prefix
            const prev = 'ABCDEFGHIJ'; // 10 chars
            const chunk = 'ABCDEFGXYZ'; // shares 7 chars = 70% > 60%
            const result = extractStreamDelta(chunk, prev);
            expect(result.delta).toBe('XYZ');
            expect(result.fullText).toBe('ABCDEFGXYZ');
        });

        it('treats as delta-append when overlap is below 60%', () => {
            const prev = 'ABCDEFGHIJ'; // 10 chars
            const chunk = 'ABXYZ'; // shares 2 chars = 20% < 60%
            const result = extractStreamDelta(chunk, prev);
            expect(result.delta).toBe('ABXYZ');
            expect(result.fullText).toBe('ABCDEFGHIJABXYZ');
        });
    });

    describe('Pattern 3: Pure delta (append)', () => {
        it('appends entirely new chunk to previous text', () => {
            const result = extractStreamDelta('world', 'Hello ');
            // "world" doesn't start with "Hello " and no significant prefix overlap
            // Since previous is "Hello " and chunk is "world":
            // common prefix = 0 chars → pure delta append
            const result2 = extractStreamDelta('XYZ', 'ABC');
            expect(result2.delta).toBe('XYZ');
            expect(result2.fullText).toBe('ABCXYZ');
        });
    });

    describe('Edge cases', () => {
        it('handles non-string chunk gracefully', () => {
            const result = extractStreamDelta(null, 'previous');
            expect(result.delta).toBe('');
            expect(result.fullText).toBe('previous');
        });

        it('handles undefined chunk gracefully', () => {
            const result = extractStreamDelta(undefined, 'previous');
            expect(result.delta).toBe('');
            expect(result.fullText).toBe('previous');
        });

        it('handles both null inputs', () => {
            const result = extractStreamDelta(null, null);
            expect(result.delta).toBe('');
            expect(result.fullText).toBe('');
        });

        it('handles empty string chunk with empty previous', () => {
            const result = extractStreamDelta('', '');
            expect(result.delta).toBe('');
            expect(result.fullText).toBe('');
        });

        it('handles numeric chunk type', () => {
            const result = extractStreamDelta(42, 'text');
            expect(result.delta).toBe('');
            expect(result.fullText).toBe('text');
        });
    });
});
