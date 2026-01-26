/**
 * @fileoverview User management and profile switching module.
 */

import { api } from '../core/api.js';
import { ACTIVE_USER, setActiveUser } from '../core/state.js';
import { showToast } from '../core/utils.js';

/**
 * Initializes the user switcher UI.
 */
export async function initUserSwitcher() {
    const res = await api('listUsers');
    if (!res.ok) return;

    const activeRes = await api('getActiveUser');
    if (activeRes.ok && activeRes.user) {
        setActiveUser(activeRes.user);
        updateUserNameDisplay(activeRes.user.name);
    }
}

/**
 * Updates the UI with the active user's name.
 * @param {string} name
 */
export function updateUserNameDisplay(name) {
    const el = document.getElementById('activeUserName');
    if (el) el.textContent = name;
}
