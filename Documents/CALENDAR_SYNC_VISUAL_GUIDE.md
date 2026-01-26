# Calendar Sync Architecture - Visual Guide

## System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                     YOUR COMPUTER (Mac)                         │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  Foodie Meal Planner App                                 │  │
│  │  ┌────────────┐  ┌────────────┐  ┌────────────┐        │  │
│  │  │  Planner   │  │  Recipes   │  │ Collections│        │  │
│  │  │            │  │            │  │            │        │  │
│  │  │  Add Meals │  │  View/Edit │  │   Groups   │        │  │
│  │  └────────────┘  └────────────┘  └────────────┘        │  │
│  │                                                          │  │
│  │  [Calendar Sync Section]                                │  │
│  │  Calendar name: Foodie Meal Planner                     │  │
│  │  [ Sync current range ]  ← Click here                   │  │
│  └──────────────────────────────────────────────────────────┘  │
│                              │                                  │
│                              ↓ Writes to                        │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  SQLite Database (foodie.sqlite)                         │  │
│  │  Location: iCloud Drive/Foodie/                          │  │
│  │  ┌────────────┬────────────┬────────────┐               │  │
│  │  │ Recipes    │ Plans      │ Pantry     │               │  │
│  │  │ Table      │ Table      │ Table      │               │  │
│  │  └────────────┴────────────┴────────────┘               │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ iCloud Sync
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                   WIFE'S COMPUTER (Mac)                         │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  Foodie Meal Planner App                                 │  │
│  │  (Same app, same database via iCloud)                    │  │
│  │                                                          │  │
│  │  [Calendar Sync Section]                                │  │
│  │  Calendar name: Foodie Meal Planner                     │  │
│  │  [ Sync current range ]  ← Click here                   │  │
│  └──────────────────────────────────────────────────────────┘  │
│                              │                                  │
│                              ↓ AppleScript calls                │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  Apple Calendar App (iCloud)                             │  │
│  │  ┌─────────────────────────────────────────────────┐    │  │
│  │  │  📅 Foodie Meal Planner Calendar                │    │  │
│  │  │                                                  │    │  │
│  │  │  Monday, Jan 13                                 │    │  │
│  │  │  ├─ 8:00 AM  Breakfast: Pancakes                │    │  │
│  │  │  ├─ 12:00 PM Lunch: Chicken Salad               │    │  │
│  │  │  └─ 6:00 PM  Dinner: Spaghetti                  │    │  │
│  │  │                                                  │    │  │
│  │  │  Tuesday, Jan 14                                │    │  │
│  │  │  ├─ 8:00 AM  Breakfast: Oatmeal                 │    │  │
│  │  │  ├─ 12:00 PM Lunch: Turkey Sandwich             │    │  │
│  │  │  └─ 6:00 PM  Dinner: Grilled Salmon             │    │  │
│  │  └─────────────────────────────────────────────────┘    │  │
│  └──────────────────────────────────────────────────────────┘  │
│                              │                                  │
│                              ↓ iCloud Calendar Sync             │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  System Settings → Internet Accounts                     │  │
│  │  ┌────────────────────────────────────────────────────┐ │  │
│  │  │  Google Account                                    │ │  │
│  │  │  [✓] Calendars  ← Must be enabled                 │ │  │
│  │  │  [✓] Contacts                                     │ │  │
│  │  │  [✓] Mail                                         │ │  │
│  │  └────────────────────────────────────────────────────┘ │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ↓ Google Sync (5-15 min)
┌─────────────────────────────────────────────────────────────────┐
│                   GOOGLE CALENDAR (Cloud)                       │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  calendar.google.com                                     │  │
│  │  ┌─────────────────────────────────────────────────┐    │  │
│  │  │  My Calendars:                                   │    │  │
│  │  │  [✓] Personal                                    │    │  │
│  │  │  [✓] Work                                        │    │  │
│  │  │  [✓] Foodie Meal Planner ← Shows here            │    │  │
│  │  │                                                  │    │  │
│  │  │  Monday, Jan 13, 2026                           │    │  │
│  │  │  8:00 AM  Breakfast: Pancakes                   │    │  │
│  │  │  12:00 PM Lunch: Chicken Salad                  │    │  │
│  │  │  6:00 PM  Dinner: Spaghetti                     │    │  │
│  │  └─────────────────────────────────────────────────┘    │  │
│  └──────────────────────────────────────────────────────────┘  │
│                              │                                  │
│                              ↓ Syncs to all devices             │
│  ┌───────────────┐  ┌───────────────┐  ┌───────────────┐     │
│  │   iPhone      │  │   iPad        │  │   Web         │     │
│  │   Google Cal  │  │   Google Cal  │  │   Browser     │     │
│  │   App         │  │   App         │  │               │     │
│  └───────────────┘  └───────────────┘  └───────────────┘     │
└─────────────────────────────────────────────────────────────────┘
```

---

## Data Flow Step-by-Step

### Step 1: Add Meal (Either Computer)
```
User Action: Add "Dinner: Spaghetti" for Monday
              ↓
Foodie App: Writes to SQLite database
              ↓
Database: Stored in iCloud Drive/Foodie/foodie.sqlite
              ↓
iCloud: Syncs file to other computer (automatic, ~seconds)
              ↓
Other Computer: Sees same data when Foodie app refreshes
```

### Step 2: Sync to Calendar
```
User Action: Click "Sync current range" button
              ↓
Foodie App: Calls calendarSyncRange() function
              ↓
AppleScript: Runs script to access Apple Calendar
              ↓
macOS: Shows permission dialog (first time only)
              ↓
User: Clicks "OK" to allow
              ↓
Apple Calendar: Creates/updates events
              - Title: "Dinner: Spaghetti"
              - Time: 6:00 PM - 7:00 PM
              - Calendar: Foodie Meal Planner
```

### Step 3: Sync to Google (Automatic)
```
Apple Calendar (iCloud): Has new events
              ↓
macOS: Detects calendar changes
              ↓
Internet Accounts: Google sync active
              ↓
Sends to Google: Via CalDAV protocol
              ↓ (5-15 minutes)
Google Calendar: Receives and stores events
              ↓
All Devices: Events appear on phone, tablet, web
```

---

## Event Structure

### In Foodie Database:
```sql
Table: plans
Columns:
- Date: '2026-01-13'
- DinnerTitle: 'Spaghetti'
- DinnerRecipeId: '123'
- DinnerEventId: 'E621C0E5-B4C7-4B42-A2F3-D5E4F6A7B8C9'
```

### In Apple Calendar:
```
Event Properties:
- UID: 'E621C0E5-B4C7-4B42-A2F3-D5E4F6A7B8C9'
- Title: 'Dinner: Spaghetti'
- Description: 'RecipeId: 123'
- Start: 2026-01-13 18:00:00
- End: 2026-01-13 19:00:00
- Calendar: 'Foodie Meal Planner'
```

### In Google Calendar:
```
(Same properties as Apple Calendar, synced)
```

---

## Permission Flow

### First Sync Attempt:

```
┌────────────────────────────────────────────────┐
│  macOS Security Dialog                         │
├────────────────────────────────────────────────┤
│                                                │
│  "Foodie Meal Planner" would like to          │
│  access your calendar.                         │
│                                                │
│  This app will be able to:                    │
│  • Read calendar events                       │
│  • Create new events                          │
│  • Modify existing events                     │
│  • Delete events                               │
│                                                │
│  [ Cancel ]              [ OK ]                │
└────────────────────────────────────────────────┘
```

**User clicks OK** → Permission granted permanently

### If Permission Denied:

```
System Settings → Privacy & Security → Automation
  ↓
┌────────────────────────────────────────────────┐
│  Automation                                    │
├────────────────────────────────────────────────┤
│  Foodie Meal Planner                           │
│    [✓] Calendar  ← Enable this                 │
│    [ ] Finder                                  │
│    [ ] System Events                           │
└────────────────────────────────────────────────┘
```

---

## Sync Timing

### Foodie Database Sync (iCloud):
- **How often**: Continuous (iCloud Drive automatic sync)
- **Delay**: Usually < 10 seconds
- **Manual trigger**: None needed (automatic)

### Calendar Events (Foodie → Apple):
- **How often**: Only when you click "Sync current range"
- **Delay**: Instant (< 1 second)
- **Manual trigger**: Required - must click button

### Google Calendar Sync (Apple → Google):
- **How often**: Continuous (background process)
- **Delay**: 5-15 minutes typically
- **Manual trigger**: None (automatic once configured)

---

## Conflict Resolution

### Same Meal Edited on Both Computers:

```
Scenario: You edit Monday's dinner, wife also edits it

1. Your Computer:
   - Changes "Spaghetti" → "Lasagna"
   - Saves to iCloud database

2. Wife's Computer:
   - Changes "Spaghetti" → "Pizza"
   - Saves to iCloud database

3. iCloud:
   - One change wins (usually last write)
   - Other change is lost

4. Solution:
   - Communicate about who's planning
   - Or refresh Foodie before making changes
   - SQLite doesn't have conflict resolution
```

### Calendar Event Updates:

```
Scenario: Meal changed after syncing

1. Original:
   - Database: Monday Dinner = "Spaghetti"
   - Calendar: Event "Dinner: Spaghetti"
   - Event UID: ABC123

2. Change in Foodie:
   - Database: Monday Dinner = "Lasagna"

3. Click Sync:
   - Finds existing event by UID (ABC123)
   - Updates title to "Dinner: Lasagna"
   - Same event, new title
   - No duplicate created ✓

4. Google Calendar:
   - Receives update from Apple Calendar
   - Shows "Dinner: Lasagna"
```

---

## Network Requirements

### For iCloud Database Sync:
- ✅ Internet connection required
- ✅ Signed into same iCloud account on both Macs
- ✅ iCloud Drive enabled
- ⏱️ Sync delay: seconds to minutes

### For Apple → Google Sync:
- ✅ Internet connection required
- ✅ Google account added to Internet Accounts
- ✅ Calendars enabled for Google account
- ⏱️ Sync delay: 5-15 minutes

### Offline Behavior:
- ❌ Database changes won't sync until online
- ❌ Calendar events won't sync to Google
- ✅ Can still add meals in Foodie (local)
- ✅ Can still view existing meals
- ✅ Syncs when connection restored

---

## Multiple Device Scenarios

### Scenario A: Both computers used by same person
```
Morning (Your Mac):
  - Plan Monday-Wednesday
  - Click Sync
  - Events in Apple Calendar

Evening (Wife's Mac):
  - See Monday-Wednesday meals (via iCloud DB)
  - Plan Thursday-Friday
  - Click Sync
  - All events in Apple Calendar
  - All events in Google Calendar
```

### Scenario B: Each computer used by different person
```
You (Your Mac):
  - Plan dinners for the week
  - Click Sync

Wife (Her Mac):
  - See your dinners
  - Can edit if needed
  - Click Sync to update calendar
  - Views on her phone via Google Cal
```

### Scenario C: Using same Google account on both
```
Setup:
  - Both Macs → Same iCloud account (for database)
  - Both Macs → Same Google account (for calendar)

Result:
  - Database syncs via iCloud
  - Calendar events appear in Google
  - Both see same Google Calendar on their phones
```

---

## Backup Strategy

### Database Backup:
```
Location: ~/Library/Mobile Documents/com~apple~CloudDocs/Foodie/

Backup methods:
1. Time Machine (automatic if enabled)
2. Manual copy:
   cp foodie.sqlite foodie-backup-2026-01-13.sqlite
3. Export from Foodie app (if feature exists)
```

### Calendar Backup:
```
Apple Calendar:
  File → Export → Export...
  Save as: Foodie-backup.ics

Can re-import later if needed
```

---

## Troubleshooting Decision Tree

```
Events not showing in Google Calendar?
  │
  ├─ Are they in Apple Calendar?
  │  ├─ NO → Click "Sync current range" in Foodie
  │  └─ YES → Continue
  │
  ├─ Is Google account added?
  │  ├─ NO → System Settings → Add Google account
  │  └─ YES → Continue
  │
  ├─ Is Calendars enabled for Google?
  │  ├─ NO → System Settings → Google → Enable Calendars
  │  └─ YES → Continue
  │
  ├─ How long has it been?
  │  ├─ < 5 min → Wait longer
  │  ├─ < 30 min → Try toggling Calendars off/on
  │  └─ > 30 min → Try manual export/import
  │
  └─ Check calendar visibility in Google Calendar web
     - Is "Foodie Meal Planner" checked in sidebar?
```

---

This visual guide shows exactly how data flows from Foodie app to Google Calendar!
