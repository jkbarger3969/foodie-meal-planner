# Quick Setup - Calendar Sync to Google Calendar

## TL;DR - Fast Track Setup

### 1. Build & Install (15 minutes)

**On your computer:**
```bash
cd /Users/keithbarger/Projects/foodie-meal-planner-desktop
npm run build
```

**Transfer to wife's computer:**
- File created: `dist/Foodie Meal Planner-1.0.0.dmg`
- Copy via AirDrop or USB
- Double-click DMG → Drag to Applications

---

### 2. Share Database via iCloud (5 minutes)

**On BOTH computers:**

1. Open Foodie app
2. Menu: **File → Set Database Folder** (if available, or check Settings)
3. Create/select folder:
   ```
   ~/Library/Mobile Documents/com~apple~CloudDocs/Foodie
   ```
4. ✅ Done - both computers now share meal plans

---

### 3. Setup Apple Calendar (3 minutes)

**On wife's computer:**

1. Open **Apple Calendar** app
2. **File → New Calendar → iCloud**
3. Name: **Foodie Meal Planner** (exact name, case-sensitive)
4. Choose a color

---

### 4. Sync to Google Calendar (5 minutes)

**On wife's computer:**

1. **System Settings → Internet Accounts**
2. Click **Google** (or add account)
3. Sign in with Google account
4. ✅ Enable **Calendars** checkbox
5. Wait 5 minutes for sync

---

### 5. Test (2 minutes)

**In Foodie app:**
1. Go to **Planner** tab
2. Add a meal (e.g., Monday Dinner: "Spaghetti")
3. Scroll to **Calendar Sync** section
4. Click **Sync current range**
5. When prompted, click **OK** to allow calendar access

**In Apple Calendar:**
- Should see "Dinner: Spaghetti" at 6:00 PM Monday

**In Google Calendar (after 5-15 minutes):**
- Go to [calendar.google.com](https://calendar.google.com)
- Should see "Dinner: Spaghetti"

---

## Daily Workflow

### Adding Meals:

1. **Open Foodie** (either computer)
2. **Planner tab** → Add meals for the week
3. Click **"Sync current range"** button
4. ✅ Done

Meals will appear:
- Immediately in Apple Calendar
- Within 15 minutes in Google Calendar

---

## Critical Settings

### Calendar Name:
Must be exactly: **Foodie Meal Planner**
- In Foodie app (Planner tab, Calendar Sync section)
- In Apple Calendar app (calendar name)
- Case-sensitive, spelling matters

### Meal Times:
- Breakfast: 8:00 AM
- Lunch: 12:00 PM  
- Dinner: 6:00 PM
- Duration: 1 hour each

### Database Location:
```
iCloud: ~/Library/Mobile Documents/com~apple~CloudDocs/Foodie/
```
Both computers must use the SAME location.

---

## Troubleshooting - Fast Fixes

### "Calendar not found"
→ Create calendar in Apple Calendar app with exact name

### Permission denied
→ **System Settings → Privacy & Security → Automation**
→ Enable "Calendar" for Foodie app

### Meals not in Google Calendar
→ Wait 15 minutes, then check
→ **System Settings → Internet Accounts → Google**
→ Toggle Calendars off/on

### Database not syncing
→ Both computers in **same iCloud folder**
→ Check iCloud Drive is enabled in System Settings

### Changes don't appear
→ Click **"Sync current range"** after every change

---

## Architecture

```
┌─────────────────┐
│  Foodie App     │
│  (Your Mac)     │
└────────┬────────┘
         │
         ↓ [Shared Database via iCloud]
         │
┌────────┴────────┐
│  Foodie App     │
│  (Wife's Mac)   │
└────────┬────────┘
         │
         ↓ [Sync button clicked]
         │
┌────────┴────────┐
│  Apple Calendar │ ← Events created here
│  (iCloud)       │
└────────┬────────┘
         │
         ↓ [Automatic sync]
         │
┌────────┴────────┐
│ Google Calendar │ ← Shows on web & phone
└─────────────────┘
```

---

## Important Notes

⚠️ **Manual Sync Required**
- Changes in Foodie don't auto-sync
- Must click "Sync current range" button each time
- Future enhancement could add auto-sync

⚠️ **Not Direct Google Calendar**
- App uses Apple Calendar (macOS native)
- Then Apple Calendar syncs to Google
- 5-15 minute delay is normal

⚠️ **macOS Only**
- Uses AppleScript for calendar integration
- Won't work on Windows or Linux
- Wife must have macOS computer

✅ **Syncs Both Ways**
- Your computer → Shared database → Wife's computer
- Either person can add meals
- Both see same data
- But must click "Sync" to update calendar

---

## File Paths Reference

**Database (iCloud):**
```
~/Library/Mobile Documents/com~apple~CloudDocs/Foodie/foodie.sqlite
```

**Built App:**
```
/Users/keithbarger/Projects/foodie-meal-planner-desktop/dist/Foodie Meal Planner-1.0.0.dmg
```

**Access Library folder:**
```
Finder → Go menu → Hold Option key → Library appears in menu
```

---

## Build Command Reference

**Development mode (for testing):**
```bash
npm run dev
```

**Build distributable app:**
```bash
npm run build
```

**After changes to database:**
```bash
npm run rebuild
```

---

## Next Steps After Setup

1. ✅ Install on wife's computer
2. ✅ Point both to iCloud database
3. ✅ Create Apple Calendar
4. ✅ Connect Google account
5. ✅ Test sync
6. ✅ Plan meals for the week
7. ✅ Sync to calendar
8. ✅ View on phone via Google Calendar app

---

## Support

See full guide: **CALENDAR_SYNC_SETUP_GUIDE.md**

Common questions:
- How to build: Section "Build Distributable App"
- Permission issues: Section "Troubleshooting - Permission denied"
- Google Calendar not showing: Section "Troubleshooting - Events not showing"
- Database sharing: Section "Share Database Between Computers"

---

**Estimated Total Setup Time: 30 minutes**

Good luck! 🎉
