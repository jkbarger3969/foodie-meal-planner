#!/bin/bash

echo "📋 Adding 'Clear Today's Meals' feature to iPad app..."
echo ""

cp ios-apps/FoodieKitchen/Views/ContentView.swift \
   ~/Desktop/FoodieKitchen/FoodieKitchen/Views/ContentView.swift

echo "✅ Done!"
echo ""
echo "New Feature Added:"
echo "- 'Clear All' button in Today's Meals list (left side of toolbar)"
echo "- Shows trash icon in red"
echo "- Confirmation dialog before clearing"
echo "- Clears all meal slots, recipes, and resets current recipe"
echo "- Only appears when there are meals to clear"
echo ""
echo "Usage:"
echo "1. Open 'Today's Meals' on iPad"
echo "2. Tap the red 'Clear All' button (trash icon)"
echo "3. Confirm in the dialog"
echo "4. All meals cleared - can reload from desktop anytime"
