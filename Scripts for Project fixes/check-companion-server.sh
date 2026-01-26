#!/bin/bash

echo "==================================="
echo "Foodie Companion Server Diagnostics"
echo "==================================="
echo ""

# Check if app is running
echo "1. Checking if Foodie Meal Planner is running..."
if pgrep -x "Foodie Meal Planner" > /dev/null; then
    echo "   ✅ App is running"
else
    echo "   ❌ App is NOT running - please launch it first!"
    exit 1
fi

echo ""
echo "2. Finding local IP addresses..."
echo "   Your server should be accessible at one of these:"
echo ""

# Get all non-loopback IPv4 addresses
ifconfig | grep "inet " | grep -v "127.0.0.1" | awk '{print "   ws://" $2 ":8080"}'

echo ""
echo "3. Checking if port 8080 is open..."
if lsof -i :8080 > /dev/null 2>&1; then
    echo "   ✅ Port 8080 is listening"
    lsof -i :8080 | grep LISTEN
else
    echo "   ❌ Port 8080 is NOT listening"
    echo "   The companion server may not have started correctly."
fi

echo ""
echo "==================================="
echo "Next Steps:"
echo "1. Use one of the ws:// addresses above in your iPad settings"
echo "2. Make sure iPad is on the same WiFi network"
echo "3. Enter just the IP address (e.g., 192.168.2.189) in iPad settings"
echo "==================================="
