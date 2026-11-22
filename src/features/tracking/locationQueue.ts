import AsyncStorage from "@react-native-async-storage/async-storage";
import NetInfo from "@react-native-community/netinfo";

import type { LocationPoint } from "./schemas";
import { sendLocationBatch } from "./service";

const QUEUE_STORAGE_KEY = "@dnp_tracking_offline_queue";
const ACTIVE_DELIVERY_KEY = "@dnp_tracking_active_delivery_id";

export const BATCH_FLUSH_THRESHOLD = 5;
export const MAX_QUEUE_CAPACITY = 500;

let isFlushing = false;
let isOnlineListenerAttached = false;

// Setting up location queue network listener
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

// Enqueueing location points
export async function enqueuePoints(points: LocationPoint[]): Promise<number> {
  if (points.length === 0) {
    return getQueueLength();
  }

  try {
    const raw = await AsyncStorage.getItem(QUEUE_STORAGE_KEY);
    const existing: LocationPoint[] = raw ? JSON.parse(raw) : [];

    const combined = [...existing, ...points];
    const trimmed =
      combined.length > MAX_QUEUE_CAPACITY
        ? combined.slice(combined.length - MAX_QUEUE_CAPACITY)
        : combined;

    await AsyncStorage.setItem(QUEUE_STORAGE_KEY, JSON.stringify(trimmed));

    if (trimmed.length >= BATCH_FLUSH_THRESHOLD) {
      void flushQueue();
    }

    return trimmed.length;
  } catch (error) {
    console.error("[LocationQueue] Failed to enqueue location points:", error);
    return 0;
  }
}

// Fetching queued location points
export async function getQueuedPoints(): Promise<LocationPoint[]> {
  try {
    const raw = await AsyncStorage.getItem(QUEUE_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as LocationPoint[]) : [];
  } catch (error) {
    console.error("[LocationQueue] Failed to read queue:", error);
    return [];
  }
}

// Fetching queue length
export async function getQueueLength(): Promise<number> {
  const points = await getQueuedPoints();
  return points.length;
}

// Flushing location queue
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

    const response = await sendLocationBatch(points);

    if (response.success) {
      await AsyncStorage.removeItem(QUEUE_STORAGE_KEY);
      return { sent: points.length, remaining: 0 };
    }

    return { sent: 0, remaining: points.length };
  } catch (error) {
    const len = await getQueueLength();
    console.warn(`[LocationQueue] Sync failed (retained ${len} points for retry):`, error);
    return { sent: 0, remaining: len };
  } finally {
    isFlushing = false;
  }
}

// Clearing location queue
export async function clearQueue(): Promise<void> {
  try {
    await AsyncStorage.removeItem(QUEUE_STORAGE_KEY);
  } catch (error) {
    console.error("[LocationQueue] Failed to clear queue:", error);
  }
}

// Setting active delivery ID
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

// Getting active delivery ID
export async function getActiveDeliveryId(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(ACTIVE_DELIVERY_KEY);
  } catch {
    return null;
  }
}
