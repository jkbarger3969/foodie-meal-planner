#!/bin/bash

# Fix script for AddPantryItemView.swift build error
# Copies the fixed version to your Xcode project

echo "🔧 Fixing AddPantryItemView.swift build error..."
echo ""

SOURCE="ios-apps/FoodieShoppingList/Views/AddPantryItemView.swift"
DEST="/Users/keithbarger/Desktop/FoodieShoppingList/FoodieShoppingList/Views/AddPantryItemView.swift"

if [ ! -f "$SOURCE" ]; then
    echo "❌ Source file not found: $SOURCE"
    exit 1
fi

if [ ! -d "$(dirname "$DEST")" ]; then
    echo "❌ Destination directory not found: $(dirname "$DEST")"
    exit 1
fi

echo "📦 Copying fixed file..."
cp -v "$SOURCE" "$DEST"

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ File updated successfully!"
    echo ""
    echo "📝 What was fixed:"
    echo "  - Changed from Message struct to [String: Any] dictionary"
    echo "  - ConnectionManager.send() expects a dictionary, not a Message"
    echo ""
    echo "🔨 Next steps:"
    echo "  1. In Xcode: Product → Clean Build Folder (⌘⇧K)"
    echo "  2. Build again: Product → Build (⌘B)"
    echo "  3. Build should now succeed!"
    echo ""
else
    echo ""
    echo "❌ Copy failed - please check permissions"
    exit 1
fi
