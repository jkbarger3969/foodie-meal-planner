#!/bin/bash

echo "Starting diagnostic..."

# Test 1: Check if recipes exist
echo ""
echo "=== Test 1: Recipe Count ==="
sqlite3 data/foodie.sqlite "SELECT COUNT(*) as count FROM recipes;" 

# Test 2: Check QtyText for fractional ingredients  
echo ""
echo "=== Test 2: Sample Ingredient Parsing (fractions) ==="
sqlite3 data/foodie.sqlite "SELECT RecipeId, IngredientName, QtyText, QtyNum, Unit FROM ingredients WHERE QtyText LIKE '%/%' LIMIT 10;"

# Test 3: Check if modal can find recipes
echo ""
echo "=== Test 3: Recipe titles for search ==="
sqlite3 data/foodie.sqlite "SELECT Title FROM recipes WHERE LOWER(Title) LIKE '%chicken%' LIMIT 5;"

# Test 4: Check plans
echo ""
echo "=== Test 4: Current meal plans ==="
sqlite3 data/foodie.sqlite "SELECT Date, BreakfastRecipeId, LunchRecipeId, DinnerRecipeId FROM plans WHERE Date >= date('now') LIMIT 5;"

echo ""
echo "Diagnostic complete."
