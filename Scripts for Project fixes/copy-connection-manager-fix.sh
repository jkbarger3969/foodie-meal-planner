#!/bin/bash

echo "📋 The issue: ConnectionManager.swift in Xcode is missing the availableStores property!"
echo ""
echo "Copying updated ConnectionManager.swift..."

cp ios-apps/FoodieShoppingList/Services/ConnectionManager.swift \
   ~/Desktop/FoodieShoppingList/FoodieShoppingList/Services/ConnectionManager.swift

echo ""
echo "✅ Done! The ConnectionManager now has:"
echo "   - @Published var availableStores: [String] = []"
echo "   - requestStoreList() method"
echo "   - 'store_list' message handler"
echo ""
echo "This should fix the build errors."
