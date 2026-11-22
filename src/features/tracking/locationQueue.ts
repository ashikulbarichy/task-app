import AsyncStorage from "@react-native-async-storage/async-storage";
import NetInfo from "@react-native-community/netinfo";

import type { LocationPoint } from "./schemas";
import { sendLocationBatch } from "./service";

const QUEUE_STORAGE_KEY = "@dnp_tracking_offline_queue";
const ACTIVE_DELIVERY_KEY = "@dnp_tracking_active_delivery_id";

/**
 * Flush threshold: When the queue reaches this many points, trigger an automatic flush.
 */
export const BATCH_FLUSH_THRESHOLD = 5;

/**
 * Hard limit on queued points to protect storage if the device stays offline for hours.
 */
export const MAX_QUEUE_CAPACITY = 500;

// Mutex flag preventing concurrent flush attempts
let isFlushing = false;
let isOnlineListenerAttached = false;

/**
 * Attaches NetInfo listener so that whenever connectivity is restored (e.g. Airplane Mode turned OFF),
 * any accumulated offline location points are automatically flushed in a throttled HTTP batch.
 */
export function setupLocationQueueNetworkListener(): () => void {
  if (isOnlineListenerAttached) {
    return () => {};
  }
  isOnlineListenerAttached = true;

  let wasOffline = false;

  const unsubscribe = NetInfo.addEventListener((state) => {
    const isOnline = Boolean(state.isConnected && state.isInternetReachable !== false);

    if (!isOnline) {
      wasOffline = true;
    } else if (wasOffline) {
      wasOffline = false;
      console.log("[LocationQueue] Network connectivity restored. Draining offline location queue…");
      void flushQueue();
    }
  });

  return () => {
    isOnlineListenerAttached = false;
    unsubscribe();
  };
}

/**
 * Appends newly validated location points to persistent offline storage.
 * If the queue reaches `BATCH_FLUSH_THRESHOLD`, an automatic flush is triggered.
 */
export async function enqueuePoints(points: LocationPoint[]): Promise<number> {
  if (points.length === 0) {
    return getQueueLength();
  }

  try {
    const raw = await AsyncStorage.getItem(QUEUE_STORAGE_KEY);
    const existing: LocationPoint[] = raw ? JSON.parse(raw) : [];

    // Append and enforce capacity cap (dropping oldest points first if full)
    const combined = [...existing, ...points];
    const trimmed =
      combined.length > MAX_QUEUE_CAPACITY
        ? combined.slice(combined.length - MAX_QUEUE_CAPACITY)
        : combined;

    await AsyncStorage.setItem(QUEUE_STORAGE_KEY, JSON.stringify(trimmed));

    // Auto-flush if threshold is reached
    if (trimmed.length >= BATCH_FLUSH_THRESHOLD) {
      void flushQueue();
    }

    return trimmed.length;
  } catch (error) {
    console.error("[LocationQueue] Failed to enqueue location points:", error);
    return 0;
  }
}

/**
 * Reads all currently queued points from storage.
 */
export async function getQueuedPoints(): Promise<LocationPoint[]> {
  try {
    const raw = await AsyncStorage.getItem(QUEUE_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as LocationPoint[]) : [];
  } catch (error) {
    console.error("[LocationQueue] Failed to read queue:", error);
    return [];
  }
}

/**
 * Returns the current number of queued points awaiting transmission.
 */
export async function getQueueLength(): Promise<number> {
  const points = await getQueuedPoints();
  return points.length;
}

/**
 * Flushes the queue by transmitting all accumulated points to the backend.
 * Uses an execution lock to prevent duplicate concurrent network requests.
 * Points remain safely persisted until the backend acknowledges receipt.
 */
export async function flushQueue(): Promise<{ sent: number; remaining: number }> {
  if (isFlushing) {
    const len = await getQueueLength();
    return { sent: 0, remaining: len };
  }

  isFlushing = true;
  try {
    const raw = await AsyncStorage.getItem(QUEUE_STORAGE_KEY);
    if (!raw) {
      return { sent: 0, remaining: 0 };
    }

    const points: LocationPoint[] = JSON.parse(raw);
    if (points.length === 0) {
      return { sent: 0, remaining: 0 };
    }

    // Attempt transmission via plain TS service
    const response = await sendLocationBatch(points);

    if (response.success) {
      // Clean up transmitted points
      await AsyncStorage.removeItem(QUEUE_STORAGE_KEY);
      return { sent: points.length, remaining: 0 };
    }

    return { sent: 0, remaining: points.length };
  } catch (error) {
    // Keep items in queue when network request fails (e.g. offline, timeout)
    const len = await getQueueLength();
    console.warn(`[LocationQueue] Sync failed (retained ${len} points for retry):`, error);
    return { sent: 0, remaining: len };
  } finally {
    isFlushing = false;
  }
}

/**
 * Clears the queue unconditionally (e.g., on delivery cancellation or driver sign-out).
 */
export async function clearQueue(): Promise<void> {
  try {
    await AsyncStorage.removeItem(QUEUE_STORAGE_KEY);
  } catch (error) {
    console.error("[LocationQueue] Failed to clear queue:", error);
  }
}

/**
 * Sets the delivery ID currently in progress.
 * Background tasks read this directly from storage to tag location points without React state.
 */
export async function setActiveDeliveryId(deliveryId: string | null): Promise<void> {
  try {
    if (deliveryId) {
      await AsyncStorage.setItem(ACTIVE_DELIVERY_KEY, deliveryId);
    } else {
      await AsyncStorage.removeItem(ACTIVE_DELIVERY_KEY);
    }
  } catch (error) {
    console.error("[LocationQueue] Failed to set active delivery ID:", error);
  }
}

/**
 * Gets the active delivery ID for background tagging.
 */
export async function getActiveDeliveryId(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(ACTIVE_DELIVERY_KEY);
  } catch {
    return null;
  }
}
