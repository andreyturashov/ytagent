/**
 * Status Badge UI Component
 * Updates the header status badge to reflect current state.
 */

import { getEl } from '../utils/dom.js';

/**
 * Update the header status badge.
 * @param {'active' | 'warning' | 'inactive'} state
 * @param {string} text - Status label text
 */
export function updateStatus(state, text) {
    const badge = getEl('page-status');
    const label = getEl('status-text');
    if (!badge || !label) return;

    badge.className = 'status-badge';
    if (state === 'active') badge.classList.add('active');
    if (state === 'warning') badge.classList.add('warning');
    label.textContent = text;
}
