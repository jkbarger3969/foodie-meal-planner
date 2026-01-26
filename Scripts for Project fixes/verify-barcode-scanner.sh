#!/bin/bash

# Quick verification that all barcode scanner files are in place

echo "🔍 Verifying Barcode Scanner Implementation Files"
echo "=================================================="
echo ""

# Check iPhone app files
echo "📱 iPhone App Files (ios-apps/FoodieShoppingList/):"
echo ""

FILES_OK=0
FILES_MISSING=0

# New files
if [ -f "ios-apps/FoodieShoppingList/Views/BarcodeScannerView.swift" ]; then
    LINES=$(wc -l < "ios-apps/FoodieShoppingList/Views/BarcodeScannerView.swift")
    echo "  ✅ BarcodeScannerView.swift ($LINES lines)"
    FILES_OK=$((FILES_OK + 1))
else
    echo "  ❌ BarcodeScannerView.swift (MISSING)"
    FILES_MISSING=$((FILES_MISSING + 1))
fi

if [ -f "ios-apps/FoodieShoppingList/Views/AddPantryItemView.swift" ]; then
    LINES=$(wc -l < "ios-apps/FoodieShoppingList/Views/AddPantryItemView.swift")
    echo "  ✅ AddPantryItemView.swift ($LINES lines)"
    FILES_OK=$((FILES_OK + 1))
else
    echo "  ❌ AddPantryItemView.swift (MISSING)"
    FILES_MISSING=$((FILES_MISSING + 1))
fi

# Updated file
if [ -f "ios-apps/FoodieShoppingList/Views/ContentView.swift" ]; then
    LINES=$(wc -l < "ios-apps/FoodieShoppingList/Views/ContentView.swift")
    if grep -q "showBarcodeScanner" "ios-apps/FoodieShoppingList/Views/ContentView.swift"; then
        echo "  ✅ ContentView.swift ($LINES lines, barcode scanner integrated)"
        FILES_OK=$((FILES_OK + 1))
    else
        echo "  ⚠️  ContentView.swift (exists but missing barcode scanner code)"
        FILES_MISSING=$((FILES_MISSING + 1))
    fi
else
    echo "  ❌ ContentView.swift (MISSING)"
    FILES_MISSING=$((FILES_MISSING + 1))
fi

echo ""

# Check desktop files
echo "🖥️  Desktop App Files:"
echo ""

if [ -f "src/main/main.js" ]; then
    if grep -q "handleAddPantryItem" "src/main/main.js"; then
        echo "  ✅ src/main/main.js (handleAddPantryItem method found)"
        FILES_OK=$((FILES_OK + 1))
    else
        echo "  ❌ src/main/main.js (handleAddPantryItem method MISSING)"
        FILES_MISSING=$((FILES_MISSING + 1))
    fi
    
    if grep -q "case 'add_pantry_item'" "src/main/main.js"; then
        echo "  ✅ src/main/main.js (WebSocket handler found)"
        FILES_OK=$((FILES_OK + 1))
    else
        echo "  ❌ src/main/main.js (WebSocket handler MISSING)"
        FILES_MISSING=$((FILES_MISSING + 1))
    fi
else
    echo "  ❌ src/main/main.js (MISSING)"
    FILES_MISSING=$((FILES_MISSING + 2))
fi

echo ""

# Check documentation
echo "📚 Documentation:"
echo ""

if [ -f "UPC_BARCODE_SCANNER_IMPLEMENTATION.md" ]; then
    echo "  ✅ UPC_BARCODE_SCANNER_IMPLEMENTATION.md"
    FILES_OK=$((FILES_OK + 1))
else
    echo "  ❌ UPC_BARCODE_SCANNER_IMPLEMENTATION.md (MISSING)"
    FILES_MISSING=$((FILES_MISSING + 1))
fi

if [ -f "BARCODE_SCANNER_FILES_READY.md" ]; then
    echo "  ✅ BARCODE_SCANNER_FILES_READY.md"
    FILES_OK=$((FILES_OK + 1))
else
    echo "  ❌ BARCODE_SCANNER_FILES_READY.md (MISSING)"
    FILES_MISSING=$((FILES_MISSING + 1))
fi

if [ -f "copy-barcode-scanner-files.sh" ]; then
    echo "  ✅ copy-barcode-scanner-files.sh"
    FILES_OK=$((FILES_OK + 1))
else
    echo "  ❌ copy-barcode-scanner-files.sh (MISSING)"
    FILES_MISSING=$((FILES_MISSING + 1))
fi

echo ""
echo "=================================================="

if [ $FILES_MISSING -eq 0 ]; then
    echo "✅ All files verified ($FILES_OK/$FILES_OK)"
    echo ""
    echo "🚀 Implementation is complete and ready!"
    echo ""
    echo "Next steps:"
    echo "  1. Run: ./copy-barcode-scanner-files.sh /path/to/your/XcodeProject"
    echo "  2. Open Xcode and add the new Swift files to your target"
    echo "  3. Add camera permission to Info.plist"
    echo "  4. Build and test on physical iPhone"
    echo ""
    echo "See BARCODE_SCANNER_FILES_READY.md for details"
    exit 0
else
    echo "❌ Missing $FILES_MISSING file(s)"
    echo ""
    echo "Some files are missing. This may indicate an incomplete implementation."
    exit 1
fi
