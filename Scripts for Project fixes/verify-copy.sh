#!/bin/bash

# Show what files will be copied (dry-run verification)

SOURCE_SHOPPING="ios-apps/FoodieShoppingList"
SOURCE_KITCHEN="ios-apps/FoodieKitchen"
DESKTOP_SHOPPING="$HOME/Desktop/FoodieShoppingList/FoodieShoppingList"
DESKTOP_KITCHEN="$HOME/Desktop/FoodieKitchen/FoodieKitchen"

echo "📋 File Copy Preview"
echo "===================="
echo ""

echo "📱 iPhone App (FoodieShoppingList)"
echo "-----------------------------------"

if [ -d "$DESKTOP_SHOPPING" ]; then
    echo "✓ Destination exists: $DESKTOP_SHOPPING"
    echo ""
    
    echo "Files to copy:"
    
    # Services
    if [ -f "$SOURCE_SHOPPING/Services/ConnectionManager.swift" ]; then
        echo "  ✓ Services/ConnectionManager.swift"
        ls -lh "$SOURCE_SHOPPING/Services/ConnectionManager.swift" | awk '{print "    Modified:", $6, $7, $8, "Size:", $5}'
    fi
    
    if [ -f "$SOURCE_SHOPPING/Services/ShoppingListStore.swift" ]; then
        echo "  ✓ Services/ShoppingListStore.swift"
        ls -lh "$SOURCE_SHOPPING/Services/ShoppingListStore.swift" | awk '{print "    Modified:", $6, $7, $8, "Size:", $5}'
    fi
    
    # App file
    if [ -f "$SOURCE_SHOPPING/FoodieShoppingListApp.swift" ]; then
        echo "  ✓ FoodieShoppingListApp.swift"
        ls -lh "$SOURCE_SHOPPING/FoodieShoppingListApp.swift" | awk '{print "    Modified:", $6, $7, $8, "Size:", $5}'
    fi
    
    echo ""
    echo "Destination files (will be overwritten):"
    [ -f "$DESKTOP_SHOPPING/Services/ConnectionManager.swift" ] && ls -lh "$DESKTOP_SHOPPING/Services/ConnectionManager.swift" | awk '{print "  • Services/ConnectionManager.swift -", $6, $7, $8}'
    [ -f "$DESKTOP_SHOPPING/Services/ShoppingListStore.swift" ] && ls -lh "$DESKTOP_SHOPPING/Services/ShoppingListStore.swift" | awk '{print "  • Services/ShoppingListStore.swift -", $6, $7, $8}'
    [ -f "$DESKTOP_SHOPPING/FoodieShoppingListApp.swift" ] && ls -lh "$DESKTOP_SHOPPING/FoodieShoppingListApp.swift" | awk '{print "  • FoodieShoppingListApp.swift -", $6, $7, $8}'
else
    echo "✗ Destination not found: $DESKTOP_SHOPPING"
fi

echo ""
echo "📱 iPad App (FoodieKitchen)"
echo "---------------------------"

if [ -d "$DESKTOP_KITCHEN" ]; then
    echo "✓ Destination exists: $DESKTOP_KITCHEN"
    
    # Check for any recently modified files
    recent_files=$(find "$SOURCE_KITCHEN" -name "*.swift" -mtime -1 2>/dev/null | wc -l)
    echo "  Recently modified files in source: $recent_files"
else
    echo "✗ Destination not found: $DESKTOP_KITCHEN"
fi

echo ""
echo "======================================"
echo "🔍 Verification Complete"
echo "======================================"
echo ""
echo "To proceed with the copy, run:"
echo "  ./copy-all-companion-files.sh"
echo ""
