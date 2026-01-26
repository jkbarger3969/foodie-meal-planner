# 🔐 REQUIRED: Add Privacy Keys for Voice Commands

## Quick Setup - 2 Minutes

Before voice commands will work, you **MUST** add two privacy permission keys to your Xcode project.

---

## Step-by-Step Visual Guide

### 1. Open Xcode Project
```
File → Open → /Users/keithbarger/Desktop/FoodieKitchen/FoodieKitchen.xcodeproj
```

### 2. Select Project Settings
1. Click **FoodieKitchen** (blue icon) in left sidebar
2. Select **FoodieKitchen** target (under TARGETS)
3. Click **Info** tab at the top

### 3. Add Microphone Permission

You'll see "Custom iOS Target Properties" list.

1. **Hover over any existing row** → a **+** button appears
2. **Click the +** button
3. **Start typing:** "Privacy - Micro..."
4. **Select:** `Privacy - Microphone Usage Description`
5. **Value:** 
   ```
   Foodie uses your microphone for hands-free voice commands while cooking. Say 'Foodie' followed by a command to control the app without touching the screen.
   ```

### 4. Add Speech Recognition Permission

1. **Click the + button** again (below the row you just added)
2. **Start typing:** "Privacy - Speech..."
3. **Select:** `Privacy - Speech Recognition Usage Description`
4. **Value:**
   ```
   Foodie uses speech recognition to understand your voice commands. This allows hands-free control of recipes, timers, and navigation while cooking.
   ```

---

## What It Should Look Like

After adding both keys, your Info tab should show:

```
Custom iOS Target Properties

Key                                          Value
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Privacy - Microphone Usage Description      Foodie uses your microphone for hands-free...
Privacy - Speech Recognition Usage...       Foodie uses speech recognition to understand...
[... other existing keys ...]
```

---

## Alternative: Edit Info.plist as Source Code

If you prefer to edit the raw XML:

1. **Right-click** `Info.plist` in Project Navigator
2. **Select** "Open As → Source Code"
3. **Add** these lines before the final `</dict>`:

```xml
<key>NSMicrophoneUsageDescription</key>
<string>Foodie uses your microphone for hands-free voice commands while cooking. Say 'Foodie' followed by a command to control the app without touching the screen.</string>

<key>NSSpeechRecognitionUsageDescription</key>
<string>Foodie uses speech recognition to understand your voice commands. This allows hands-free control of recipes, timers, and navigation while cooking.</string>
```

---

## Verify It Worked

1. **Build the app** (Cmd+B)
2. **Run on iPad** (Cmd+R)
3. **First time only:** iOS will show permission prompts
4. **Tap "OK" / "Allow"** for both prompts
5. **Open Settings** in app → Voice Control section
6. **Status should show:** "Authorized" with green ✅

---

## If No Permission Prompts Appear

The keys were not added correctly. Check:

1. Keys are under **Info** tab (not Build Settings)
2. Key names are exact (use dropdown, don't type manually)
3. Rebuild app (Cmd+Shift+K → Cmd+B)
4. Reinstall on iPad

---

## Why These Are Required

- **NSMicrophoneUsageDescription:** iOS requires explanation before allowing microphone access
- **NSSpeechRecognitionUsageDescription:** iOS requires explanation before allowing speech recognition

Without these keys:
- ❌ Voice Commands toggle won't work
- ❌ App may crash when trying to access microphone
- ❌ iOS will silently deny permissions

---

## Already Added?

If you see these keys in Info.plist already, you're good to go! Just run the app.

---

**Next Step:** Build and run the app, then test voice commands!

See `VOICE_COMMANDS_COMPLETE.md` for full testing guide.
