# ✅ FINAL WORKING BUILD - INSTALLATION GUIDE

## Build Details
- **File**: `dist/Foodie Meal Planner-1.0.0-arm64.dmg`
- **Built**: January 19, 2026 at 4:58:15 PM
- **Status**: ✅ WORKING (EPIPE errors fixed, window shows)

---

## ⚠️ IMPORTANT: Gatekeeper Workaround Required

**The app works perfectly but macOS Gatekeeper blocks it when you double-click!**

You MUST use **Right-click → Open** the first time on EACH Mac.

---

## Installation on THIS Mac

```bash
# Run this script (already done):
./FINAL_INSTALL.sh
```

**Then:**
1. Go to **Applications** folder in Finder
2. Find **"Foodie Meal Planner"**
3. **RIGHT-CLICK** → **Open** (don't double-click!)
4. Click **"Open"** in the security dialog
5. After first launch, normal double-click will work

---

## Installation on YOUR OTHER Mac

### Step 1: Copy DMG
Transfer `dist/Foodie Meal Planner-1.0.0-arm64.dmg` to your other Mac via:
- AirDrop
- USB drive
- Cloud storage (iCloud, Dropbox, etc.)

### Step 2: Install
1. Double-click the DMG
2. Drag "Foodie Meal Planner" to Applications folder
3. Eject the DMG

### Step 3: Remove Quarantine
Open Terminal on the other Mac and run:
```bash
sudo xattr -cr '/Applications/Foodie Meal Planner.app'
```

### Step 4: First Launch (CRITICAL)
1. Open **Finder** → **Applications**
2. Find **"Foodie Meal Planner"**
3. **RIGHT-CLICK** (or Control-click) the app
4. Select **"Open"**
5. Click **"Open"** in the security dialog

**After the first right-click → Open, you can use normal double-click.**

---

## Why This Happens

The app is unsigned (no developer certificate) so macOS Gatekeeper blocks it:
- ❌ Double-click = Blocked silently
- ❌ `open` command = Blocked
- ✅ Right-click → Open = Bypasses Gatekeeper
- ✅ Terminal launch = Works (bypasses Gatekeeper)

---

## Verification

App is working correctly if:
- ✅ Window appears
- ✅ Meals are visible
- ✅ No EPIPE error dialog
- ✅ No error log at: `~/Library/Application Support/Foodie Meal Planner/error.log`

---

## Troubleshooting

### App won't open at all
```bash
# Remove and reinstall
rm -rf "/Applications/Foodie Meal Planner.app"
# Reinstall from DMG
# Then RIGHT-CLICK → Open
```

### "Damaged app" message
```bash
sudo xattr -cr '/Applications/Foodie Meal Planner.app'
```
Then RIGHT-CLICK → Open

### EPIPE error appears
This means you're running an OLD build. Reinstall from the **4:58 PM DMG**.

---

## Summary

✅ **Build is ready and working**  
⚠️ **Must use RIGHT-CLICK → Open first time on each Mac**  
✅ **After first launch, double-click works normally**
