#!/bin/bash

echo "🔍 Window Creation Test"
echo "======================"
echo ""

# Launch app in background
echo "1. Launching app..."
"/Applications/Foodie Meal Planner.app/Contents/MacOS/Foodie Meal Planner" > /tmp/foodie-launch.log 2>&1 &
APP_PID=$!

sleep 3

echo ""
echo "2. App Process:"
ps aux | grep "Foodie Meal Planner" | grep -v grep | grep -v Helper | head -3

echo ""
echo "3. Window Count (should be > 0):"
osascript -e 'tell application "System Events" to count windows of process "Foodie Meal Planner"' 2>&1 || echo "Permission denied or no windows"

echo ""
echo "4. App in Dock?"
osascript -e 'tell application "System Events" to get name of processes' 2>&1 | tr ',' '\n' | grep -i foodie || echo "Not in dock process list"

echo ""
echo "5. Launch log (first 30 lines):"
head -30 /tmp/foodie-launch.log

echo ""
echo "6. MANUAL TEST:"
echo "   - Look at your screen - do you see a Foodie window?"
echo "   - Look at your dock - is there a Foodie icon?"
echo "   - Look at the top menu bar - does it say 'Foodie Meal Planner'?"
echo ""
echo "7. To kill the app: kill $APP_PID"
