#!/bin/bash

echo "🧹 Cleaning previous builds..."
rm -rf dist/
rm -rf node_modules/

echo "📦 Installing dependencies..."
npm install

echo "🔨 Building application..."
npm run build

echo ""
echo "✅ Build complete!"
echo ""
echo "📦 Output files:"
ls -lh dist/*.dmg dist/*.zip 2>/dev/null || echo "   (No DMG/ZIP found - check for errors above)"

echo ""
echo "📍 Installation:"
echo "   1. Open: dist/Foodie Meal Planner-1.0.0.dmg"
echo "   2. Drag app to Applications folder"
echo "   3. Launch from Applications"
echo ""
echo "🐛 If app won't open, check error log:"
echo "   tail -f ~/Library/Application\ Support/Foodie\ Meal\ Planner/error.log"
echo ""
