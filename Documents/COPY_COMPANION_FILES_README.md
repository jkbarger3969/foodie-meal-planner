# 📱 Copy Updated Companion Files to Xcode

## Quick Start

Run this command from the project root:

```bash
./quick-copy.sh
```

That's it! The script will:
- ✅ Backup your existing files
- ✅ Copy 3 updated files to Desktop Xcode project
- ✅ Show you exactly what was done

## What Gets Copied

**iPhone App (FoodieShoppingList):**
- `Services/ConnectionManager.swift` → Added `send()` method
- `Services/ShoppingListStore.swift` → Added pantry sync notifications  
- `FoodieShoppingListApp.swift` → Injected connectionManager

## Next Steps After Copy

1. Open Xcode project: `~/Desktop/FoodieShoppingList/FoodieShoppingList.xcodeproj`
2. Clean: `⌘ + Shift + K`
3. Build: `⌘ + B`
4. Run on iPhone: `⌘ + R`

## Test It

- Remove an item from shopping list → Check desktop pantry increases
- Uncheck a purchased item → Check desktop pantry increases
- Watch desktop console for sync messages

## Need More Info?

See `COMPANION_FILES_COPY_GUIDE.md` for:
- Detailed testing instructions
- Troubleshooting tips
- Rollback instructions
- Full change log

## Scripts Available

- `./quick-copy.sh` - Fast copy with backup (recommended)
- `./verify-copy.sh` - Preview what will be copied
- `./copy-all-companion-files.sh` - Copy all apps (iPhone + iPad)

---

**Files ready to copy as of:** January 20, 2026 10:19 AM
