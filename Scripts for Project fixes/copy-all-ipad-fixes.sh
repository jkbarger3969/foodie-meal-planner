#!/bin/bash
# Copy all fixed iPad files including InstructionsView

PROJECT_DIR="$HOME/Projects/foodie-meal-planner-desktop/ios-apps/FoodieKitchen"
XCODE_DIR="$HOME/Desktop/FoodieKitchen/FoodieKitchen"

echo "📱 Copying ALL fixed iPad files..."

cp "$PROJECT_DIR/Services/VoiceCommandManager.swift" "$XCODE_DIR/Services/VoiceCommandManager.swift"
echo "✅ VoiceCommandManager.swift (2-stage: 'Foodie' activates mic, then say command)"

cp "$PROJECT_DIR/Views/InstructionsView.swift" "$XCODE_DIR/Views/InstructionsView.swift"
echo "✅ InstructionsView.swift (Finish button on last step)"

cp "$PROJECT_DIR/Views/ContentView.swift" "$XCODE_DIR/Views/ContentView.swift"
echo "✅ ContentView.swift (NavigationView for toolbar)"

cp "$PROJECT_DIR/Services/RecipeStore.swift" "$XCODE_DIR/Services/RecipeStore.swift"
echo "✅ RecipeStore.swift"

echo ""
echo "✅ All critical files updated!"
echo ""
echo "Now rebuild in Xcode (⌘+R)"
