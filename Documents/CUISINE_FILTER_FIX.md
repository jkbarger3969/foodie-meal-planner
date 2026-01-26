# Cuisine Filter Dropdown Fix

## Problem
The cuisine filter dropdown in the Recipes tab only showed a partial list of cuisines (10 hardcoded options), not the comprehensive master list of 100+ cuisines.

**Before:**
```html
<select id="recipeCuisineFilter">
  <option value="">All Cuisines</option>
  <option value="Italian">Italian</option>
  <option value="Mexican">Mexican</option>
  <option value="Chinese">Chinese</option>
  <option value="Indian">Indian</option>
  <option value="Japanese">Japanese</option>
  <option value="American">American</option>
  <option value="French">French</option>
  <option value="Thai">Thai</option>
  <option value="Mediterranean">Mediterranean</option>
  <option value="Other">Other</option>
</select>
```

## Root Cause
The `recipeCuisineFilter` dropdown was **hardcoded** with only 10 popular cuisines instead of being dynamically populated from the `COMPREHENSIVE_CUISINES` array (which contains 100+ cuisines).

## Fix

### 1. Cleaned Up HTML
**File:** `src/renderer/index.html` (lines 1025-1027)

Removed hardcoded options, leaving only the "All Cuisines" default:
```html
<select id="recipeCuisineFilter" style="width:auto; padding:6px 10px; min-height:auto;">
  <option value="">All Cuisines</option>
</select>
```

### 2. Added Dynamic Population Function
**File:** `src/renderer/index.html` (lines 4635-4654)

Created `populateCuisineFilter()` function to populate dropdown from comprehensive list:
```javascript
function populateCuisineFilter() {
  const select = document.getElementById('recipeCuisineFilter');
  if (!select) return;
  
  const currentValue = select.value;
  
  // Build options HTML
  const optionsHtml = ['<option value="">All Cuisines</option>'].concat(
    COMPREHENSIVE_CUISINES.map(cuisine => 
      `<option value="${escapeAttr(cuisine)}">${escapeHtml(cuisine)}</option>`
    )
  ).join('');
  
  select.innerHTML = optionsHtml;
  
  // Restore selected value if it still exists
  if (currentValue && COMPREHENSIVE_CUISINES.includes(currentValue)) {
    select.value = currentValue;
  }
}
```

### 3. Called on App Startup
**File:** `src/renderer/index.html` (line 6438)

Added call in `init()` function after recipes are loaded:
```javascript
await resetAndLoadRecipes();

// Populate cuisine filter dropdown with comprehensive list
populateCuisineFilter();

await loadPantry();
```

## Result

The cuisine filter dropdown now shows **all 100+ cuisines** from the comprehensive list:

- Afghan, African, Albanian, American, Argentinian, Armenian, Asian, Australian, Austrian
- Bangladeshi, Barbecue, Belgian, Bolivian, Brazilian, British, Bulgarian
- Cajun/Creole, Cambodian, Caribbean, Chilean, Chinese, Colombian, Cuban, Czech
- Danish, Dominican, Dutch
- Ecuadorian, Egyptian, English, Ethiopian, European
- Filipino, Finnish, French
- Georgian, German, Greek, Guatemalan
- Haitian, Hawaiian, Hungarian
- Icelandic, Indian, Indonesian, Iranian, Iraqi, Irish, Israeli, Italian
- Jamaican, Japanese, Jewish, Jordanian
- Korean, Kosher
- Latin American, Lebanese
- Malaysian, Mediterranean, Mexican, Middle Eastern, Mongolian, Moroccan
- Nepalese, New Zealand, Nigerian, Norwegian
- Pakistani, Persian, Peruvian, Polish, Portuguese, Puerto Rican
- Romanian, Russian
- Salvadoran, Scandinavian, Scottish, Seafood, Serbian, Singaporean, Slovak, South African, South American, Spanish, Sri Lankan, Swedish, Swiss
- Taiwanese, Thai, Tibetan, Turkish
- Ukrainian
- Vegan, Vegetarian, Vietnamese
- Welsh

## Testing

1. **Start the app:**
   ```bash
   npm run dev
   ```

2. **Go to Recipes tab**

3. **Click the cuisine filter dropdown**
   - Should see "All Cuisines" + all 100+ cuisines alphabetically sorted
   - No longer limited to just 10 options

4. **Select any cuisine to filter**
   - Recipes list will filter to show only that cuisine
   - Works with all cuisines, not just the previous 10

## Consistency

This fix ensures consistency across the app:
- ✅ Recipe edit form (`rCuisine`) - uses `COMPREHENSIVE_CUISINES`
- ✅ Cuisine preferences modal - uses `COMPREHENSIVE_CUISINES`
- ✅ Cuisine management (Admin tab) - uses `COMPREHENSIVE_CUISINES`
- ✅ **Recipe filter dropdown** - now uses `COMPREHENSIVE_CUISINES` ✅ FIXED

All cuisine dropdowns now reference the same master list.

## Files Modified
- `src/renderer/index.html` (3 changes)
  - Lines 1025-1027: Removed hardcoded options
  - Lines 4635-4654: Added `populateCuisineFilter()` function
  - Line 6438: Called function in `init()`

## No Breaking Changes
- Filter still defaults to "All Cuisines"
- Existing filter behavior unchanged
- No database changes required
- Backward compatible
