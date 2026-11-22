import { z } from "zod";

export const DeliveryStatusSchema = z.enum([
  "pending",
  "started",
  "arrived",
  "completed",
]);

export type DeliveryStatus = z.infer<typeof DeliveryStatusSchema>;

export const VALID_STATUS_TRANSITIONS: Record<DeliveryStatus, readonly DeliveryStatus[]> = {
  pending: ["started"],
  started: ["arrived"],
  arrived: ["completed"],
  completed: [],
} as const;

// Validating status transition
export function isValidStatusTransition(
  current: DeliveryStatus,
  next: DeliveryStatus,
): boolean {
  const allowed = VALID_STATUS_TRANSITIONS[current];
  return allowed ? allowed.includes(next) : false;
}

export const StatusTransitionPayloadSchema = z
  .object({
    id: z.string().min(1, "Delivery ID is required"),
    currentStatus: DeliveryStatusSchema,
    nextStatus: DeliveryStatusSchema,
  })
  .refine(
    (data) => isValidStatusTransition(data.currentStatus, data.nextStatus),
    (data) => ({
      message: `Invalid status transition from '${data.currentStatus}' to '${data.nextStatus}'. Allowed next status: ${
        VALID_STATUS_TRANSITIONS[data.currentStatus]?.join(", ") || "none (terminal)"
      }`,
      path: ["nextStatus"],
    }),
  );

export type StatusTransitionPayload = z.infer<typeof StatusTransitionPayloadSchema>;

export const ProofOfDeliveryFormSchema = z.object({
  recipientName: z
    .string()
    .trim()
    .min(1, "Recipient name is required")
    .max(100, "Recipient name is too long"),
  notes: z
    .string()
    .trim()
    .max(500, "Notes cannot exceed 500 characters")
    .optional(),
});

export type ProofOfDeliveryForm = z.infer<typeof ProofOfDeliveryFormSchema>;

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
