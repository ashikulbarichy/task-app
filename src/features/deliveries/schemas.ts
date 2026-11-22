import { z } from "zod";

/**
 * Valid delivery status transitions.
 */
export const DeliveryStatusSchema = z.enum([
  "assigned",
  "in_transit",
  "arrived",
  "completed",
  "cancelled",
]);

export type DeliveryStatus = z.infer<typeof DeliveryStatusSchema>;

/**
 * Core Delivery entity schema.
 * Single source of truth for deliveries across service, queries, and UI.
 */
export const DeliverySchema = z.object({
  id: z.string().min(1),
  orderNumber: z.string().min(1),
  status: DeliveryStatusSchema,
  customerName: z.string().min(1),
  address: z.string().min(1),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  items: z.array(z.string()).default([]),
  recipientName: z.string().optional(),
  notes: z.string().optional(),
  updatedAt: z.string().optional(),
});

export type Delivery = z.infer<typeof DeliverySchema>;
