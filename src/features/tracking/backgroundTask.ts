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
export const MAX_ACCEPTABLE_ACCURACY_METERS = 50;

// Defining background location task
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

  const deliveryId = await getActiveDeliveryId();

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
    await enqueuePoints(validPoints);
  }
});

// Checking location permissions
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

// Requesting all location permissions
export async function requestAllLocationPermissions(): Promise<{
  foregroundGranted: boolean;
  backgroundGranted: boolean;
}> {
  let foreground = await Location.getForegroundPermissionsAsync();
  if (!foreground.granted) {
    foreground = await Location.requestForegroundPermissionsAsync();
  }

  if (!foreground.granted) {
    return { foregroundGranted: false, backgroundGranted: false };
  }

  let background = await Location.getBackgroundPermissionsAsync();
  if (!background.granted) {
    background = await Location.requestBackgroundPermissionsAsync();
  }

  return {
    foregroundGranted: true,
    backgroundGranted: background.granted,
  };
}

// Starting background tracking
export async function startBackgroundTracking(options?: {
  deliveryId?: string;
}): Promise<{ success: boolean; error?: string }> {
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

  if (options?.deliveryId) {
    await setActiveDeliveryId(options.deliveryId);
  }

  const alreadyStarted = await Location.hasStartedLocationUpdatesAsync(
    BACKGROUND_LOCATION_TASK,
  );
  if (alreadyStarted) {
    return { success: true };
  }

  try {
    await Location.startLocationUpdatesAsync(BACKGROUND_LOCATION_TASK, {
      accuracy: Location.Accuracy.High,
      timeInterval: 10000,
      distanceInterval: 15,
      deferredUpdatesInterval: 10000,
      deferredUpdatesDistance: 15,
      pausesUpdatesAutomatically: false,
      activityType: Location.ActivityType.AutomotiveNavigation,
      showsBackgroundLocationIndicator: true,
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

// Stopping background tracking
export async function stopBackgroundTracking(): Promise<void> {
  try {
    const isRunning = await Location.hasStartedLocationUpdatesAsync(
      BACKGROUND_LOCATION_TASK,
    );
    if (isRunning) {
      await Location.stopLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
    }

    await flushQueue();
    await setActiveDeliveryId(null);
  } catch (err) {
    console.error("[BackgroundTask] Error stopping location updates:", err);
  }
}

// Checking background tracking status
export async function isBackgroundTrackingActive(): Promise<boolean> {
  return Location.hasStartedLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
}

// Prompting location settings alert
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

// Prompting battery optimization info
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

// Resuming tracking on startup if active
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
