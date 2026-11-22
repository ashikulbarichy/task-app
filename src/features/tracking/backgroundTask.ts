import * as Location from "expo-location";
import * as TaskManager from "expo-task-manager";
import { Alert, Linking, Platform } from "react-native";

import { getDeliveryById } from "@/features/deliveries/service";
import {
  enqueuePoints,
  flushQueue,
  getActiveDeliveryId,
  setActiveDeliveryId,
} from "./locationQueue";
import { safeParseLocationPoint } from "./schemas";

export const BACKGROUND_LOCATION_TASK = "dnp-background-delivery-task";

/**
 * Filter threshold: Discard inaccurate GPS fixes (e.g. cellular tower triangulation / weak GPS).
 */
export const MAX_ACCEPTABLE_ACCURACY_METERS = 50;

/**
 * Top-level TaskManager registration.
 * Runs in a headless JS environment outside the React component tree.
 * MUST NOT use React hooks or rely on React component state.
 */
TaskManager.defineTask(BACKGROUND_LOCATION_TASK, async ({ data, error }) => {
  if (error) {
    console.error("[BackgroundTask] Location update error:", error.message);
    return;
  }

  if (!data) {
    return;
  }

  const { locations } = data as { locations: Location.LocationObject[] };
  if (!Array.isArray(locations) || locations.length === 0) {
    return;
  }

  // 1. Read the active delivery ID directly from persistent storage
  const deliveryId = await getActiveDeliveryId();

  // 2. Filter out noisy fixes (> 50m accuracy) and validate with Zod
  const validPoints = locations
    .filter((loc) => {
      const accuracy = loc.coords.accuracy;
      return accuracy !== null && accuracy <= MAX_ACCEPTABLE_ACCURACY_METERS;
    })
    .map((loc) =>
      safeParseLocationPoint({
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
        accuracy: loc.coords.accuracy,
        speed: loc.coords.speed,
        heading: loc.coords.heading,
        timestamp: loc.timestamp,
        deliveryId,
      }),
    )
    .filter((p): p is NonNullable<typeof p> => p !== null);

  if (validPoints.length > 0) {
    // 3. Enqueue to offline storage (flushes automatically if threshold is reached)
    await enqueuePoints(validPoints);
  }
});

/**
 * Checks current location permissions for foreground and background.
 */
export async function checkLocationPermissions(): Promise<{
  foregroundGranted: boolean;
  backgroundGranted: boolean;
}> {
  const foreground = await Location.getForegroundPermissionsAsync();
  const background = await Location.getBackgroundPermissionsAsync();

  return {
    foregroundGranted: foreground.granted,
    backgroundGranted: background.granted,
  };
}

/**
 * Requests Foreground and Background permissions in sequence.
 * On modern Android (11+) and iOS, Background MUST be requested after Foreground is granted.
 */
export async function requestAllLocationPermissions(): Promise<{
  foregroundGranted: boolean;
  backgroundGranted: boolean;
}> {
  // Step 1: Foreground
  let foreground = await Location.getForegroundPermissionsAsync();
  if (!foreground.granted) {
    foreground = await Location.requestForegroundPermissionsAsync();
  }

  if (!foreground.granted) {
    return { foregroundGranted: false, backgroundGranted: false };
  }

  // Step 2: Background (Requires "Allow all the time" on Android)
  let background = await Location.getBackgroundPermissionsAsync();
  if (!background.granted) {
    background = await Location.requestBackgroundPermissionsAsync();
  }

  return {
    foregroundGranted: true,
    backgroundGranted: background.granted,
  };
}

/**
 * Starts background location tracking with battery-conscious throttling and
 * OS-compliant persistent notifications.
 */
export async function startBackgroundTracking(options?: {
  deliveryId?: string;
}): Promise<{ success: boolean; error?: string }> {
  // 1. Verify permissions
  const { foregroundGranted, backgroundGranted } = await checkLocationPermissions();
  if (!foregroundGranted) {
    return {
      success: false,
      error: "Foreground location permission is required.",
    };
  }

  if (!backgroundGranted) {
    return {
      success: false,
      error: 'Background ("Allow all the time") location permission is required.',
    };
  }

  // 2. Persist active delivery ID if provided
  if (options?.deliveryId) {
    await setActiveDeliveryId(options.deliveryId);
  }

  // 3. Check if already tracking
  const alreadyStarted = await Location.hasStartedLocationUpdatesAsync(
    BACKGROUND_LOCATION_TASK,
  );
  if (alreadyStarted) {
    return { success: true };
  }

  try {
    // 4. Start OS location updates
    await Location.startLocationUpdatesAsync(BACKGROUND_LOCATION_TASK, {
      accuracy: Location.Accuracy.High,
      timeInterval: 10000, // 10 seconds
      distanceInterval: 15, // 15 meters
      deferredUpdatesInterval: 10000,
      deferredUpdatesDistance: 15,
      pausesUpdatesAutomatically: false,
      activityType: Location.ActivityType.AutomotiveNavigation,

      // iOS: Shows persistent blue pill/status bar indicator
      showsBackgroundLocationIndicator: true,

      // Android: Persistent foreground service notification (mandatory for Android 8+)
      foregroundService: {
        notificationTitle: "DNP Delivery Active",
        notificationBody: "Broadcasting real-time delivery location to customer.",
        notificationColor: "#2563EB",
        killServiceOnDestroy: false,
      },
    });

    return { success: true };
  } catch (err) {
    console.error("[BackgroundTask] Failed to start location updates:", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to start location updates",
    };
  }
}

/**
 * Stops background tracking, flushes any remaining offline points,
 * and clears the active delivery tag.
 */
export async function stopBackgroundTracking(): Promise<void> {
  try {
    const isRunning = await Location.hasStartedLocationUpdatesAsync(
      BACKGROUND_LOCATION_TASK,
    );
    if (isRunning) {
      await Location.stopLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
    }

    // Flush any unsent points remaining in queue
    await flushQueue();

    // Clear active delivery ID
    await setActiveDeliveryId(null);
  } catch (err) {
    console.error("[BackgroundTask] Error stopping location updates:", err);
  }
}

/**
 * Checks whether the background tracking task is actively running.
 */
export async function isBackgroundTrackingActive(): Promise<boolean> {
  return Location.hasStartedLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
}

/**
 * Guides the user to system settings if background permission is restricted or denied.
 */
export function openLocationSettingsAlert(message: string): void {
  Alert.alert(
    "Location Permission Required",
    message,
    [
      { text: "Cancel", style: "cancel" },
      {
        text: "Open Settings",
        onPress: () => {
          void Linking.openSettings();
        },
      },
    ],
    { cancelable: true },
  );
}

/**
 * Shows advice for Android battery optimization (Doze mode) to prevent OS killing tracking.
 */
export function promptBatteryOptimizationInfo(): void {
  if (Platform.OS === "android") {
    Alert.alert(
      "Battery Optimization Advice",
      "For uninterrupted background delivery tracking, please ensure DNP Delivery is set to 'Unrestricted' battery usage in your device app settings.",
      [
        { text: "Later", style: "cancel" },
        { text: "Open App Settings", onPress: () => void Linking.openSettings() },
      ],
    );
  }
}

/**
 * Startup Recovery Logic (Stage 5 Hardening):
 * If the app was terminated / killed by the OS during an active delivery ('started' or 'arrived')
 * and subsequently restarted:
 * 1. Checks persistent storage for an active delivery ID.
 * 2. Fetches current delivery state from backend.
 * 3. If delivery is still in 'started' or 'arrived', verifies and resumes background location updates.
 * 4. If delivery was marked 'completed', automatically halts tracking and clears active storage.
 */
export async function checkAndResumeTrackingOnStartup(): Promise<void> {
  try {
    const activeDeliveryId = await getActiveDeliveryId();
    if (!activeDeliveryId) {
      return;
    }

    console.log(`[StartupRecovery] Found saved active delivery: ${activeDeliveryId}. Checking state…`);
    const delivery = await getDeliveryById(activeDeliveryId);

    if (delivery.status === "started" || delivery.status === "arrived") {
      const isRunning = await Location.hasStartedLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
      if (!isRunning) {
        console.log(`[StartupRecovery] Resuming background tracking for order ${activeDeliveryId}…`);
        await startBackgroundTracking({ deliveryId: activeDeliveryId });
      }
    } else {
      console.log(`[StartupRecovery] Order ${activeDeliveryId} is '${delivery.status}'. Halting tracking.`);
      await stopBackgroundTracking();
    }
  } catch (err) {
    console.warn("[StartupRecovery] Unable to verify delivery status on startup:", err);
  }
}
