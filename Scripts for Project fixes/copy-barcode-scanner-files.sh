#!/bin/bash

# Copy Barcode Scanner Implementation Files to Xcode Project
# Run this script after creating your FoodieShoppingList Xcode project

set -e

echo "🔍 Barcode Scanner File Copy Script"
echo "===================================="
echo ""

# Check if Xcode project path is provided
if [ -z "$1" ]; then
    echo "❌ Error: Xcode project directory not specified"
    echo ""
    echo "Usage: ./copy-barcode-scanner-files.sh /path/to/FoodieShoppingList"
    echo ""
    echo "Example:"
    echo "  ./copy-barcode-scanner-files.sh ~/Desktop/FoodieShoppingList"
    echo ""
    echo "The path should be the folder containing your .xcodeproj file"
    exit 1
fi

XCODE_PROJECT_DIR="$1"

# Verify the directory exists
if [ ! -d "$XCODE_PROJECT_DIR" ]; then
    echo "❌ Error: Directory not found: $XCODE_PROJECT_DIR"
    exit 1
fi

# Find the .xcodeproj file
XCODE_PROJ=$(find "$XCODE_PROJECT_DIR" -maxdepth 1 -name "*.xcodeproj" | head -1)
if [ -z "$XCODE_PROJ" ]; then
    echo "❌ Error: No .xcodeproj file found in $XCODE_PROJECT_DIR"
    exit 1
fi

echo "✅ Found Xcode project: $(basename "$XCODE_PROJ")"
echo ""

# Source directory
SOURCE_DIR="ios-apps/FoodieShoppingList"

# Define file mappings
declare -A FILES=(
    # New files for barcode scanner
    ["Views/BarcodeScannerView.swift"]="Views/BarcodeScannerView.swift"
    ["Views/AddPantryItemView.swift"]="Views/AddPantryItemView.swift"
    
    # Updated file
    ["Views/ContentView.swift"]="Views/ContentView.swift"
)

echo "📋 Files to copy:"
echo ""

# Check if source files exist
MISSING_FILES=0
for SOURCE_FILE in "${!FILES[@]}"; do
    if [ -f "$SOURCE_DIR/$SOURCE_FILE" ]; then
        echo "  ✅ $SOURCE_FILE"
    else
        echo "  ❌ $SOURCE_FILE (NOT FOUND)"
        MISSING_FILES=$((MISSING_FILES + 1))
    fi
done

echo ""

if [ $MISSING_FILES -gt 0 ]; then
    echo "❌ Error: $MISSING_FILES source file(s) not found"
    echo "   Make sure you're running this script from the foodie-meal-planner-desktop directory"
    exit 1
fi

# Create Views directory if it doesn't exist
VIEWS_DIR="$XCODE_PROJECT_DIR/Views"
if [ ! -d "$VIEWS_DIR" ]; then
    echo "📁 Creating Views directory..."
    mkdir -p "$VIEWS_DIR"
fi

# Copy files
echo "📦 Copying files..."
echo ""

COPIED=0
for SOURCE_FILE in "${!FILES[@]}"; do
    DEST_FILE="${FILES[$SOURCE_FILE]}"
    SOURCE_PATH="$SOURCE_DIR/$SOURCE_FILE"
    DEST_PATH="$XCODE_PROJECT_DIR/$DEST_FILE"
    
    # Create destination directory if needed
    DEST_DIR=$(dirname "$DEST_PATH")
    mkdir -p "$DEST_DIR"
    
    # Copy file
    cp "$SOURCE_PATH" "$DEST_PATH"
    
    if [ $? -eq 0 ]; then
        echo "  ✅ Copied: $SOURCE_FILE → $DEST_FILE"
        COPIED=$((COPIED + 1))
    else
        echo "  ❌ Failed: $SOURCE_FILE"
    fi
done

echo ""
echo "✅ Successfully copied $COPIED file(s)"
echo ""
echo "📝 Next Steps:"
echo ""
echo "1. Open Xcode project:"
echo "   open \"$XCODE_PROJ\""
echo ""
echo "2. Add the new files to your target:"
echo "   - In Xcode, right-click 'Views' folder → 'Add Files to FoodieShoppingList...'"
echo "   - Select: BarcodeScannerView.swift, AddPantryItemView.swift"
echo "   - Ensure 'FoodieShoppingList' target is checked"
echo "   - Click 'Add'"
echo ""
echo "3. Update Info.plist with camera permission:"
echo "   - Open Info.plist in Xcode"
echo "   - Add new row:"
echo "     Key: Privacy - Camera Usage Description (NSCameraUsageDescription)"
echo "     Value: Camera access is required to scan grocery item barcodes"
echo ""
echo "4. Build and run on physical iPhone (camera required - won't work on simulator)"
echo ""
echo "📖 See UPC_BARCODE_SCANNER_IMPLEMENTATION.md for complete documentation"
