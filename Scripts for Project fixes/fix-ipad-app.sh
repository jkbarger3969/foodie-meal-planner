#!/bin/bash
# Fix iPad app - Copy corrected Swift files to Xcode project

PROJECT_DIR="$HOME/Projects/foodie-meal-planner-desktop/ios-apps/FoodieKitchen"
XCODE_DIR="$HOME/Desktop/FoodieKitchen/FoodieKitchen"

echo "📱 Copying fixed iPad app files to Xcode project..."

# Check if Xcode project exists
if [ ! -d "$XCODE_DIR" ]; then
    echo "❌ Error: Xcode project not found at $XCODE_DIR"
    echo "Please check the path and try again."
    exit 1
fi

# Create backup
BACKUP_DIR="$HOME/Desktop/FoodieKitchen_BACKUP_$(date +%Y%m%d_%H%M%S)"
echo "📦 Creating backup at $BACKUP_DIR"
cp -R "$HOME/Desktop/FoodieKitchen" "$BACKUP_DIR"

# Copy fixed ContentView.swift
echo "✅ Copying ContentView.swift (adds NavigationView for toolbar buttons)"
cp "$PROJECT_DIR/Views/ContentView.swift" "$XCODE_DIR/Views/ContentView.swift"

# Copy all other potentially updated files
echo "✅ Copying VoiceCommandManager.swift"
cp "$PROJECT_DIR/Services/VoiceCommandManager.swift" "$XCODE_DIR/Services/VoiceCommandManager.swift"

echo "✅ Copying RecipeStore.swift"
cp "$PROJECT_DIR/Services/RecipeStore.swift" "$XCODE_DIR/Services/RecipeStore.swift"

echo "✅ Copying SettingsView.swift"
cp "$PROJECT_DIR/Views/SettingsView.swift" "$XCODE_DIR/Views/SettingsView.swift"

echo "✅ Copying FoodieKitchenApp.swift"
cp "$PROJECT_DIR/FoodieKitchenApp.swift" "$XCODE_DIR/FoodieKitchenApp.swift"

echo ""
echo "✅ All files copied successfully!"
echo ""
echo "Next steps:"
echo "1. Open Xcode with FoodieKitchen project"
echo "2. Connect iPad via USB"
echo "3. Select iPad as build target"
echo "4. Press ⌘+R to build and install"
echo ""
echo "After install:"
echo "- Home button will appear (top-left, blue)"
echo "- 'Today's Meals' button will appear (top-center)"
echo "- Settings → Voice Control to enable voice commands"
echo ""
echo "Backup created at: $BACKUP_DIR"
