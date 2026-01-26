#!/bin/bash

# Script to Copy Updated iPad Files to Xcode Project

echo "📱 Copying updated iPad files to Xcode project..."
echo ""

# Set paths
PROJECT_DIR="/Users/keithbarger/Projects/foodie-meal-planner-desktop/ios-apps/FoodieKitchen"
XCODE_DIR="/Users/keithbarger/Desktop/FoodieKitchen/FoodieKitchen"

# Copy Models
echo "Copying Models..."
cp "$PROJECT_DIR/Models/Message.swift" "$XCODE_DIR/Models/"
cp "$PROJECT_DIR/Models/Recipe.swift" "$XCODE_DIR/Models/"

# Copy Services
echo "Copying Services..."
cp "$PROJECT_DIR/Services/ConnectionManager.swift" "$XCODE_DIR/Services/"
cp "$PROJECT_DIR/Services/RecipeStore.swift" "$XCODE_DIR/Services/"
cp "$PROJECT_DIR/Services/VoiceCommandManager.swift" "$XCODE_DIR/Services/"

# Copy Views
echo "Copying Views..."
cp "$PROJECT_DIR/Views/ContentView.swift" "$XCODE_DIR/Views/"
cp "$PROJECT_DIR/Views/SettingsView.swift" "$XCODE_DIR/Views/"

# Copy App file
echo "Copying App file..."
cp "$PROJECT_DIR/FoodieKitchenApp.swift" "$XCODE_DIR/"

echo ""
echo "✅ All files copied!"
echo ""
echo "⚠️  IMPORTANT: Add Privacy Keys to Info.plist"
echo "   See: VOICE_COMMANDS_PRIVACY_KEYS.md"
echo ""
echo "Next steps:"
echo "1. Add privacy keys in Xcode Info.plist (REQUIRED for voice commands)"
echo "2. Go to Xcode"
echo "3. Product → Clean Build Folder (Cmd+Shift+K)"
echo "4. Product → Build (Cmd+B)"
echo "5. Product → Run (Cmd+R)"
echo ""
echo "📖 Full guide: VOICE_COMMANDS_COMPLETE.md"
echo ""
