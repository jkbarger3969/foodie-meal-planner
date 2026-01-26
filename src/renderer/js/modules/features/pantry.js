/**
 * @fileoverview Pantry management module.
 */

import { api } from '../core/api.js';
import { showToast, escapeHtml } from '../core/utils.js';
import { openModal } from '../core/ui.js';

/**
 * Loads pantry items and renders them.
 */
export async function loadPantry(query = '') {
    const res = await api('listPantry', { q: query });
    if (!res.ok) {
        showToast(res.error || 'Failed to load pantry', 'error');
        return;
    }

    const box = document.getElementById('pantryList');
    if (!box) return;

    box.innerHTML = (res.items || []).map(item => `
    <div class="pantry-item">
      <div class="pantry-item-name">${escapeHtml(item.Name)}</div>
      <div class="pantry-item-qty">${item.QtyNum || 0} ${escapeHtml(item.Unit || '')}</div>
    </div>
  `).join('');
}
