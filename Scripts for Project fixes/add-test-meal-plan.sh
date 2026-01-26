#!/bin/bash
# Add a test meal plan to the production database

USERDATA_DB=~/Library/Application\ Support/Foodie\ Meal\ Planner/foodie.sqlite
TODAY=$(date '+%Y-%m-%d')

echo "=== Checking production database ==="
echo "Database: $USERDATA_DB"
echo "Today: $TODAY"
echo ""

# Check if plan exists
EXISTING=$(sqlite3 "$USERDATA_DB" "SELECT COUNT(*) FROM plans WHERE Date = '${TODAY}';")

if [ "$EXISTING" -gt 0 ]; then
    echo "✅ Meal plan already exists for today!"
    sqlite3 "$USERDATA_DB" "SELECT Date, BreakfastTitle, LunchTitle, DinnerTitle FROM plans WHERE Date = '${TODAY}';"
else
    echo "⚠️  No meal plan for today. Creating one..."
    
    # Get first 3 recipes
    RECIPES=$(sqlite3 "$USERDATA_DB" "SELECT RecipeId, Title FROM recipes LIMIT 3;")
    
    if [ -z "$RECIPES" ]; then
        echo "❌ No recipes found in database!"
        exit 1
    fi
    
    # Extract recipe IDs and titles
    REC1_ID=$(echo "$RECIPES" | sed -n '1p' | cut -d'|' -f1)
    REC1_TITLE=$(echo "$RECIPES" | sed -n '1p' | cut -d'|' -f2)
    REC2_ID=$(echo "$RECIPES" | sed -n '2p' | cut -d'|' -f1)
    REC2_TITLE=$(echo "$RECIPES" | sed -n '2p' | cut -d'|' -f2)
    REC3_ID=$(echo "$RECIPES" | sed -n '3p' | cut -d'|' -f1)
    REC3_TITLE=$(echo "$RECIPES" | sed -n '3p' | cut -d'|' -f2)
    
    # Create meal plan
    sqlite3 "$USERDATA_DB" "
    INSERT OR REPLACE INTO plans (
      Date, 
      BreakfastRecipeId, BreakfastTitle,
      LunchRecipeId, LunchTitle,
      DinnerRecipeId, DinnerTitle,
      UpdatedAt
    ) VALUES (
      '${TODAY}',
      '${REC1_ID}', '${REC1_TITLE}',
      '${REC2_ID}', '${REC2_TITLE}',
      '${REC3_ID}', '${REC3_TITLE}',
      datetime('now')
    );
    "
    
    echo "✅ Created meal plan for ${TODAY}:"
    sqlite3 "$USERDATA_DB" "SELECT Date, BreakfastTitle, LunchTitle, DinnerTitle FROM plans WHERE Date = '${TODAY}';"
fi

echo ""
echo "=== Recipe count ==="
sqlite3 "$USERDATA_DB" "SELECT COUNT(*) || ' recipes' FROM recipes;"

echo ""
echo "Done! Now restart the desktop app."
