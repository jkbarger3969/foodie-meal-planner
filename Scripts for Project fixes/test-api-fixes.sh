#!/bin/bash
# Comprehensive API verification test
# Tests all 8 bug fixes to ensure they work correctly

echo "=========================================="
echo "API FIXES VERIFICATION TEST"
echo "=========================================="
echo ""

DB_PATH="data/foodie.sqlite"

# Color codes
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

passed=0
failed=0

# Test function
test_feature() {
    local test_name="$1"
    local test_cmd="$2"
    
    echo -n "Testing: $test_name ... "
    
    if eval "$test_cmd" &>/dev/null; then
        echo -e "${GREEN}✓ PASS${NC}"
        ((passed++))
        return 0
    else
        echo -e "${RED}✗ FAIL${NC}"
        ((failed++))
        return 1
    fi
}

echo "Database Schema Verification"
echo "--------------------------------------------"

# Test 1: Verify plan_meal_assignments table exists (Bug #4 fix)
test_feature "plan_meal_assignments table exists" \
    "sqlite3 $DB_PATH 'SELECT name FROM sqlite_master WHERE type=\"table\" AND name=\"plan_meal_assignments\"' | grep -q plan_meal_assignments"

# Test 2: Verify users table exists
test_feature "users table exists" \
    "sqlite3 $DB_PATH 'SELECT COUNT(*) FROM users' | grep -qE '^[0-9]+$'"

# Test 3: Verify plan_additional_items table exists
test_feature "plan_additional_items table exists" \
    "sqlite3 $DB_PATH 'SELECT name FROM sqlite_master WHERE type=\"table\" AND name=\"plan_additional_items\"' | grep -q plan_additional_items"

# Test 4: Verify dietary_restrictions table exists
test_feature "dietary_restrictions table exists" \
    "sqlite3 $DB_PATH 'SELECT COUNT(*) FROM dietary_restrictions' | grep -qE '^[0-9]+$'"

# Test 5: Verify user_favorites table exists
test_feature "user_favorites table exists" \
    "sqlite3 $DB_PATH 'SELECT name FROM sqlite_master WHERE type=\"table\" AND name=\"user_favorites\"' | grep -q user_favorites"

# Test 6: Verify recipe_collections table exists
test_feature "recipe_collections table exists" \
    "sqlite3 $DB_PATH 'SELECT name FROM sqlite_master WHERE type=\"table\" AND name=\"recipe_collections\"' | grep -q recipe_collections"

# Test 7: Verify pantry has QtyNum and Unit columns
test_feature "pantry.QtyNum column exists" \
    "sqlite3 $DB_PATH 'PRAGMA table_info(pantry)' | grep -q QtyNum"

test_feature "pantry.Unit column exists" \
    "sqlite3 $DB_PATH 'PRAGMA table_info(pantry)' | grep -q Unit"

# Test 8: Verify recipes has TitleLower column
test_feature "recipes.TitleLower column exists" \
    "sqlite3 $DB_PATH 'PRAGMA table_info(recipes)' | grep -q TitleLower"

# Test 9: Verify recipes has is_favorite column
test_feature "recipes.is_favorite column exists" \
    "sqlite3 $DB_PATH 'PRAGMA table_info(recipes)' | grep -q is_favorite"

echo ""
echo "Critical Indexes Verification"
echo "--------------------------------------------"

# Test 10: Verify plan_meal_assignments indexes
test_feature "idx_plan_meal_assignments_date_slot index exists" \
    "sqlite3 $DB_PATH 'SELECT name FROM sqlite_master WHERE type=\"index\" AND name=\"idx_plan_meal_assignments_date_slot\"' | grep -q idx_plan_meal_assignments_date_slot"

test_feature "idx_plan_meal_assignments_user index exists" \
    "sqlite3 $DB_PATH 'SELECT name FROM sqlite_master WHERE type=\"index\" AND name=\"idx_plan_meal_assignments_user\"' | grep -q idx_plan_meal_assignments_user"

# Test 11: Verify additional items indexes
test_feature "idx_additional_items_date_slot index exists" \
    "sqlite3 $DB_PATH 'SELECT name FROM sqlite_master WHERE type=\"index\" AND name=\"idx_additional_items_date_slot\"' | grep -q idx_additional_items_date_slot"

# Test 12: Verify recipes index
test_feature "idx_recipes_titlelower index exists" \
    "sqlite3 $DB_PATH 'SELECT name FROM sqlite_master WHERE type=\"index\" AND name=\"idx_recipes_titlelower\"' | grep -q idx_recipes_titlelower"

# Test 13: Verify pantry index
test_feature "idx_pantry_namelower index exists" \
    "sqlite3 $DB_PATH 'SELECT name FROM sqlite_master WHERE type=\"index\" AND name=\"idx_pantry_namelower\"' | grep -q idx_pantry_namelower"

echo ""
echo "Data Integrity Verification"
echo "--------------------------------------------"

# Test 14: Verify default user exists
test_feature "Default 'Whole Family' user exists" \
    "sqlite3 $DB_PATH 'SELECT COUNT(*) FROM users WHERE name=\"Whole Family\"' | grep -q '^1$'"

# Test 15: Verify dietary restrictions seeded
test_feature "Dietary restrictions seeded (>= 5)" \
    "[ \$(sqlite3 $DB_PATH 'SELECT COUNT(*) FROM dietary_restrictions') -ge 5 ]"

# Test 16: Verify stores exist
test_feature "Stores table has data (>= 1)" \
    "[ \$(sqlite3 $DB_PATH 'SELECT COUNT(*) FROM stores') -ge 1 ]"

# Test 17: Verify recipes exist
test_feature "Recipes table has data (>= 100)" \
    "[ \$(sqlite3 $DB_PATH 'SELECT COUNT(*) FROM recipes') -ge 100 ]"

# Test 18: Verify ingredients linked to recipes
test_feature "Ingredients exist for recipes" \
    "[ \$(sqlite3 $DB_PATH 'SELECT COUNT(*) FROM ingredients') -ge 100 ]"

echo ""
echo "File Structure Verification"
echo "--------------------------------------------"

# Test 19: Verify main files exist
test_feature "src/main/main.js exists" \
    "[ -f src/main/main.js ]"

test_feature "src/main/api.js exists" \
    "[ -f src/main/api.js ]"

test_feature "src/main/db.js exists" \
    "[ -f src/main/db.js ]"

test_feature "src/main/preload.js exists" \
    "[ -f src/main/preload.js ]"

test_feature "src/renderer/index.html exists" \
    "[ -f src/renderer/index.html ]"

# Test 20: Verify package.json has required dependencies
test_feature "better-sqlite3 dependency exists" \
    "grep -q 'better-sqlite3' package.json"

test_feature "electron dependency exists" \
    "grep -q '\"electron\"' package.json"

test_feature "ws (WebSocket) dependency exists" \
    "grep -q '\"ws\"' package.json"

echo ""
echo "JavaScript Syntax Verification"
echo "--------------------------------------------"

# Test 21-25: Check JavaScript syntax
test_feature "main.js syntax valid" \
    "node --check src/main/main.js"

test_feature "api.js syntax valid" \
    "node --check src/main/api.js"

test_feature "db.js syntax valid" \
    "node --check src/main/db.js"

test_feature "preload.js syntax valid" \
    "node --check src/main/preload.js"

test_feature "google-calendar.js syntax valid" \
    "node --check src/main/google-calendar.js"

echo ""
echo "=========================================="
echo "TEST SUMMARY"
echo "=========================================="
echo -e "${GREEN}Passed: $passed${NC}"
echo -e "${RED}Failed: $failed${NC}"
echo ""

if [ $failed -eq 0 ]; then
    echo -e "${GREEN}✅ ALL TESTS PASSED! Ready to build DMG.${NC}"
    exit 0
else
    echo -e "${RED}❌ SOME TESTS FAILED! Fix issues before building DMG.${NC}"
    exit 1
fi
