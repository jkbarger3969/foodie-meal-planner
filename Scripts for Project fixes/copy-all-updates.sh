#!/bin/bash

echo "📦 Copying all updated files to Xcode projects..."
echo ""

# iPhone Shopping List
echo "📱 iPhone Shopping List:"
cp -v ios-apps/FoodieShoppingList/Views/BarcodeScannerView.swift /Users/keithbarger/Desktop/FoodieShoppingList/FoodieShoppingList/Views/
cp -v ios-apps/FoodieShoppingList/Views/AddPantryItemView.swift /Users/keithbarger/Desktop/FoodieShoppingList/FoodieShoppingList/Views/
cp -v ios-apps/FoodieShoppingList/Views/ContentView.swift /Users/keithbarger/Desktop/FoodieShoppingList/FoodieShoppingList/Views/
cp -v ios-apps/FoodieShoppingList/Models/ShoppingItem.swift /Users/keithbarger/Desktop/FoodieShoppingList/FoodieShoppingList/Models/
cp -v ios-apps/FoodieShoppingList/Services/ShoppingListStore.swift /Users/keithbarger/Desktop/FoodieShoppingList/FoodieShoppingList/Services/

echo ""
echo "📱 iPad Kitchen:"
cp -v ios-apps/FoodieKitchen/Views/ContentView.swift /Users/keithbarger/Desktop/FoodieKitchen/FoodieKitchen/Views/
cp -v ios-apps/FoodieKitchen/Views/TimerBar.swift /Users/keithbarger/Desktop/FoodieKitchen/FoodieKitchen/Views/
cp -v ios-apps/FoodieKitchen/Models/Recipe.swift /Users/keithbarger/Desktop/FoodieKitchen/FoodieKitchen/Models/

echo ""
echo "✅ All files copied successfully!"
echo ""
echo "📝 Summary:"
echo "  iPhone: 5 files (3 Views, 1 Model, 1 Service)"
echo "  iPad: 3 files (2 Views, 1 Model)"
echo ""
echo "🔨 Next: Clean build (⌘⇧K) and rebuild (⌘B) both apps"
