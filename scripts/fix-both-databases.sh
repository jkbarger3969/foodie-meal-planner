#!/bin/bash

# Fix Ingredients in Both Databases
# This script applies ingredient normalization fixes to both:
# 1. Seed database (data/foodie.sqlite) - used for packaging
# 2. UserData database - used by running app

set -e

echo "🔧 Fixing ingredients in both databases..."
echo ""

# Fix seed database
echo "1️⃣  Fixing SEED database (data/foodie.sqlite)..."
npx electron scripts/fix-userdata-ingredients.js --seed
echo ""

# Fix userData database
echo "2️⃣  Fixing USERDATA database (~/Library/Application Support/Foodie Meal Planner/foodie.sqlite)..."
npx electron scripts/fix-userdata-ingredients.js --userdata
echo ""

echo "✅ Both databases fixed!"
echo ""
echo "Next steps:"
echo "  1. Restart the desktop app to test changes"
echo "  2. When ready, run 'npm run build' to package with fixed seed database"
