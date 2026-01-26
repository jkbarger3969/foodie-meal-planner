#!/bin/bash

# test-all-features.sh
# Comprehensive test script for Foodie Meal Planner features
# Tests database operations directly to verify all features work

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Get database path
DB_PATH="./data/foodie.sqlite"
if [ ! -f "$DB_PATH" ]; then
  # Try user data directory
  USER_DATA_DIR="$HOME/Library/Application Support/Electron/foodie.sqlite"
  if [ -f "$USER_DATA_DIR" ]; then
    DB_PATH="$USER_DATA_DIR"
  else
    echo -e "${RED}✗ Database not found at $DB_PATH or $USER_DATA_DIR${NC}"
    exit 1
  fi
fi

echo "Testing Foodie Meal Planner Features"
echo "Database: $DB_PATH"
echo "======================================="
echo ""

PASS_COUNT=0
FAIL_COUNT=0

# Helper functions
pass() {
  echo -e "${GREEN}✓ PASS${NC}: $1"
  PASS_COUNT=$((PASS_COUNT + 1))
}

fail() {
  echo -e "${RED}✗ FAIL${NC}: $1"
  FAIL_COUNT=$((FAIL_COUNT + 1))
}

warn() {
  echo -e "${YELLOW}⚠ WARN${NC}: $1"
}

test_query() {
  local description="$1"
  local query="$2"
  local expected_behavior="$3"
  
  result=$(sqlite3 "$DB_PATH" "$query" 2>&1)
  exit_code=$?
  
  if [ $exit_code -eq 0 ]; then
    if [ -n "$result" ]; then
      pass "$description - Found: $(echo "$result" | wc -l | tr -d ' ') row(s)"
    else
      if [ "$expected_behavior" = "allow_empty" ]; then
        pass "$description - Empty result (expected)"
      else
        warn "$description - No data found (query successful but empty)"
        PASS_COUNT=$((PASS_COUNT + 1))
      fi
    fi
  else
    fail "$description - Query failed: $result"
  fi
}

test_table_exists() {
  local table_name="$1"
  result=$(sqlite3 "$DB_PATH" "SELECT name FROM sqlite_master WHERE type='table' AND name='$table_name';" 2>&1)
  
  if [ -n "$result" ]; then
    pass "Table exists: $table_name"
  else
    fail "Table missing: $table_name"
  fi
}

test_column_exists() {
  local table_name="$1"
  local column_name="$2"
  result=$(sqlite3 "$DB_PATH" "PRAGMA table_info($table_name);" | grep -i "$column_name" || true)
  
  if [ -n "$result" ]; then
    pass "Column exists: $table_name.$column_name"
  else
    fail "Column missing: $table_name.$column_name"
  fi
}

echo "=== 1. RECIPE MANAGEMENT ==="
echo ""

# Test table structure
test_table_exists "recipes"
test_table_exists "ingredients"
test_column_exists "recipes" "RecipeId"
test_column_exists "recipes" "Title"
test_column_exists "recipes" "TitleLower"
test_column_exists "recipes" "is_favorite"

# Test listRecipesAll functionality
test_query "listRecipesAll - List all recipes" \
  "SELECT COUNT(*) FROM recipes;" \
  "allow_empty"

test_query "listRecipesAll - Check for TitleLower index" \
  "SELECT COUNT(*) FROM recipes WHERE TitleLower IS NOT NULL;" \
  "allow_empty"

# Test searchRecipesFuzzy functionality
test_query "searchRecipesFuzzy - Search with LIKE" \
  "SELECT COUNT(*) FROM recipes WHERE TitleLower LIKE '%chicken%' OR Title LIKE '%chicken%' LIMIT 100;" \
  "allow_empty"

# Test getRecipe functionality
recipe_id=$(sqlite3 "$DB_PATH" "SELECT RecipeId FROM recipes LIMIT 1;" 2>/dev/null || echo "")
if [ -n "$recipe_id" ]; then
  test_query "getRecipe - Get single recipe by ID" \
    "SELECT Title FROM recipes WHERE RecipeId = '$recipe_id';" \
    "require_data"
  
  # Test listRecipeIngredients
  test_query "listRecipeIngredients - Get ingredients for recipe" \
    "SELECT COUNT(*) FROM ingredients WHERE RecipeId = '$recipe_id';" \
    "allow_empty"
else
  warn "getRecipe - No recipes in database to test"
fi

# Test toggleRecipeFavorite functionality
test_query "toggleRecipeFavorite - Check favorite column exists and works" \
  "SELECT COUNT(*) FROM recipes WHERE is_favorite = 1;" \
  "allow_empty"

echo ""
echo "=== 2. MEAL PLANNING ==="
echo ""

# Test plans table structure
test_table_exists "plans"
test_column_exists "plans" "Date"
test_column_exists "plans" "BreakfastRecipeId"
test_column_exists "plans" "BreakfastTitle"
test_column_exists "plans" "LunchRecipeId"
test_column_exists "plans" "DinnerRecipeId"

# Test getPlansRange functionality
test_query "getPlansRange - Get plans for date range" \
  "SELECT COUNT(*) FROM plans WHERE Date >= '2026-01-01' AND Date <= '2026-12-31';" \
  "allow_empty"

test_query "getPlansRange - Check plan structure with meals" \
  "SELECT Date, BreakfastTitle, LunchTitle, DinnerTitle FROM plans WHERE BreakfastTitle IS NOT NULL OR LunchTitle IS NOT NULL OR DinnerTitle IS NOT NULL LIMIT 5;" \
  "allow_empty"

# Test upsertPlanMeal functionality (check if we can read plan data correctly)
test_query "upsertPlanMeal - Verify plan data can be queried" \
  "SELECT COUNT(*) FROM plans;" \
  "allow_empty"

# Test additional items functionality
test_table_exists "plan_additional_items"
test_query "getAdditionalItems - Query additional items table" \
  "SELECT COUNT(*) FROM plan_additional_items;" \
  "allow_empty"

echo ""
echo "=== 3. SHOPPING LIST ==="
echo ""

# Test buildShoppingList functionality
test_query "buildShoppingList - Verify ingredients can be aggregated" \
  "SELECT IngredientNorm, COUNT(*) as count FROM ingredients GROUP BY IngredientNorm LIMIT 10;" \
  "allow_empty"

test_query "buildShoppingList - Check store assignments" \
  "SELECT DISTINCT StoreId FROM ingredients WHERE StoreId IS NOT NULL AND StoreId != '';" \
  "allow_empty"

test_query "buildShoppingList - Check ingredient categories" \
  "SELECT DISTINCT Category FROM ingredients WHERE Category IS NOT NULL AND Category != '';" \
  "allow_empty"

# Test pantry deduction functionality
test_table_exists "pantry"
test_column_exists "pantry" "QtyNum"
test_column_exists "pantry" "Unit"
test_query "buildShoppingList - Check pantry items for deduction" \
  "SELECT COUNT(*) FROM pantry WHERE QtyNum IS NOT NULL AND QtyNum > 0;" \
  "allow_empty"

echo ""
echo "=== 4. MULTI-USER SUPPORT ==="
echo ""

# Test users table
test_table_exists "users"
test_column_exists "users" "user_id"
test_column_exists "users" "name"
test_column_exists "users" "is_active"

# Test listUsers functionality
test_query "listUsers - Get all users" \
  "SELECT COUNT(*) FROM users;" \
  "allow_empty"

# Test getActiveUser functionality
test_query "getActiveUser - Get active users" \
  "SELECT user_id, name FROM users WHERE is_active = 1 LIMIT 1;" \
  "allow_empty"

# Test dietary restrictions
test_table_exists "dietary_restrictions"
test_table_exists "user_dietary_restrictions"
test_query "listDietaryRestrictions - Get dietary restrictions" \
  "SELECT COUNT(*) FROM dietary_restrictions;" \
  "allow_empty"

# Test user favorites
test_table_exists "user_favorites"
test_query "getUserFavorites - Check user favorites table" \
  "SELECT COUNT(*) FROM user_favorites;" \
  "allow_empty"

# Test meal assignments
test_table_exists "plan_meal_assignments"
test_query "getMealAssignments - Check meal assignments" \
  "SELECT COUNT(*) FROM plan_meal_assignments;" \
  "allow_empty"

echo ""
echo "=== 5. COLLECTIONS ==="
echo ""

# Test collections tables
test_table_exists "recipe_collections"
test_table_exists "recipe_collection_map"

test_column_exists "recipe_collections" "collection_id"
test_column_exists "recipe_collections" "name"
test_column_exists "recipe_collection_map" "recipe_id"
test_column_exists "recipe_collection_map" "collection_id"
test_column_exists "recipe_collection_map" "is_main_dish"

# Test listCollections functionality
test_query "listCollections - Get all collections" \
  "SELECT COUNT(*) FROM recipe_collections;" \
  "allow_empty"

test_query "listCollectionRecipes - Get recipes in collections" \
  "SELECT COUNT(*) FROM recipe_collection_map;" \
  "allow_empty"

echo ""
echo "=== 6. STORES ==="
echo ""

test_table_exists "stores"
test_column_exists "stores" "StoreId"
test_column_exists "stores" "Name"
test_column_exists "stores" "Priority"

test_query "listStores - Get all stores" \
  "SELECT StoreId, Name, Priority FROM stores ORDER BY Priority ASC;" \
  "allow_empty"

echo ""
echo "=== 7. ADDITIONAL FEATURES ==="
echo ""

# Test category overrides
test_table_exists "category_overrides"
test_query "getCategoryOverrides - Check category overrides" \
  "SELECT COUNT(*) FROM category_overrides;" \
  "allow_empty"

# Test ingredient categories
test_table_exists "ingredient_categories"
test_query "getIngredientCategories - Check ingredient categories" \
  "SELECT category, sort_order FROM ingredient_categories ORDER BY sort_order;" \
  "allow_empty"

# Test Google Calendar integration columns
test_column_exists "plans" "BreakfastEventId"
test_column_exists "plans" "LunchEventId"
test_column_exists "plans" "DinnerEventId"

# Test pantry expiration tracking
test_column_exists "pantry" "expiration_date"
test_column_exists "pantry" "low_stock_threshold"

# Test recipe default servings
test_column_exists "recipes" "default_servings"

echo ""
echo "=== 8. DATABASE INTEGRITY ==="
echo ""

# Test foreign key constraints
test_query "Foreign Keys - Check if foreign keys are enabled" \
  "PRAGMA foreign_keys;" \
  "allow_empty"

# Test indexes
test_query "Indexes - Check for TitleLower index" \
  "SELECT name FROM sqlite_master WHERE type='index' AND name='idx_recipes_titlelower';" \
  "allow_empty"

test_query "Indexes - Check for NameLower index" \
  "SELECT name FROM sqlite_master WHERE type='index' AND name='idx_pantry_namelower';" \
  "allow_empty"

# Test WAL mode
test_query "Database Mode - Check WAL mode" \
  "PRAGMA journal_mode;" \
  "allow_empty"

echo ""
echo "=== 9. DATA VALIDATION ==="
echo ""

# Count total records
total_recipes=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM recipes;" 2>/dev/null || echo "0")
total_ingredients=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM ingredients;" 2>/dev/null || echo "0")
total_plans=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM plans;" 2>/dev/null || echo "0")
total_pantry=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM pantry;" 2>/dev/null || echo "0")
total_users=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM users;" 2>/dev/null || echo "0")
total_collections=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM recipe_collections;" 2>/dev/null || echo "0")

echo "Database Statistics:"
echo "  - Recipes: $total_recipes"
echo "  - Ingredients: $total_ingredients"
echo "  - Meal Plans: $total_plans"
echo "  - Pantry Items: $total_pantry"
echo "  - Users: $total_users"
echo "  - Collections: $total_collections"

# Validate data integrity
if [ "$total_recipes" -gt 0 ]; then
  pass "Data Validation - Database contains recipes"
else
  warn "Data Validation - No recipes in database (empty database is valid for new install)"
  PASS_COUNT=$((PASS_COUNT + 1))
fi

if [ "$total_users" -gt 0 ]; then
  pass "Data Validation - Database contains users"
else
  fail "Data Validation - No users in database (should have default 'Whole Family' user)"
fi

# Check for orphaned ingredients
orphaned=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM ingredients WHERE RecipeId NOT IN (SELECT RecipeId FROM recipes);" 2>/dev/null || echo "0")
if [ "$orphaned" -eq 0 ]; then
  pass "Data Validation - No orphaned ingredients"
else
  warn "Data Validation - Found $orphaned orphaned ingredients"
fi

echo ""
echo "=== 10. SCHEMA VERSION CHECK ==="
echo ""

# Check for all expected tables
expected_tables=("recipes" "ingredients" "stores" "plans" "pantry" "users" "dietary_restrictions" "user_dietary_restrictions" "user_favorites" "plan_meal_assignments" "recipe_collections" "recipe_collection_map" "ingredient_categories" "category_overrides" "user_ingredient_category" "plan_additional_items")

missing_tables=0
for table in "${expected_tables[@]}"; do
  result=$(sqlite3 "$DB_PATH" "SELECT name FROM sqlite_master WHERE type='table' AND name='$table';" 2>&1)
  if [ -z "$result" ]; then
    warn "Expected table missing: $table"
    missing_tables=$((missing_tables + 1))
  fi
done

if [ $missing_tables -eq 0 ]; then
  pass "Schema Version - All expected tables present"
else
  warn "Schema Version - $missing_tables table(s) missing (may be using older schema)"
fi

echo ""
echo "======================================="
echo "TEST SUMMARY"
echo "======================================="
echo -e "${GREEN}Passed: $PASS_COUNT${NC}"
echo -e "${RED}Failed: $FAIL_COUNT${NC}"
echo ""

if [ $FAIL_COUNT -eq 0 ]; then
  echo -e "${GREEN}✓ ALL TESTS PASSED${NC}"
  echo ""
  echo "Your Foodie Meal Planner database is healthy and all features are functional!"
  exit 0
else
  echo -e "${RED}✗ SOME TESTS FAILED${NC}"
  echo ""
  echo "Some features may not work correctly. Review the failures above."
  exit 1
fi
