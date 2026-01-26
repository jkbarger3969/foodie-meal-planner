/**
 * @fileoverview Meal planner module.
 */

import { PLAN } from '../core/state.js';
import { api } from '../core/api.js';
import { showToast, escapeHtml, escapeAttr, addDays } from '../core/utils.js';

/**
 * Loads meal plans for a date range into the UI.
 * @param {string} start - YYYY-MM-DD
 * @param {number} days - Number of days to load.
 */
export async function loadPlansIntoUi(start, days) {
    PLAN.start = start;
    PLAN.days = days;
    const end = addDays(start, days - 1);

    const res = await api('getUserPlanMeals', { start, end });
    if (!res.ok) {
        showToast(res.error || 'Plan load error', 'error');
        return;
    }

    PLAN.plansByDate = {};
    for (const p of (res.plans || [])) {
        PLAN.plansByDate[p.Date] = p;
    }

    renderPlanner('planList', start, days, true);
    renderPlanner('bulkList', start, days, false);
}

/**
 * Renders a single meal line in the planner.
 */
export function slotLine(date, slot, meal, mealIndex = 0, totalMeals = 1) {
    const hasRecipe = !!(meal && meal.RecipeId);
    const title = hasRecipe ? meal.Title : '(empty)';
    const rid = hasRecipe ? meal.RecipeId : '';
    const mealId = meal?.id || null;

    return `
    <div class="meal-line animate-in" 
         data-date="${escapeAttr(date)}" 
         data-slot="${escapeAttr(slot)}" 
         data-idx="${mealIndex}">
      <div class="meal-title" data-action="${hasRecipe ? 'planner-view' : 'select-meal'}" 
           data-rid="${escapeAttr(rid)}" data-date="${escapeAttr(date)}" data-slot="${escapeAttr(slot)}">
        ${escapeHtml(title)}
      </div>
      <div class="meal-actions">
        ${hasRecipe ? `<button class="card-action-btn ghost" data-action="planner-view" data-rid="${escapeAttr(rid)}">👁️</button>` : ''}
        <button class="card-action-btn ghost" data-action="select-meal" data-date="${escapeAttr(date)}">✏️</button>
      </div>
    </div>
  `;
}

/**
 * Renders the entire planner grid/list.
 */
export function renderPlanner(containerId, start, days, includeSwap) {
    const box = document.getElementById(containerId);
    if (!box) return;

    const dates = [];
    for (let i = 0; i < days; i++) dates.push(addDays(start, i));

    box.innerHTML = dates.map(date => {
        const p = PLAN.plansByDate[date] || { Date: date, Breakfast: [], Lunch: [], Dinner: [] };
        const dayName = new Date(date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long' });

        const renderSlot = (label, meals) => {
            const mealsArray = Array.isArray(meals) ? meals : (meals ? [meals] : []);
            const slotHtml = mealsArray.length > 0
                ? mealsArray.map((m, idx) => slotLine(date, label, m, idx, mealsArray.length)).join('')
                : `<div class="meal-line ghost-hover" data-action="select-meal" data-date="${escapeAttr(date)}">
             <div class="meal-title muted">+ Add ${label}</div>
           </div>`;

            return `
        <div class="planner-slot" data-date="${escapeAttr(date)}" data-slot="${escapeAttr(label)}">
          <span class="slot-label">${label}</span>
          ${slotHtml}
        </div>
      `;
        };

        return `
      <div class="planner-day-card animate-in" data-day="${escapeAttr(date)}">
        <div class="planner-day-header">
          <div class="planner-day-title">${dayName}</div>
          <button class="card-action-btn ghost" data-action="clear-day" data-date="${escapeAttr(date)}">✕</button>
        </div>
        ${renderSlot('Breakfast', p.Breakfast)}
        ${renderSlot('Lunch', p.Lunch)}
        ${renderSlot('Dinner', p.Dinner)}
      </div>
    `;
    }).join('');
}
