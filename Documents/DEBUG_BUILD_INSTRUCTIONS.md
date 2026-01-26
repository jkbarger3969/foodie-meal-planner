# Debug Build - Comprehensive Console Logging

## What Changed

Added extensive console logging to trace the exact execution path and identify where the code is failing.

## New Console Logs

### IPC Handler Level (Lines 1046-1076)

**When buttons are clicked, you'll see:**

```javascript
// Shopping List button:
📱 IPC: companion:send-shopping-list called
📱 Calling pushShoppingListToPhones()...
📱 pushShoppingListToPhones() returned count: X

// Or if error:
❌ Companion server not initialized
❌ Error in pushShoppingListToPhones: [error details]

// Meals button:
📱 IPC: companion:send-todays-meals called
📱 Calling pushTodaysMealsToTablets()...
📱 pushTodaysMealsToTablets() returned count: X

// Or if error:
❌ Companion server not initialized
❌ Error in pushTodaysMealsToTablets: [error details]
```

### CompanionServer Method Level (Lines 404-497)

**Inside the methods:**

```javascript
🔍 pushShoppingListToPhones: Starting...
🔍 pushShoppingListToPhones: Today is 2026-01-18
📤 Pushed shopping list (X items from Y recipes) to all iPhones

// Or:
🔍 pushTodaysMealsToTablets: Starting...
🔍 pushTodaysMealsToTablets: Today is 2026-01-18
📤 Pushed X meals for today to all iPads
```

## Testing Instructions

### 1. Install New Build

**File:** `dist/Foodie Meal Planner-1.0.0-arm64.dmg` (20:19)

On wife's laptop:
1. Install the new .dmg (replace existing)
2. Launch Foodie Meal Planner
3. **Open Developer Tools:** View → Toggle Developer Tools
4. Click the **Console** tab

### 2. Test Shopping List

**Click:** "Send Shopping List to Phones" button

**What to check in console:**

**If working correctly:**
```
📱 IPC: companion:send-shopping-list called
📱 Calling pushShoppingListToPhones()...
🔍 pushShoppingListToPhones: Starting...
🔍 pushShoppingListToPhones: Today is 2026-01-18
📤 Pushed shopping list (15 items from 3 recipes) to all iPhones
📱 pushShoppingListToPhones() returned count: 1
```

**If companion server not initialized:**
```
📱 IPC: companion:send-shopping-list called
❌ Companion server not initialized
```

**If database/API error:**
```
📱 IPC: companion:send-shopping-list called
📱 Calling pushShoppingListToPhones()...
🔍 pushShoppingListToPhones: Starting...
🔍 pushShoppingListToPhones: Today is 2026-01-18
❌ Error in pushShoppingListToPhones: [error message will show here]
```

**If NOTHING appears:**
- The IPC handler isn't being called at all
- Issue in preload.js or renderer

### 3. Test Today's Meals

**Click:** "Send Today's Meals to iPads" button

**What to check in console:**

**If working correctly:**
```
📱 IPC: companion:send-todays-meals called
📱 Calling pushTodaysMealsToTablets()...
🔍 pushTodaysMealsToTablets: Starting...
🔍 pushTodaysMealsToTablets: Today is 2026-01-18
📤 Pushed 3 meals for today to all iPads
📱 pushTodaysMealsToTablets() returned count: 1
```

**If no meal plan:**
```
📱 IPC: companion:send-todays-meals called
📱 Calling pushTodaysMealsToTablets()...
🔍 pushTodaysMealsToTablets: Starting...
🔍 pushTodaysMealsToTablets: Today is 2026-01-18
📤 Pushed empty meal plan (no plan for today)
📱 pushTodaysMealsToTablets() returned count: 1
```

## What To Report Back

After installing and testing, please copy and paste:

1. **The EXACT console output** when you click "Send Shopping List"
2. **The EXACT console output** when you click "Send Today's Meals"
3. **The alert message** that pops up for each
4. **Whether data appears** on iPhone/iPad

## Possible Issues We'll Identify

### If you see NOTHING in console:
- Preload.js not loaded correctly
- IPC handlers not registered
- Button onclick not working

### If you see IPC log but no method log:
- Companion server not initialized
- Error thrown before method starts

### If you see method start but no completion:
- Error during execution (will show in ❌ log)
- Database query failing
- API call hanging

### If you see "returned count: 0":
- No devices connected (but UI says they are)
- Case sensitivity still an issue
- Device type mismatch

### If you see "returned count: 1" but no data on device:
- WebSocket send failing silently
- iOS app not receiving messages
- iOS app not processing messages

---

**This debug build will pinpoint exactly where the issue is!**
