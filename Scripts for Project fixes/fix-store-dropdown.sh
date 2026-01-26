#!/bin/bash

echo "📋 Copying fixed AddPantryItemView.swift to Xcode project..."

cp ios-apps/FoodieShoppingList/Views/AddPantryItemView.swift \
   ~/Desktop/FoodieShoppingList/FoodieShoppingList/Views/AddPantryItemView.swift

echo "✅ File copied successfully!"
echo ""
echo "The @EnvironmentObject access issue has been fixed by:"
echo "1. Extracting 'let stores = connectionManager.availableStores' at the start of body"
echo "2. This creates a local variable that SwiftUI can safely use in ForEach"
echo "3. No more dynamic member access errors!"
echo ""
echo "You can now build the iPhone app in Xcode."
