#!/bin/bash
# Copy fixed VoiceCommandManager to Xcode project

cp ~/Projects/foodie-meal-planner-desktop/ios-apps/FoodieKitchen/Services/VoiceCommandManager.swift \
   ~/Desktop/FoodieKitchen/FoodieKitchen/Services/VoiceCommandManager.swift

echo "✅ VoiceCommandManager.swift updated"
echo ""
echo "Now you need to manually edit in Xcode:"
echo "1. SettingsView.swift - Change toggle behavior (see VOICE_COMMAND_FIX_COMPLETE.md)"
echo "2. VoiceCommandButton.swift - Update button UI (see VOICE_COMMAND_FIX_COMPLETE.md)"
echo ""
echo "Then rebuild and install: ⌘+R in Xcode"
