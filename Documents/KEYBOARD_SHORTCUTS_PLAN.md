# Phase 1.4: Keyboard Shortcuts Implementation Plan

## Objective
Add comprehensive keyboard shortcuts for efficient navigation and common actions, improving power user productivity.

## Keyboard Shortcuts to Implement

### Navigation Shortcuts
1. **Cmd/Ctrl + 1** - Switch to Recipes tab
2. **Cmd/Ctrl + 2** - Switch to Planner tab
3. **Cmd/Ctrl + 3** - Switch to Shopping tab
4. **Cmd/Ctrl + 4** - Switch to Pantry tab
5. **Cmd/Ctrl + 5** - Switch to Collections tab
6. **Cmd/Ctrl + 6** - Switch to Admin tab

### Action Shortcuts (Already Implemented)
- ✅ **Cmd/Ctrl + Z** - Undo
- ✅ **Cmd/Ctrl + Shift + Z** - Redo
- ✅ **Cmd/Ctrl + S** - Save recipe (when modal open)
- ✅ **Cmd/Ctrl + F** - Focus search
- ✅ **Esc** - Close modals

### New Action Shortcuts
7. **Cmd/Ctrl + N** - New recipe (open recipe modal in create mode)
8. **Cmd/Ctrl + K** - Quick search (focus recipe search from any tab)
9. **Cmd/Ctrl + P** - Print (context-aware: recipe/shopping list/pantry)
10. **Cmd/Ctrl + ,** - Open settings/help modal (optional)

### List Navigation (Optional - Phase 2)
- **Arrow Up/Down** - Navigate recipes list
- **Enter** - Open selected recipe
- **Delete** - Delete selected recipe (with confirmation)

## Implementation Strategy

### 1. Centralized Keyboard Handler
Already exists at line ~8505, will extend it.

### 2. Tab Switching Function
```javascript
function switchToTab(tabNumber) {
  const tabs = ['recipes', 'planner', 'shopping', 'pantry', 'collections', 'admin'];
  if (tabNumber >= 1 && tabNumber <= tabs.length) {
    setTab(tabs[tabNumber - 1]);
  }
}
```

### 3. New Recipe Shortcut
```javascript
// Cmd/Ctrl+N - New recipe
if (modKey && e.key === 'n') {
  e.preventDefault();
  openRecipeModalCreate();
  return;
}
```

### 4. Quick Search (Cmd+K)
```javascript
// Cmd/Ctrl+K - Quick search (global)
if (modKey && e.key === 'k') {
  e.preventDefault();
  // Switch to recipes tab and focus search
  setTab('recipes');
  setTimeout(() => {
    document.getElementById('recipeSearch').focus();
  }, 100);
  return;
}
```

### 5. Context-Aware Print
```javascript
// Cmd/Ctrl+P - Print (context-aware)
if (modKey && e.key === 'p') {
  e.preventDefault();
  
  // Determine current context
  const currentTab = getCurrentTab();
  
  if (currentTab === 'recipes') {
    // Print current recipe if modal open
    if (CURRENT_RECIPE_ID) {
      printCurrentRecipe();
    }
  } else if (currentTab === 'shopping') {
    // Print shopping list
    printShoppingList();
  } else if (currentTab === 'pantry') {
    // Print pantry
    document.getElementById('btnPantryPrint').click();
  }
  return;
}
```

### 6. Help Modal (Cmd+,)
Create a keyboard shortcuts help modal showing all available shortcuts.

```javascript
// Cmd/Ctrl+, - Show keyboard shortcuts help
if (modKey && e.key === ',') {
  e.preventDefault();
  showKeyboardShortcutsHelp();
  return;
}
```

### 7. Question Mark (?) - Help
```javascript
// ? - Show keyboard shortcuts help (alternative)
if (e.key === '?') {
  e.preventDefault();
  showKeyboardShortcutsHelp();
  return;
}
```

## Help Modal Implementation

### HTML Structure
```html
<div id="keyboardShortcutsModal" class="modalBack" style="display:none;">
  <div class="modal-content" style="max-width: 600px;">
    <div class="modal-header">
      <h2>⌨️ Keyboard Shortcuts</h2>
      <button onclick="closeKeyboardShortcutsModal()">×</button>
    </div>
    <div class="modal-body">
      <!-- Shortcuts organized by category -->
    </div>
  </div>
</div>
```

### Shortcuts List
- **Navigation**
  - Cmd+1-6: Switch tabs
  - Cmd+K: Quick search
- **Actions**
  - Cmd+N: New recipe
  - Cmd+S: Save recipe
  - Cmd+P: Print
  - Cmd+Z: Undo
  - Cmd+Shift+Z: Redo
  - Cmd+F: Focus search
  - Esc: Close modals
- **Help**
  - Cmd+,: Show shortcuts
  - ?: Show shortcuts

## Visual Hints

Add subtle keyboard shortcut hints to buttons/menu items:

```html
<button>New Recipe <span class="shortcut-hint">⌘N</span></button>
```

### CSS for Hints
```css
.shortcut-hint {
  opacity: 0.5;
  font-size: 0.85em;
  margin-left: 8px;
}
```

## Testing Checklist

### Navigation
- [ ] Cmd+1 switches to Recipes tab
- [ ] Cmd+2 switches to Planner tab
- [ ] Cmd+3 switches to Shopping tab
- [ ] Cmd+4 switches to Pantry tab
- [ ] Cmd+5 switches to Collections tab
- [ ] Cmd+6 switches to Admin tab
- [ ] Tab switching works from any current tab

### Actions
- [ ] Cmd+N opens new recipe modal
- [ ] Cmd+K focuses search and switches to Recipes tab
- [ ] Cmd+P prints current context
- [ ] Cmd+, shows shortcuts help
- [ ] ? shows shortcuts help

### Context-Aware
- [ ] Cmd+P prints recipe when recipe modal open
- [ ] Cmd+P prints shopping list when on Shopping tab
- [ ] Cmd+P prints pantry when on Pantry tab

### Edge Cases
- [ ] Shortcuts disabled when typing in inputs
- [ ] Shortcuts don't conflict with browser defaults
- [ ] Help modal can be closed with Esc
- [ ] Platform detection (⌘ on Mac, Ctrl on Windows)

## Platform-Specific Display

### Mac
Display: ⌘N, ⌘K, ⌘P, etc.

### Windows/Linux
Display: Ctrl+N, Ctrl+K, Ctrl+P, etc.

### Detection
```javascript
const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
const modSymbol = isMac ? '⌘' : 'Ctrl';
```

## Notes

- Keep shortcuts intuitive and standard
- Avoid conflicts with browser shortcuts
- Provide discoverability via help modal
- Consider adding tooltips to buttons
- Future: Make shortcuts customizable
