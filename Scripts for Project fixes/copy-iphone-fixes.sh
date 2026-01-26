#!/bin/bash

echo "📱 Fixing iPhone Shopping List Issues..."
echo ""

echo "1. Copying ShoppingListStore.swift (fixes old list reappearing)..."
cp ios-apps/FoodieShoppingList/Services/ShoppingListStore.swift \
   ~/Desktop/FoodieShoppingList/FoodieShoppingList/Services/ShoppingListStore.swift

echo "2. Copying ConnectionManager.swift (fixes flashing success banner)..."
cp ios-apps/FoodieShoppingList/Services/ConnectionManager.swift \
   ~/Desktop/FoodieShoppingList/FoodieShoppingList/Services/ConnectionManager.swift

echo ""
echo "✅ Files copied!"
echo ""
echo "Fixes Applied:"
echo ""
echo "1. OLD SHOPPING LIST REAPPEARING:"
echo "   - Empty list from desktop now properly clears non-manual items"
echo "   - Manual items are preserved (user-added)"
echo "   - Fixed persistence issue where old items came back"
echo ""
echo "2. FLASHING 'AUTO-SYNC SUCCESSFUL':"
echo "   - Success banner only shows for explicit updates (shopping_list_update)"
echo "   - Initial connection sync (shopping_list) is silent"
echo "   - Prevents flashing on every reconnect"
echo ""
echo "3. CONNECTION DROPS:"
echo "   - Already has exponential backoff and max retry limit"
echo "   - Check desktop console for WebSocket errors"
echo "   - Verify iPhone and Mac are on same network"
echo ""
echo "Rebuild the iPhone app in Xcode to apply these fixes."
