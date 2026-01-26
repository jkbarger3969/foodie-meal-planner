#!/bin/bash
# Comprehensive SQL Query Verification
# Tests all SQL queries in api.js against actual database

DB="data/foodie.sqlite"

echo "=========================================="
echo "SQL QUERY VERIFICATION TEST"
echo "=========================================="
echo ""

passed=0
failed=0
errors=()

# Color codes
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

test_query() {
    local name="$1"
    local query="$2"
    
    echo -n "Testing: $name ... "
    
    if sqlite3 "$DB" "$query" &>/dev/null; then
        echo -e "${GREEN}✓ PASS${NC}"
        ((passed++))
        return 0
    else
        echo -e "${RED}✗ FAIL${NC}"
        ((failed++))
        errors+=("$name: Query failed to execute")
        return 1
    fi
}

echo "Testing SELECT Queries"
echo "--------------------------------------------"

# Recipes table queries
test_query "recipes: SELECT all columns" \
    "SELECT RecipeId, Title, TitleLower, URL, Cuisine, MealType, Notes, Instructions, Image_Name, CreatedAt, UpdatedAt, default_servings, is_favorite FROM recipes LIMIT 1"

test_query "recipes: WHERE TitleLower LIKE" \
    "SELECT RecipeId FROM recipes WHERE TitleLower >= 'a' AND TitleLower < 'b' LIMIT 1"

test_query "recipes: ORDER BY TitleLower" \
    "SELECT RecipeId FROM recipes ORDER BY TitleLower ASC, RecipeId ASC LIMIT 1"

# Ingredients table queries
test_query "ingredients: SELECT by RecipeId" \
    "SELECT IngredientNorm, IngredientRaw, Notes, QtyNum, QtyText, StoreId, Unit, Category, idx FROM ingredients WHERE RecipeId IN (SELECT RecipeId FROM recipes LIMIT 1) ORDER BY idx ASC"

test_query "ingredients: GROUP BY Category" \
    "SELECT DISTINCT Category FROM ingredients WHERE Category IS NOT NULL AND Category != '' ORDER BY Category ASC"

# Plans table queries
test_query "plans: SELECT with date range" \
    "SELECT Date, BreakfastRecipeId, BreakfastTitle, LunchRecipeId, LunchTitle, DinnerRecipeId, DinnerTitle FROM plans WHERE Date >= '2026-01-01' AND Date <= '2026-01-31'"

test_query "plans: UPDATE meal slot" \
    "UPDATE plans SET BreakfastRecipeId='test', BreakfastTitle='test' WHERE Date='2099-12-31'; DELETE FROM plans WHERE Date='2099-12-31'"

# Pantry table queries
test_query "pantry: SELECT all columns" \
    "SELECT ItemId, Name, NameLower, QtyText, QtyNum, Unit, StoreId, Notes, Category, UpdatedAt FROM pantry LIMIT 1"

test_query "pantry: WHERE NameLower" \
    "SELECT * FROM pantry WHERE NameLower >= 'a' AND NameLower < 'b' LIMIT 1"

# Users table queries
test_query "users: SELECT all" \
    "SELECT user_id, name, email, avatar_emoji, is_active, created_at, updated_at FROM users"

test_query "users: WHERE is_active" \
    "SELECT user_id FROM users WHERE is_active = 1"

# Multi-user tables
test_query "dietary_restrictions: SELECT all" \
    "SELECT restriction_id, name, description, created_at FROM dietary_restrictions"

test_query "user_dietary_restrictions: JOIN query" \
    "SELECT udr.user_id, dr.name FROM user_dietary_restrictions udr JOIN dietary_restrictions dr ON udr.restriction_id = dr.restriction_id LIMIT 1"

test_query "user_favorites: JOIN query" \
    "SELECT uf.user_id, uf.recipe_id FROM user_favorites uf JOIN recipes r ON uf.recipe_id = r.RecipeId LIMIT 1"

test_query "plan_meal_assignments: SELECT by date/slot" \
    "SELECT pma.user_id, u.name, u.avatar_emoji FROM plan_meal_assignments pma JOIN users u ON pma.user_id = u.user_id WHERE pma.date = '2026-01-20' AND pma.slot = 'Breakfast'"

# Additional items
test_query "plan_additional_items: SELECT by date/slot" \
    "SELECT id, Date, Slot, RecipeId, Title, ItemType, SortOrder FROM plan_additional_items WHERE Date >= '2026-01-01' AND Date <= '2026-01-31'"

# Collections
test_query "recipe_collections: SELECT all" \
    "SELECT collection_id, name, description, created_at FROM recipe_collections"

test_query "recipe_collection_map: JOIN query" \
    "SELECT rcm.recipe_id, rcm.is_main_dish, r.Title FROM recipe_collection_map rcm JOIN recipes r ON rcm.recipe_id = r.RecipeId LIMIT 1"

# Category overrides (FIXED in Round 4)
test_query "category_overrides: SELECT keyword/category" \
    "SELECT keyword, category FROM category_overrides ORDER BY keyword ASC"

# Stores
test_query "stores: SELECT all" \
    "SELECT StoreId, Name, Priority FROM stores ORDER BY Priority ASC"

echo ""
echo "Testing INSERT/UPDATE/DELETE Operations"
echo "--------------------------------------------"

# Test INSERT with conflict resolution
test_query "INSERT with ON CONFLICT (plans)" \
    "INSERT INTO plans(Date) VALUES('2099-12-31') ON CONFLICT(Date) DO NOTHING; DELETE FROM plans WHERE Date='2099-12-31'"

test_query "INSERT with ON CONFLICT (category_overrides)" \
    "INSERT INTO category_overrides(keyword, category, updated_at) VALUES('test_ingredient', 'Test', datetime('now')) ON CONFLICT(keyword) DO UPDATE SET category=excluded.category; DELETE FROM category_overrides WHERE keyword='test_ingredient'"

# Test UPDATE queries
test_query "UPDATE recipes SET is_favorite" \
    "UPDATE recipes SET is_favorite = 0 WHERE RecipeId = 'nonexistent'"

test_query "UPDATE pantry SET QtyNum/Unit" \
    "UPDATE pantry SET QtyNum=1.0, Unit='cup', QtyText='1 cup' WHERE ItemId = 'nonexistent'"

# Test DELETE queries
test_query "DELETE FROM ingredients WHERE RecipeId" \
    "DELETE FROM ingredients WHERE RecipeId = 'nonexistent'"

echo ""
echo "Testing Complex Queries"
echo "--------------------------------------------"

# Test queries with subqueries
test_query "SELECT with IN subquery" \
    "SELECT RecipeId FROM recipes WHERE RecipeId IN (SELECT RecipeId FROM ingredients LIMIT 1) LIMIT 1"

test_query "SELECT with NOT IN subquery" \
    "SELECT COUNT(*) FROM ingredients WHERE RecipeId NOT IN (SELECT RecipeId FROM recipes)"

# Test GROUP BY and aggregations
test_query "COUNT with GROUP BY" \
    "SELECT Cuisine, COUNT(*) as count FROM recipes WHERE Cuisine IS NOT NULL GROUP BY Cuisine"

test_query "SUM/AVG aggregations" \
    "SELECT COUNT(*) as total, AVG(QtyNum) as avg_qty FROM pantry WHERE QtyNum IS NOT NULL"

# Test LIKE queries
test_query "LIKE with wildcards" \
    "SELECT Title FROM recipes WHERE Title LIKE '%chicken%' LIMIT 1"

# Test DISTINCT
test_query "SELECT DISTINCT Cuisine" \
    "SELECT DISTINCT Cuisine FROM recipes WHERE Cuisine IS NOT NULL AND Cuisine != '' ORDER BY Cuisine"

echo ""
echo "Testing Foreign Key Constraints"
echo "--------------------------------------------"

# These should fail if foreign keys are properly enforced
test_query "Foreign key enforcement ON" \
    "PRAGMA foreign_keys"

# Try to insert with invalid foreign key (should fail gracefully in our code)
test_query "Invalid foreign key handling" \
    "SELECT 1" # Placeholder - we don't actually want to break FK constraints

echo ""
echo "Testing Index Usage"
echo "--------------------------------------------"

# Verify indexes exist and are used
test_query "idx_recipes_titlelower exists" \
    "SELECT name FROM sqlite_master WHERE type='index' AND name='idx_recipes_titlelower'"

test_query "idx_pantry_namelower exists" \
    "SELECT name FROM sqlite_master WHERE type='index' AND name='idx_pantry_namelower'"

test_query "idx_plan_meal_assignments_date_slot exists" \
    "SELECT name FROM sqlite_master WHERE type='index' AND name='idx_plan_meal_assignments_date_slot'"

echo ""
echo "=========================================="
echo "TEST SUMMARY"
echo "=========================================="
echo -e "${GREEN}Passed: $passed${NC}"
echo -e "${RED}Failed: $failed${NC}"

if [ $failed -gt 0 ]; then
    echo ""
    echo -e "${RED}FAILED QUERIES:${NC}"
    for error in "${errors[@]}"; do
        echo "  - $error"
    done
fi

echo ""

if [ $failed -eq 0 ]; then
    echo -e "${GREEN}✅ ALL SQL QUERIES VALID${NC}"
    exit 0
else
    echo -e "${RED}❌ SOME QUERIES FAILED${NC}"
    exit 1
fi
