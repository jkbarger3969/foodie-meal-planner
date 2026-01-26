/**
 * @fileoverview Shopping list management module.
 */

import { api } from '../core/api.js';
import { showToast, escapeHtml, escapeAttr } from '../core/utils.js';
import { openModal, closeModal } from '../core/ui.js';

/**
 * Builds the shopping list for a date range.
 */
export async function buildShoppingList(start, end) {
    const includeLowStock = document.getElementById('shopIncludeLowStock')?.checked;

    const activeUserRes = await api('getActiveUser');
    const userId = activeUserRes.ok ? activeUserRes.userId : null;

    const res = await api('buildShoppingList', { userId, start, end, excludeLeftovers: true, includeLowStock });
    if (!res.ok) {
        showToast(res.error || 'Failed to build shopping list', 'error');
        return;
    }

    // Implementation of renderShop_ logic
    renderShoppingList_(res.groups || []);
}

function renderShoppingList_(groups) {
    const container = document.getElementById('shopListContainer'); // Ensure this ID exists in your HTML
    if (!container) return;

    if (!groups || groups.length === 0) {
        container.innerHTML = `<div class="empty-state">Shopping list is empty!</div>`;
        return;
    }

    let html = '';

    // Sort groups by priority? (Assuming backend sorts or we sort here)

    for (const group of groups) {
        if (!group.Items || group.Items.length === 0) continue;

        html += `
        <div class="shop-group">
            <div class="shop-group-header">
                <h3>${escapeHtml(group.StoreName || 'Unassigned')}</h3>
                <span class="shop-group-count">${group.Items.length} items</span>
            </div>
            <div class="shop-items">`;

        for (const item of group.Items) {
            const isMerged = item.IsMerged;
            const originalTooltip = isMerged && item.OriginalNames
                ? `Merged from: ${item.OriginalNames.join(', ')}`
                : '';

            const mergeIcon = isMerged
                ? `<span class="icon-merge" title="${escapeAttr(originalTooltip)}">🔗</span>`
                : '';

            // Encode source IDs safely for the data attribute
            const sourceIdsJson = item.SourceIds ? JSON.stringify(item.SourceIds) : '[]';

            html += `
            <div class="shop-item" data-id="${escapeAttr(item.IngredientNorm)}" data-source-ids="${escapeAttr(sourceIdsJson)}" data-store="${escapeAttr(group.StoreId)}">
                <div class="shop-item-check">
                    <input type="checkbox" id="check_${escapeAttr(item.IngredientNorm)}" />
                </div>
                <div class="shop-item-details">
                    <div class="shop-item-name">
                        ${escapeHtml(item.IngredientNorm)}
                        ${mergeIcon}
                    </div>
                    <div class="shop-item-meta">
                        ${escapeHtml(item.QtyText)}
                    </div>
                </div>
                <div class="shop-item-actions">
                    <button class="btn-icon small" title="Rename (Updates underlying recipes)" onclick="window.Foodie.editShopItem(this)">✏️</button>
                </div>
            </div>`;
        }

        html += `</div></div>`;
    }

    container.innerHTML = html;
}

// Expose edit function globally for the onclick handler
window.Foodie = window.Foodie || {};
window.Foodie.editShopItem = async (btn) => {
    // Find parent shop-item
    const itemEl = btn.closest('.shop-item');
    if (!itemEl) return;

    const normName = itemEl.getAttribute('data-id');
    const sourceIdsRaw = itemEl.getAttribute('data-source-ids');
    let sourceIds = [];
    try {
        sourceIds = JSON.parse(sourceIdsRaw);
    } catch (e) {
        console.error("Failed to parse source IDs");
        return;
    }

    const newName = prompt(`Rename "${normName}"?\n(This will update the recipe database for future lists)`, normName);

    if (newName && newName !== normName) {
        try {
            const res = await api('updateShoppingItem', { newName, sourceIds });
            if (res.ok) {
                showToast(`Updated ${res.updated} recipe ingredients. Refreshing list...`, 'success');
                // Trigger refresh by reloading the list (assuming we have access to current range or just reload page)
                // For now, reload window is simplest, or callback
                window.location.reload();
            } else {
                showToast(res.error, 'error');
            }
        } catch (e) {
            console.error(e);
            showToast('Failed to update item', 'error');
        }
    }
};


/**
 * Displays a preview of the shopping list before printing.
 */
export function showShoppingListPreview(title, items, groups) {
    const subtitle = document.getElementById('shoppingListPreviewSubtitle');
    if (subtitle) subtitle.textContent = title;

    const content = document.getElementById('shoppingListPreviewContent');
    if (content) {
        content.innerHTML = `<div class="preview-title">${escapeHtml(title)}</div>`;
        // Build detailed groups HTML...
    }

    openModal('shoppingListPreviewBack');
}
