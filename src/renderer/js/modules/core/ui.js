/**
 * @fileoverview UI core interactions module.
 */

import { MODAL_STATE, MOUSE_POS } from './state.js';
import { escapeAttr, escapeHtml } from './utils.js';

/**
 * Opens a modal overlay with animation.
 * @param {string} id - The ID of the overlay element.
 */
export function openModal(id) {
    const overlay = document.getElementById(id);
    if (!overlay) return;

    // Prevent re-opening if already open
    if (MODAL_STATE[id]) return;
    MODAL_STATE[id] = true;

    const modal = overlay.querySelector('.modal');
    overlay.style.display = 'flex';

    if (modal) {
        // Reset transform to get accurate bounds
        modal.style.transform = 'none';
        const rect = modal.getBoundingClientRect();

        // Origin is relative to the modal itself given centering
        modal.style.transformOrigin = `${MOUSE_POS.x - rect.left}px ${MOUSE_POS.y - rect.top}px`;
        modal.style.transform = ''; // Restore to CSS value
    }

    // Trigger animation next frame
    requestAnimationFrame(() => {
        overlay.classList.add('show');
    });
}

/**
 * Closes a modal overlay with animation.
 * @param {string} id - The ID of the overlay element.
 */
export function closeModal(id) {
    const overlay = document.getElementById(id);
    if (!overlay) return;

    MODAL_STATE[id] = false;

    // Immediately block all pointer events during animation
    overlay.style.pointerEvents = 'none';
    overlay.classList.remove('show');

    // Wait for transition before hiding
    setTimeout(() => {
        if (!overlay.classList.contains('show')) {
            overlay.style.display = 'none';
            overlay.style.pointerEvents = '';
        }
    }, 400);
}

/**
 * Triggers a subtle success feedback animation on an element.
 * @param {HTMLElement} element
 */
export function triggerSuccessFeedback(element) {
    if (!element) return;
    element.classList.remove('success-pulse');
    void element.offsetWidth; // Force reflow
    element.classList.add('success-pulse');
}

/**
 * Generates HTML for a select option list.
 * @param {string[]} vals
 * @param {string} selected
 * @returns {string}
 */
export function optionHtml_(vals, selected) {
    const s = String(selected ?? '');
    const list = Array.isArray(vals) ? vals.slice() : [];
    if (s && !list.some(v => String(v) === s)) list.push(s);
    return list.map(v => {
        const vv = String(v);
        return `<option value="${escapeAttr(vv)}"${vv === s ? ' selected' : ''}>${escapeHtml(vv)}</option>`;
    }).join('');
}

/**
 * Ensures a datalist exists and is populated.
 * @param {string} id
 * @param {string[]} values
 * @returns {HTMLElement}
 */
export function ensureDatalist_(id, values) {
    let dl = document.getElementById(id);
    if (!dl) {
        dl = document.createElement('datalist');
        dl.id = id;
        document.body.appendChild(dl);
    }
    dl.innerHTML = (values || []).map(v => `<option value="${escapeAttr(String(v))}"></option>`).join('');
    return dl;
}

/**
 * Manages loading states for buttons.
 * @param {HTMLElement} el
 * @param {boolean} isLoading
 * @param {string} [text]
 */
export function setLoading(el, isLoading, text) {
    if (!el) return;
    if (isLoading) {
        el.setAttribute('data-original-html', el.innerHTML);
        el.disabled = true;
        el.innerHTML = `<span class="spinner"></span> ${text || 'Loading...'}`;
    } else {
        el.disabled = false;
        const original = el.getAttribute('data-original-html');
        if (original) el.innerHTML = original;
    }
}
