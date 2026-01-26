#!/bin/bash

# Foodie iOS Apps - Automated Build Helper
# This script prepares everything possible without GUI interaction

set -e  # Exit on error

echo "🍎 Foodie iOS Apps - Build Helper"
echo "=================================="
echo ""

# Check if Xcode is installed
if ! command -v xcodebuild &> /dev/null; then
    echo "❌ Xcode is not installed"
    echo "   Please install from App Store: https://apps.apple.com/app/xcode/id497799835"
    exit 1
fi

echo "✅ Xcode found: $(xcodebuild -version | head -1)"
echo ""

# Get your network info
echo "📡 Your Mac's Network Information:"
echo "=================================="
LOCAL_IP=$(ifconfig | grep "inet " | grep -v 127.0.0.1 | awk '{print $2}' | head -1)
echo "   IP Address: $LOCAL_IP"
echo "   iPhone format: ws://$LOCAL_IP:8080"
echo "   iPad format: $LOCAL_IP"
echo ""
echo "⚠️  IMPORTANT: Write down this IP address!"
echo "   Configure iOS apps with this address to connect to THIS Mac."
echo "   To switch to a different Mac (e.g., wife's Mac), just change"
echo "   the IP address in the iOS app settings and reconnect."
echo ""

# Check if projects already exist
IPHONE_PROJECT="ios-apps/FoodieShoppingList.xcodeproj"
IPAD_PROJECT="ios-apps/FoodieKitchen.xcodeproj"

echo "📱 Checking iOS App Files:"
echo "========================="

# Count iPhone files
IPHONE_COUNT=$(find ios-apps/FoodieShoppingList -name "*.swift" 2>/dev/null | wc -l | tr -d ' ')
echo "   iPhone app: $IPHONE_COUNT/12 Swift files"

# Count iPad files
IPAD_COUNT=$(find ios-apps/FoodieKitchen -name "*.swift" 2>/dev/null | wc -l | tr -d ' ')
echo "   iPad app: $IPAD_COUNT/15 Swift files"

if [ "$IPHONE_COUNT" -eq 12 ] && [ "$IPAD_COUNT" -eq 15 ]; then
    echo "   ✅ All Swift files present"
else
    echo "   ⚠️  Some files may be missing"
fi

echo ""
echo "📋 Next Steps (Manual - Requires Xcode GUI):"
echo "==========================================="
echo ""
echo "Unfortunately, I cannot open Xcode or create projects via command line."
echo "Xcode project creation requires GUI interaction."
echo ""
echo "Here's what YOU need to do:"
echo ""
echo "1. Open Xcode:"
echo "   - Press Command+Space"
echo "   - Type: Xcode"
echo "   - Press Enter"
echo ""
echo "2. Create iPhone Project:"
echo "   - Click 'Create a new Xcode project'"
echo "   - Choose: iOS → App"
echo "   - Product Name: FoodieShoppingList"
echo "   - Interface: SwiftUI"
echo "   - Language: Swift"
echo "   - Save in: $(pwd)/ios-apps/"
echo ""
echo "3. Add iPhone Swift Files:"
echo "   - Delete default ContentView.swift"
echo "   - Create folders: Models, Services, Views, Extensions"
echo "   - Drag all .swift files from ios-apps/FoodieShoppingList/ into project"
echo ""
echo "4. Repeat for iPad Project:"
echo "   - Product Name: FoodieKitchen"
echo "   - Save in: $(pwd)/ios-apps/"
echo "   - Set to iPad-only, Landscape-only in settings"
echo "   - Add all .swift files from ios-apps/FoodieKitchen/"
echo ""
echo "5. Configure Permissions (both projects):"
echo "   - Info tab → Add privacy keys for Speech & Microphone"
echo ""
echo "6. Build & Run:"
echo "   - Connect iPhone/iPad via USB"
echo "   - Select device in Xcode toolbar"
echo "   - Click Run button (▶)"
echo ""
echo "📖 Detailed Instructions:"
echo "   Open: ios-apps/INSTALLATION_GUIDE.md"
echo ""
echo "⏱️  Estimated Time: 30-60 minutes for both apps"
echo ""
echo "Your server IP for iOS apps: $LOCAL_IP"
echo ""
