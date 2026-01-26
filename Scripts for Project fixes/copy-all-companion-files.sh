#!/bin/bash

# Copy all updated companion app files to Desktop Xcode projects
# Run this script from the project root directory

set -e

DESKTOP_SHOPPING="$HOME/Desktop/FoodieShoppingList/FoodieShoppingList"
DESKTOP_KITCHEN="$HOME/Desktop/FoodieKitchen/FoodieKitchen"
SOURCE_SHOPPING="ios-apps/FoodieShoppingList"
SOURCE_KITCHEN="ios-apps/FoodieKitchen"

echo "🚀 Copying companion app files to Desktop Xcode projects..."
echo ""

# ========================================
# FoodieShoppingList (iPhone)
# ========================================
if [ -d "$DESKTOP_SHOPPING" ]; then
    echo "📱 FoodieShoppingList (iPhone)"
    echo "================================"
    
    # Services
    echo "📁 Copying Services..."
    cp -v "$SOURCE_SHOPPING/Services/ConnectionManager.swift" "$DESKTOP_SHOPPING/Services/ConnectionManager.swift"
    cp -v "$SOURCE_SHOPPING/Services/ShoppingListStore.swift" "$DESKTOP_SHOPPING/Services/ShoppingListStore.swift"
    cp -v "$SOURCE_SHOPPING/Services/VoiceCommandManager.swift" "$DESKTOP_SHOPPING/Services/VoiceCommandManager.swift" 2>/dev/null || true
    cp -v "$SOURCE_SHOPPING/Services/VoiceInputManager.swift" "$DESKTOP_SHOPPING/Services/VoiceInputManager.swift" 2>/dev/null || true
    
    # App file
    echo "📁 Copying App file..."
    cp -v "$SOURCE_SHOPPING/FoodieShoppingListApp.swift" "$DESKTOP_SHOPPING/FoodieShoppingListApp.swift"
    
    # Views (if updated)
    if [ -f "$SOURCE_SHOPPING/Views/ContentView.swift" ]; then
        echo "📁 Copying Views..."
        cp -v "$SOURCE_SHOPPING/Views/ContentView.swift" "$DESKTOP_SHOPPING/Views/ContentView.swift" 2>/dev/null || true
    fi
    
    # Models
    if [ -f "$SOURCE_SHOPPING/Models/ShoppingItem.swift" ]; then
        echo "📁 Copying Models..."
        cp -v "$SOURCE_SHOPPING/Models/ShoppingItem.swift" "$DESKTOP_SHOPPING/Models/ShoppingItem.swift" 2>/dev/null || true
        cp -v "$SOURCE_SHOPPING/Models/Message.swift" "$DESKTOP_SHOPPING/Models/Message.swift" 2>/dev/null || true
    fi
    
    echo "✅ FoodieShoppingList files copied!"
    echo ""
else
    echo "⚠️  FoodieShoppingList project not found at $DESKTOP_SHOPPING"
    echo ""
fi

# ========================================
# FoodieKitchen (iPad)
# ========================================
if [ -d "$DESKTOP_KITCHEN" ]; then
    echo "📱 FoodieKitchen (iPad)"
    echo "================================"
    
    # Services
    if [ -d "$SOURCE_KITCHEN/Services" ]; then
        echo "📁 Copying Services..."
        [ -f "$SOURCE_KITCHEN/Services/ConnectionManager.swift" ] && cp -v "$SOURCE_KITCHEN/Services/ConnectionManager.swift" "$DESKTOP_KITCHEN/Services/ConnectionManager.swift"
        [ -f "$SOURCE_KITCHEN/Services/RecipeStore.swift" ] && cp -v "$SOURCE_KITCHEN/Services/RecipeStore.swift" "$DESKTOP_KITCHEN/Services/RecipeStore.swift"
        [ -f "$SOURCE_KITCHEN/Services/VoiceCommandManager.swift" ] && cp -v "$SOURCE_KITCHEN/Services/VoiceCommandManager.swift" "$DESKTOP_KITCHEN/Services/VoiceCommandManager.swift"
    fi
    
    # App file
    if [ -f "$SOURCE_KITCHEN/FoodieKitchenApp.swift" ]; then
        echo "📁 Copying App file..."
        cp -v "$SOURCE_KITCHEN/FoodieKitchenApp.swift" "$DESKTOP_KITCHEN/FoodieKitchenApp.swift"
    fi
    
    # Views
    if [ -d "$SOURCE_KITCHEN/Views" ]; then
        echo "📁 Copying Views..."
        [ -f "$SOURCE_KITCHEN/Views/ContentView.swift" ] && cp -v "$SOURCE_KITCHEN/Views/ContentView.swift" "$DESKTOP_KITCHEN/Views/ContentView.swift"
        [ -f "$SOURCE_KITCHEN/Views/RecipeDetailView.swift" ] && cp -v "$SOURCE_KITCHEN/Views/RecipeDetailView.swift" "$DESKTOP_KITCHEN/Views/RecipeDetailView.swift"
    fi
    
    # Models
    if [ -d "$SOURCE_KITCHEN/Models" ]; then
        echo "📁 Copying Models..."
        [ -f "$SOURCE_KITCHEN/Models/Recipe.swift" ] && cp -v "$SOURCE_KITCHEN/Models/Recipe.swift" "$DESKTOP_KITCHEN/Models/Recipe.swift"
        [ -f "$SOURCE_KITCHEN/Models/Message.swift" ] && cp -v "$SOURCE_KITCHEN/Models/Message.swift" "$DESKTOP_KITCHEN/Models/Message.swift"
    fi
    
    echo "✅ FoodieKitchen files copied!"
    echo ""
else
    echo "⚠️  FoodieKitchen project not found at $DESKTOP_KITCHEN"
    echo ""
fi

echo "======================================"
echo "✅ All companion files copied successfully!"
echo "======================================"
echo ""
echo "📝 Key updates in this sync:"
echo ""
echo "iPhone (FoodieShoppingList):"
echo "   ✓ ConnectionManager.swift - Added send() method for pantry sync"
echo "   ✓ ShoppingListStore.swift - Added pantry return notifications"
echo "   ✓ FoodieShoppingListApp.swift - Injected connectionManager into store"
echo ""
echo "🔨 Next steps:"
echo "   1. Open Xcode projects:"
echo "      - ~/Desktop/FoodieShoppingList/FoodieShoppingList.xcodeproj"
echo "      - ~/Desktop/FoodieKitchen/FoodieKitchen.xcodeproj"
echo "   2. Build each project (⌘B)"
echo "   3. Test on your devices"
echo ""
echo "📱 New Features Ready:"
echo "   • Pantry auto-sync when items removed from shopping list"
echo "   • Pantry auto-sync when items unmarked as purchased"
echo "   • Real-time pantry updates across desktop and iPhone"
echo ""
