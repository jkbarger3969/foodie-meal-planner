# 🎤 Voice Commands Quick Reference

## Wake Word: "Foodie"

---

## Navigation
```
Foodie, next step
Foodie, previous step
Foodie, go home          ← Closes recipe, shows Today's Meals
Foodie, go to ingredients
```

## Timers
```
Foodie, start timer for 10 minutes
Foodie, pause timer
Foodie, resume timer
Foodie, cancel timer
```

## Reading (Text-to-Speech)
```
Foodie, read current step
Foodie, read ingredients
```

## Meal Switching
```
Foodie, show breakfast
Foodie, show lunch
Foodie, show dinner
Foodie, show dessert
Foodie, show side
```

---

## Setup (One-Time)

1. **Add Privacy Keys** (REQUIRED)
   - See: `VOICE_COMMANDS_PRIVACY_KEYS.md`
   - Takes 2 minutes in Xcode Info.plist

2. **Build & Run**
   ```
   Xcode → Clean → Build → Run
   ```

3. **Enable in App**
   ```
   Settings → Voice Control → Toggle ON
   Grant iOS permissions
   ```

---

## Modes

**Continuous:** Always listening (battery intensive)  
**Single Command:** One command then stops (default)

Toggle in Settings → Voice Control → Continuous Listening

---

## Testing

```
1. Enable voice commands in Settings
2. Say: "Foodie, next step"
3. Say: "Foodie, go home"
4. Say: "Foodie, start timer for 5 minutes"
```

All commands should:
- Execute the action
- Speak confirmation

---

## Troubleshooting

**Not working?**
- Add privacy keys to Info.plist first
- Enable in iOS Settings → FoodieKitchen
- Speak clearly with "Foodie" before command
- Check iPad has internet connection

**No sound?**
- Check iPad volume
- Check mute switch
- Disconnect Bluetooth if needed

---

## Full Documentation

- `VOICE_COMMANDS_COMPLETE.md` - Full guide
- `VOICE_COMMANDS_PRIVACY_KEYS.md` - Setup guide
- `PHASE_7_VOICE_COMMANDS_SUMMARY.md` - Overview

---

**Pattern:** "Foodie" + [command]  
**Commands:** 15+  
**Languages:** English (en-US)  
**Platform:** iPad only
