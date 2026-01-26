# Rebuild iPad App with Voice Commands

## The Issue
The voice command code exists in the Swift files but hasn't been compiled and installed on your iPad yet. You're running an old version of the app.

## Quick Fix - Rebuild and Install

### 1. Open Xcode Project
1. Launch **Xcode**
2. Open your existing `FoodieKitchen` project (look on Desktop/Documents)
3. If you don't have the project, you'll need to create it following `ios-apps/INSTALLATION_GUIDE.md`

### 2. Verify Files Are Updated
Check that these files exist in your Xcode project:
- **Services/VoiceCommandManager.swift** - Should have wake word "foodie" on line 22
- **Services/RecipeStore.swift** - Should have `goHome()` function around line 88
- **Views/ContentView.swift** - Should have RecipeListView with DisclosureGroup
- **Views/SettingsView.swift** - Should have Voice Control section around line 69

If any are missing or old:
1. **Delete the old file** in Xcode (right-click → Delete → Move to Trash)
2. **Drag new file** from `ios-apps/FoodieKitchen/[folder]/[filename].swift` into the same folder

### 3. Add Privacy Permissions

**CRITICAL**: Add these to Info.plist or the app will crash:

1. In Xcode, find **Info.plist** in left sidebar
2. Right-click in the editor → **Add Row**
3. Add these TWO permissions:

| Key | Value |
|-----|-------|
| `Privacy - Microphone Usage Description` | `Foodie needs microphone access for voice commands while cooking` |
| `Privacy - Speech Recognition Usage Description` | `Foodie uses speech recognition for hands-free cooking control` |

**Or add via Source Code**:
1. Right-click Info.plist → **Open As** → **Source Code**
2. Add before the closing `</dict>`:
```xml
<key>NSMicrophoneUsageDescription</key>
<string>Foodie needs microphone access for voice commands while cooking</string>
<key>NSSpeechRecognitionUsageDescription</key>
<string>Foodie uses speech recognition for hands-free cooking control</string>
```

### 4. Build and Install

1. **Connect iPad** via USB cable
2. **Select iPad** as build target (top bar: FoodieKitchen > [Your iPad Name])
3. **Click Run** (▶️ button) or press `⌘ + R`
4. **Wait for build** (30-60 seconds)
5. **App will install and launch** on iPad

### 5. Enable Voice Commands

1. On iPad, open **Settings** in Foodie Kitchen app (gear icon)
2. Scroll to **Voice Control** section
3. Tap **Enable** (if Authorization shows "Not Authorized")
4. **Grant permissions**:
   - Allow Microphone access
   - Allow Speech Recognition
5. Toggle **Voice Commands** ON
6. Choose mode:
   - **Continuous Listening**: Always on (drains battery)
   - **Single Command**: Say "Foodie [command]" then stops

### 6. Test Voice Commands

Say: **"Foodie, show dinner"**
Expected: App loads dinner recipe

Say: **"Foodie, next step"** (while viewing recipe)
Expected: Advances to next instruction step

## Verify "Go Back" Button

After selecting a recipe:
1. Look for **Home button** (top-left, blue with house icon)
2. OR tap **"Today's Meals"** (top-center)
3. OR say **"Foodie, go home"** (if voice enabled)

All three should return you to the meal list.

## Available Voice Commands

### Navigation
- "Foodie, next step"
- "Foodie, previous step"
- "Foodie, go home"

### Timers
- "Foodie, start timer for 10 minutes"
- "Foodie, pause timer"
- "Foodie, resume timer"
- "Foodie, cancel timer"

### Reading
- "Foodie, read current step"
- "Foodie, read ingredients"

### Meal Switching
- "Foodie, show breakfast"
- "Foodie, show lunch"
- "Foodie, show dinner"
- "Foodie, show dessert"

## Troubleshooting

### Voice commands don't work
- Check Settings → Voice Control → Authorization status
- Make sure **Voice Commands toggle is ON**
- Verify iPad microphone works (test with Siri)
- Check "Last heard:" in Settings to see if iPad is hearing you

### Can't go back to meal list
- Tap blue **Home** button (top-left)
- OR tap **"Today's Meals"** (top-center toolbar)
- If buttons are missing: rebuild app (old version installed)

### Permission errors
- Delete app from iPad
- Rebuild and reinstall from Xcode
- Grant permissions when prompted

### Build errors in Xcode
- **"Missing file"**: Drag Swift file from `ios-apps/FoodieKitchen/` into project
- **"Duplicate symbols"**: Remove duplicate files from project navigator
- **Code signing**: Select your Apple ID in project settings → Signing & Capabilities

## Desktop Meal Sending

Make sure Desktop app is sending meals correctly:
1. **Open desktop app** → Plan a meal for today
2. **Click companion button** (📱 in toolbar)
3. **Verify server running**: Should show IP address and port 8080
4. **On iPad**: Settings → enter desktop IP → Save & Connect
5. **Send meal**: In desktop, click companion button → should see "Send to iPad" option

The desktop needs to send the meal plan WITH additional items. If this isn't working, the desktop code may need updating too.
