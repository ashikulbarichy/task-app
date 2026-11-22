import { api } from "@/api/client";
import {
  type LocationBatchResponse,
  LocationBatchResponseSchema,
  LocationBatchSchema,
  type LocationPoint,
  LocationPointSchema,
} from "./schemas";

// Sending location batch
export async function sendLocationBatch(
  points: LocationPoint[],
  deviceId?: string,
): Promise<LocationBatchResponse> {
  if (points.length === 0) {
    return { success: true, processed: 0 };
  }

  const payload = LocationBatchSchema.parse({
    locations: points,
    deviceId,
    sentAt: Date.now(),
  });

  const response = await api.post("/tracking/batch", payload);

  return LocationBatchResponseSchema.parse(response.data);
}

// Fetching latest delivery location
export async function getLatestDeliveryLocation(
  deliveryId: string,
): Promise<LocationPoint | null> {
  const response = await api.get(`/tracking/${deliveryId}/latest`);
  if (!response.data) {
    return null;
  }
  return LocationPointSchema.parse(response.data);
}
