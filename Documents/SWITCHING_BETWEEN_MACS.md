# Switching Between Macs - Quick Guide

This guide explains how to use the iOS companion apps with either your Mac or your wife's Mac.

---

## Overview

The iOS apps can connect to **any** Mac running the Foodie desktop app on the same WiFi network. You can easily switch between your Mac and your wife's Mac by changing the server IP address in the app settings.

---

## How It Works

### Server IP Address
Each Mac has its own local IP address on your home network:
- **Your Mac**: e.g., `192.168.1.100`
- **Wife's Mac**: e.g., `192.168.1.105`

The iOS apps connect to whichever IP address you configure in settings.

### No Data Loss
- All recipe data lives on the desktop Macs
- iOS apps are just **viewers/controllers**
- Switching between Macs is instant and safe
- No sync conflicts or data duplication

---

## Setup: Find Each Mac's IP Address

### On Your Mac

1. **Launch Foodie desktop app**
2. **Click 📱 button** (bottom right corner)
3. **Note the server address** shown in the panel:
   ```
   Server running on:
   ws://192.168.1.100:8080
   ```
4. **Write down the IP**: `192.168.1.100`

### On Wife's Mac

Repeat the same steps:
1. Launch Foodie desktop app
2. Click 📱 button
3. Note her Mac's IP address (e.g., `192.168.1.105`)
4. Write it down

**Tip:** Create a note in your phone with both IP addresses for quick reference!

---

## Switching Between Macs

### iPhone Shopping List App

**To connect to YOUR Mac:**
1. Open FoodieShoppingList app
2. Tap **Settings** (gear icon)
3. Enter: `ws://192.168.1.100:8080` (your Mac's IP)
4. Tap **Save & Connect**
5. See green "Connected" status

**To switch to WIFE'S Mac:**
1. Open **Settings**
2. Change address to: `ws://192.168.1.105:8080` (her Mac's IP)
3. Tap **Save & Connect**
4. Now connected to her Mac!

**To switch back to YOUR Mac:**
1. Open **Settings**
2. Change address back to: `ws://192.168.1.100:8080`
3. Tap **Save & Connect**

### iPad Kitchen App

**To connect to YOUR Mac:**
1. Open FoodieKitchen app
2. Tap **Settings** (gear icon)
3. Enter just the IP: `192.168.1.100` (no `ws://` or `:8080`)
4. Tap **Save & Connect**
5. See green "Connected"

**To switch to WIFE'S Mac:**
1. Open **Settings**
2. Change to: `192.168.1.105`
3. Tap **Save & Connect**

**Note:** The iPad app only needs the IP address (not the full WebSocket URL).

---

## Common Scenarios

### Scenario 1: Weekly Shopping
**You use your Mac for meal planning, wife uses hers for cooking:**

**Monday (Your Mac):**
- You plan meals on your Mac
- Send shopping list to iPhone: `ws://192.168.1.100:8080`
- Go shopping, check off items
- Return home, sync back to your Mac

**Wednesday (Wife's Mac):**
- Wife has different recipes on her Mac
- Switch iPhone to: `ws://192.168.1.105:8080`
- She sends her shopping list
- You shop again using her list

### Scenario 2: Cooking Together
**Different recipes on different Macs:**

**Your Mac:**
- You're making chicken on your Mac
- iPad connected to: `192.168.1.100`
- Following your recipe in split-screen

**Wife's Mac:**
- She's making dessert on her Mac
- After you finish, switch iPad to: `192.168.1.105`
- Now she can follow her recipe

### Scenario 3: Travel/Work
**One Mac is away:**

If your Mac is at work or traveling:
- Just connect to wife's Mac (`192.168.1.105`)
- Use her recipes and shopping lists
- When your Mac returns home, switch back

---

## Best Practices

### Keep a Reference Note

Create a note on your iPhone:
```
Foodie Server Addresses

My Mac:
ws://192.168.1.100:8080 (iPhone)
192.168.1.100 (iPad)

Wife's Mac:
ws://192.168.1.105:8080 (iPhone)
192.168.1.105 (iPad)
```

### Use Descriptive Names (Optional)

In iOS Settings → General → About → Name, you can rename devices:
- "Keith's Mac" instead of "MacBook Pro"
- "Sarah's Mac" instead of "iMac"

This makes it easier to identify which Mac is which.

### Check Connection Status

Before sending/receiving data:
- Look for **green checkmark** in Settings
- If disconnected (red X), reconnect
- Make sure correct Mac is running Foodie app

---

## Troubleshooting

### "Cannot Connect to Wife's Mac"

**Check:**
- [ ] Wife's Mac is on same WiFi network
- [ ] Foodie desktop app is running on her Mac
- [ ] You entered her Mac's IP correctly
- [ ] Both Macs are powered on (not sleeping)

### "IP Address Changed"

IP addresses can change if router reboots:

**Solution:**
1. Check current IP on the Mac:
   - Click 📱 button in Foodie app
   - Note new IP address
2. Update iOS app settings with new IP
3. Reconnect

**Prevent IP changes (Advanced):**
- Set static IP in router settings (DHCP reservation)
- Assign fixed IPs to both Macs
- Then addresses won't change

### "Connected to Wrong Mac"

If you sent data to the wrong Mac:

**iPhone shopping list:**
- Items are already on wrong Mac's database
- Solution: Manually re-enter on correct Mac, or switch and resend

**iPad recipe:**
- Just switch to correct Mac's IP
- Request recipes again from correct Mac

---

## Advanced: Multiple Devices Per Mac

You can connect multiple iOS devices to one Mac:

**Example:**
- **Your iPhone** → Your Mac (shopping)
- **Wife's iPhone** → Wife's Mac (shopping)
- **Shared iPad** → Your Mac (cooking your recipe)
- **Second iPad** → Wife's Mac (cooking her recipe)

Each Mac's companion panel shows all connected devices.

---

## Quick Reference

### iPhone Format
```
ws://[IP]:8080
```
Examples:
- `ws://192.168.1.100:8080`
- `ws://10.0.0.5:8080`

### iPad Format
```
[IP]
```
Examples:
- `192.168.1.100`
- `10.0.0.5`

### Finding Current Connection

**iPhone:**
- Settings → Desktop Mac section shows current address

**iPad:**
- Settings → Desktop Mac section shows current IP

**Desktop:**
- Click 📱 button
- "Connected Devices" shows which iOS devices are connected

---

## Security Note

All communication is **local WiFi only**:
- No internet connection required
- No cloud servers involved
- Data never leaves your home network
- Both Mac and iOS device must be on same WiFi

This means:
- ✅ Secure and private
- ✅ Works offline
- ❌ Won't work from outside your home
- ❌ Won't work on cellular data

---

## Summary

**Switching is easy:**
1. Find the Mac's IP (click 📱 button)
2. Change IP in iOS app settings
3. Tap "Save & Connect"
4. Done! Now connected to different Mac

**No data loss:**
- Each Mac has its own recipes
- iOS apps just display data from whichever Mac you connect to
- Safe to switch back and forth anytime

**Same WiFi required:**
- All devices (your Mac, wife's Mac, iPhone, iPad) must be on same network
- Desktop app must be running on the Mac you want to connect to

**Keep both IPs handy:**
- Save both Mac IP addresses in your phone's notes
- Makes switching quick and easy

---

## Example: Complete Workflow

**Monday Morning (Planning on Your Mac):**
1. iPhone settings: `ws://192.168.1.100:8080`
2. You plan meals on your Mac
3. Send shopping list to iPhone
4. Green checkmark shows connected to your Mac

**Monday Afternoon (Shopping):**
1. iPhone still connected to your Mac
2. Shopping list works offline at store
3. Check off items as you shop
4. Add "Milk" manually

**Monday Evening (Cooking Your Recipe):**
1. iPad settings: `192.168.1.100`
2. Return home, iPhone auto-syncs to your Mac
3. Send recipe to iPad from your Mac
4. Cook using iPad split-screen

**Tuesday Evening (Wife's Recipe):**
1. iPad settings: Change to `192.168.1.105`
2. iPad now connects to wife's Mac
3. She sends her recipe to iPad
4. You cook using her recipe

**Wednesday (Back to Your Mac):**
1. iPad settings: Change back to `192.168.1.100`
2. Connected to your Mac again
3. Business as usual

**Easy!** 🎉
