#!/bin/bash
set -e

echo "🔧 FINAL FIX - Installing with safeLog wrapper"
echo "=============================================="
echo ""

# Kill any running instances
killall "Foodie Meal Planner" 2>/dev/null || true
sleep 1

# Clean install
echo "1. Installing from DMG..."
hdiutil attach "dist/Foodie Meal Planner-1.0.0-arm64.dmg" -quiet
sudo rm -rf "/Applications/Foodie Meal Planner.app"
sudo cp -R "/Volumes/Foodie Meal Planner 1.0.0/Foodie Meal Planner.app" /Applications/
sudo xattr -cr "/Applications/Foodie Meal Planner.app"
hdiutil detach "/Volumes/Foodie Meal Planner 1.0.0" -quiet

echo ""
echo "2. Testing with 'open' command (simulates double-click)..."
open -a "Foodie Meal Planner"

sleep 3

echo ""
echo "3. Checking if app is running..."
if ps aux | grep "Foodie Meal Planner" | grep -v grep | grep -v Helper > /dev/null; then
    echo "   ✅ SUCCESS! App is running!"
    echo ""
    echo "   Process:"
    ps aux | grep "Foodie Meal Planner" | grep -v grep | grep -v Helper | head -1
    echo ""
    echo "   NOW CHECK:"
    echo "   - Do you see the Foodie window on your screen?"
    echo "   - Is there a Foodie icon in your dock?"
    echo "   - Does the menu bar say 'Foodie Meal Planner'?"
else
    echo "   ❌ FAILED - App crashed"
    echo ""
    echo "   Check Console.app for crash logs"
fi
