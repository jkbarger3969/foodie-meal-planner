/**
 * @fileoverview API wrapper for Electron IPC calls.
 */

/**
 * Centrally managed API call function.
 * Wraps the Electron IPC bridge (window.Foodie.api).
 * 
 * @param {string} fn - The backend function name to call.
 * @param {Object} [payload={}] - The arguments for the function.
 * @returns {Promise<Object>} The result from the main process.
 */
export async function api(fn, payload = {}) {
    try {
        const result = await window.Foodie.api(fn, payload);
        return result;
    } catch (error) {
        console.error(`[API Error] ${fn}:`, error);
        return { ok: false, error: error.message };
    }
}
