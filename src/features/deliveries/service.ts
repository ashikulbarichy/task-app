import { z } from "zod";

import { api } from "@/api/client";
import {
  DeliverySchema,
  type Delivery,
  type ProofOfDeliveryForm,
  ProofOfDeliveryFormSchema,
  type StatusTransitionPayload,
  StatusTransitionPayloadSchema,
} from "./schemas";

/**
 * ---------------------------------------------------------------------------
 * DELIVERY SERVICE (Plain TypeScript, Zero React imports)
 * ---------------------------------------------------------------------------
 */

/**
 * Fetches all assigned deliveries.
 */
export async function getDeliveries(): Promise<Delivery[]> {
  const response = await api.get("/deliveries");
  return z.array(DeliverySchema).parse(response.data);
}

/**
 * Fetches single delivery details by ID.
 */
export async function getDeliveryById(id: string): Promise<Delivery> {
  const response = await api.get(`/deliveries/${id}`);
  return DeliverySchema.parse(response.data);
}

/**
 * Updates a delivery status with strict Zod transition verification.
 * Rejects illegal transitions (e.g. pending -> completed) before calling the network.
 * Supports optional `simulateFailure` flag to test optimistic update rollbacks.
 */
export async function updateDeliveryStatus(
  payload: StatusTransitionPayload & { simulateFailure?: boolean },
): Promise<Delivery> {
  // 1. Enforce strict transition rule in plain TypeScript before firing request
  const validated = StatusTransitionPayloadSchema.parse(payload);

  // 2. Perform HTTP PATCH with optional error-trigger header
  const headers = payload.simulateFailure ? { "x-mock-error": "500" } : undefined;

  const response = await api.patch(
    `/deliveries/${validated.id}/status`,
    { status: validated.nextStatus },
    { headers },
  );

  // 3. Ensure server response conforms to single source of truth schema
  return DeliverySchema.parse(response.data);
}

/**
 * Submits Proof of Delivery (POD) and transitions order to terminal "completed" state.
 */
export async function completeDelivery(params: {
  id: string;
  proof: ProofOfDeliveryForm;
  simulateFailure?: boolean;
}): Promise<Delivery> {
  const validatedProof = ProofOfDeliveryFormSchema.parse(params.proof);

  const headers = params.simulateFailure ? { "x-mock-error": "500" } : undefined;

  const response = await api.post(
    `/deliveries/${params.id}/complete`,
    validatedProof,
    { headers },
  );

  return DeliverySchema.parse(response.data);
}
