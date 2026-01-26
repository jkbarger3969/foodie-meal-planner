#!/bin/bash
set -e

echo "=========================================="
echo "INSTALLING FINAL WORKING BUILD"
echo "=========================================="
echo ""

# Kill everything
killall "Foodie Meal Planner" 2>/dev/null || true
sleep 2

# Remove old app
echo "1. Removing old app..."
rm -rf "/Applications/Foodie Meal Planner.app"
echo "   ✅ Removed"

# Remove old error log
echo "2. Clearing old error log..."
rm -f "/Users/keithbarger/Library/Application Support/Foodie Meal Planner/error.log"
echo "   ✅ Cleared"

# Copy new app
echo "3. Installing NEW build (4:58 PM with EPIPE fix)..."
cp -R "dist/mac-arm64/Foodie Meal Planner.app" /Applications/
echo "   ✅ Installed"

# Clear attributes
echo "4. Clearing extended attributes..."
xattr -cr "/Applications/Foodie Meal Planner.app"
echo "   ✅ Cleared"

echo ""
echo "=========================================="
echo "VERIFICATION:"
echo "=========================================="

TIMESTAMP=$(stat -f "%Sm" -t "%H:%M:%S" "/Applications/Foodie Meal Planner.app/Contents/MacOS/Foodie Meal Planner")
echo "Installed binary: $TIMESTAMP"
echo "Expected: 16:58:xx"

echo ""
echo "5. Launching app..."
open "/Applications/Foodie Meal Planner.app"
sleep 5

# Check if running
PROCS=$(ps aux | grep "/Applications/Foodie Meal Planner" | grep -v grep | wc -l | tr -d ' ')
if [ "$PROCS" -gt 0 ]; then
    echo "✅ App is RUNNING ($PROCS processes)"
    
    # Check for errors
    if [ -f "/Users/keithbarger/Library/Application Support/Foodie Meal Planner/error.log" ]; then
        echo "⚠️  ERROR LOG CREATED:"
        tail -5 "/Users/keithbarger/Library/Application Support/Foodie Meal Planner/error.log"
    else
        echo "✅ NO ERROR LOG - WORKING!"
    fi
else
    echo "❌ App NOT running"
fi

echo ""
echo "=========================================="
echo "READY TO COPY TO OTHER MAC:"
echo "=========================================="
echo ""
echo "Copy this file to your other Mac:"
echo "  dist/Foodie Meal Planner-1.0.0-arm64.dmg"
echo ""
echo "On the other Mac:"
echo "  1. Install from DMG"
echo "  2. Run: sudo xattr -cr '/Applications/Foodie Meal Planner.app'"
echo "  3. Launch"
echo ""
