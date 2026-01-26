#!/bin/bash
set -e

echo "🔧 Installing updated DMG with debug logging..."
echo ""

# Clean install
hdiutil attach "dist/Foodie Meal Planner-1.0.0-arm64.dmg" -quiet
sudo rm -rf "/Applications/Foodie Meal Planner.app"
sudo cp -R "/Volumes/Foodie Meal Planner 1.0.0/Foodie Meal Planner.app" /Applications/
sudo xattr -cr "/Applications/Foodie Meal Planner.app"
hdiutil detach "/Volumes/Foodie Meal Planner 1.0.0" -quiet

echo "✅ Installed"
echo ""
echo "🚀 Launching app..."
"/Applications/Foodie Meal Planner.app/Contents/MacOS/Foodie Meal Planner" 2>&1 | head -30
