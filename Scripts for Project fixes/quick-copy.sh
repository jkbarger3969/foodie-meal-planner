#!/bin/bash

# Quick copy script with backup
# This script backs up existing files before copying

set -e

BACKUP_DIR="$HOME/Desktop/companion-backup-$(date +%Y%m%d-%H%M%S)"
DESKTOP_SHOPPING="$HOME/Desktop/FoodieShoppingList/FoodieShoppingList"
SOURCE_SHOPPING="ios-apps/FoodieShoppingList"

echo "🔄 Quick Copy with Backup"
echo "=========================="
echo ""

# Create backup
if [ -d "$DESKTOP_SHOPPING" ]; then
    echo "💾 Creating backup..."
    mkdir -p "$BACKUP_DIR/FoodieShoppingList"
    
    [ -f "$DESKTOP_SHOPPING/Services/ConnectionManager.swift" ] && \
        cp "$DESKTOP_SHOPPING/Services/ConnectionManager.swift" "$BACKUP_DIR/FoodieShoppingList/" && \
        echo "  ✓ Backed up ConnectionManager.swift"
    
    [ -f "$DESKTOP_SHOPPING/Services/ShoppingListStore.swift" ] && \
        cp "$DESKTOP_SHOPPING/Services/ShoppingListStore.swift" "$BACKUP_DIR/FoodieShoppingList/" && \
        echo "  ✓ Backed up ShoppingListStore.swift"
    
    [ -f "$DESKTOP_SHOPPING/FoodieShoppingListApp.swift" ] && \
        cp "$DESKTOP_SHOPPING/FoodieShoppingListApp.swift" "$BACKUP_DIR/FoodieShoppingList/" && \
        echo "  ✓ Backed up FoodieShoppingListApp.swift"
    
    echo ""
    echo "📦 Backup saved to: $BACKUP_DIR"
    echo ""
fi

# Copy new files
echo "📋 Copying updated files..."
echo ""

cp "$SOURCE_SHOPPING/Services/ConnectionManager.swift" "$DESKTOP_SHOPPING/Services/ConnectionManager.swift"
echo "  ✓ Copied ConnectionManager.swift (added send() method)"

cp "$SOURCE_SHOPPING/Services/ShoppingListStore.swift" "$DESKTOP_SHOPPING/Services/ShoppingListStore.swift"
echo "  ✓ Copied ShoppingListStore.swift (added pantry sync)"

cp "$SOURCE_SHOPPING/FoodieShoppingListApp.swift" "$DESKTOP_SHOPPING/FoodieShoppingListApp.swift"
echo "  ✓ Copied FoodieShoppingListApp.swift (injected connectionManager)"

echo ""
echo "✅ Copy complete!"
echo ""
echo "🔨 Next steps:"
echo "   1. Open: ~/Desktop/FoodieShoppingList/FoodieShoppingList.xcodeproj"
echo "   2. Clean build folder: ⌘+Shift+K"
echo "   3. Build: ⌘+B"
echo "   4. Run on iPhone: ⌘+R"
echo ""
echo "💡 If you need to restore, backup is at:"
echo "   $BACKUP_DIR"
echo ""
