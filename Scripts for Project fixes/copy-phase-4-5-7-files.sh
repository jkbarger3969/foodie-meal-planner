#!/bin/bash

# PHASE 4.5.7: Copy Companion App Multi-User Update Files
# This script copies updated iOS companion app files to Xcode project directories

echo "=========================================="
echo "Phase 4.5.7: Companion App Multi-User Updates"
echo "Copy Files to Xcode Project Directories"
echo "=========================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to prompt for directory
prompt_for_directory() {
    local app_name=$1
    local default_path=$2
    
    echo -e "${YELLOW}Enter the Xcode project directory for ${app_name}:${NC}"
    echo "  (Press Enter to use: ${default_path})"
    read -r user_path
    
    if [ -z "$user_path" ]; then
        echo "$default_path"
    else
        echo "$user_path"
    fi
}

# Default paths (adjust based on your setup)
DEFAULT_IPAD_PATH="$HOME/Desktop/FoodieKitchen"
DEFAULT_IPHONE_PATH="$HOME/Desktop/FoodieShoppingList"

# Get destination paths from user
IPAD_DEST=$(prompt_for_directory "FoodieKitchen (iPad)" "$DEFAULT_IPAD_PATH")
IPHONE_DEST=$(prompt_for_directory "FoodieShoppingList (iPhone)" "$DEFAULT_IPHONE_PATH")

echo ""
echo "=========================================="
echo "Copying Files..."
echo "=========================================="

# Source paths
IPAD_SOURCE="ios-apps/FoodieKitchen"
IPHONE_SOURCE="ios-apps/FoodieShoppingList"

# iPad Files to Copy
echo ""
echo -e "${GREEN}iPad App (FoodieKitchen):${NC}"

# 1. Recipe.swift (updated with AssignedUser struct)
if [ -f "$IPAD_SOURCE/Models/Recipe.swift" ]; then
    mkdir -p "$IPAD_DEST/Models"
    cp "$IPAD_SOURCE/Models/Recipe.swift" "$IPAD_DEST/Models/"
    echo "  ✓ Copied Models/Recipe.swift"
else
    echo -e "  ${RED}✗ Source file not found: $IPAD_SOURCE/Models/Recipe.swift${NC}"
fi

# 2. ContentView.swift (updated with assignment badges)
if [ -f "$IPAD_SOURCE/Views/ContentView.swift" ]; then
    mkdir -p "$IPAD_DEST/Views"
    cp "$IPAD_SOURCE/Views/ContentView.swift" "$IPAD_DEST/Views/"
    echo "  ✓ Copied Views/ContentView.swift"
else
    echo -e "  ${RED}✗ Source file not found: $IPAD_SOURCE/Views/ContentView.swift${NC}"
fi

# iPhone Files to Copy
echo ""
echo -e "${GREEN}iPhone App (FoodieShoppingList):${NC}"

# 1. ShoppingItem.swift (updated with forUsers field)
if [ -f "$IPHONE_SOURCE/Models/ShoppingItem.swift" ]; then
    mkdir -p "$IPHONE_DEST/Models"
    cp "$IPHONE_SOURCE/Models/ShoppingItem.swift" "$IPHONE_DEST/Models/"
    echo "  ✓ Copied Models/ShoppingItem.swift"
else
    echo -e "  ${RED}✗ Source file not found: $IPHONE_SOURCE/Models/ShoppingItem.swift${NC}"
fi

# 2. ShoppingItemRow.swift (updated with user badge display)
if [ -f "$IPHONE_SOURCE/Views/ShoppingItemRow.swift" ]; then
    mkdir -p "$IPHONE_DEST/Views"
    cp "$IPHONE_SOURCE/Views/ShoppingItemRow.swift" "$IPHONE_DEST/Views/"
    echo "  ✓ Copied Views/ShoppingItemRow.swift"
else
    echo -e "  ${RED}✗ Source file not found: $IPHONE_SOURCE/Views/ShoppingItemRow.swift${NC}"
fi

echo ""
echo "=========================================="
echo "Summary of Changes"
echo "=========================================="
echo ""
echo -e "${GREEN}iPad App (FoodieKitchen):${NC}"
echo "  • Models/Recipe.swift"
echo "    - Added AssignedUser struct (userId, name, avatarEmoji, email)"
echo "    - Updated MealSlot with assignedUsers: [AssignedUser] array"
echo "    - Added parsing logic for WebSocket data"
echo ""
echo "  • Views/ContentView.swift"
echo "    - Added assignment badges in RecipeListView"
echo "    - Shows 'For: 👨 Keith, 👩 Sarah' below meal title"
echo "    - Displays avatar emojis and user names"
echo ""
echo -e "${GREEN}iPhone App (FoodieShoppingList):${NC}"
echo "  • Models/ShoppingItem.swift"
echo "    - Added forUsers: [String] field"
echo "    - Updated all initializers with backward compatibility"
echo "    - Added Codable support for forUsers"
echo ""
echo "  • Views/ShoppingItemRow.swift"
echo "    - Added user assignment display"
echo "    - Shows 'For: Keith, Sarah' in blue caption text"
echo "    - Positioned between quantity and manual badge"
echo ""
echo "=========================================="
echo "Next Steps"
echo "=========================================="
echo ""
echo "1. Open Xcode projects:"
echo "   - FoodieKitchen:       $IPAD_DEST"
echo "   - FoodieShoppingList:  $IPHONE_DEST"
echo ""
echo "2. Verify files are in the correct locations"
echo ""
echo "3. Build and test both apps:"
echo "   - iPad app should show meal assignments"
echo "   - iPhone app should show user badges on shopping items"
echo ""
echo "4. Test WebSocket data flow:"
echo "   - Desktop app sends assignedUsers + additionalItems"
echo "   - iPad receives and displays assignments"
echo "   - iPhone receives and displays forUsers"
echo ""
echo "5. If files were not added to Xcode project:"
echo "   - Right-click project folder in Xcode"
echo "   - Add Files to [ProjectName]..."
echo "   - Select copied files"
echo "   - Ensure 'Copy items if needed' is UNchecked (files already in place)"
echo ""
echo -e "${GREEN}✓ File copy complete!${NC}"
echo ""
