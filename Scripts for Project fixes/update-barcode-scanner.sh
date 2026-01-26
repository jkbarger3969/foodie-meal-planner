#!/bin/bash
cp ios-apps/FoodieShoppingList/Views/BarcodeScannerView.swift \
   ~/Desktop/FoodieShoppingList/FoodieShoppingList/Views/BarcodeScannerView.swift
echo "✅ Updated BarcodeScannerView with improved error messages"
echo ""
echo "Changes:"
echo "- Better error messages showing the UPC code"
echo "- More detailed parsing error info"
echo "- Clearer distinction between 'not found' vs 'network error'"
echo ""
echo "The scanner connects to: https://world.openfoodfacts.org"
echo ""
echo "If product not found:"
echo "- Shows error with UPC code"
echo "- Offers 'Enter Manually' button"
echo "- User can type product name and add to pantry"
