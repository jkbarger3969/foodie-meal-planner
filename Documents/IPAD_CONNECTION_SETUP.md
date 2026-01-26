# iPad Connection Setup - Wife's Laptop

## Current Status

✅ iPad app rebuilt with connection fixes (slower retry, no infinite loop)  
✅ Desktop app rebuilt with serialization fixes  
❌ **Desktop app not running on wife's laptop** ← This is why iPad can't connect

## Quick Fix

### Step 1: Install Desktop App on Wife's Laptop

Copy the latest build from your dev Mac to wife's laptop:

**File location on dev Mac:**
```
/Users/keithbarger/Projects/foodie-meal-planner-desktop/dist/Foodie Meal Planner-1.0.0-arm64.dmg
```

**On wife's laptop:**
1. Open the .dmg
2. Drag to Applications (replace existing)
3. **Launch Foodie Meal Planner**

### Step 2: Find Server IP Address

**Option A - From Desktop App Console:**
1. Open the desktop app on wife's laptop
2. View → Toggle Developer Tools → Console tab
3. Look for:
   ```
   📱 Companion server started on port 8080
   📱 Connect iOS devices to:
      ws://192.168.X.X:8080
   ```

**Option B - Run Diagnostic Script:**

Copy `check-companion-server.sh` to wife's laptop and run:
```bash
chmod +x check-companion-server.sh
./check-companion-server.sh
```

It will show all available IP addresses.

### Step 3: Configure iPad

On the iPad app:
1. Tap the Settings button (⚙️)
2. Enter the IP address (e.g., `192.168.2.189`)
3. Tap Connect

### Step 4: Verify Connection

**Desktop console should show:**
```
📱 ipad connected: iPad-XXXXX (192.168.X.X)
```

**iPad should show:**
- "Connected" status
- Settings button stops flashing
- No timeout errors in Xcode

## Troubleshooting

### iPad shows "The request timed out"
- Desktop app not running on wife's laptop
- Wrong IP address entered
- iPad and laptop on different WiFi networks
- Firewall blocking port 8080

### Settings button still flashing (but slower)
- This is expected if not connected yet
- Will stop completely once connected
- Much better than before (was 100s of attempts/second, now max 5 attempts with delays)

### Can't find IP address
Run this on wife's laptop:
```bash
ifconfig | grep "inet " | grep -v "127.0.0.1"
```

Look for address like `192.168.X.X` or `10.X.X.X`

## Testing After Connection

Once connected, test:
1. **Send Today's Meals to iPad** - should appear without errors
2. **Send Shopping List to Phone** - should appear without errors
3. No "object could not be cloned" errors
4. Clean app quit (no force quit needed)

---

**Current IP iPad is trying:** `192.168.2.189:8080`  
**Status:** Timing out because desktop server not running on wife's laptop
