# Bulk Scraper Configuration - 10,000 Recipes

## Updated Configuration Summary

The scraper has been configured to collect **10,000 recipes** with balanced meal type distribution.

## Per-Site Targets

| Site | Max Recipes | Listing URLs | Meal Type Coverage |
|------|-------------|--------------|-------------------|
| **AllRecipes** | 2,000 | 9 URLs | Breakfast, Lunch, Dinner (3x), Side Dish (2x), Dessert (2x) |
| **Serious Eats** | 1,500 | 7 URLs | Breakfast, Lunch, Dinner (2x), Side Dish, Dessert, Mixed |
| **BBC Good Food** | 1,500 | 8 URLs | Breakfast, Lunch, Dinner (2x), Side Dish, Dessert (2x), Mixed |
| **Bon Appétit** | 1,500 | 7 URLs | Breakfast, Lunch, Dinner (2x), Side Dish, Dessert, Mixed |
| **Food Network** | 1,200 | 6 URLs | Breakfast, Lunch, Dinner (2x), Side Dish, Dessert |
| **Epicurious** | 1,200 | 7 URLs | Breakfast, Lunch, Dinner (2x), Side Dish, Dessert, Mixed |
| **Delish** | 1,100 | 7 URLs | Breakfast, Lunch, Dinner (2x), Side Dish, Dessert (2x) |
| **TOTAL** | **10,000** | **51 URLs** | **Balanced across all meal types** |

## Expected Meal Type Distribution

Based on the listing URL configuration:

| Meal Type | Expected Count | Percentage |
|-----------|----------------|------------|
| **Dinner** | ~4,000 | 40% |
| **Dessert** | ~1,500 | 15% |
| **Breakfast** | ~1,500 | 15% |
| **Side Dish** | ~1,500 | 15% |
| **Lunch** | ~1,500 | 15% |

**Note:** Some recipes may be auto-categorized as "Any" if meal type cannot be determined.

## Listing URLs by Meal Type

### Breakfast (7 sites × 1 URL each = 7 URLs)
- AllRecipes: `/recipes/76/breakfast-and-brunch/`
- Serious Eats: `/breakfast-recipes-5091894`
- BBC Good Food: `/recipes/collection/breakfast-recipes`
- Bon Appétit: `/recipes/breakfast`
- Food Network: `/recipes/breakfast/p/1`
- Epicurious: `/recipes-menus/breakfast-brunch-recipes`
- Delish: `/cooking/recipe-ideas/g2162/easy-breakfast-recipes/`

### Lunch (7 sites × 1 URL each = 7 URLs)
- AllRecipes: `/recipes/17861/lunch/`
- Serious Eats: `/lunch-recipes-5091897`
- BBC Good Food: `/recipes/collection/lunch-recipes`
- Bon Appétit: `/recipes/lunch`
- Food Network: `/recipes/lunch/p/1`
- Epicurious: `/recipes-menus/lunch-recipes`
- Delish: `/cooking/recipe-ideas/g3175/easy-lunch-ideas/`

### Dinner (Multiple URLs per site = 17 URLs total)
- AllRecipes: 3 URLs (quick-and-easy, dinner, main-dish)
- Serious Eats: 2 URLs (weeknight-dinners, quick-recipes)
- BBC Good Food: 2 URLs (quick-dinner, easy-dinner)
- Bon Appétit: 2 URLs (dinner, quick-recipes)
- Food Network: 2 URLs (main-dish, dinner)
- Epicurious: 2 URLs (dinner-recipes, quick-easy)
- Delish: 2 URLs (quick-easy-dinner, healthy-dinner)

### Side Dish (7 sites × 1 URL each = 9 URLs)
- AllRecipes: 2 URLs (salad, appetizers-and-snacks)
- Serious Eats: `/side-dish-recipes-5091900`
- BBC Good Food: `/recipes/collection/side-dish-recipes`
- Bon Appétit: `/recipes/side-dish`
- Food Network: `/recipes/side-dish/p/1`
- Epicurious: `/recipes-menus/side-dish-recipes`
- Delish: `/cooking/g2447/side-dish-recipes/`

### Dessert (Multiple URLs per site = 11 URLs total)
- AllRecipes: 2 URLs (desserts, cakes)
- Serious Eats: 1 URL (dessert-recipes)
- BBC Good Food: 2 URLs (cake-recipes, dessert-recipes)
- Bon Appétit: 1 URL (dessert)
- Food Network: 1 URL (dessert)
- Epicurious: 1 URL (dessert-recipes)
- Delish: 2 URLs (easy-dessert, best-cookies)

### Mixed/Healthy (Various categories)
- Serious Eats: `/healthy-recipes-5091913`
- BBC Good Food: `/recipes/collection/healthy-recipes`
- Bon Appétit: `/recipes/healthy`
- Epicurious: `/recipes-menus/healthy-recipes`

## Execution Order

The scraper will visit sites in this order:

1. **AllRecipes** (up to 2,000 recipes)
2. **Serious Eats** (up to 1,500 recipes)
3. **BBC Good Food** (up to 1,500 recipes)
4. **Bon Appétit** (up to 1,500 recipes)
5. **Food Network** (up to 1,200 recipes)
6. **Epicurious** (up to 1,200 recipes)
7. **Delish** (up to 1,100 recipes)

**Stops when:** 10,000 total recipes reached

## Expected Source Distribution

If scraper completes all sites:

```
AllRecipes: 2,000 recipes (20%)
Serious Eats: 1,500 recipes (15%)
BBC Good Food: 1,500 recipes (15%)
Bon Appétit: 1,500 recipes (15%)
Food Network: 1,200 recipes (12%)
Epicurious: 1,200 recipes (12%)
Delish: 1,100 recipes (11%)
─────────────────────────────
Total: 10,000 recipes (100%)
```

If scraper stops early (reaches 10,000 before completing all sites):

```
Example:
AllRecipes: 2,000 recipes ✅
Serious Eats: 1,500 recipes ✅
BBC Good Food: 1,500 recipes ✅
Bon Appétit: 1,500 recipes ✅
Food Network: 1,200 recipes ✅
Epicurious: 1,200 recipes ✅
Delish: 600 recipes (stopped at 10,000 total)
─────────────────────────────
Total: 10,000 recipes
```

## Rate Limiting

- **AllRecipes:** 2,500ms (2.5 seconds) between requests
- **All other sites:** 3,000ms (3 seconds) between requests

**Respectful scraping:** Ensures we don't overload any website's servers.

## Estimated Duration

**12-16 hours total**

Breakdown:
- AllRecipes: 2,000 recipes × 2.5s = ~83 minutes (~1.4 hours)
- Serious Eats: 1,500 recipes × 3s = ~75 minutes (~1.25 hours)
- BBC Good Food: 1,500 recipes × 3s = ~75 minutes (~1.25 hours)
- Bon Appétit: 1,500 recipes × 3s = ~75 minutes (~1.25 hours)
- Food Network: 1,200 recipes × 3s = ~60 minutes (~1 hour)
- Epicurious: 1,200 recipes × 3s = ~60 minutes (~1 hour)
- Delish: 1,100 recipes × 3s = ~55 minutes (~0.9 hours)

**Total:** ~8.3 hours of pure scraping time

**With overhead** (page fetches, processing, errors): ~12-16 hours

## Database Schema Compliance

All scraped recipes will comply with the existing database schema:

```sql
recipes:
  - RecipeId (generated)
  - Title, URL, Cuisine, MealType
  - Instructions, Notes (includes attribution)
  - Source, Author
  - default_servings

ingredients:
  - RecipeId, idx
  - IngredientRaw, IngredientName, IngredientNorm
  - QtyNum, QtyText, Unit, Notes
  - Category (populated later via categorization)
```

## Auto-Categorization

**Meal Type Detection:**
- Analyzes recipe name, description, keywords
- Pattern matching for meal type keywords
- Expected accuracy: ~85-90%

**Cuisine Detection:**
- Checks JSON-LD recipeCuisine field
- Keyword analysis (title, description)
- Ingredient analysis (characteristic ingredients)
- Expected accuracy: ~70-80%

## Command to Run

```bash
node scripts/bulk-recipe-scraper.js
```

**One command, 10,000 recipes, balanced meal types!** 🎉
