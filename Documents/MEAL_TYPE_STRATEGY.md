# Meal Type Categories - Strategy & Implementation

**Date:** January 17, 2025  
**Status:** Flexible schema with detection patterns

---

## Overview

The meal type system is designed to be **flexible and extensible**:
- Database stores meal types as **TEXT** (no constraints)
- Scraper can detect and store **any meal type**
- App UI can be updated after scraping to support discovered categories

---

## Current Configuration

### Database Schema
```sql
CREATE TABLE recipes (
  ...
  MealType TEXT,  -- No constraints, can store ANY value
  ...
);
```

### Scraper Detection (scripts/bulk-recipe-scraper.js)
**Currently detects 9 meal types:**
1. `Dessert` - Cakes, cookies, pies, ice cream, etc.
2. `Appetizer` - Starters, hors d'oeuvres, dips
3. `Snack` - Energy bars, trail mix, munchies
4. `Brunch` - Specifically tagged as brunch
5. `Breakfast` - Pancakes, waffles, omelets, etc.
6. `Lunch` - Sandwiches, wraps, salads
7. `Dinner` - Main courses, entrees, roasts
8. `Side Dish` - Accompaniments, sides
9. `Beverage` - Drinks, cocktails, smoothies
10. `Any` - Default if no match

### App UI Support (src/renderer/index.html)
**Currently supports 6 meal types:**
1. `Any` - Default/unspecified
2. `Breakfast`
3. `Lunch`
4. `Dinner`
5. `Side Dish`
6. `Dessert`

**NOT yet in UI:**
- ❌ `Appetizer`
- ❌ `Snack`
- ❌ `Brunch`
- ❌ `Beverage`

### Meal Planner Slots
**Currently has 3 fixed slots per day:**
1. `Breakfast`
2. `Lunch`
3. `Dinner`

---

## Workflow Strategy

### Phase 1: Scraping (Capture Everything)
The scraper will:
1. Check recipe JSON-LD for category information
2. Try to match against detection patterns
3. Store whatever makes sense (including new categories)
4. Default to `Any` if no match

**Example Output:**
```
✅ Banana Bread Baked Oatmeal [American] [Breakfast]
✅ Spinach Artichoke Dip [American] [Appetizer]
✅ Iced Coffee Recipe [American] [Beverage]
```

### Phase 2: Analysis (See What You Got)
After scraping, run the analysis script:

```bash
node scripts/analyze-meal-types.js
```

**Example Output:**
```
========================================
📊 MEAL TYPE ANALYSIS
========================================

Total Recipes: 10000

Meal Type Distribution:
─────────────────────────────────────
Dinner          3456 (34.6%) ████████████████
Dessert         1789 (17.9%) ████████
Breakfast       1234 (12.3%) ██████
Side Dish        987 (9.9%)  ████
Lunch            876 (8.8%)  ████
Appetizer        543 (5.4%)  ██
Snack            321 (3.2%)  █
Beverage         198 (2.0%)  █
Brunch           167 (1.7%)  
Any              429 (4.3%)  ██

🆕 New meal types found:
   - Appetizer (543 recipes)
   - Snack (321 recipes)
   - Brunch (167 recipes)
   - Beverage (198 recipes)
```

### Phase 3: Update App UI (Add New Categories)
Based on analysis, update the app to support discovered categories.

**Files to update:**

#### 1. Recipe Editor Dropdown (src/renderer/index.html ~line 1304)
```html
<select id="rMealType">
  <option value="Any">Any</option>
  <option value="Breakfast">Breakfast</option>
  <option value="Brunch">Brunch</option>           <!-- NEW -->
  <option value="Lunch">Lunch</option>
  <option value="Dinner">Dinner</option>
  <option value="Side Dish">Side Dish</option>
  <option value="Appetizer">Appetizer</option>     <!-- NEW -->
  <option value="Snack">Snack</option>             <!-- NEW -->
  <option value="Dessert">Dessert</option>
  <option value="Beverage">Beverage</option>       <!-- NEW -->
</select>
```

#### 2. Import Preview Dropdown (src/renderer/index.html ~line 1632)
```html
<select id="importPreviewMealType">
  <option value="Any">Any</option>
  <option value="Breakfast">Breakfast</option>
  <option value="Brunch">Brunch</option>           <!-- NEW -->
  <option value="Lunch">Lunch</option>
  <option value="Dinner">Dinner</option>
  <option value="Side Dish">Side Dish</option>
  <option value="Appetizer">Appetizer</option>     <!-- NEW -->
  <option value="Snack">Snack</option>             <!-- NEW -->
  <option value="Dessert">Dessert</option>
  <option value="Beverage">Beverage</option>       <!-- NEW -->
</select>
```

#### 3. Meal Planner (Optional - Advanced)
If you want to add more slots, you would need to:
- Update database schema for `plans` table
- Add new slots to the meal planner UI
- Update API endpoints

**Example:** Add a `Snack` slot between Lunch and Dinner

---

## Detection Patterns

The scraper uses keyword matching to detect meal types. Here are the current patterns:

### Dessert
**Keywords:** dessert, cake, cookie, brownie, pie, tart, pudding, ice cream, candy, sweet, chocolate chip, cupcake, mousse, cheesecake, fudge

**Examples:**
- "Chocolate Chip Cookies"
- "New York Cheesecake"
- "Apple Pie"

### Appetizer
**Keywords:** appetizer, starter, hors d'oeuvre, canape, finger food, dip

**Examples:**
- "Spinach Artichoke Dip"
- "Buffalo Wings"
- "Bruschetta"

### Snack
**Keywords:** snack, nibbles, munchies, trail mix, energy bar

**Examples:**
- "Homemade Granola Bars"
- "Trail Mix"
- "Roasted Chickpeas"

### Brunch
**Keywords:** brunch

**Examples:**
- "Brunch Casserole"
- "Eggs Benedict" (might also match Breakfast)

### Breakfast
**Keywords:** breakfast, pancake, waffle, omelet, omelette, cereal, oatmeal, french toast, scrambled, eggs benedict, frittata, bagel, croissant

**Examples:**
- "Fluffy Pancakes"
- "Scrambled Eggs"
- "Overnight Oats"

### Lunch
**Keywords:** lunch, sandwich, wrap, salad bowl, panini, club sandwich

**Examples:**
- "Turkey Club Sandwich"
- "Greek Salad Wrap"
- "Chicken Panini"

### Dinner
**Keywords:** dinner, entree, entrée, main dish, main course, roast, steak, casserole

**Examples:**
- "Roast Chicken"
- "Beef Stew"
- "Chicken Parmesan"

### Side Dish
**Keywords:** side dish, side, accompaniment, coleslaw, mashed potatoes, roasted vegetables, garlic bread, rice pilaf

**Examples:**
- "Garlic Mashed Potatoes"
- "Roasted Brussels Sprouts"
- "Coleslaw"

### Beverage
**Keywords:** beverage, drink, cocktail, smoothie, juice, lemonade, tea, coffee

**Examples:**
- "Strawberry Smoothie"
- "Homemade Lemonade"
- "Iced Coffee"

---

## Priority Order

The scraper checks patterns in this order (first match wins):

1. **Dessert** - Most specific (avoid "sweet potato" matching as dessert)
2. **Appetizer** - Before main meals
3. **Snack** - Before main meals
4. **Brunch** - Specific timing
5. **Breakfast** - Morning meal
6. **Lunch** - Midday meal
7. **Dinner** - Evening meal
8. **Side Dish** - Accompaniment
9. **Beverage** - Drinks
10. **Any** - Default fallback

**Why this order?** To ensure specific categories match before generic ones.

---

## Extending Detection Patterns

To add more keywords or categories, edit `scripts/bulk-recipe-scraper.js` line 349:

```javascript
const patterns = {
  'Dessert': [...],
  'Appetizer': [...],
  'Snack': [...],
  'Brunch': ['brunch', 'brunch casserole'],  // Add more keywords
  // Add new category:
  'Condiment': ['condiment', 'sauce', 'dressing', 'marinade'],
  ...
};
```

---

## Analysis & Review Process

### 1. Run Scraper
```bash
node scripts/bulk-recipe-scraper.js
```

### 2. Analyze Results
```bash
node scripts/analyze-meal-types.js
```

### 3. Review Samples
```bash
sqlite3 data/foodie-scraped.sqlite << EOF
-- See all unique meal types
SELECT DISTINCT MealType FROM recipes ORDER BY MealType;

-- Count by meal type
SELECT MealType, COUNT(*) FROM recipes GROUP BY MealType ORDER BY COUNT(*) DESC;

-- Sample recipes for a specific meal type
SELECT Title, Cuisine, Source FROM recipes WHERE MealType = 'Appetizer' LIMIT 10;

-- Check "Any" category for unmatched recipes
SELECT Title, Cuisine, Source FROM recipes WHERE MealType = 'Any' LIMIT 20;
EOF
```

### 4. Update App UI
Based on the analysis, decide which meal types to add to the app UI dropdowns.

### 5. Test in App
1. Open the app
2. Check recipe editor dropdown
3. Import a recipe and verify meal type is correctly displayed
4. Edit a recipe and change its meal type

---

## Recommendations

### For Recipe Editor
**Add all detected categories** to dropdowns so users can:
- View recipes with all their original categories
- Manually adjust categories if needed
- Filter/search by any category

### For Meal Planner
**Keep it simple with 3-4 slots:**
- Breakfast (or Breakfast/Brunch combined)
- Lunch
- Dinner
- Optional: Snack or Dessert

**Why?** Meal planning works best with simple, predictable slots. Too many slots becomes overwhelming.

### Hybrid Approach
You could:
1. Store full categories in database (`Appetizer`, `Snack`, `Brunch`, etc.)
2. Show all categories in recipe editor
3. Map to planner slots programmatically:
   - `Brunch` → Can go in `Breakfast` slot
   - `Appetizer` → Can go in `Lunch` or `Dinner` slot
   - `Snack` → Not shown in planner (or add a separate snack slot)
   - `Beverage` → Not shown in planner

---

## Next Steps

1. ✅ **Scraper updated** - Now detects 9 meal types
2. ✅ **Analysis script created** - `scripts/analyze-meal-types.js`
3. ⏳ **Run scraper** - See what categories are actually found
4. ⏳ **Run analysis** - Review distribution
5. ⏳ **Update app UI** - Add new categories to dropdowns
6. ⏳ **Test** - Verify everything works

---

## Summary

**Strategy:** Capture everything → Analyze → Update UI as needed

**Benefits:**
- No data loss (all categories stored)
- Flexible schema (can add new categories anytime)
- Data-driven decisions (see what's actually in the scraped data)
- Easy to extend (just add keywords to detection patterns)

**Files:**
- `scripts/bulk-recipe-scraper.js` - Detection patterns
- `scripts/analyze-meal-types.js` - Analysis tool
- `src/renderer/index.html` - UI dropdowns (lines ~1304, ~1632)
- `src/main/db.js` - Database schema (flexible TEXT field)
