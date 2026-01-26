#!/bin/bash

echo "Copying fixed VoiceCommandManager.swift to Xcode project..."

cp ios-apps/FoodieKitchen/Services/VoiceCommandManager.swift ~/Desktop/FoodieKitchen/FoodieKitchen/Services/VoiceCommandManager.swift

echo "✅ File copied!"
echo ""
echo "Next steps:"
echo "1. Open Xcode project at ~/Desktop/FoodieKitchen/"
echo "2. Rebuild the iPad app"
echo "3. Test voice commands - errors will now stop after 3 attempts instead of looping"
echo "4. If voice stops due to errors, toggle voice off/on in settings to restart"
