import { z } from "zod";

export const LocationPointSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  accuracy: z.number().nullable().optional(),
  speed: z.number().nullable().optional(),
  heading: z.number().nullable().optional(),
  timestamp: z.number(),
  deliveryId: z.string().nullable().optional(),
});

export type LocationPoint = z.infer<typeof LocationPointSchema>;

export const LocationBatchSchema = z.object({
  locations: z.array(LocationPointSchema).min(1),
  deviceId: z.string().optional(),
  sentAt: z.number().default(() => Date.now()),
});

export type LocationBatch = z.infer<typeof LocationBatchSchema>;

export const LocationBatchResponseSchema = z.object({
  success: z.boolean(),
  processed: z.number(),
  message: z.string().optional(),
});

export type LocationBatchResponse = z.infer<typeof LocationBatchResponseSchema>;

// Parsing location point safely
export function safeParseLocationPoint(data: unknown): LocationPoint | null {
  const result = LocationPointSchema.safeParse(data);
  return result.success ? result.data : null;
}
