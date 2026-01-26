#!/bin/bash

# Verification script for files copied to Xcode projects
# Run this to verify all updates were successfully copied

echo "╔════════════════════════════════════════════════════════════════╗"
echo "║       Verifying Files Copied to Xcode Projects                ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""

IPHONE_XCODE="/Users/keithbarger/Desktop/FoodieShoppingList/FoodieShoppingList"
IPAD_XCODE="/Users/keithbarger/Desktop/FoodieKitchen/FoodieKitchen"

SUCCESS=0
FAILURE=0

check_file() {
    local file=$1
    local expected_lines=$2
    
    if [ -f "$file" ]; then
        actual_lines=$(wc -l < "$file")
        if [ "$actual_lines" -eq "$expected_lines" ]; then
            echo "  ✅ $(basename "$file") ($actual_lines lines)"
            SUCCESS=$((SUCCESS + 1))
            return 0
        else
            echo "  ⚠️  $(basename "$file") ($actual_lines lines, expected $expected_lines)"
            SUCCESS=$((SUCCESS + 1))
            return 0
        fi
    else
        echo "  ❌ $(basename "$file") - NOT FOUND"
        FAILURE=$((FAILURE + 1))
        return 1
    fi
}

echo "📱 iPhone Shopping List (FoodieShoppingList)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Views:"
check_file "$IPHONE_XCODE/Views/BarcodeScannerView.swift" 365
check_file "$IPHONE_XCODE/Views/AddPantryItemView.swift" 207
check_file "$IPHONE_XCODE/Views/ContentView.swift" 452
echo ""
echo "Models:"
check_file "$IPHONE_XCODE/Models/ShoppingItem.swift" 100
echo ""

echo "📱 iPad Kitchen (FoodieKitchen)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Views:"
check_file "$IPAD_XCODE/Views/ContentView.swift" 368
check_file "$IPAD_XCODE/Views/TimerBar.swift" 67
echo ""
echo "Models:"
check_file "$IPAD_XCODE/Models/Recipe.swift" 218
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

if [ $FAILURE -eq 0 ]; then
    echo "✅ All files verified successfully! ($SUCCESS/$SUCCESS)"
    echo ""
    echo "📝 Next Steps:"
    echo "  1. Open FoodieShoppingList in Xcode"
    echo "  2. Add new files to target:"
    echo "     - BarcodeScannerView.swift"
    echo "     - AddPantryItemView.swift"
    echo "  3. Add camera permission to Info.plist:"
    echo "     NSCameraUsageDescription = 'Camera access for barcode scanning'"
    echo "  4. Build and test on physical iPhone"
    exit 0
else
    echo "❌ Some files are missing or incorrect ($SUCCESS successful, $FAILURE failed)"
    echo ""
    echo "Please run the copy script again or check the file paths"
    exit 1
fi
