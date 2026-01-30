/**
 * @fileoverview Recipe management module.
 */

import { RECIPES, CURRENT_QUERY, SEARCH_INDEX, ADVANCED_FILTERS, ACTIVE_USER } from '../core/state.js';
import { api } from '../core/api.js';
import { showToast, escapeHtml, escapeAttr, getRecipeImageUrl } from '../core/utils.js';
import { triggerSuccessFeedback } from '../core/ui.js';

/**
 * Fast indexed search for recipes.
 * @param {string} query
 * @returns {Array} List of matching recipes.
 */
export function searchRecipesIndexed_(query) {
    if (!query) return RECIPES;

    const q = query.toLowerCase().trim();

    if (SEARCH_INDEX.lastSearchQuery === q && SEARCH_INDEX.lastSearchResults) {
        return SEARCH_INDEX.lastSearchResults;
    }

    if (!SEARCH_INDEX.index || !SEARCH_INDEX.recipeMap) {
        return RECIPES.filter(r => (r.Title || '').toLowerCase().includes(q));
    }

    const queryWords = q.split(/\s+/).filter(w => w.length >= 2);
    let matchingIds = null;

    if (queryWords.length === 1) {
        const word = queryWords[0];
        if (SEARCH_INDEX.index.has(word)) {
            matchingIds = new Set(SEARCH_INDEX.index.get(word));
        } else {
            matchingIds = new Set();
            for (const [term, ids] of SEARCH_INDEX.index.entries()) {
                if (term.includes(word)) {
                    for (const id of ids) matchingIds.add(id);
                }
            }
        }
    } else if (queryWords.length > 1) {
        const wordSets = queryWords.map(word => {
            const matches = new Set();
            for (const [term, ids] of SEARCH_INDEX.index.entries()) {
                if (term.includes(word)) {
                    for (const id of ids) matches.add(id);
                }
            }
            return matches;
        });

        matchingIds = wordSets.reduce((acc, set) => {
            const intersection = new Set();
            for (const id of acc) {
                if (set.has(id)) intersection.add(id);
            }
            return intersection;
        });
    } else {
        matchingIds = new Set();
    }

    const results = Array.from(matchingIds || [])
        .map(id => SEARCH_INDEX.recipeMap.get(id))
        .filter(Boolean);

    SEARCH_INDEX.lastSearchQuery = q;
    SEARCH_INDEX.lastSearchResults = results;
    return results;
}

/**
 * Renders a single recipe card.
 * @param {Object} r - Recipe object.
 * @returns {string} HTML string.
 */
export function renderRecipeCard_(r) {
    const isFavorite = r.is_favorite === true || r.is_favorite === 1 || r.is_favorite === '1';
    const starIcon = isFavorite ? '⭐' : '☆';
    const starColor = isFavorite ? '#ffd700' : 'var(--muted)';

    // Get emoji - try cuisine first, then meal type, then default
    const recipeEmoji = (r.Cuisine && r.Cuisine !== 'Any') ? '🍽️' : '📖'; // Simplified for matches

    return `
    <div class="recipe-card animate-in" 
         draggable="true"
         data-recipe-id="${escapeAttr(r.RecipeId)}" 
         data-recipe-title="${escapeAttr(r.Title || '')}">
      
      <!-- Pinterest Badge (Cuisine) -->
      ${r.Cuisine ? `<div class="recipe-card-badge">${escapeHtml(r.Cuisine)}</div>` : ''}
      
      <!-- Recipe Image (Lazy Loaded) -->
      <div class="recipe-card-image" 
           style="background-image: url('${escapeAttr(getRecipeImageUrl(r.Image_Name || r.Image))}'); background-color: #f0f0f0"></div>
      
      <!-- Quick Actions (Top Left) -->
      <div class="recipe-card-actions">
        <button class="card-action-btn" data-action="recipe-favorite" data-rid="${escapeAttr(r.RecipeId)}" 
                data-tooltip="Toggle Favorite" data-tooltip-pos="bottom"
                style="color: ${starColor}">
          ${starIcon}
        </button>
        <button class="card-action-btn" data-action="quick-assign" data-rid="${escapeAttr(r.RecipeId)}" data-tooltip="Assign to date" data-tooltip-pos="bottom">📅</button>
        <button class="card-action-btn" data-action="quick-collection" data-rid="${escapeAttr(r.RecipeId)}" data-tooltip="Add to collection" data-tooltip-pos="bottom">📦</button>
        <label class="card-action-btn recipe-select-label" data-tooltip="Select for bulk actions" data-tooltip-pos="bottom">
          <input type="checkbox" class="recipe-select-checkbox" data-recipe-id="${escapeAttr(r.RecipeId)}" />
          <div class="checkmark-overlay"></div>
        </label>
      </div>

      <!-- Content Overlay -->
      <div class="recipe-card-overlay">
        <div class="recipe-card-title">${escapeHtml(r.Title || 'Untitled Recipe')}</div>
        <div class="recipe-card-meta">
          <span>${recipeEmoji} ${escapeHtml(r.MealType || 'Any')}</span>
          ${r.PrepTimeMinutes ? `<span>• ⏱️ ${r.PrepTimeMinutes}m</span>` : ''}
        </div>
      </div>
    </div>
  `;
}

/**
 * Main function to render recipes in the grid.
 */
export function renderRecipes() {
    const box = document.getElementById('recipesList');
    if (!box) return;

    const showFavoritesOnly = document.getElementById('recipeFavoritesOnly')?.checked || false;
    const cuisineFilter = document.getElementById('recipeCuisineFilter')?.value || '';

    let recipesToShow = CURRENT_QUERY ? searchRecipesIndexed_(CURRENT_QUERY) : RECIPES;

    if (showFavoritesOnly) {
        recipesToShow = recipesToShow.filter(r => r.is_favorite === true || r.is_favorite === 1 || r.is_favorite === '1');
    }
    if (cuisineFilter) {
        recipesToShow = recipesToShow.filter(r => r.Cuisine === cuisineFilter);
    }

    // Virtual scrolling check (VIRTUAL_SCROLL would need to be imported)
    // ... Virtual scrolling implementation would go here ...

    box.innerHTML = recipesToShow.map(r => renderRecipeCard_(r)).join('');
}
