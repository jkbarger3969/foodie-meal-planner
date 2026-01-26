# UI Design for Multiple Meals Per Slot

## Current Constraints

### List View
- **Layout**: Vertical accordion, one day per section
- **Space**: Generous vertical space, fluid width
- **Current Height**: ~100-250px per meal (with all details)
- **Strength**: Can easily accommodate multiple meals stacked

### Grid View  
- **Layout**: 7-column calendar grid
- **Cell Size**: `min-height: 200px`, but expands as needed
- **Meal Card**: `min-height: 60px`, `padding: 10px`, `margin-bottom: 8px`
- **Constraint**: Width is divided by 7, becomes cramped with long titles
- **Challenge**: Fitting 2+ meals per slot while staying readable

---

## Design Goals

1. **Clear Visual Hierarchy** - Easy to distinguish between users' meals
2. **Compact but Readable** - Especially in grid view
3. **User Context Awareness** - Show whose meal it is
4. **Minimize Clutter** - Don't overwhelm with too much info
5. **Maintain Existing Features** - Badges, actions, additional items all work

---

## Proposed UI Changes

### A. List View - Stacked Meal Cards

**Current** (Single Meal):
```
┌────────────────────────────────────────────────────┐
│ Breakfast: Pancakes                    [Actions▼] │
│ 👨‍👩‍👧‍👦 For: Whole Family                            │
│ + Add Side/Dessert                                 │
└────────────────────────────────────────────────────┘
```

**New** (Multiple Meals):
```
┌────────────────────────────────────────────────────┐
│ Breakfast (2 meals)                                │
├────────────────────────────────────────────────────┤
│ 👨‍👩‍👧‍👦 Whole Family: Pancakes        [Actions▼]   │
│ + Add Side/Dessert                                 │
├────────────────────────────────────────────────────┤
│ 👤 John: Oatmeal                       [Actions▼]   │
│ + Add Side/Dessert                                 │
└────────────────────────────────────────────────────┘
```

**Implementation**:
```javascript
function slotLine(date, slot, meals) {
  if (!meals || meals.length === 0) {
    return renderEmptySlot(date, slot);
  }
  
  // Slot header showing count
  let html = `
    <div class="slot-header">
      <strong>${slot}</strong>
      ${meals.length > 1 ? `<span class="meal-count-badge">${meals.length} meals</span>` : ''}
    </div>
  `;
  
  // Render each meal as a separate card
  meals.forEach((meal, index) => {
    html += `
      <div class="meal-card ${index > 0 ? 'meal-card-secondary' : ''}" data-meal-id="${meal.id}">
        <div class="meal-header-row">
          ${meal.UserName && meal.UserName !== 'Whole Family' 
            ? `<span class="meal-user-badge">${escapeHtml(meal.AvatarEmoji)} ${escapeHtml(meal.UserName)}</span>` 
            : `<span class="meal-user-badge">${escapeHtml(meal.AvatarEmoji || '👨‍👩‍👧‍👦')} Whole Family</span>`
          }
          <span class="meal-title">${escapeHtml(meal.Title)}</span>
          ${meal.IsWholeFamilyFallback ? `<span class="fallback-indicator" title="Inherited from Whole Family">↓</span>` : ''}
        </div>
        
        <div class="meal-actions">
          <button class="ghost mini" onclick="viewMeal('${meal.id}')">View</button>
          <button class="ghost mini" onclick="editMeal('${meal.id}')">Edit</button>
          ${!meal.IsWholeFamilyFallback ? `<button class="ghost mini danger" onclick="deleteMeal('${meal.id}')">Delete</button>` : ''}
        </div>
        
        <!-- Additional items container -->
        <div class="additional-items-container" data-date="${date}" data-slot="${slot}" data-meal-id="${meal.id}"></div>
      </div>
    `;
    
    // Divider between meals (except after last)
    if (index < meals.length - 1) {
      html += `<div class="meal-divider"></div>`;
    }
  });
  
  // Add meal button at bottom
  html += `
    <div class="slot-footer">
      <button class="ghost mini" onclick="openMealPicker('${date}','${slot}')">+ Add Another ${slot}</button>
    </div>
  `;
  
  return html;
}
```

**CSS Additions**:
```css
.slot-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
  padding-bottom: 6px;
  border-bottom: 2px solid var(--line);
}

.meal-count-badge {
  background: rgba(77, 163, 255, 0.15);
  color: var(--accent);
  padding: 2px 8px;
  border-radius: 10px;
  font-size: 11px;
  font-weight: 600;
}

.meal-card {
  background: var(--card);
  border: 1px solid var(--line);
  border-radius: 8px;
  padding: 10px;
  margin-bottom: 8px;
}

.meal-card-secondary {
  background: var(--bg-elevated);
  border-left: 3px solid var(--accent);
}

.meal-header-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
  flex-wrap: wrap;
}

.meal-user-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  background: rgba(77, 163, 255, 0.1);
  padding: 3px 8px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 600;
  color: var(--accent);
  white-space: nowrap;
}

.meal-title {
  flex: 1;
  min-width: 0;
  font-weight: 500;
}

.fallback-indicator {
  color: var(--muted);
  font-size: 16px;
  cursor: help;
}

.meal-divider {
  height: 1px;
  background: var(--line);
  margin: 12px 0;
}

.slot-footer {
  margin-top: 12px;
  padding-top: 8px;
  border-top: 1px dashed var(--line);
}

.meal-actions {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}
```

---

### B. Grid View - Compact Stacked Display

**Current** (Single Meal):
```
┌──────────────────┐
│ B                │
│ Pancakes         │
│ 👨‍👩‍👧‍👦            │
└──────────────────┘
```

**New Option 1** - Stacked (Preferred for 2-3 meals):
```
┌──────────────────┐
│ B (2)            │
│ ┌──────────────┐ │
│ │👨‍👩‍👧‍👦 Pancakes│ │
│ └──────────────┘ │
│ ┌──────────────┐ │
│ │👤 Oatmeal    │ │
│ └──────────────┘ │
└──────────────────┘
```

**New Option 2** - Condensed (If 4+ meals):
```
┌──────────────────┐
│ B (4 meals) ▼    │
│ • Pancakes       │
│ • Oatmeal        │
│ • Yogurt         │
│ • Smoothie       │
└──────────────────┘
```

**Implementation**:
```javascript
function renderGridMeal(date, slot, meals) {
  if (!meals || meals.length === 0) {
    return `
      <div class="grid-meal-slot empty" data-date="${date}" data-slot="${slot}">
        <div class="grid-slot-label">${slot[0]}</div>
        <button class="grid-add-btn" onclick="openMealPicker('${date}','${slot}')">+</button>
      </div>
    `;
  }
  
  const slotClass = slot.toLowerCase();
  
  // If only one meal, use existing compact design
  if (meals.length === 1) {
    const meal = meals[0];
    return `
      <div class="grid-meal ${slotClass}" 
           draggable="true"
           data-date="${date}"
           data-slot="${slot}"
           data-meal-id="${meal.id}">
        <div class="grid-meal-label">${slot[0]}</div>
        <div class="grid-meal-title">${escapeHtml(meal.Title)}</div>
        ${meal.UserName && meal.UserName !== 'Whole Family' 
          ? `<div class="grid-user-avatar">${escapeHtml(meal.AvatarEmoji)}</div>` 
          : ''
        }
      </div>
    `;
  }
  
  // Multiple meals - compact stacked view
  if (meals.length <= 3) {
    let html = `
      <div class="grid-meal-slot multi" data-date="${date}" data-slot="${slot}">
        <div class="grid-slot-header">
          <span class="grid-slot-label">${slot[0]}</span>
          <span class="grid-meal-count">${meals.length}</span>
        </div>
    `;
    
    meals.forEach(meal => {
      html += `
        <div class="grid-mini-meal ${slotClass}" 
             data-meal-id="${meal.id}"
             onclick="viewMeal('${meal.id}')">
          <span class="grid-mini-avatar">${escapeHtml(meal.AvatarEmoji || '👨‍👩‍👧‍👦')}</span>
          <span class="grid-mini-title">${escapeHtml(truncate(meal.Title, 15))}</span>
        </div>
      `;
    });
    
    html += `</div>`;
    return html;
  }
  
  // Too many meals (4+) - use condensed bullet list
  return `
    <div class="grid-meal-slot condensed" data-date="${date}" data-slot="${slot}">
      <div class="grid-slot-header">
        <span class="grid-slot-label">${slot[0]}</span>
        <span class="grid-meal-count">${meals.length} meals</span>
      </div>
      <div class="grid-meal-list">
        ${meals.slice(0, 3).map(m => `<div class="grid-list-item">• ${escapeHtml(truncate(m.Title, 12))}</div>`).join('')}
        ${meals.length > 3 ? `<div class="grid-list-more">+${meals.length - 3} more</div>` : ''}
      </div>
    </div>
  `;
}

function truncate(str, maxLen) {
  if (str.length <= maxLen) return str;
  return str.substring(0, maxLen - 1) + '…';
}
```

**CSS for Grid View**:
```css
/* Multi-meal grid slot */
.grid-meal-slot.multi {
  background: var(--card);
  border: 1px solid var(--line);
  border-radius: 6px;
  padding: 6px;
  margin-bottom: 8px;
  min-height: 80px;
}

.grid-slot-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 6px;
  padding-bottom: 4px;
  border-bottom: 1px solid var(--line);
}

.grid-meal-count {
  background: rgba(77, 163, 255, 0.15);
  color: var(--accent);
  padding: 2px 6px;
  border-radius: 8px;
  font-size: 10px;
  font-weight: 600;
}

.grid-mini-meal {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px;
  margin-bottom: 3px;
  background: var(--bg-elevated);
  border-radius: 4px;
  cursor: pointer;
  transition: background 0.15s ease;
}

.grid-mini-meal:hover {
  background: var(--card-hover);
}

.grid-mini-avatar {
  font-size: 14px;
  flex-shrink: 0;
}

.grid-mini-title {
  font-size: 11px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* Condensed view for 4+ meals */
.grid-meal-slot.condensed {
  background: var(--card);
  border: 1px solid var(--line);
  border-radius: 6px;
  padding: 6px;
  margin-bottom: 8px;
}

.grid-meal-list {
  font-size: 10px;
  color: var(--text-secondary);
}

.grid-list-item {
  padding: 2px 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.grid-list-more {
  padding: 2px 0;
  color: var(--accent);
  font-weight: 600;
}
```

---

### C. User Context Indicators

**Visual Language**:
```
👨‍👩‍👧‍👦  = Whole Family (blue background)
👤   = Individual User (neutral background)
↓    = Fallback/Inherited from Whole Family (gray, subtle)
```

**Color Coding**:
```css
.meal-user-badge.whole-family {
  background: rgba(77, 163, 255, 0.15);
  border: 1px solid rgba(77, 163, 255, 0.3);
  color: var(--accent);
}

.meal-user-badge.individual {
  background: rgba(255, 193, 7, 0.15);
  border: 1px solid rgba(255, 193, 7, 0.3);
  color: #f5a623;
}

.meal-user-badge.fallback {
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid var(--line);
  color: var(--muted);
  font-style: italic;
}
```

---

### D. Meal Actions - Context Menu

**For Individual Meals**:
```
┌────────────────────────────┐
│ View Recipe                │
│ Edit Meal                  │
│ Delete This Meal           │  ← Red, destructive
│ ───────────────────────    │
│ Add to Collection          │
│ Mark as Leftover           │
└────────────────────────────┘
```

**For Whole Family Fallback**:
```
┌────────────────────────────┐
│ View Recipe                │
│ Override for Me            │  ← Creates user-specific meal
│ ───────────────────────────│
│ (Cannot delete WF meals)   │
└────────────────────────────┘
```

---

### E. Empty State & Add Meal Flow

**Empty Slot**:
```
┌────────────────────────────────────────────────────┐
│ Breakfast                                          │
│                                                    │
│        No meals planned                            │
│                                                    │
│    [+ Add Breakfast]  [📚 Assign Collection]      │
└────────────────────────────────────────────────────┘
```

**Has Meals**:
```
┌────────────────────────────────────────────────────┐
│ Breakfast (2 meals)                                │
│ ┌──────────────────────────────────────────────┐  │
│ │ 👨‍👩‍👧‍👦 Whole Family: Pancakes                 │  │
│ └──────────────────────────────────────────────┘  │
│ ┌──────────────────────────────────────────────┐  │
│ │ 👤 John: Oatmeal                              │  │
│ └──────────────────────────────────────────────┘  │
│ ─────────────────────────────────────────────────  │
│    [+ Add Another Breakfast]                       │
└────────────────────────────────────────────────────┘
```

---

### F. Responsive Behavior

**Desktop (> 1200px)**:
- Grid view shows full titles
- List view shows all details

**Tablet (768px - 1200px)**:
- Grid view uses truncated titles (15 chars)
- List view maintains full display

**Mobile (< 768px)**:
- Grid view switches to 4 or 5 columns (not 7)
- Or switches to list view entirely
- Meals stack naturally in vertical layout

---

## User Experience Flows

### Flow 1: Viewing as "Whole Family"
1. User opens meal planner
2. Sees ALL meals from ALL users aggregated
3. Each meal shows user badge (👨‍👩‍👧‍👦 👤 etc.)
4. Can easily see "Oh, John has Oatmeal, Sarah has Yogurt, and we have Pancakes"
5. Calendar events show all 3 meals at 8:00 AM

### Flow 2: Viewing as Individual User (John)
1. John switches to his account
2. Sees only his meals + Whole Family fallbacks
3. Monday Breakfast: Shows his Oatmeal
4. Monday Lunch: Shows Whole Family meal (he hasn't overridden)
5. Can add his own lunch to override

### Flow 3: Adding Multiple Meals
1. User clicks "+ Add Another Breakfast"
2. Meal picker opens with user selector (defaults to active user)
3. Selects recipe
4. New meal card appears below existing ones
5. Clear visual separation with divider

---

## Summary of UI Changes

### List View Changes:
- ✅ **Minimal Impact** - Vertical space is abundant
- ✅ Meals stack naturally with dividers
- ✅ Clear user badges
- ✅ Individual action buttons per meal
- ⚠️ May get long with 4+ meals (acceptable for list view)

### Grid View Changes:
- ⚠️ **Moderate Impact** - Width constrained
- ✅ Compact stacked view for 2-3 meals
- ✅ Bullet list for 4+ meals
- ✅ Count badge shows number of meals
- ⚠️ Some title truncation needed

### Overall Assessment:
- **List View**: Excellent for multiple meals (primary use case)
- **Grid View**: Good for quick overview, click for details
- **User Experience**: Clean, intuitive, maintains existing patterns
- **Performance**: No concerns, simple DOM rendering

---

## Implementation Priority

1. **Phase 1**: Update list view (most important, most used)
2. **Phase 2**: Update grid view compact display
3. **Phase 3**: Polish interactions (drag/drop, modals)
4. **Phase 4**: Responsive optimizations

**Estimated UI Changes**: ~200 lines of HTML/CSS, ~150 lines of JavaScript
