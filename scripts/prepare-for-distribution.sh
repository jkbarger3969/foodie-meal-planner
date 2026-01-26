#!/bin/bash

###############################################################################
# Prepare database for distribution
# This script ensures the foodie.sqlite database is properly formatted and fixed
# Run this before creating a distributable package
###############################################################################

set -e  # Exit on error

echo "========================================="
echo "Preparing database for distribution"
echo "========================================="
echo ""

# Navigate to project root
cd "$(dirname "$0")/.."

# Fix ingredient quantities in the authoritative database
echo "Step 1: Fixing ingredient quantities in data/foodie.sqlite..."
node scripts/run-fix-with-electron.js data/foodie.sqlite
echo "✅ Database fixed"
echo ""

# Verify the fixes
echo "Step 2: Verifying fixes..."
echo ""

echo "Checking data/foodie.sqlite for fraction parsing:"
sqlite3 data/foodie.sqlite "SELECT IngredientRaw, QtyText, QtyNum FROM ingredients WHERE IngredientRaw LIKE '%2/3%' LIMIT 3"
echo ""

echo "Checking for 1/4 fractions:"
sqlite3 data/foodie.sqlite "SELECT IngredientRaw, QtyText, QtyNum FROM ingredients WHERE IngredientRaw LIKE '%1/4%' LIMIT 3"
echo ""

echo "========================================="
echo "✅ Database prepared for distribution"
echo "========================================="
echo ""
echo "Next steps:"
echo "1. Run 'npm run rebuild' to ensure better-sqlite3 is compiled for Electron"
echo "2. Test the app thoroughly"
echo "3. Create distributable package"
