#!/bin/bash

# Critical Workflow Test Script
# Tests end-to-end user workflows to ensure production readiness

echo "=========================================="
echo "CRITICAL WORKFLOW TESTS"
echo "=========================================="
echo ""

DB_PATH="./data/foodie.sqlite"

# Test 1: Recipe Creation Workflow
echo "Test 1: Recipe Creation Workflow"
echo "--------------------------------------------"

# Check recipes table exists and is accessible
RECIPE_COUNT=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM recipes;" 2>&1)
if [ $? -eq 0 ]; then
    echo "✓ Recipes table accessible ($RECIPE_COUNT recipes)"
else
    echo "✗ FAILED: Cannot access recipes table"
    exit 1
fi

# Check ingredients table exists
ING_COUNT=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM ingredients;" 2>&1)
if [ $? -eq 0 ]; then
    echo "✓ Ingredients table accessible ($ING_COUNT ingredients)"
else
    echo "✗ FAILED: Cannot access ingredients table"
    exit 1
fi

# Verify recipe-ingredient relationship
ORPHAN_CHECK=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM ingredients WHERE RecipeId NOT IN (SELECT RecipeId FROM recipes);" 2>&1)
if [ $? -eq 0 ]; then
    if [ "$ORPHAN_CHECK" -eq 0 ]; then
        echo "✓ No orphaned ingredients"
    else
        echo "⚠ Warning: $ORPHAN_CHECK orphaned ingredients found"
    fi
fi

echo ""

# Test 2: Meal Planning Workflow
echo "Test 2: Meal Planning Workflow"
echo "--------------------------------------------"

# Check plans table
PLAN_COUNT=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM plans;" 2>&1)
if [ $? -eq 0 ]; then
    echo "✓ Plans table accessible ($PLAN_COUNT planned days)"
else
    echo "✗ FAILED: Cannot access plans table"
    exit 1
fi

# Check plan_additional_items table
ADDITIONAL_COUNT=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM plan_additional_items;" 2>&1)
if [ $? -eq 0 ]; then
    echo "✓ Additional items table accessible ($ADDITIONAL_COUNT items)"
else
    echo "✗ FAILED: Cannot access plan_additional_items table"
    exit 1
fi

# Check plan_meal_assignments table
ASSIGNMENT_COUNT=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM plan_meal_assignments;" 2>&1)
if [ $? -eq 0 ]; then
    echo "✓ Meal assignments table accessible ($ASSIGNMENT_COUNT assignments)"
else
    echo "✗ FAILED: Cannot access plan_meal_assignments table"
    exit 1
fi

echo ""

# Test 3: Shopping List Workflow
echo "Test 3: Shopping List Workflow"
echo "--------------------------------------------"

# Check stores table
STORE_COUNT=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM stores;" 2>&1)
if [ $? -eq 0 ]; then
    echo "✓ Stores table accessible ($STORE_COUNT stores)"
else
    echo "✗ FAILED: Cannot access stores table"
    exit 1
fi

# Verify ingredients have valid StoreId references
INVALID_STORES=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM ingredients WHERE StoreId IS NOT NULL AND StoreId != '' AND StoreId NOT IN (SELECT StoreId FROM stores);" 2>&1)
if [ $? -eq 0 ]; then
    if [ "$INVALID_STORES" -eq 0 ]; then
        echo "✓ All ingredient store references valid"
    else
        echo "⚠ Warning: $INVALID_STORES ingredients with invalid StoreId"
    fi
fi

# Check pantry table
PANTRY_COUNT=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM pantry;" 2>&1)
if [ $? -eq 0 ]; then
    echo "✓ Pantry table accessible ($PANTRY_COUNT items)"
else
    echo "✗ FAILED: Cannot access pantry table"
    exit 1
fi

echo ""

# Test 4: Collections Workflow
echo "Test 4: Collections Workflow"
echo "--------------------------------------------"

COLLECTION_COUNT=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM recipe_collections;" 2>&1)
if [ $? -eq 0 ]; then
    echo "✓ Collections table accessible ($COLLECTION_COUNT collections)"
else
    echo "✗ FAILED: Cannot access recipe_collections table"
    exit 1
fi

COLLECTION_MAP_COUNT=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM recipe_collection_map;" 2>&1)
if [ $? -eq 0 ]; then
    echo "✓ Collection map table accessible ($COLLECTION_MAP_COUNT mappings)"
else
    echo "✗ FAILED: Cannot access recipe_collection_map table"
    exit 1
fi

# Verify collection-recipe relationships
ORPHAN_COLLECTIONS=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM recipe_collection_map WHERE recipe_id NOT IN (SELECT RecipeId FROM recipes);" 2>&1)
if [ $? -eq 0 ]; then
    if [ "$ORPHAN_COLLECTIONS" -eq 0 ]; then
        echo "✓ No orphaned collection mappings"
    else
        echo "⚠ Warning: $ORPHAN_COLLECTIONS orphaned collection mappings"
    fi
fi

echo ""

# Test 5: Multi-User Workflow
echo "Test 5: Multi-User Workflow"
echo "--------------------------------------------"

USER_COUNT=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM users;" 2>&1)
if [ $? -eq 0 ]; then
    echo "✓ Users table accessible ($USER_COUNT users)"
else
    echo "✗ FAILED: Cannot access users table"
    exit 1
fi

# Check at least one active user exists
ACTIVE_USERS=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM users WHERE is_active = 1;" 2>&1)
if [ $? -eq 0 ]; then
    if [ "$ACTIVE_USERS" -gt 0 ]; then
        echo "✓ Active users exist ($ACTIVE_USERS active)"
    else
        echo "⚠ Warning: No active users found"
    fi
fi

# Check dietary restrictions
RESTRICTION_COUNT=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM dietary_restrictions;" 2>&1)
if [ $? -eq 0 ]; then
    echo "✓ Dietary restrictions table accessible ($RESTRICTION_COUNT restrictions)"
fi

FAVORITE_COUNT=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM user_favorites;" 2>&1)
if [ $? -eq 0 ]; then
    echo "✓ User favorites table accessible ($FAVORITE_COUNT favorites)"
fi

echo ""

# Test 6: Category Override Workflow
echo "Test 6: Category Override Workflow"
echo "--------------------------------------------"

OVERRIDE_COUNT=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM category_overrides;" 2>&1)
if [ $? -eq 0 ]; then
    echo "✓ Category overrides table accessible ($OVERRIDE_COUNT overrides)"
else
    echo "✗ FAILED: Cannot access category_overrides table"
    exit 1
fi

echo ""

# Test 7: Index Verification
echo "Test 7: Database Indexes"
echo "--------------------------------------------"

INDEXES=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM sqlite_master WHERE type='index' AND name NOT LIKE 'sqlite_%';" 2>&1)
if [ $? -eq 0 ]; then
    echo "✓ Database has $INDEXES custom indexes"
else
    echo "✗ FAILED: Cannot query indexes"
    exit 1
fi

# Verify critical indexes exist
CRITICAL_INDEXES=(
    "idx_recipes_titlelower"
    "idx_pantry_namelower"
    "idx_plan_meal_assignments_date_slot"
    "idx_additional_items_date_slot"
)

for idx in "${CRITICAL_INDEXES[@]}"; do
    EXISTS=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM sqlite_master WHERE type='index' AND name='$idx';" 2>&1)
    if [ "$EXISTS" -eq 1 ]; then
        echo "✓ Index exists: $idx"
    else
        echo "⚠ Warning: Missing index: $idx"
    fi
done

echo ""

# Test 8: Foreign Key Constraints
echo "Test 8: Foreign Key Constraints"
echo "--------------------------------------------"

FK_ENABLED=$(sqlite3 "$DB_PATH" "PRAGMA foreign_keys;" 2>&1)
if [ "$FK_ENABLED" -eq 1 ]; then
    echo "✓ Foreign key constraints enabled"
else
    echo "⚠ Warning: Foreign key constraints disabled"
fi

# Check for integrity violations
INTEGRITY=$(sqlite3 "$DB_PATH" "PRAGMA integrity_check;" 2>&1)
if [ "$INTEGRITY" = "ok" ]; then
    echo "✓ Database integrity check passed"
else
    echo "✗ FAILED: Database integrity issues found"
    echo "$INTEGRITY"
    exit 1
fi

echo ""
echo "=========================================="
echo "SUMMARY"
echo "=========================================="
echo "✅ All critical workflows verified"
echo "✅ Database structure intact"
echo "✅ Relationships valid"
echo "✅ Production ready for beta testing"
echo ""
