#!/bin/bash
set -e

echo "Installing properly signed build..."

# Kill
killall "Foodie Meal Planner" 2>/dev/null || true
sleep 2

# Remove old
sudo rm -rf "/Applications/Foodie Meal Planner.app"

# Install from DMG properly
hdiutil attach "dist/Foodie Meal Planner-1.0.0-arm64.dmg" -nobrowse -readonly

sleep 2

# Copy (preserving code signature)
sudo cp -R "/Volumes/Foodie Meal Planner 1.0.0/Foodie Meal Planner.app" /Applications/

# Eject
hdiutil detach "/Volumes/Foodie Meal Planner 1.0.0" || hdiutil detach "/Volumes/Foodie Meal Planner 1.0.0 1" || true

sleep 1

# Verify signature
echo ""
echo "Verifying signature..."
codesign -dv "/Applications/Foodie Meal Planner.app" 2>&1 | grep -E "Authority|Team"

echo ""
echo "Clearing quarantine..."
sudo xattr -cr "/Applications/Foodie Meal Planner.app"

echo ""
echo "✅ Ready! Now double-click to launch from Applications"
