#!/bin/bash
set -e

echo "🧪 Testing DMG Fix"
echo "=================="
echo ""

# Mount DMG
echo "📀 Mounting DMG..."
hdiutil attach "dist/Foodie Meal Planner-1.0.0-arm64.dmg"

# Remove old installation
echo ""
echo "🗑️  Removing old installation..."
sudo rm -rf "/Applications/Foodie Meal Planner.app"

# Copy new app
echo ""
echo "📦 Installing new version..."
sudo cp -R "/Volumes/Foodie Meal Planner 1.0.0/Foodie Meal Planner.app" /Applications/

# Clear quarantine
echo ""
echo "🔓 Clearing quarantine..."
sudo xattr -cr "/Applications/Foodie Meal Planner.app"

# Unmount DMG
echo ""
echo "📀 Unmounting DMG..."
hdiutil detach "/Volumes/Foodie Meal Planner 1.0.0"

echo ""
echo "✅ Installation complete!"
echo ""
echo "Now test:"
echo "1. Double-click /Applications/Foodie Meal Planner.app"
echo "2. The window should appear immediately"
echo "3. No icon flicker or crash"
echo ""
echo "If it still crashes, check Console.app for errors:"
echo "  - Open Console.app"
echo "  - Search for 'Foodie Meal Planner'"
echo "  - Look for crash logs or error messages"
