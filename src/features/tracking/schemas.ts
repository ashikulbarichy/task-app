import { z } from "zod";

/**
 * Single geographic coordinate point captured from GPS.
 * Stored offline in AsyncStorage when network is unreachable,
 * and flushed to the backend in batches.
 */
export const LocationPointSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  accuracy: z.number().nullable().optional(),
  speed: z.number().nullable().optional(),
  heading: z.number().nullable().optional(),
  timestamp: z.number(), // Epoch milliseconds
  deliveryId: z.string().nullable().optional(),
});

export type LocationPoint = z.infer<typeof LocationPointSchema>;

/**
 * Batch payload sent to POST /api/tracking/batch.
 * Batches location points to reduce radio wakeups and network requests.
 */
export const LocationBatchSchema = z.object({
  locations: z.array(LocationPointSchema).min(1),
  deviceId: z.string().optional(),
  sentAt: z.number().default(() => Date.now()),
});

export type LocationBatch = z.infer<typeof LocationBatchSchema>;

/**
 * Backend response format for location batch ingestion.
 */
export const LocationBatchResponseSchema = z.object({
  success: z.boolean(),
  processed: z.number(),
  message: z.string().optional(),
});

export type LocationBatchResponse = z.infer<typeof LocationBatchResponseSchema>;

/**
 * Defensive parser for raw location objects (e.g. from native GPS callbacks).
 * Drops corrupted fixes before they enter the offline queue.
 */
export function safeParseLocationPoint(data: unknown): LocationPoint | null {
  const result = LocationPointSchema.safeParse(data);
  return result.success ? result.data : null;
}
