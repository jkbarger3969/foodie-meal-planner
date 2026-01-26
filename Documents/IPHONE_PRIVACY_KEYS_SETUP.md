# iPhone App - Privacy Keys Setup

## CRITICAL: Add These Before Building

The voice commands feature requires microphone and speech recognition permissions. You **MUST** add these privacy keys to the Info.plist in Xcode, or the app will crash when requesting permissions.

---

## How to Add Privacy Keys in Xcode

### Method 1: Via Info Tab (Recommended)

1. Open the Xcode project for FoodieShoppingList
2. In the Project Navigator (left sidebar), select **FoodieShoppingList** (blue project icon at top)
3. Select the **FoodieShoppingList** target (under TARGETS)
4. Click the **Info** tab (at the top)
5. Under "Custom iOS Target Properties", hover over any row and click the **+** button
6. Add these two entries:

| Key | Type | Value |
|-----|------|-------|
| Privacy - Microphone Usage Description | String | `Foodie needs microphone access for voice commands while shopping.` |
| Privacy - Speech Recognition Usage Description | String | `Foodie needs speech recognition to understand voice commands for managing your shopping list.` |

**Screenshot locations:**
- Info tab is next to "Build Settings", "Build Phases", etc.
- Keys will appear as expandable rows with key/type/value columns

---

### Method 2: Via Info.plist File (Alternative)

If you have a separate Info.plist file:

1. Locate `Info.plist` in the Project Navigator
2. Right-click → Open As → Source Code
3. Add these lines inside the `<dict>` tag:

```xml
<key>NSMicrophoneUsageDescription</key>
<string>Foodie needs microphone access for voice commands while shopping.</string>
<key>NSSpeechRecognitionUsageDescription</key>
<string>Foodie needs speech recognition to understand voice commands for managing your shopping list.</string>
```

---

## Verify Keys Are Added

After adding the keys:

1. Build the project (Cmd+B)
2. Run on device/simulator (Cmd+R)
3. Go to Settings → Voice Control
4. Tap "Enable"
5. You should see permission prompts for:
   - Microphone access
   - Speech recognition access

If the app crashes at this step, the keys are missing or incorrect.

---

## Why These Keys Are Required

Starting with iOS 10, Apple requires developers to declare why their app needs sensitive permissions. The keys are:

- **NSMicrophoneUsageDescription**: Explains why the app needs microphone access
- **NSSpeechRecognitionUsageDescription**: Explains why the app needs speech recognition

Without these keys:
- iOS will terminate the app with a crash
- User won't see permission prompts
- Voice commands won't work

---

## Alternative: Skip Voice Commands

If you don't want to add voice commands:

1. Don't enable "Voice Commands" toggle in Settings
2. The feature is optional - all other app features work normally
3. The app won't crash if you never enable voice commands

However, the privacy keys should still be added to prevent potential issues.

---

## Common Issues

### Issue: App crashes immediately when tapping "Enable" in Voice Control
**Cause**: Privacy keys not added
**Fix**: Add both keys as shown above, rebuild, and try again

### Issue: Permission prompts don't appear
**Cause**: Either keys are missing, or permissions were previously denied
**Fix**: 
1. Add keys if missing
2. Go to iOS Settings → Privacy → Microphone → Foodie Shopping List (enable)
3. Go to iOS Settings → Privacy → Speech Recognition → Foodie Shopping List (enable)

### Issue: Keys added but still crashing
**Cause**: Wrong key names
**Fix**: Use exact key names:
- `NSMicrophoneUsageDescription` (NOT MicrophoneUsageDescription)
- `NSSpeechRecognitionUsageDescription` (NOT SpeechRecognitionUsageDescription)

---

## Quick Reference

**Exact key names for copy/paste:**
```
NSMicrophoneUsageDescription
NSSpeechRecognitionUsageDescription
```

**Suggested descriptions:**
```
Foodie needs microphone access for voice commands while shopping.
Foodie needs speech recognition to understand voice commands for managing your shopping list.
```

You can customize the descriptions, but they should clearly explain why the permission is needed.

---

**Once keys are added, you're ready to build and test voice commands!**

See [IPHONE_VOICE_COMMANDS.md](./IPHONE_VOICE_COMMANDS.md) for complete usage guide.
