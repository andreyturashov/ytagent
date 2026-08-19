/**
 * Tests for src/ui/status.js
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { updateStatus } from '../../src/ui/status.js';

describe('Status UI', () => {
    beforeEach(() => {
        document.body.innerHTML = `
            <div id="page-status" class="status-badge">
                <span class="status-dot"></span>
                <span id="status-text">Detecting...</span>
            </div>
        `;
    });

    it('sets active state', () => {
        updateStatus('active', 'Ready');
        const badge = document.getElementById('page-status');
        const text = document.getElementById('status-text');
        expect(badge.classList.contains('active')).toBe(true);
        expect(badge.classList.contains('warning')).toBe(false);
        expect(text.textContent).toBe('Ready');
    });

    it('sets warning state', () => {
        updateStatus('warning', 'No Content');
        const badge = document.getElementById('page-status');
        expect(badge.classList.contains('warning')).toBe(true);
        expect(badge.classList.contains('active')).toBe(false);
    });

    it('sets inactive state (no extra class)', () => {
        updateStatus('inactive', 'No Tab');
        const badge = document.getElementById('page-status');
        expect(badge.classList.contains('active')).toBe(false);
        expect(badge.classList.contains('warning')).toBe(false);
        expect(badge.className).toBe('status-badge');
    });

    it('clears previous state classes', () => {
        updateStatus('active', 'Ready');
        updateStatus('warning', 'Loading...');
        const badge = document.getElementById('page-status');
        expect(badge.classList.contains('active')).toBe(false);
        expect(badge.classList.contains('warning')).toBe(true);
    });

    it('handles missing DOM elements gracefully', () => {
        document.body.innerHTML = '';
        // Should not throw
        expect(() => updateStatus('active', 'test')).not.toThrow();
    });
});
