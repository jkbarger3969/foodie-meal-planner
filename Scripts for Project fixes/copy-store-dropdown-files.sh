#!/bin/bash

echo "📋 Copying all files for store dropdown feature..."
echo ""

echo "1. Copying ConnectionManager.swift (has availableStores property)..."
cp ios-apps/FoodieShoppingList/Services/ConnectionManager.swift \
   ~/Desktop/FoodieShoppingList/FoodieShoppingList/Services/ConnectionManager.swift

echo "2. Copying AddPantryItemView.swift (uses availableStores)..."
cp ios-apps/FoodieShoppingList/Views/AddPantryItemView.swift \
   ~/Desktop/FoodieShoppingList/FoodieShoppingList/Views/AddPantryItemView.swift

echo "3. Copying BarcodeScannerView.swift..."
cp ios-apps/FoodieShoppingList/Views/BarcodeScannerView.swift \
   ~/Desktop/FoodieShoppingList/FoodieShoppingList/Views/BarcodeScannerView.swift

echo ""
echo "✅ All files copied!"
echo ""
echo "The real issue was: ConnectionManager in Xcode was missing @Published var availableStores"
echo ""
echo "Now the build should work."
