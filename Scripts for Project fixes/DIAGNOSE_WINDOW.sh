#!/bin/bash

echo "🔍 Diagnosing DMG Install Issue"
echo "================================"
echo ""

# Clean install
echo "1️⃣  Clean install from DMG..."
hdiutil attach "dist/Foodie Meal Planner-1.0.0-arm64.dmg" -quiet
sudo rm -rf "/Applications/Foodie Meal Planner.app"
sudo cp -R "/Volumes/Foodie Meal Planner 1.0.0/Foodie Meal Planner.app" /Applications/
sudo xattr -cr "/Applications/Foodie Meal Planner.app"
hdiutil detach "/Volumes/Foodie Meal Planner 1.0.0" -quiet

echo ""
echo "2️⃣  Launching app from /Applications..."
open "/Applications/Foodie Meal Planner.app"

sleep 3

echo ""
echo "3️⃣  Checking if app is running..."
ps aux | grep "Foodie Meal Planner" | grep -v grep | head -5

echo ""
echo "4️⃣  Checking window visibility..."
osascript -e 'tell application "System Events" to get name of every window of every process whose name contains "Foodie"'

echo ""
echo "5️⃣  If you see 'Foodie Meal Planner' in the process list above,"
echo "     but NO window name, then the window creation is failing."
echo ""
echo "6️⃣  Check the app manually:"
echo "     - Can you see a window?"
echo "     - Is there a menu bar at the top?"
echo "     - Does it respond to clicks?"
