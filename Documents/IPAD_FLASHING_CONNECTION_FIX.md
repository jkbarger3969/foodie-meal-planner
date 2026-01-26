# iPad Settings Button Flashing - Root Cause & Fix

## Root Cause Analysis

The settings button flashing is caused by **RAPID RECONNECTION ATTEMPTS** when the desktop server is unreachable.

### The Problem Chain

1. **Desktop server not running** (or wrong IP address: `192.168.2.189:8080`)
2. iPad tries to connect → **fails with NSURLErrorDomain Code=-1004**
3. Connection failure triggers `handleDisconnection()`
4. Auto-reconnect timer starts (2s, 4s, 6s, 8s, 10s delay)
5. **Network monitor** detects WiFi is still connected
6. Network monitor triggers `attemptAutoConnect()` again
7. **Infinite loop** - reconnection resets, tries again infinitely
8. Each attempt updates `@Published var connectionStatus`
9. **Every status update rebuilds ContentView**
10. Settings button is in toolbar → **re-renders constantly** → **FLASHING**

### Evidence from Xcode Log

```
Connection 57...88: failed to connect 1:61, reason -1
WebSocket receive error: ...Code=-1004 "Could not connect to the server"
```

**88+ connection attempts** in rapid succession, way beyond the 5-attempt limit.

## The Fix

Updated `ConnectionManager.swift` to prevent rapid reconnection spam:

### Changes Made

**1. Added connection state tracking:**
```swift
private var isConnecting = false
private var lastConnectionAttempt: Date?
private let minRetryInterval: TimeInterval = 5.0
```

**2. Updated `attemptAutoConnect()` with rate limiting:**
```swift
func attemptAutoConnect() {
    guard !serverAddress.isEmpty else { return }
    guard !isConnecting else { return }  // Don't attempt if already connecting
    
    // Enforce minimum 5-second interval between attempts
    if let lastAttempt = lastConnectionAttempt,
       Date().timeIntervalSince(lastAttempt) < minRetryInterval {
        return
    }
    
    // Stop after max attempts reached
    if reconnectAttempts >= maxReconnectAttempts {
        return
    }
    
    connect()
}
```

**3. Updated `connect()` to set connecting flag:**
```swift
func connect() {
    guard !isConnecting else { return }
    
    isConnecting = true
    lastConnectionAttempt = Date()
    // ... rest of connection logic
}
```

**4. Updated `handleDisconnection()` to stop redundant UI updates:**
```swift
private func handleDisconnection() {
    isConnecting = false
    isConnected = false
    // ...
    
    guard reconnectAttempts < maxReconnectAttempts else {
        if case .error = connectionStatus {
            // Already in error state, don't update again (prevents flashing)
        } else {
            connectionStatus = .error("Cannot connect to server")
        }
        return
    }
    // ...
}
```

**5. Updated `disconnect()` to reset connecting flag:**
```swift
func disconnect() {
    isConnecting = false
    // ... rest of cleanup
}
```

## Why This Stops the Flashing

✅ **Rate limiting** - Max 1 attempt per 5 seconds (was unlimited)  
✅ **Connection state guard** - Won't start new attempt if already connecting  
✅ **Attempt limit enforcement** - Stops after 5 failures (was bypassed by network monitor)  
✅ **No redundant UI updates** - Only updates status when actually changing states  
✅ **Settings button stable** - No more rapid view rebuilds

## Rebuild iPad App

In Xcode:
1. Open `ios-apps/FoodieKitchen.xcodeproj`
2. Clean Build Folder (Shift+Cmd+K)
3. Build (Cmd+B)
4. Run on iPad (Cmd+R)

## Expected Behavior After Fix

### When Desktop Server is NOT Running:

1. iPad attempts to connect
2. Fails after 2-second timeout
3. Shows "Disconnected" or "Cannot connect to server"
4. Tries 5 times with increasing delays (2s, 4s, 6s, 8s, 10s)
5. **Stops attempting** - shows error message
6. **Settings button does NOT flash** - stable UI

### When Desktop Server IS Running:

1. iPad connects successfully
2. Shows "Connected" status
3. Settings button stable
4. No flashing

## To Actually Connect

The iPad is trying to reach `192.168.2.189:8080`. You need to:

1. **Start desktop app** on the Mac with that IP address
2. **Or** update iPad settings with correct server IP
3. Both devices must be on same WiFi network

Check desktop app IP in Console → should show:
```
📱 Companion server started on port 8080
📱 Connect iOS devices to:
   ws://192.168.X.X:8080
```

Use that IP in iPad settings.

---

**Summary:** The flashing was caused by infinite reconnection loop triggered by network monitoring. The fix adds rate limiting, state guards, and prevents redundant UI updates. The settings button will now remain stable even when disconnected.
