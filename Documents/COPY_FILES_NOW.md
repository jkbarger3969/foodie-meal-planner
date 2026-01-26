# 🎯 Copy Companion Files Now

## ⚡ Quick Command (Recommended)

```bash
./quick-copy.sh
```

## ✅ What This Does

1. **Backs up** your existing Xcode project files (just in case)
2. **Copies** 3 updated files to `~/Desktop/FoodieShoppingList/`
3. **Shows** exactly what was copied

## 📱 Files Being Copied

```
ios-apps/FoodieShoppingList/
  ├── Services/ConnectionManager.swift    → Desktop Xcode project
  ├── Services/ShoppingListStore.swift    → Desktop Xcode project
  └── FoodieShoppingListApp.swift         → Desktop Xcode project
```

## 🔧 Build in Xcode After Copy

```bash
# Open Xcode project
open ~/Desktop/FoodieShoppingList/FoodieShoppingList.xcodeproj

# Then in Xcode:
# 1. Clean: ⌘ + Shift + K
# 2. Build: ⌘ + B
# 3. Run: ⌘ + R
```

## 🧪 Test the New Pantry Sync

**On iPhone:**
- Remove any item from shopping list
- OR uncheck a purchased item

**On Desktop:**
- Watch console for sync messages
- Check Pantry tab → quantity should increase

**Expected Console Output:**
```
📥 Item removed from iphone: chicken breast (1.5 lb)
✅ Returned to pantry: chicken breast (1.5 lb)
```

## 📊 File Details

| File | Size | What Changed |
|------|------|--------------|
| ConnectionManager.swift | 11 KB | Added `send()` method |
| ShoppingListStore.swift | 9.6 KB | Added pantry notifications |
| FoodieShoppingListApp.swift | 1.7 KB | Injected connectionManager |

## 🔄 If You Need to Undo

Your backup will be saved to:
```
~/Desktop/companion-backup-[timestamp]/
```

To restore:
```bash
# Find your backup
ls -lt ~/Desktop/companion-backup-* | head -1

# Copy back from that folder
```

## 📖 More Information

- **Quick guide:** `COPY_COMPANION_FILES_README.md`
- **Full details:** `COMPANION_FILES_COPY_GUIDE.md`

## ✨ What's New in This Update

- **Pantry Auto-Sync:** Items removed from shopping list return to pantry
- **Smart Quantity Parsing:** Handles fractions like "1 1/2 cups"
- **Real-Time Updates:** Desktop sees changes immediately
- **Bi-directional Sync:** iPhone ↔ Desktop pantry stays in sync

---

**Ready to copy?** Run: `./quick-copy.sh`
