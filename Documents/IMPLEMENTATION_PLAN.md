# Implementation Plan - User Requested Features

## STATUS: Need Clarification on Pantry Deduction

**Question for User:**  
You mentioned "pantry subtraction was working in previous versions" but I cannot find any evidence of this integration:
- No "Mark as Cooked" or "Complete Meal" buttons exist
- No automatic deduction on any user action
- The `_deductFromPantry_()` functions exist but are never called
- Only "Pantry Impact" display exists (shows what WOULD be deducted, but doesn't deduct)

**Please clarify:**
1. What action triggered pantry deduction? (button click? automatic?)
2. Where was the button/trigger located? (meal planner? pantry tab?)
3. What happened after deduction? (confirmation message?)

**I can implement this feature, but need to know the expected behavior first.**

---

## READY TO IMPLEMENT

### 1. Toast Notifications ✓
**What they are:** Non-blocking notification popups that appear briefly and fade out
- Replace annoying `alert()` dialogs
- Show success/error messages
- Auto-dismiss after 3-5 seconds
- Stack multiple toasts
- Color-coded (green=success, red=error, blue=info)

**Example:**
```
┌─────────────────────────────┐
│ ✓ Recipe added successfully │  ← Fades in/out, auto-dismisses
└─────────────────────────────┘
```

### 2. Keyboard Shortcuts ✓
**Planned shortcuts:**
- `Esc` - Close any open modal
- `Ctrl/Cmd + S` - Save current recipe
- `Ctrl/Cmd + F` - Focus search box
- `Ctrl/Cmd + N` - New recipe
- Arrow keys - Navigate meal slots in planner
- `Delete` - Remove selected item
- `Enter` - Confirm action in modals

### 3. Loading States ✓
**What they are:** Visual indicators that show operations in progress
- Spinner on buttons during async operations
- Skeleton loaders for lazy-loaded content
- Progress bars for long operations
- Disable buttons during processing

**Example:**
```
[Generating Shopping List... ⟳]  ← Button shows spinner, disabled
```

### 4. UI Polish ✓
**Recommended improvements:**
- Smooth transitions on modals (fade in/out)
- Hover effects on all buttons
- Focus rings for accessibility
- Success animations (checkmark fadeout)
- Smooth scroll to newly added items
- Better empty states with helpful messages

---

## WILL PROCEED WITH

1. ✓ Remove 9 unused backend functions (safely)
2. ✓ Add toast notification system
3. ✓ Add keyboard shortcuts
4. ✓ Add loading states
5. ⏸ Pantry deduction (waiting for clarification)
6. ✓ Fix unicode fractions (needs npm rebuild first)

---

## WAITING FOR USER

**Pantry Deduction Clarification:**
Please describe how this worked before, or tell me how you want it to work now.

**Suggested Implementation:**
Add "Mark as Cooked" button to each meal slot that:
1. Shows confirmation with pantry impact preview
2. Deducts ingredients from pantry on confirm
3. Shows toast notification "✓ Ingredients deducted from pantry"
4. Updates pantry display to show new quantities

**Proceed?**
