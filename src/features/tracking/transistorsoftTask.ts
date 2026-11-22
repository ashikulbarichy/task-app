import BackgroundGeolocation, {
  type Location,
  type LocationError,
} from "react-native-background-geolocation";

import { env } from "@/lib/env";
import { safeParseLocationPoint } from "./schemas";

export const BG_GEO_TASK_NAME = "dnp-tsoft-background-task";
const MAX_ACCEPTABLE_ACCURACY_METERS = 50;

// Initializing background geolocation
export async function initBackgroundGeolocation(options?: {
  deliveryId?: string;
}): Promise<void> {
  const state = await BackgroundGeolocation.ready({
    url: `${env.EXPO_PUBLIC_API_URL}/tracking/batch`,
    autoSync: true,
    batchSync: true,
    maxBatchSize: 50,
    autoSyncThreshold: 5,
    maxRecordsToPersist: 500,
    desiredAccuracy: BackgroundGeolocation.DESIRED_ACCURACY_HIGH,
    distanceFilter: 15,
    locationTimeout: 60,
    locationUpdateInterval: 10000,
    fastestLocationUpdateInterval: 5000,
    isMoving: false,
    stationaryRadius: 25,
    foregroundService: true,
    notification: {
      title: "DNP Delivery Active",
      text: "Broadcasting live delivery location to customer.",
      color: "#2563EB",
      channelName: "delivery-updates",
    },
    enableHeadless: true,
    startOnBoot: true,
    showsBackgroundLocationIndicator: true,
    activityType: BackgroundGeolocation.ACTIVITY_TYPE_AUTOMOTIVE_NAVIGATION,
    stopOnTerminate: false,
    debug: false,
    extras: {
      deliveryId: options?.deliveryId ?? null,
    },
  });

  console.log(
    `[TransistorTask] BackgroundGeolocation ready. enabled=${state.enabled}, isMoving=${state.isMoving}`,
  );
}

// Subscribing to location updates
export function subscribeToLocations(
  onValidLocation: (point: ReturnType<typeof safeParseLocationPoint>) => void,
  onError?: (err: LocationError) => void,
): () => void {
  const locationSub = BackgroundGeolocation.onLocation((location: Location) => {
    const raw = {
      latitude: location.coords.latitude,
      longitude: location.coords.longitude,
      accuracy: location.coords.accuracy,
      speed: location.coords.speed,
      heading: location.coords.heading,
      timestamp: new Date(location.timestamp).getTime(),
      deliveryId: (location.extras?.deliveryId as string | null | undefined) ?? null,
    };

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

  return () => {
    locationSub.remove();
  };
}

// Starting transistor tracking
export async function startTransistorTracking(deliveryId?: string): Promise<boolean> {
  try {
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

// Stopping transistor tracking
export async function stopTransistorTracking(): Promise<void> {
  try {
    await BackgroundGeolocation.sync();
    await BackgroundGeolocation.stop();
    console.log("[TransistorTask] Tracking stopped and queue flushed.");
  } catch (err) {
    console.error("[TransistorTask] Failed to stop cleanly:", err);
    try {
      await BackgroundGeolocation.stop();
    } catch {}
  }
}

// Checking transistor tracking status
export async function isTransistorTrackingActive(): Promise<boolean> {
  const state = await BackgroundGeolocation.getState();
  return state.enabled;
}

// Getting transistor queue count
export async function getTransistorQueueCount(): Promise<number> {
  const count = await BackgroundGeolocation.getCount();
  return count;
}

// Manually syncing transistor queue
export async function manualSync(): Promise<void> {
  try {
    await BackgroundGeolocation.sync();
  } catch (err) {
    console.warn("[TransistorTask] Manual sync failed:", err);
  }
}
