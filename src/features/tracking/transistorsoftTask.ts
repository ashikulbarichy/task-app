import BackgroundGeolocation, {
  type Location,
  type LocationError,
} from "react-native-background-geolocation";

import { env } from "@/lib/env";
import { safeParseLocationPoint } from "./schemas";

export const BG_GEO_TASK_NAME = "dnp-tsoft-background-task";

/**
 * Minimum GPS accuracy threshold (metres).
 * Mirrors the same constant in backgroundTask.ts so both paths behave identically.
 */
const MAX_ACCEPTABLE_ACCURACY_METERS = 50;

/**
 * Configure and ready the Transistorsoft BackgroundGeolocation plugin.
 *
 * Call this ONCE at app bootstrap (e.g. inside App.tsx useEffect or index.js).
 * It is safe to call multiple times – the plugin ignores duplicate `.ready()` calls.
 *
 * Key design differences from our expo-location implementation:
 *   - No manual AsyncStorage queue — the plugin has a built-in SQLite store.
 *   - `autoSync: true`  → plugin dispatches pending DB rows automatically whenever
 *     the network comes back (Ionic's HTTP adapter, not Axios).
 *   - `batchSync: true` → rows are grouped into a single POST body matching our
 *     `/api/tracking/batch` endpoint shape exactly.
 *   - `stopOnTerminate: false` + `startOnBoot: true` → survives a force-quit or reboot
 *     without any app-level headless task registration.
 *   - Motion / stationary detection → native accelerometer + geofence trick stops GPS
 *     while the driver is parked, saving battery automatically.
 */
export async function initBackgroundGeolocation(options?: {
  deliveryId?: string;
}): Promise<void> {
  const state = await BackgroundGeolocation.ready({
    // ── Identity ───────────────────────────────────────────────────────────────
    // Transistorsoft commercial licence key (required in production builds).
    // For development evaluation you can omit this — the plugin works unlicensed
    // but logs a warning and shows a banner overlay on the map.
    // License key MUST be stored in .env / EAS secrets — never hardcoded.
    // transistorLicenseKey: process.env.EXPO_PUBLIC_TRANSISTORSOFT_LICENSE_KEY,

    // ── HTTP / SQLite Sync ─────────────────────────────────────────────────────
    // The plugin's internal HTTP client POSTs to this URL automatically.
    // The payload structure matches our mock server's /api/tracking/batch format.
    url: `${env.EXPO_PUBLIC_API_URL}/tracking/batch`,
    autoSync: true,         // Dispatch stored rows whenever connectivity is restored
    batchSync: true,        // Bundle multiple rows into a single POST body
    maxBatchSize: 50,       // Max rows per POST (prevents oversized request bodies)
    autoSyncThreshold: 5,   // Minimum rows before auto-sync fires (mirrors BATCH_FLUSH_THRESHOLD)
    maxRecordsToPersist: 500, // SQLite row cap (mirrors MAX_QUEUE_CAPACITY)

    // ── GPS Accuracy & Filtering ───────────────────────────────────────────────
    desiredAccuracy: BackgroundGeolocation.DESIRED_ACCURACY_HIGH,
    distanceFilter: 15,     // 15 m minimum movement before recording a fix
    locationTimeout: 60,    // Max seconds to wait for a GPS fix

    // ── Throttling ─────────────────────────────────────────────────────────────
    // locationUpdateInterval / fastestLocationUpdateInterval are Android-only;
    // iOS uses significant-location-change as a secondary power-saving mechanism.
    locationUpdateInterval: 10000,         // 10 s between updates
    fastestLocationUpdateInterval: 5000,   // Never faster than 5 s even if OS offers more

    // ── Motion Detection (stationary geofence) ─────────────────────────────────
    // When stationary is detected the plugin enters a 200 m stationary geofence.
    // GPS is killed until the driver crosses the geofence perimeter.
    // This is the single biggest battery win over our custom expo-location approach.
    isMoving: false,
    stationaryRadius: 25,   // m — radius of the stationary watch-geofence

    // ── Android-specific ───────────────────────────────────────────────────────
    foregroundService: true,
    notification: {
      title: "DNP Delivery Active",
      text: "Broadcasting live delivery location to customer.",
      color: "#2563EB",
      channelName: "delivery-updates",
    },
    enableHeadless: true,   // Fire headless task callbacks when app is terminated
    startOnBoot: true,      // Resume tracking after device reboot

    // ── iOS-specific ───────────────────────────────────────────────────────────
    showsBackgroundLocationIndicator: true, // Blue pill in status bar
    activityType: BackgroundGeolocation.ACTIVITY_TYPE_AUTOMOTIVE_NAVIGATION,

    // ── Lifecycle ──────────────────────────────────────────────────────────────
    stopOnTerminate: false,  // Keep tracking after the user swipes the app away
    debug: false,            // Disable sound FX / verbose logging in production

    // ── Custom metadata attached to every transmitted location object ──────────
    // Stored in SQLite and forwarded to the backend inside `location.extras`.
    extras: {
      deliveryId: options?.deliveryId ?? null,
    },
  });

  console.log(
    `[TransistorTask] BackgroundGeolocation ready. enabled=${state.enabled}, isMoving=${state.isMoving}`,
  );
}

/**
 * Subscribe to incoming location events and validate each fix against our Zod schema.
 *
 * Returns an unsubscribe function — call it in your cleanup effect or on delivery completion.
 *
 * NOTE: The plugin's internal HTTP client handles offline queuing automatically.
 * This listener is for in-app UI updates (e.g. animating the driver pin on the map)
 * and cross-validation of raw fixes — not for manual queuing.
 */
export function subscribeToLocations(
  onValidLocation: (point: ReturnType<typeof safeParseLocationPoint>) => void,
  onError?: (err: LocationError) => void,
): () => void {
  // onLocation fires for EVERY accepted fix (foreground + background)
  const locationSub = BackgroundGeolocation.onLocation((location: Location) => {
    const raw = {
      latitude: location.coords.latitude,
      longitude: location.coords.longitude,
      accuracy: location.coords.accuracy,
      speed: location.coords.speed,
      heading: location.coords.heading,
      // Transistorsoft timestamps are ISO-8601 strings — convert to epoch ms
      timestamp: new Date(location.timestamp).getTime(),
      deliveryId: (location.extras?.deliveryId as string | null | undefined) ?? null,
    };

    // Discard noisy fixes (accuracy > 50 m) — same filter as backgroundTask.ts
    if (
      typeof raw.accuracy === "number" &&
      raw.accuracy > MAX_ACCEPTABLE_ACCURACY_METERS
    ) {
      console.warn(
        `[TransistorTask] Dropped noisy fix (accuracy=${raw.accuracy}m > ${MAX_ACCEPTABLE_ACCURACY_METERS}m)`,
      );
      return;
    }

    const validated = safeParseLocationPoint(raw);
    onValidLocation(validated);
  }, onError);

  // Return cleanup function
  return () => {
    locationSub.remove();
  };
}

/**
 * Starts background tracking for the given delivery.
 * Sets the deliveryId in plugin extras so every transmitted fix is tagged.
 */
export async function startTransistorTracking(deliveryId?: string): Promise<boolean> {
  try {
    // Update extras with current deliveryId before starting
    await BackgroundGeolocation.setConfig({
      extras: { deliveryId: deliveryId ?? null },
    });

    const state = await BackgroundGeolocation.start();
    console.log(`[TransistorTask] Tracking started. enabled=${state.enabled}`);
    return state.enabled;
  } catch (err) {
    console.error("[TransistorTask] Failed to start:", err);
    return false;
  }
}

/**
 * Stops background tracking and flushes any remaining SQLite rows to the backend.
 * Uses the plugin's built-in `sync()` to drain the internal DB queue before stopping.
 */
export async function stopTransistorTracking(): Promise<void> {
  try {
    // Force-flush internal SQLite queue before stopping
    await BackgroundGeolocation.sync();
    await BackgroundGeolocation.stop();
    console.log("[TransistorTask] Tracking stopped and queue flushed.");
  } catch (err) {
    console.error("[TransistorTask] Failed to stop cleanly:", err);
    // Attempt a hard stop even if sync fails
    try {
      await BackgroundGeolocation.stop();
    } catch {}
  }
}

/**
 * Checks if the plugin is currently enabled.
 */
export async function isTransistorTrackingActive(): Promise<boolean> {
  const state = await BackgroundGeolocation.getState();
  return state.enabled;
}

/**
 * Returns the number of location rows currently stored in the plugin's SQLite DB.
 * Useful for showing an "X points pending sync" badge in the UI.
 */
export async function getTransistorQueueCount(): Promise<number> {
  const count = await BackgroundGeolocation.getCount();
  return count;
}

/**
 * Manually force-syncs the SQLite queue to the backend regardless of autoSync threshold.
 * Call this when the driver taps "Sync Now" in the UI.
 */
export async function manualSync(): Promise<void> {
  try {
    await BackgroundGeolocation.sync();
  } catch (err) {
    console.warn("[TransistorTask] Manual sync failed:", err);
  }
}
