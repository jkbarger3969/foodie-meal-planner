# Beta Tester Quick Start Guide

**Foodie Meal Planner v1.0.0**  
**Platform:** macOS (Apple Silicon - M1/M2/M3)

---

## Installation

1. **Download** the DMG file:
   - `Foodie Meal Planner-1.0.0-arm64.dmg` (106MB)

2. **First-time security warning:**
   - Double-click the DMG
   - If macOS blocks it: Right-click → Open → Allow
   - Alternatively: System Settings → Privacy & Security → Allow

3. **Install:**
   - Drag "Foodie Meal Planner" to Applications folder
   - Launch from Applications

4. **First launch:**
   - App will initialize database (~5-10 seconds)
   - You'll see the main interface with 3,532 recipes loaded

---

## Key Features to Test

### 1. Recipe Management ⭐
- **Search:** Type in search box - should be INSTANT (<5ms)
- **Virtual Scrolling:** Scroll through 3,000+ recipes smoothly (60 FPS)
- **Favorites:** Click star icon to favorite recipes
- **Import:** Paste a recipe URL (supports AllRecipes, NYTimes Cooking, etc.)

### 2. Meal Planning 📅
- **Grid View:** Click "Planner" tab → see 7-day calendar
- **Drag & Drop:** Drag recipes from list to meal slots
- **Additional Items:** Add sides/desserts to any meal
- **Smart Suggestions:** Empty slot → click → get AI suggestions

### 3. Shopping List 🛒
- **Auto-Generate:** Set date range → click "Generate Shopping List"
- **Store Assignment:** Assign items to stores (Costco, Trader Joe's, etc.)
- **Pantry Integration:** Items auto-deducted from pantry inventory

### 4. Multi-User Features 👨‍👩‍👧‍👦
- **Household Members:** Add users via Settings
- **Dietary Restrictions:** Assign per person (vegetarian, gluten-free, etc.)
- **Personal Favorites:** Each user has their own favorites
- **Meal Assignments:** Assign specific meals to specific people

### 5. Google Calendar Sync 🗓️
- **OAuth Setup:** Settings → Google Calendar → Authenticate
- **Bidirectional Sync:** Meals appear in Google Calendar, edits sync back
- **Duplicate Prevention:** Smart detection of duplicate events

### 6. Companion Apps 📱
**iPad Kitchen Display:**
- Shows today's meals
- Voice commands: "Foodie, next step"
- Timer integration

**iPhone Shopping List:**
- Real-time sync with desktop
- Check off items while shopping
- Add items via voice

---

## Performance Testing Checklist

### Virtual Scrolling (Phase 9.2)
1. Go to Recipes tab
2. Scroll rapidly through the list
3. **Expected:** Smooth 60 FPS, no lag
4. **Check:** Memory usage <60MB (Activity Monitor)

### Search Speed (Phase 9.1 + 9.4)
1. Type "chicken" in search box
2. **Expected:** Results appear in <5ms
3. **Try:** Various search terms, partial matches

### Meal Planner (Phase 9.3)
1. Open Planner tab → load 7-day view
2. **Expected:** Grid renders in <100ms
3. **Try:** Expand meal slots with additional items

### Animation Performance (Phase 9.8)
1. Open modals, show toasts, drag meals
2. **Expected:** Smooth 60 FPS animations
3. **Try:** Switch tabs while animations running

---

## Known Issues (Expected)

1. **"Unidentified Developer" Warning**
   - **Why:** App not notarized yet (beta testing)
   - **Fix:** Right-click → Open → Allow

2. **First Launch Delay**
   - **Why:** Database initialization
   - **Duration:** 5-10 seconds (one-time)

3. **Companion App Setup**
   - **Manual IP Entry:** You'll need to enter desktop IP manually
   - **Network:** iPad/iPhone must be on same WiFi network

---

## What to Report

### Critical Bugs 🚨
- App crashes
- Data loss
- Features completely non-functional
- Security/privacy concerns

### High Priority Issues ⚠️
- Features partially working
- Performance significantly worse than expected
- UI rendering problems
- Data sync failures

### Medium Priority Issues 📝
- Minor UI glitches
- Confusing UX
- Missing features you expected
- Feature requests

### Low Priority Issues 💡
- Cosmetic issues
- Nice-to-have features
- Documentation unclear

---

## How to Report Issues

**Include in your report:**
1. **Steps to reproduce** (detailed)
2. **Expected behavior**
3. **Actual behavior**
4. **Screenshots/videos** (if applicable)
5. **System info:** macOS version, Mac model (M1/M2/M3)
6. **Console logs:** If app crashed, check Console.app

**Send to:** [Your contact email/Slack/GitHub Issues]

---

## Performance Expectations

### App Startup
- **Target:** <1 second
- **Acceptable:** 1-2 seconds
- **Issue:** >3 seconds

### Recipe Search
- **Target:** <5ms
- **Acceptable:** 5-20ms
- **Issue:** >50ms

### Meal Planner Load
- **Target:** <100ms
- **Acceptable:** 100-200ms
- **Issue:** >300ms

### Memory Usage
- **Target:** <60MB
- **Acceptable:** 60-100MB
- **Issue:** >150MB

### Scroll FPS
- **Target:** 60 FPS
- **Acceptable:** 50-60 FPS
- **Issue:** <45 FPS

---

## Advanced Testing (Optional)

### Stress Testing
1. **Import 100 recipes** via URL import
2. **Create 30-day meal plan**
3. **Generate shopping list** for 30 days
4. **Check performance** after each step

### Multi-User Testing
1. **Create 5 household members**
2. **Assign dietary restrictions** to each
3. **Create personal favorites** per user
4. **Assign meals** to specific people
5. **Verify filtering** works correctly

### Companion App Testing
1. **Connect iPad** via WebSocket
2. **Test voice commands** (10+ commands)
3. **Add items** from iPhone
4. **Verify real-time sync**

### Google Calendar Testing
1. **Complete OAuth flow**
2. **Sync 7-day meal plan**
3. **Edit event** in Google Calendar
4. **Verify sync back** to app
5. **Check duplicate prevention**

---

## Feedback Survey (Optional)

After 1 week of testing, please rate (1-5 scale):

**Performance:**
- [ ] App startup speed
- [ ] Recipe search speed
- [ ] Meal planner responsiveness
- [ ] Overall smoothness

**Features:**
- [ ] Recipe management
- [ ] Meal planning
- [ ] Shopping list generation
- [ ] Multi-user support
- [ ] Companion apps
- [ ] Google Calendar sync

**User Experience:**
- [ ] Interface clarity
- [ ] Feature discoverability
- [ ] Workflow efficiency
- [ ] Documentation quality

**Overall:**
- [ ] Would you recommend this app? (Yes/No)
- [ ] Most useful feature?
- [ ] Least useful feature?
- [ ] Missing features?

---

## Support

**Documentation:**
- See `PRODUCTION_READINESS_REPORT.md` for technical details
- See `PHASE_9_COMPLETE_SUMMARY.md` for performance info
- See repository README for full documentation

**Testing Script:**
Run automated tests:
```bash
node test-production-readiness.js
```

**Debug Mode:**
Launch app from Terminal to see console logs:
```bash
/Applications/Foodie\ Meal\ Planner.app/Contents/MacOS/Foodie\ Meal\ Planner
```

---

**Thank you for beta testing!** 🙏

Your feedback will help make Foodie Meal Planner the best meal planning app for families.

**Version:** 1.0.0  
**Build Date:** 2026-01-20  
**Platform:** macOS (Apple Silicon)
