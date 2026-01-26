#!/bin/bash

echo "======================================"
echo "GOOGLE CALENDAR SYNC DIAGNOSTIC"
echo "======================================"
echo ""

# Check which app name is being used
echo "1. Checking Electron app userData folders..."
for dir in "Foodie Meal Planner" "foodie-meal-planner" "foodie-meal-planner-desktop"; do
  path=~/Library/Application\ Support/"$dir"
  if [ -d "$path" ]; then
    echo "   ✓ Found: $dir"
    
    # Check for database
    if [ -f "$path/foodie.sqlite" ]; then
      count=$(sqlite3 "$path/foodie.sqlite" "SELECT COUNT(*) FROM plans WHERE Date = '2026-01-14'" 2>/dev/null)
      echo "     - Database: ✓ (plans for 2026-01-14: $count)"
    fi
    
    # Check for Google credentials
    if [ -f "$path/google-credentials.json" ]; then
      echo "     - Google credentials: ✓"
    else
      echo "     - Google credentials: ✗ MISSING"
    fi
    
    # Check for Google token
    if [ -f "$path/google-token.json" ]; then
      echo "     - Google token: ✓"
    else
      echo "     - Google token: ✗ NOT AUTHORIZED"
    fi
    
    echo ""
  fi
done

echo ""
echo "2. Checking test meals in databases..."
for db_path in ~/Library/Application\ Support/*/foodie.sqlite; do
  if [ -f "$db_path" ]; then
    echo "   Database: ${db_path#$HOME/}"
    result=$(sqlite3 "$db_path" "SELECT Date, BreakfastTitle, LunchTitle, DinnerTitle FROM plans WHERE Date = '2026-01-14'" 2>/dev/null)
    if [ -n "$result" ]; then
      echo "   Data: $result"
    else
      echo "   No data for 2026-01-14"
    fi
    echo ""
  fi
done

echo ""
echo "3. LIKELY ISSUES:"
echo ""

# Find which folder has google credentials
has_creds=false
for dir in "Foodie Meal Planner" "foodie-meal-planner" "foodie-meal-planner-desktop"; do
  if [ -f ~/Library/Application\ Support/"$dir"/google-credentials.json ]; then
    has_creds=true
    echo "   ✓ Google credentials found in: $dir"
  fi
done

if [ "$has_creds" = false ]; then
  echo "   ✗ NO GOOGLE CREDENTIALS FOUND"
  echo "     → You need to upload google-credentials.json in the app"
  echo "     → Go to Settings → Google Calendar Sync → Upload Credentials"
  echo ""
fi

# Find which folder has token
has_token=false
for dir in "Foodie Meal Planner" "foodie-meal-planner" "foodie-meal-planner-desktop"; do
  if [ -f ~/Library/Application\ Support/"$dir"/google-token.json ]; then
    has_token=true
    echo "   ✓ Google token found in: $dir"
  fi
done

if [ "$has_token" = false ]; then
  echo "   ✗ NO GOOGLE TOKEN FOUND"
  echo "     → You need to authorize Google Calendar in the app"
  echo "     → Go to Settings → Google Calendar Sync → Authorize"
  echo ""
fi

echo ""
echo "4. NEXT STEPS:"
echo ""
echo "   If credentials/token are missing:"
echo "   1. Open the app"
echo "   2. Press: Cmd + Option + I (to open DevTools)"
echo "   3. Click the Console tab"
echo "   4. Go to Settings → Google Calendar Sync"
echo "   5. Upload google-credentials.json"
echo "   6. Click 'Open Authorization Page'"
echo "   7. Authorize and paste the code"
echo "   8. Try syncing again"
echo "   9. Check console for error messages"
echo ""
echo "   Copy the console output and share it for debugging."
echo ""
