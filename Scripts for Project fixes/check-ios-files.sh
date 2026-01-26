#!/bin/bash

# Verify all iOS app files are present
# Run this before building in Xcode

echo "📱 Verifying iOS App Files"
echo "=========================="
echo ""

# Check iPhone app files
echo "iPhone App (FoodieShoppingList):"
echo "--------------------------------"

IPHONE_DIR="ios-apps/FoodieShoppingList"
MISSING=0

# Models
echo "Models (2 files):"
files=("ShoppingItem.swift" "Message.swift")
for file in "${files[@]}"; do
    if [ -f "$IPHONE_DIR/Models/$file" ]; then
        echo "  ✅ $file"
    else
        echo "  ❌ $file - MISSING!"
        ((MISSING++))
    fi
done

# Services
echo ""
echo "Services (3 files):"
files=("ShoppingListStore.swift" "ConnectionManager.swift" "VoiceInputManager.swift")
for file in "${files[@]}"; do
    if [ -f "$IPHONE_DIR/Services/$file" ]; then
        echo "  ✅ $file"
    else
        echo "  ❌ $file - MISSING!"
        ((MISSING++))
    fi
done

# Views
echo ""
echo "Views (5 files):"
files=("ContentView.swift" "ShoppingItemRow.swift" "AddItemView.swift" "SettingsView.swift" "SyncStatusBanner.swift")
for file in "${files[@]}"; do
    if [ -f "$IPHONE_DIR/Views/$file" ]; then
        echo "  ✅ $file"
    else
        echo "  ❌ $file - MISSING!"
        ((MISSING++))
    fi
done

# Extensions
echo ""
echo "Extensions (1 file):"
if [ -f "$IPHONE_DIR/Extensions/View+Extensions.swift" ]; then
    echo "  ✅ View+Extensions.swift"
else
    echo "  ❌ View+Extensions.swift - MISSING!"
    ((MISSING++))
fi

# Root
echo ""
echo "Root (1 file):"
if [ -f "$IPHONE_DIR/FoodieShoppingListApp.swift" ]; then
    echo "  ✅ FoodieShoppingListApp.swift"
else
    echo "  ❌ FoodieShoppingListApp.swift - MISSING!"
    ((MISSING++))
fi

# Summary
echo ""
echo "================================"
TOTAL_IPHONE=$(find "$IPHONE_DIR" -name "*.swift" -type f | wc -l | tr -d ' ')
echo "Total Swift files found: $TOTAL_IPHONE/13"

if [ $MISSING -eq 0 ] && [ $TOTAL_IPHONE -eq 13 ]; then
    echo "✅ All iPhone app files present!"
else
    echo "❌ Missing $MISSING file(s)"
    echo ""
    echo "Expected: 13 Swift files"
    echo "Found: $TOTAL_IPHONE Swift files"
fi

echo ""
echo "================================"
echo ""

# Check iPad app files
echo "iPad App (FoodieKitchen):"
echo "-------------------------"

IPAD_DIR="ios-apps/FoodieKitchen"
MISSING_IPAD=0

# Models
echo "Models (3 files):"
files=("Recipe.swift" "TimerItem.swift" "Message.swift")
for file in "${files[@]}"; do
    if [ -f "$IPAD_DIR/Models/$file" ]; then
        echo "  ✅ $file"
    else
        echo "  ❌ $file - MISSING!"
        ((MISSING_IPAD++))
    fi
done

# Services
echo ""
echo "Services (4 files):"
files=("ConnectionManager.swift" "RecipeStore.swift" "TimerManager.swift" "VoiceCommandManager.swift")
for file in "${files[@]}"; do
    if [ -f "$IPAD_DIR/Services/$file" ]; then
        echo "  ✅ $file"
    else
        echo "  ❌ $file - MISSING!"
        ((MISSING_IPAD++))
    fi
done

# Views
echo ""
echo "Views (6 files):"
files=("ContentView.swift" "IngredientListView.swift" "InstructionsView.swift" "TimerBar.swift" "SettingsView.swift" "VoiceCommandButton.swift")
for file in "${files[@]}"; do
    if [ -f "$IPAD_DIR/Views/$file" ]; then
        echo "  ✅ $file"
    else
        echo "  ❌ $file - MISSING!"
        ((MISSING_IPAD++))
    fi
done

# Extensions
echo ""
echo "Extensions (1 file):"
if [ -f "$IPAD_DIR/Extensions/View+Extensions.swift" ]; then
    echo "  ✅ View+Extensions.swift"
else
    echo "  ❌ View+Extensions.swift - MISSING!"
    ((MISSING_IPAD++))
fi

# Root
echo ""
echo "Root (1 file):"
if [ -f "$IPAD_DIR/FoodieKitchenApp.swift" ]; then
    echo "  ✅ FoodieKitchenApp.swift"
else
    echo "  ❌ FoodieKitchenApp.swift - MISSING!"
    ((MISSING_IPAD++))
fi

# Summary
echo ""
echo "================================"
TOTAL_IPAD=$(find "$IPAD_DIR" -name "*.swift" -type f | wc -l | tr -d ' ')
echo "Total Swift files found: $TOTAL_IPAD/15"

if [ $MISSING_IPAD -eq 0 ] && [ $TOTAL_IPAD -eq 15 ]; then
    echo "✅ All iPad app files present!"
else
    echo "❌ Missing $MISSING_IPAD file(s)"
    echo ""
    echo "Expected: 15 Swift files"
    echo "Found: $TOTAL_IPAD Swift files"
fi

echo ""
echo "================================"
echo ""
echo "Next Steps:"
echo ""
if [ $MISSING -eq 0 ] && [ $TOTAL_IPHONE -eq 13 ]; then
    echo "iPhone app ready! ✅"
    echo "1. Open Xcode"
    echo "2. Create new iOS App project: FoodieShoppingList"
    echo "3. Drag all files from ios-apps/FoodieShoppingList/ into Xcode"
    echo "4. Add privacy keys (Speech + Microphone)"
    echo "5. Build and run on iPhone"
    echo ""
    echo "See: AFTER_FILES_COPIED.md for detailed steps"
else
    echo "❌ iPhone app has missing files"
    echo "   Fix the missing files before proceeding"
fi

echo ""

if [ $MISSING_IPAD -eq 0 ] && [ $TOTAL_IPAD -eq 15 ]; then
    echo "iPad app ready! ✅"
    echo "1. Open Xcode"
    echo "2. Create new iOS App project: FoodieKitchen"
    echo "3. Set to iPad-only, Landscape-only"
    echo "4. Drag all files from ios-apps/FoodieKitchen/ into Xcode"
    echo "5. Add privacy keys (Speech + Microphone)"
    echo "6. Build and run on iPad"
else
    echo "iPad app ready for later (build iPhone app first)"
fi

echo ""
