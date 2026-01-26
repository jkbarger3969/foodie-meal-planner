#!/bin/bash
echo "🎯 FINAL PRODUCTION VERIFICATION"
echo "=================================="
echo ""

DB="data/foodie.sqlite"
PASS=0
FAIL=0

test_query() {
  local name="$1"
  local query="$2"
  local expected="$3"
  
  result=$(sqlite3 "$DB" "$query" 2>&1)
  
  if [[ "$result" == *"$expected"* ]] || [[ -n "$result" && "$expected" == "ANY" ]]; then
    echo "✅ $name"
    ((PASS++))
  else
    echo "❌ $name (got: $result)"
    ((FAIL++))
  fi
}

echo "📊 Core Tables & Data"
test_query "recipes table" "SELECT COUNT(*) FROM recipes" "3532"
test_query "ingredients table" "SELECT COUNT(*) FROM ingredients" "ANY"
test_query "plans table" "SELECT name FROM sqlite_master WHERE type='table' AND name='plans'" "plans"
test_query "pantry table" "SELECT name FROM sqlite_master WHERE type='table' AND name='pantry'" "pantry"
test_query "stores table" "SELECT COUNT(*) FROM stores" "3"

echo ""
echo "👥 Multi-User Tables"
test_query "users table" "SELECT COUNT(*) FROM users" "1"
test_query "dietary_restrictions" "SELECT COUNT(*) FROM dietary_restrictions" "10"
test_query "user_favorites" "SELECT name FROM sqlite_master WHERE type='table' AND name='user_favorites'" "user_favorites"
test_query "plan_meal_assignments" "SELECT name FROM sqlite_master WHERE type='table' AND name='plan_meal_assignments'" "plan_meal_assignments"

echo ""
echo "📦 Additional Features"
test_query "recipe_collections" "SELECT name FROM sqlite_master WHERE type='table' AND name='recipe_collections'" "recipe_collections"
test_query "plan_additional_items" "SELECT name FROM sqlite_master WHERE type='table' AND name='plan_additional_items'" "plan_additional_items"

echo ""
echo "📈 Performance Indexes"
test_query "idx_recipes_titlelower" "SELECT name FROM sqlite_master WHERE type='index' AND name='idx_recipes_titlelower'" "idx_recipes_titlelower"
test_query "idx_pantry_namelower" "SELECT name FROM sqlite_master WHERE type='index' AND name='idx_pantry_namelower'" "idx_pantry_namelower"
test_query "idx_additional_items_date_slot" "SELECT name FROM sqlite_master WHERE type='index' AND name='idx_additional_items_date_slot'" "idx_additional_items_date_slot"

echo ""
echo "🔍 Critical Columns"
test_query "recipes.TitleLower" "SELECT COUNT(*) FROM pragma_table_info('recipes') WHERE name='TitleLower'" "1"
test_query "recipes.is_favorite" "SELECT COUNT(*) FROM pragma_table_info('recipes') WHERE name='is_favorite'" "1"
test_query "pantry.NameLower" "SELECT COUNT(*) FROM pragma_table_info('pantry') WHERE name='NameLower'" "1"
test_query "pantry.QtyNum" "SELECT COUNT(*) FROM pragma_table_info('pantry') WHERE name='QtyNum'" "1"
test_query "pantry.Unit" "SELECT COUNT(*) FROM pragma_table_info('pantry') WHERE name='Unit'" "1"

echo ""
echo "=================================="
echo "📊 RESULTS: $PASS passed, $FAIL failed"
echo "=================================="

if [ $FAIL -eq 0 ]; then
  echo "🎉 ALL TESTS PASSED - DATABASE READY FOR PRODUCTION"
  exit 0
else
  echo "⚠️  SOME TESTS FAILED - REVIEW REQUIRED"
  exit 1
fi
