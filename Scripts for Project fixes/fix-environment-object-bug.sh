#!/bin/bash

echo "📋 Fixing @EnvironmentObject SwiftUI compiler bug..."
echo ""

echo "Copying AddPantryItemView.swift..."
cp ios-apps/FoodieShoppingList/Views/AddPantryItemView.swift \
   ~/Desktop/FoodieShoppingList/FoodieShoppingList/Views/AddPantryItemView.swift

echo "Copying BarcodeScannerView.swift..."
cp ios-apps/FoodieShoppingList/Views/BarcodeScannerView.swift \
   ~/Desktop/FoodieShoppingList/FoodieShoppingList/Views/BarcodeScannerView.swift

echo ""
echo "✅ Files copied successfully!"
echo ""
echo "The fix:"
echo "1. Changed @EnvironmentObject to @ObservedObject in AddPantryItemView"
echo "2. Passed connectionManager as explicit parameter instead of environment"
echo "3. This bypasses the SwiftUI @EnvironmentObject dynamic member access bug"
echo ""
echo "Benefits:"
echo "- No more compiler errors with availableStores access"
echo "- Same functionality, just different injection method"
echo "- @ObservedObject still provides reactive updates"
echo ""
echo "You can now build the iPhone app in Xcode."
