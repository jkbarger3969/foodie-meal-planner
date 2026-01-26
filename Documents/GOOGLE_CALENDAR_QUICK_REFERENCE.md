# 🚀 Google Calendar Sync - Quick Start

## ⚡ 5-Minute Setup

### Step 1: Get Google Credentials (One-Time)
1. Go to: https://console.cloud.google.com
2. Create new project: "Foodie Meal Planner"
3. Enable Google Calendar API
4. Create OAuth 2.0 credentials (Desktop app)
5. Download `google-credentials.json`

### Step 2: Configure Foodie App
1. Open Foodie → Settings tab
2. Find "🌐 Google Calendar Sync (Direct)" section
3. Upload `google-credentials.json`
4. Click "Open Authorization Page"
5. Sign in with YOUR Google account
6. Copy auth code and paste it back
7. Click "Complete Authorization"

### Step 3: Sync Meals
1. Go to Planner tab
2. Add meals to your plan
3. Go to Settings tab
4. Select target calendar (usually "Primary")
5. Click "🌐 Sync to Google Calendar"
6. Done! Check Google Calendar

---

## 🔄 Daily Usage

After initial setup, syncing is just 2 clicks:

1. **Plan meals** in Planner tab
2. **Click sync** in Settings tab

That's it! Events appear in Google Calendar instantly.

---

## 🏠 Multi-Computer Setup

To sync from wife's computer to YOUR calendar:

1. **On wife's computer:**
   - Install Foodie app
   - Use YOUR `google-credentials.json` file
   - Sign in as YOU during OAuth
   - Select YOUR calendar

2. **Result:**
   - Both computers sync to YOUR Google Calendar
   - You see all meals on your phone/web/computer

---

## 🎯 What Gets Synced

**Breakfast** → 8:00 AM event  
**Lunch** → 12:00 PM event  
**Dinner** → 6:00 PM event

**Event Format:**
```
Title: Breakfast: Pancakes with Maple Syrup
Time: 8:00 AM - 8:30 AM
Description: RecipeId: rec_12345
```

---

## ❓ Quick Troubleshooting

**Buttons are disabled?**  
→ Complete the setup steps in order (credentials → authorize → sync)

**"Error: Not authenticated"?**  
→ Click "Open Authorization Page" and complete OAuth flow

**Events not showing?**  
→ Refresh Google Calendar (may take a few seconds)

**Need to re-authorize?**  
→ Click "Revoke Access" then start setup again

---

## 📱 Access Your Meals Anywhere

Once synced to Google Calendar, your meal plan is available:

- 🌐 **Web:** calendar.google.com
- 📱 **Phone:** Google Calendar app (iOS/Android)
- 💻 **Desktop:** macOS Calendar, Outlook, etc. (via Google sync)
- 🗣️ **Voice:** "Hey Google, what's for dinner?"

---

## 🔒 Privacy & Security

**Credentials stored locally:**  
`~/Library/Application Support/foodie-meal-planner-desktop/`

**Access tokens:**  
Auto-refresh, stored encrypted by OS

**Google can see:**  
Only your meal events (not recipes or ingredients)

**Revoke access anytime:**  
Settings → Advanced Options → "Revoke Google Calendar Access"

---

## 📚 More Help

- **Full Setup Guide:** GOOGLE_CALENDAR_DIRECT_SYNC_SETUP.md
- **Technical Details:** GOOGLE_CALENDAR_IMPLEMENTATION_SUMMARY.md
- **Completion Status:** GOOGLE_CALENDAR_COMPLETE.md

---

## 🎉 Ready to Use!

The Google Calendar integration is **100% complete** and ready for production use.

Start by running:
```bash
npm run dev
```

Then follow the 5-minute setup above!
