#!/bin/bash

# Script to Copy Updated iPhone Files to Xcode Project

echo "📱 Copying updated iPhone files to Xcode project..."
echo ""

# Set paths
PROJECT_DIR="/Users/keithbarger/Projects/foodie-meal-planner-desktop/ios-apps/FoodieShoppingList"
XCODE_DIR="/Users/keithbarger/Desktop/FoodieShoppingList/FoodieShoppingList"

# Copy Models
echo "Copying Models..."
cp "$PROJECT_DIR/Models/Message.swift" "$XCODE_DIR/Models/"
cp "$PROJECT_DIR/Models/ShoppingItem.swift" "$XCODE_DIR/Models/"

# Copy Services
echo "Copying Services..."
cp "$PROJECT_DIR/Services/ConnectionManager.swift" "$XCODE_DIR/Services/"
cp "$PROJECT_DIR/Services/ShoppingListStore.swift" "$XCODE_DIR/Services/"
cp "$PROJECT_DIR/Services/VoiceInputManager.swift" "$XCODE_DIR/Services/"
cp "$PROJECT_DIR/Services/VoiceCommandManager.swift" "$XCODE_DIR/Services/"

# Copy Views
echo "Copying Views..."
cp "$PROJECT_DIR/Views/ContentView.swift" "$XCODE_DIR/Views/"
cp "$PROJECT_DIR/Views/SettingsView.swift" "$XCODE_DIR/Views/"
cp "$PROJECT_DIR/Views/ShoppingItemRow.swift" "$XCODE_DIR/Views/"
cp "$PROJECT_DIR/Views/AddItemView.swift" "$XCODE_DIR/Views/"
cp "$PROJECT_DIR/Views/SyncStatusBanner.swift" "$XCODE_DIR/Views/"

# Copy Extensions
echo "Copying Extensions..."
cp "$PROJECT_DIR/Extensions/View+Extensions.swift" "$XCODE_DIR/Extensions/"

# Copy App file
echo "Copying App file..."
cp "$PROJECT_DIR/FoodieShoppingListApp.swift" "$XCODE_DIR/"

echo ""
echo "✅ All files copied!"
echo ""
echo "Next steps:"
echo "1. Go to Xcode"
echo "2. Product → Clean Build Folder (Cmd+Shift+K)"
echo "3. Product → Build (Cmd+B)"
echo "4. Product → Run (Cmd+R) on iPhone"
echo ""
echo "📖 See: IPHONE_APP_IMPROVEMENTS.md for details"
echo ""
