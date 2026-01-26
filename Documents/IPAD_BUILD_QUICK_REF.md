# iPad App Build - Quick Reference Card

## 🚀 Quick Start (15 min speedrun)

1. **Create Project**
   - Xcode → New Project → **iOS** → App
   - Name: `FoodieKitchen`, Team: Your Apple ID
   - Save to Desktop

2. **Add Folders**
   - Right-click FoodieKitchen → New Group
   - Create: Models, Services, Views, Extensions

3. **Drag Files** (from `ios-apps/FoodieKitchen/`)
   - Models: 3 files (Recipe, TimerItem, Message)
   - Services: 4 files (ConnectionManager, RecipeStore, TimerManager, VoiceCommandManager)
   - Views: 6 files (RecipeDetail, RecipeStep, TodaysMeals, Timer, Settings, VoiceCommand)
   - Extensions: 1 file (String+Extensions)
   - Root: FoodieKitchenApp.swift (replace existing)
   - Delete: ContentView.swift

4. **Add Privacy Keys**
   - Project → Target → Info
   - Microphone: "needs microphone for voice commands"
   - Speech Recognition: "uses speech for hands-free control"

5. **Build & Run**
   - Connect iPad
   - Select iPad in device dropdown
   - Press ▶ or Command+R

---

## 📱 Connection Setup

**Get Mac IP:**
```
Desktop app → Click 📱 → Copy IP (e.g., 192.168.1.100)
```

**Configure iPad:**
```
iPad app → Settings ⚙️ → Enter IP → Save & Connect
```

**Switch to Wife's Mac:**
```
Same process, just enter her Mac's IP instead
```

---

## ⚠️ Common Errors

| Error | Quick Fix |
|-------|-----------|
| Cannot find type | File Inspector → Check target membership ✅ |
| Multiple commands | Delete duplicate file, clean build |
| Missing import | Add `import Combine` or `import UIKit` |
| App crashes | Check FoodieKitchenApp.swift has @StateObject lines |
| Won't connect | Verify same WiFi, correct IP, port 8080 open |

---

## 📋 File Count Verification

- **15 total .swift files**
- Models: 3
- Services: 4  
- Views: 6
- Extensions: 1
- App: 1

**Check:** Build Phases → Compile Sources (should show 15 files)

---

## 🎯 First-Time Setup

1. Enable Developer Mode on iPad
2. Trust certificate on iPad (Settings → General → Device Management)
3. Grant microphone permission
4. Grant speech recognition permission
5. Enter Mac IP in Settings
6. Test connection

---

## 🔄 Multi-Mac Workflow

**Your Mac IP:** ____________ (write it here)  
**Wife's Mac IP:** ____________ (write it here)

**To switch:** Settings → Change IP → Save & Connect

**Persistence:** IP is saved automatically, survives app restarts

---

## 🛠️ Clean Build Process

```
1. Shift+Cmd+K (Clean Build Folder)
2. Delete Derived Data (Xcode Settings → Locations)
3. Close Xcode
4. Reopen Xcode
5. Command+B (Build)
```

---

## 📦 What iPad App Does

✅ Receives today's meal plan from desktop  
✅ Displays recipes with step-by-step instructions  
✅ Voice commands for hands-free cooking  
✅ Multiple timers for different cooking tasks  
✅ Persistent connection to desktop Mac  
✅ Switch between multiple Macs (yours + wife's)  

---

## 🔗 Related Docs

- Full guide: `XCODE_IPAD_BUILD_GUIDE.md`
- Multi-Mac details: `SWITCHING_BETWEEN_MACS.md`
- iPhone app: `XCODE_STEP_BY_STEP.md`

---

**Build Time:** ~15-20 minutes  
**First-Time Setup:** +5 minutes  
**Total:** ~25 minutes from zero to working iPad app
