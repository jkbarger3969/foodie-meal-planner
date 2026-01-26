/**
 * @fileoverview Common utility functions.
 */

import { DEFAULT_RECIPE_IMAGE } from './constants.js';

/**
 * Formats a Date as YYYY-MM-DD.
 * @param {Date|string} d
 * @returns {string}
 */
export function ymd(d) {
    if (!d) return '';
    const dt = (d instanceof Date) ? d : new Date(d);
    const y = dt.getFullYear();
    const m = String(dt.getMonth() + 1).padStart(2, '0');
    const da = String(dt.getDate()).padStart(2, '0');
    return `${y}-${m}-${da}`;
}

/**
 * Adds days to a YYYY-MM-DD string.
 * @param {string} dateYmd
 * @param {number} days
 * @returns {string}
 */
export function addDays(dateYmd, days) {
    if (!dateYmd) return '';
    const [y, m, d] = dateYmd.split('-').map(Number);
    const dt = new Date(y, m - 1, d);
    dt.setDate(dt.getDate() + Number(days || 0));
    return ymd(dt);
}

/**
 * Calculates inclusive days between two YYYY-MM-DD dates.
 * @param {string} startYmd
 * @param {string} endYmd
 * @returns {number}
 */
export function daysInclusive(startYmd, endYmd) {
    if (!startYmd || !endYmd) return 0;
    const [sy, sm, sd] = String(startYmd).split('-').map(Number);
    const [ey, em, ed] = String(endYmd).split('-').map(Number);
    const s = new Date(sy, sm - 1, sd);
    const e = new Date(ey, em - 1, ed);
    const diff = Math.floor((e - s) / (24 * 60 * 60 * 1000));
    return diff + 1;
}

/**
 * Escapes HTML characters.
 * @param {string} s
 * @returns {string}
 */
export function escapeHtml(s) {
    return String(s || '').replace(/[&<>"]/g, c => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'
    })[c]);
}

/**
 * Escapes characters for HTML attributes.
 * @param {string} s
 * @returns {string}
 */
export function escapeAttr(s) {
    return escapeHtml(s).replace(/"/g, '&quot;');
}

/**
 * Convert image path to displayable URL.
 * Handles local paths, full URLs, and defaults.
 * @param {string} imageName
 * @returns {string}
 */
export function getRecipeImageUrl(imageName) {
    if (!imageName) return DEFAULT_RECIPE_IMAGE;

    if (imageName.startsWith('http://') || imageName.startsWith('https://')) {
        return imageName;
    }

    // Local path - use custom protocol
    if (imageName.startsWith('images/')) {
        return 'foodie-image://' + imageName.replace('images/', '');
    }

    // Legacy path format
    if (imageName.startsWith('data/images/')) {
        return 'foodie-image://' + imageName.replace('data/images/', '');
    }

    return DEFAULT_RECIPE_IMAGE;
}

/**
 * Debounce utility.
 * @param {Function} func
 * @param {number} wait
 * @returns {Function}
 */
export function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

/**
 * Formats time since a date.
 * @param {Date} date
 * @returns {string}
 */
export function formatTimeAgo(date) {
    const now = new Date();
    const diffMs = now - date;
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHour = Math.floor(diffMin / 60);
    const diffDay = Math.floor(diffHour / 24);

    if (diffSec < 60) return 'Just now';
    if (diffMin < 60) return `${diffMin} minute${diffMin === 1 ? '' : 's'} ago`;
    if (diffHour < 24) return `${diffHour} hour${diffHour === 1 ? '' : 's'} ago`;
    if (diffDay < 7) return `${diffDay} day${diffDay === 1 ? '' : 's'} ago`;

    return date.toLocaleDateString();
}

/**
 * Formats bytes to human readable string.
 * @param {number} bytes
 * @returns {string}
 */
export function formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

/**
 * Show a toast notification.
 * @param {string} message
 * @param {string} [type='info'] - success|error|info|warning
 * @param {number} [duration=5000]
 */
export function showToast(message, type = 'info', duration = 5000) {
    const container = document.getElementById('toast-container');
    if (!container) {
        console.log(`[Toast] [${type}] ${message}`);
        return;
    }

    const icons = { success: '✓', error: '✕', info: 'ℹ', warning: '⚠' };
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `
    <span class="toast-icon">${icons[type] || 'ℹ'}</span>
    <span class="toast-message">${message}</span>
    <button class="toast-close">×</button>
  `;

    toast.querySelector('.toast-close').onclick = () => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    };

    container.appendChild(toast);
    setTimeout(() => toast.classList.add('show'), 10);
    setTimeout(() => {
        if (toast.parentNode) {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 300);
        }
    }, duration);
}
