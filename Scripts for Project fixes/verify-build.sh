#!/bin/bash

# Post-Build Verification Script
# Run this after building iOS apps to verify everything works

echo "🧪 Foodie Companion Apps - Post-Build Verification"
echo "===================================================="
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Your server IP
SERVER_IP="192.168.2.115"

echo "📡 Network Configuration:"
echo "========================"
echo -e "   Server IP: ${GREEN}$SERVER_IP${NC}"
echo "   Server Address: ws://$SERVER_IP:8080"
echo ""

# Check if desktop app server is running
echo "🖥️  Desktop App Check:"
echo "====================="

if lsof -i :8080 | grep -q LISTEN; then
    echo -e "   ${GREEN}✅ WebSocket server is running on port 8080${NC}"
else
    echo -e "   ${RED}❌ Server not running on port 8080${NC}"
    echo "   → Launch the Foodie desktop app first"
fi
echo ""

# Check if devices can reach server
echo "📱 Network Connectivity:"
echo "======================="

# Check if server is accessible
if nc -zv $SERVER_IP 8080 2>&1 | grep -q succeeded; then
    echo -e "   ${GREEN}✅ Port 8080 is accessible${NC}"
else
    echo -e "   ${YELLOW}⚠️  Cannot connect to port 8080${NC}"
    echo "   → Check firewall settings"
fi

# Check WiFi interface
WIFI_INTERFACE=$(networksetup -listallhardwareports | awk '/Wi-Fi/{getline; print $2}')
if [ -n "$WIFI_INTERFACE" ]; then
    WIFI_STATUS=$(ifconfig "$WIFI_INTERFACE" | grep "status:" | awk '{print $2}')
    if [ "$WIFI_STATUS" = "active" ]; then
        echo -e "   ${GREEN}✅ WiFi is active${NC}"
    else
        echo -e "   ${RED}❌ WiFi is not active${NC}"
    fi
fi
echo ""

# Check Xcode projects
echo "📂 Xcode Projects:"
echo "=================="

if [ -d "ios-apps/FoodieShoppingList.xcodeproj" ]; then
    echo -e "   ${GREEN}✅ iPhone project exists${NC}"
else
    echo -e "   ${RED}❌ iPhone project not found${NC}"
    echo "   → Create FoodieShoppingList project in Xcode"
fi

if [ -d "ios-apps/FoodieKitchen.xcodeproj" ]; then
    echo -e "   ${GREEN}✅ iPad project exists${NC}"
else
    echo -e "   ${RED}❌ iPad project not found${NC}"
    echo "   → Create FoodieKitchen project in Xcode"
fi
echo ""

# Check Swift files
echo "📝 Swift Files:"
echo "==============="

IPHONE_COUNT=$(find ios-apps/FoodieShoppingList -name "*.swift" -type f 2>/dev/null | wc -l | tr -d ' ')
if [ "$IPHONE_COUNT" -eq 12 ]; then
    echo -e "   ${GREEN}✅ iPhone: $IPHONE_COUNT/12 Swift files${NC}"
else
    echo -e "   ${YELLOW}⚠️  iPhone: $IPHONE_COUNT/12 Swift files${NC}"
fi

IPAD_COUNT=$(find ios-apps/FoodieKitchen -name "*.swift" -type f 2>/dev/null | wc -l | tr -d ' ')
if [ "$IPAD_COUNT" -eq 15 ]; then
    echo -e "   ${GREEN}✅ iPad: $IPAD_COUNT/15 Swift files${NC}"
else
    echo -e "   ${YELLOW}⚠️  iPad: $IPAD_COUNT/15 Swift files${NC}"
fi
echo ""

# Test database connectivity
echo "💾 Desktop App Database:"
echo "========================"

if [ -f "data/foodie.sqlite" ]; then
    SIZE=$(du -h data/foodie.sqlite | awk '{print $1}')
    echo -e "   ${GREEN}✅ Database exists ($SIZE)${NC}"
else
    echo -e "   ${YELLOW}⚠️  Database not found${NC}"
fi
echo ""

# Summary
echo "📋 Integration Summary:"
echo "======================"

# Count checks
CHECKS_PASSED=0
CHECKS_TOTAL=6

[ "$IPHONE_COUNT" -eq 12 ] && ((CHECKS_PASSED++))
[ "$IPAD_COUNT" -eq 15 ] && ((CHECKS_PASSED++))
lsof -i :8080 | grep -q LISTEN && ((CHECKS_PASSED++))
[ -f "data/foodie.sqlite" ] && ((CHECKS_PASSED++))
[ -d "ios-apps/FoodieShoppingList.xcodeproj" ] && ((CHECKS_PASSED++))
[ -d "ios-apps/FoodieKitchen.xcodeproj" ] && ((CHECKS_PASSED++))

if [ $CHECKS_PASSED -eq $CHECKS_TOTAL ]; then
    echo -e "   ${GREEN}✅ All checks passed! ($CHECKS_PASSED/$CHECKS_TOTAL)${NC}"
    echo ""
    echo "🎉 Everything is ready! Test the sync:"
    echo "   1. Open apps on iPhone/iPad"
    echo "   2. Configure server IP: $SERVER_IP"
    echo "   3. Tap Connect in both apps"
    echo "   4. Send data from desktop 📱 button"
else
    echo -e "   ${YELLOW}⚠️  $CHECKS_PASSED/$CHECKS_TOTAL checks passed${NC}"
    echo ""
    echo "Review the items above marked with ❌ or ⚠️"
fi
echo ""

# Manual testing checklist
echo "🧪 Manual Testing Checklist:"
echo "==========================="
echo ""
echo "Desktop → iPhone:"
echo "  [ ] Click 📱 button on desktop"
echo "  [ ] Panel shows iPhone connected"
echo "  [ ] Click 'Send Shopping List to iPhone'"
echo "  [ ] Items appear on iPhone instantly"
echo "  [ ] Check off items (feel haptic feedback)"
echo "  [ ] Add 'Milk' manually on iPhone"
echo "  [ ] Tap sync button on iPhone"
echo "  [ ] 'Milk' appears on desktop shopping list"
echo ""
echo "Desktop → iPad:"
echo "  [ ] Click 📱 button on desktop"
echo "  [ ] Panel shows iPad connected"
echo "  [ ] Click 'Send Today's Meals to iPad'"
echo "  [ ] Recipe list appears on iPad"
echo "  [ ] Tap recipe → split screen shows"
echo "  [ ] Ingredients on left (40%)"
echo "  [ ] Instructions on right (60%)"
echo "  [ ] Tap mic → say 'Next step'"
echo "  [ ] Instruction advances"
echo "  [ ] Say 'Set timer 5 minutes'"
echo "  [ ] Timer appears in bottom bar"
echo ""
echo "Voice Commands (iPad):"
echo "  [ ] 'Next step' → advances"
echo "  [ ] 'Previous step' → goes back"
echo "  [ ] 'Set timer X minutes' → timer starts"
echo "  [ ] 'Done' → stops listening"
echo ""
echo "Connection Status:"
echo "  [ ] Green dot on iPhone app"
echo "  [ ] Green dot on iPad app"
echo "  [ ] Desktop shows 2 devices"
echo "  [ ] Auto-reconnects after network change"
echo ""

echo "📖 For troubleshooting, see:"
echo "   - XCODE_VISUAL_WALKTHROUGH.md"
echo "   - ios-apps/INSTALLATION_GUIDE.md"
echo ""
