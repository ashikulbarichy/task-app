import { api } from "@/api/client";
import {
  type LocationBatchResponse,
  LocationBatchResponseSchema,
  LocationBatchSchema,
  type LocationPoint,
} from "./schemas";

/**
 * Plain TypeScript service for dispatching location points to the backend.
 * Zero React dependencies — safe to call from background tasks (expo-task-manager)
 * or the offline queue draining process.
 */
export async function sendLocationBatch(
  points: LocationPoint[],
  deviceId?: string,
): Promise<LocationBatchResponse> {
  if (points.length === 0) {
    return { success: true, processed: 0 };
  }

  // 1. Validate payload against Zod schema before sending over the wire
  const payload = LocationBatchSchema.parse({
    locations: points,
    deviceId,
    sentAt: Date.now(),
  });

  // 2. Transmit batch to backend
  const response = await api.post("/tracking/batch", payload);

  // 3. Defensively validate backend response structure
  return LocationBatchResponseSchema.parse(response.data);
}
