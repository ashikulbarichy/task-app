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

// Fetching all deliveries
export async function getDeliveries(): Promise<Delivery[]> {
  const response = await api.get("/deliveries");
  return z.array(DeliverySchema).parse(response.data);
}

// Fetching delivery by ID
export async function getDeliveryById(id: string): Promise<Delivery> {
  const response = await api.get(`/deliveries/${id}`);
  return DeliverySchema.parse(response.data);
}

// Marking delivery status
export async function updateDeliveryStatus(
  payload: StatusTransitionPayload & { simulateFailure?: boolean },
): Promise<Delivery> {
  const validated = StatusTransitionPayloadSchema.parse(payload);

  const headers = payload.simulateFailure ? { "x-mock-error": "500" } : undefined;

  const response = await api.patch(
    `/deliveries/${validated.id}/status`,
    { status: validated.nextStatus },
    { headers },
  );

  return DeliverySchema.parse(response.data);
}

// Completing delivery
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
