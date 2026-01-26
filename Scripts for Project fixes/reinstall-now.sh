#!/bin/bash

echo "=========================================="
echo "REINSTALLING WITH LATEST BUILD"
echo "=========================================="
echo ""

# Kill all instances
echo "1. Killing all instances..."
killall "Foodie Meal Planner" 2>/dev/null
sleep 2

# Remove old installation
echo "2. Removing old installation..."
rm -rf "/Applications/Foodie Meal Planner.app"
echo "   ✅ Old app removed"

# Copy new version
echo "3. Installing new build (4:40 PM)..."
cp -R "dist/mac-arm64/Foodie Meal Planner.app" /Applications/
echo "   ✅ New app installed"

# Remove extended attributes
echo "4. Removing extended attributes..."
xattr -cr "/Applications/Foodie Meal Planner.app"
echo "   ✅ Attributes cleared"

# Verify
echo ""
echo "=========================================="
echo "VERIFICATION:"
echo "=========================================="
INSTALLED_TIME=$(stat -f "%Sm" -t "%H:%M:%S" "/Applications/Foodie Meal Planner.app/Contents/MacOS/Foodie Meal Planner")
echo "Installed app timestamp: $INSTALLED_TIME"
echo "Expected: 16:39:xx (4:39 PM)"
echo ""

# Launch
echo "5. Launching app..."
open "/Applications/Foodie Meal Planner.app"
sleep 3

# Check if running
PROCS=$(ps aux | grep "Foodie Meal Planner" | grep -v grep | wc -l | tr -d ' ')
echo ""
if [ "$PROCS" -gt 0 ]; then
    echo "✅ App is running ($PROCS processes)"
    echo ""
    echo "CHECK: Do you see the window?"
    echo ""
    echo "If NO window appears:"
    echo "  - Press Cmd+Tab to switch to it"
    echo "  - Check Mission Control (F3)"
    echo "  - Run: osascript -e 'tell application \"Foodie Meal Planner\" to activate'"
else
    echo "❌ App is NOT running"
    echo ""
    echo "Try running manually:"
    echo '  open "/Applications/Foodie Meal Planner.app"'
fi

echo ""
echo "=========================================="
