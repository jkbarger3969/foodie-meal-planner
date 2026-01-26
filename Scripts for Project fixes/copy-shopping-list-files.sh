#!/bin/bash

# Copy updated FoodieShoppingList companion files to Desktop Xcode project
# Run this script from the project root directory

set -e

DESKTOP_PROJECT="$HOME/Desktop/FoodieShoppingList/FoodieShoppingList"
SOURCE_DIR="ios-apps/FoodieShoppingList"

echo "🚀 Copying FoodieShoppingList files to Desktop Xcode project..."
echo ""

# Check if desktop project exists
if [ ! -d "$DESKTOP_PROJECT" ]; then
    echo "❌ Error: Desktop project not found at $DESKTOP_PROJECT"
    exit 1
fi

# Copy Services files
echo "📁 Copying Services..."
cp -v "$SOURCE_DIR/Services/ConnectionManager.swift" "$DESKTOP_PROJECT/Services/ConnectionManager.swift"
cp -v "$SOURCE_DIR/Services/ShoppingListStore.swift" "$DESKTOP_PROJECT/Services/ShoppingListStore.swift"
echo ""

# Copy App file
echo "📁 Copying App file..."
cp -v "$SOURCE_DIR/FoodieShoppingListApp.swift" "$DESKTOP_PROJECT/FoodieShoppingListApp.swift"
echo ""

echo "✅ All files copied successfully!"
echo ""
echo "📝 Files copied:"
echo "   - ConnectionManager.swift (added send() method)"
echo "   - ShoppingListStore.swift (added pantry sync notifications)"
echo "   - FoodieShoppingListApp.swift (injected connectionManager into store)"
echo ""
echo "🔨 Next steps:"
echo "   1. Open ~/Desktop/FoodieShoppingList/FoodieShoppingList.xcodeproj in Xcode"
echo "   2. Build the project (⌘B)"
echo "   3. Test on your iPhone"
echo ""
