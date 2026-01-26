# ⚡ Pantry Sync Quick Reference

## 🎯 What Just Happened

✅ iPhone companion app files updated with pantry sync
✅ Files copied to Xcode project on Desktop
✅ Backup created automatically
✅ Xcode opened and ready to build

---

## 🚀 Build & Test (5 Steps)

### In Xcode:
1. **Clean:** `⌘ + Shift + K`
2. **Build:** `⌘ + B`
3. **Run:** `⌘ + R` (on iPhone)

### On Desktop:
4. **Start app:** `npm start`
5. **Open console:** `⌥ + ⌘ + I`

### Test:
- Remove item from iPhone shopping list
- Watch desktop console for: `✅ Returned to pantry`
- Check desktop Pantry tab → quantity increased

---

## 📱 Files Updated

```
FoodieShoppingList/
  ├── Services/
  │   ├── ConnectionManager.swift    ← send() method added
  │   └── ShoppingListStore.swift    ← pantry notifications added
  └── FoodieShoppingListApp.swift    ← connectionManager injected
```

---

## 🔧 If Build Fails

```bash
# Clean everything
⌘ + Shift + K in Xcode

# Delete derived data
Xcode → Preferences → Locations → Derived Data → Delete

# Rebuild
⌘ + B
```

---

## 🐛 If Tests Fail

**No connection?**
- Check iPhone Settings → Server Address
- Should be: `ws://[DESKTOP_IP]:8080`

**Pantry not updating?**
- Check desktop console for errors
- Verify companion server started (look for port 8080 message)

**App crashes?**
- Check Xcode debug area for error logs
- Verify all 3 files copied correctly

---

## 📊 Success Indicators

✅ Xcode builds without errors
✅ iPhone shows "Connected" status
✅ Desktop console shows sync messages
✅ Pantry quantities increase when items removed
✅ No error messages in either console

---

## 📖 Full Documentation

- **Testing Guide:** `PANTRY_SYNC_TESTING_GUIDE.md`
- **Implementation Details:** `COMPANION_FILES_COPY_GUIDE.md`
- **Copy Instructions:** `COPY_FILES_NOW.md`

---

## 💾 Backup Location

```
/Users/keithbarger/Desktop/companion-backup-20260120-102515/
```

To restore: Copy files from backup → paste to Xcode project

---

## ✨ What's New

- Auto-sync pantry when items removed from shopping list
- Auto-sync pantry when items unchecked
- Smart fraction parsing (1 1/2 → 1.5)
- Real-time updates iPhone ↔ Desktop

---

**Ready?** Build in Xcode and test! 🚀
