# Background Location Library Evaluation

**Project**: DNP Delivery App — Feature 2 (Background Tracking)  
**Date**: November 2026  
**Author**: DNP Engineering  
**Decision scope**: Choosing the background location strategy for the driver tracking feature.

---

## 1. Libraries Under Evaluation

| | **Option A** | **Option B** |
|---|---|---|
| **Library** | `expo-location` + `expo-task-manager` | `react-native-background-geolocation` (Transistorsoft) |
| **Origin** | Expo open-source | Transistorsoft commercial (paid license) |
| **Implementation file** | `src/features/tracking/backgroundTask.ts` | `src/features/tracking/transistorsoftTask.ts` |
| **Offline queue** | `src/features/tracking/locationQueue.ts` (custom AsyncStorage) | Built-in SQLite (automatic) |

---

## 2. `app.json` Config Plugin Setup

### Option A — `expo-location` (Already configured)

```json
"plugins": [
  [
    "expo-location",
    {
      "locationAlwaysAndWhenInUseUsageDescription": "DNP Delivery needs background location access...",
      "locationWhenInUseUsageDescription": "DNP Delivery needs your location...",
      "isIosBackgroundLocationEnabled": true,
      "isAndroidBackgroundLocationEnabled": true,
      "isAndroidForegroundServiceEnabled": true
    }
  ]
]
```

**What the plugin injects automatically:**
- Android: `ACCESS_BACKGROUND_LOCATION`, `FOREGROUND_SERVICE`, `FOREGROUND_SERVICE_LOCATION` permissions.
- iOS: `NSLocationAlwaysAndWhenInUseUsageDescription`, `UIBackgroundModes: ["location"]`.
- Zero additional Gradle or Maven configuration required.

---

### Option B — `react-native-background-geolocation`

This library requires significantly more native plumbing across **four** separate config areas:

#### 2.1 Maven Repository (Android only)
The library ships private compiled AAR files via a password-protected Maven repository. This must be added to `android/build.gradle` via a config plugin or `expo-build-properties`. Transistorsoft provides credentials tied to your license key.

```json
"plugins": [
  [
    "expo-build-properties",
    {
      "android": {
        "extraMavenRepos": [
          {
            "url": "https://s3.amazonaws.com/transistor.maven/releases",
            "credentials": {
              "username": "...",
              "password": "TRANSISTORSOFT_MAVEN_PASSWORD"
            }
          }
        ]
      }
    }
  ]
]
```

> [!CAUTION]
> Maven credentials must come from EAS environment secrets — never hardcode them in `app.json` or Git.

#### 2.2 License Key Placement

The commercial license key is passed at runtime inside `BackgroundGeolocation.ready()`:

```ts
await BackgroundGeolocation.ready({
  // transistorLicenseKey: process.env.EXPO_PUBLIC_TRANSISTORSOFT_LICENSE_KEY,
  ...
});
```

Store it as:
- An `EXPO_PUBLIC_TRANSISTORSOFT_LICENSE_KEY` variable in `.env` (local dev).
- An EAS secret for cloud builds.

> [!NOTE]
> Without a valid license key the library works in **evaluation mode**: full functionality but with a warning overlay banner on the map view in production. Development builds show no restriction.

#### 2.3 Android Gradle Properties

Add via `expo-build-properties`:

```json
[
  "expo-build-properties",
  {
    "android": {
      "compileSdkVersion": 35,
      "targetSdkVersion": 35,
      "minSdkVersion": 24
    }
  }
]
```

#### 2.4 iOS Background Modes & Permissions

Already covered by our existing `app.json` `ios.infoPlist` section:

```json
"ios": {
  "infoPlist": {
    "UIBackgroundModes": ["location", "fetch", "remote-notification"],
    "NSLocationAlwaysAndWhenInUseUsageDescription": "...",
    "NSLocationWhenInUseUsageDescription": "..."
  }
}
```

No additional iOS changes are needed beyond the existing configuration.

---

## 3. Technical Comparison

### 3A — Battery Consumption & Motion Detection

| Dimension | expo-location + expo-task-manager | react-native-background-geolocation |
|---|---|---|
| **GPS always-on?** | ✅ Always on while task is registered | ❌ GPS sleeps when stationary is detected |
| **Stationary detection** | ❌ Not built in | ✅ Native accelerometer + geofence trick |
| **How stationary works** | — | Plugin creates a 25 m geofence around the parked driver. GPS turns off. When the device crosses the geofence perimeter, GPS restarts automatically. |
| **Distance filter** | Configurable (`distanceInterval: 15 m`) | Configurable (`distanceFilter: 15 m`) |
| **Polling interval** | `timeInterval: 10000 ms` | `locationUpdateInterval: 10000 ms` |
| **Battery impact (driving)** | Medium — GPS active, 10 s poll | Low — GPS active, 10 s poll + adaptive intervals |
| **Battery impact (stationary)** | Medium — GPS still polls every 10 s | **Very Low** — GPS fully off, only geofence wake |
| **Real-world difference** | A driver waiting 20 min at a red light drains same as driving | A driver parked for 20 min uses ~80% less GPS power |

**Verdict**: Transistorsoft wins significantly on battery for delivery apps where drivers spend substantial time idle (parking, waiting at gates, restaurant pickup).

---

### 3B — OS Kill Resilience (Android Doze / iOS Background Termination)

| Scenario | expo-location + expo-task-manager | react-native-background-geolocation |
|---|---|---|
| **App backgrounded normally** | ✅ Works — foreground service keeps process alive | ✅ Works — same foreground service |
| **Android Doze mode (screen off, idle)** | ⚠️ Unreliable — OS can defer background task scheduling arbitrarily | ✅ Reliable — foreground service with `enableHeadless: true` bypasses Doze restrictions |
| **Android force-stop (swipe from recents)** | ❌ Task is destroyed with process | ✅ `stopOnTerminate: false` — OS restarts headless process to deliver deferred locations |
| **Device reboot** | ❌ Must re-register task on next app open | ✅ `startOnBoot: true` — OS auto-restarts tracking after reboot |
| **iOS background termination** | ⚠️ iOS can terminate the process after ~3 min of background | ✅ Plugin registers a native iOS significant-change API fallback for coarse continued tracking |
| **iOS killed by user** | ❌ Tracking stops | ⚠️ Tracking may stop — iOS does not reliably restart user-killed apps |

> [!IMPORTANT]
> `stopOnTerminate: false` and `startOnBoot: true` are only available via Transistorsoft. They are the single most critical reliability advantages for a production delivery tracking scenario. Our expo-location implementation requires the driver to manually reopen the app after a reboot or force-kill.

---

### 3C — Offline Queue: Custom `locationQueue.ts` vs Built-in SQLite

| Dimension | Custom `locationQueue.ts` | Transistorsoft Built-in SQLite |
|---|---|---|
| **Storage technology** | AsyncStorage (JSON serialized) | Native SQLite database |
| **Persistence across app kill** | ✅ AsyncStorage survives force-kill | ✅ SQLite survives force-kill |
| **Max capacity** | 500 points (configurable `MAX_QUEUE_CAPACITY`) | 500 rows (configurable `maxRecordsToPersist`) |
| **Auto-flush trigger** | 5 points threshold (`BATCH_FLUSH_THRESHOLD`) | 5 rows threshold (`autoSyncThreshold`) |
| **Concurrent flush lock** | Manual `isFlushing` boolean mutex | Native — handled inside the plugin's C++ layer |
| **Retry on failure** | ❌ Single attempt — stays in queue until next flush | ✅ Exponential backoff retry with configurable `maxDaysToPersist` |
| **Network transport** | Axios (our shared `api` client, Zod-validated response) | Plugin's own HTTP adapter (no Zod validation of response) |
| **HTTP payload format** | Custom `LocationBatchSchema` (Zod) | Transistorsoft default schema — backend must accept their format |
| **Zod validation** | ✅ Both outgoing and incoming payload validated | ⚠️ Only outgoing raw fix is validated in our `subscribeToLocations()` listener |
| **Implementation complexity** | ~130 lines of custom TS, owned entirely by us | Zero lines — fully delegated to the native plugin |
| **Debugging visibility** | Console logs, can inspect AsyncStorage easily | Plugin provides `BackgroundGeolocation.getLog()` and a companion web dashboard |

**Key trade-off**: Our `locationQueue.ts` gives us full control over retry logic, Zod validation of server responses, and integration with our shared Axios client. The Transistorsoft queue requires us to trust their HTTP adapter and accept their payload schema — but requires zero implementation effort and handles race conditions at the C++ layer.

---

### 3D — Config Plugin Complexity & Licensing Trade-offs

| Dimension | expo-location + expo-task-manager | react-native-background-geolocation |
|---|---|---|
| **License** | MIT (free, open source) | Commercial (paid per app) |
| **License cost** | \$0 | ~\$499 USD per app (one-time, unlimited updates) |
| **npm install** | `expo install expo-location expo-task-manager` | `npm install react-native-background-geolocation` |
| **Config plugin lines in `app.json`** | ~10 lines | ~25 lines (Maven repo credentials, build properties) |
| **Requires EAS secrets** | ❌ No | ✅ Yes (Maven password + license key) |
| **Config plugin provided by Expo** | ✅ Official Expo package | ⚠️ Third-party plugin (maintained by Transistorsoft) |
| **Maintenance risk** | Low — Expo maintains in lockstep with SDK | Medium — depends on Transistorsoft updating for new Expo/RN versions |
| **Community / issues** | Expo forums + GitHub | Transistorsoft GitHub (responsive, but commercial support) |
| **New Arch (Bridgeless) support** | ✅ Expo SDK 53 ready | ⚠️ Check release notes — New Arch support varies by version |
| **Evaluation mode (no license key)** | N/A | ✅ Fully functional — only shows a banner overlay |

---

## 4. Summary Recommendation

```
┌─────────────────────────────────────────────────────────────────────┐
│                     RECOMMENDATION MATRIX                           │
├─────────────────────────────────┬───────────────────────────────────┤
│ Use expo-location WHEN...       │ Use Transistorsoft WHEN...        │
├─────────────────────────────────┼───────────────────────────────────┤
│ ✅ Budget is constrained        │ ✅ Battery life is critical        │
│ ✅ App is Expo-managed workflow │ ✅ Tracking must survive reboots   │
│ ✅ Drivers always keep app open │ ✅ Drivers regularly park/idle    │
│ ✅ Trainee / learning project   │ ✅ Production commercial deployment│
│ ✅ Short delivery windows       │ ✅ Long-haul / overnight shifts    │
└─────────────────────────────────┴───────────────────────────────────┘
```

### For this trainee project:
**Start with `expo-location`** (already implemented in `backgroundTask.ts`). It demonstrates the full native integration workflow, `TaskManager.defineTask` headless registration, foreground service configuration, and manual offline queue management — all valuable skills.

**Upgrade to Transistorsoft** if / when this project moves toward a production deployment where:
- Drivers use the app for 8+ hour shifts.
- Battery life complaints arise from beta testers.
- Tracking gaps are reported after device Doze or reboots.

The two implementations are architecturally parallel and swappable — `transistorsoftTask.ts` mirrors `backgroundTask.ts`'s public API (`start`, `stop`, `isActive`, queue count), so switching is a one-file change at the call site.

---

## 5. Files Produced

| File | Purpose |
|---|---|
| [`src/features/tracking/backgroundTask.ts`](../src/features/tracking/backgroundTask.ts) | expo-location implementation (Option A) |
| [`src/features/tracking/transistorsoftTask.ts`](../src/features/tracking/transistorsoftTask.ts) | Transistorsoft implementation (Option B) |
| [`src/features/tracking/locationQueue.ts`](../src/features/tracking/locationQueue.ts) | Custom offline queue used by Option A |
| [`src/features/tracking/schemas.ts`](../src/features/tracking/schemas.ts) | Shared Zod schemas used by both options |
