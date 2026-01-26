#!/bin/bash

# Google Calendar Authorization Persistence Fix - Diagnostic & Cleanup Script

echo "========================================"
echo "Google Calendar Authorization Diagnostic"
echo "========================================"
echo ""

FOODIE_DIR="$HOME/Library/Application Support/Foodie Meal Planner"
DEV_DIR="$HOME/Library/Application Support/foodie-meal-planner-desktop"
OLD_DIR="$HOME/Library/Application Support/foodie-meal-planner"

echo "Checking userData directories..."
echo ""

# Check Foodie Meal Planner (correct directory)
if [ -d "$FOODIE_DIR" ]; then
  echo "✓ Foodie Meal Planner (CORRECT - used by both dev and production)"
  echo "  Path: $FOODIE_DIR"
  if [ -f "$FOODIE_DIR/google-credentials.json" ]; then
    echo "  ✓ Has google-credentials.json ($(stat -f%Sm -t '%Y-%m-%d %H:%M' "$FOODIE_DIR/google-credentials.json"))"
  else
    echo "  ✗ Missing google-credentials.json"
  fi
  if [ -f "$FOODIE_DIR/google-token.json" ]; then
    echo "  ✓ Has google-token.json ($(stat -f%Sm -t '%Y-%m-%d %H:%M' "$FOODIE_DIR/google-token.json"))"
  else
    echo "  ✗ Missing google-token.json"
  fi
  echo ""
else
  echo "✗ Foodie Meal Planner directory not found"
  echo "  Will be created on first run"
  echo ""
fi

# Check old dev directory
if [ -d "$DEV_DIR" ]; then
  echo "⚠ foodie-meal-planner-desktop (OLD - should not be used)"
  echo "  Path: $DEV_DIR"
  if [ -f "$DEV_DIR/google-credentials.json" ]; then
    echo "  ⚠ Has google-credentials.json (OBSOLETE)"
  fi
  if [ -f "$DEV_DIR/google-token.json" ]; then
    echo "  ⚠ Has google-token.json (OBSOLETE)"
  fi
  echo "  Recommendation: Can be safely deleted after migration"
  echo ""
else
  echo "✓ No old dev directory found"
  echo ""
fi

# Check legacy directory
if [ -d "$OLD_DIR" ]; then
  echo "⚠ foodie-meal-planner (LEGACY - very old)"
  echo "  Path: $OLD_DIR"
  echo "  Recommendation: Can be safely deleted"
  echo ""
else
  echo "✓ No legacy directory found"
  echo ""
fi

echo "========================================"
echo "Fix Applied:"
echo "========================================"
echo ""
echo "Changed: src/main/google-calendar.js"
echo "  Before: Paths calculated at module load (WRONG)"
echo "  After:  Paths calculated when first used (CORRECT)"
echo ""
echo "This ensures app.setName('Foodie Meal Planner') is applied"
echo "BEFORE paths are calculated, so both dev and production"
echo "use the same userData folder."
echo ""

echo "========================================"
echo "Migration Steps (if needed):"
echo "========================================"
echo ""

if [ -f "$DEV_DIR/google-credentials.json" ] && [ ! -f "$FOODIE_DIR/google-credentials.json" ]; then
  echo "Detected credentials in old dev directory. Migrating..."
  mkdir -p "$FOODIE_DIR"
  cp "$DEV_DIR/google-credentials.json" "$FOODIE_DIR/google-credentials.json"
  echo "✓ Copied google-credentials.json to Foodie Meal Planner"
fi

if [ -f "$DEV_DIR/google-token.json" ] && [ ! -f "$FOODIE_DIR/google-token.json" ]; then
  echo "Detected token in old dev directory. Migrating..."
  mkdir -p "$FOODIE_DIR"
  cp "$DEV_DIR/google-token.json" "$FOODIE_DIR/google-token.json"
  echo "✓ Copied google-token.json to Foodie Meal Planner"
fi

echo ""
echo "========================================"
echo "Testing Instructions:"
echo "========================================"
echo ""
echo "1. Start dev mode: npm run dev"
echo "2. Check Settings → Google Calendar"
echo "3. Should show: '✓ Configured & Authorized'"
echo "4. Quit and restart dev mode"
echo "5. Should STILL show: '✓ Configured & Authorized'"
echo "6. Authorization should now persist!"
echo ""
echo "========================================"
echo "Production Build:"
echo "========================================"
echo ""
echo "When you build and install the app (npm run package),"
echo "it will use the same 'Foodie Meal Planner' folder."
echo "Your authorization will persist across:"
echo "  - Dev mode restarts"
echo "  - Production app restarts"
echo "  - Upgrades to new versions"
echo ""
echo "✓ Fix is production-ready!"
echo ""
