import { z } from "zod";

import { api } from "@/api/client";
import { DeliverySchema, type Delivery } from "./schemas";

/**
 * ---------------------------------------------------------------------------
 * DELIVERY SERVICE (Plain TypeScript, Zero React imports)
 * ---------------------------------------------------------------------------
 */

export async function getDeliveries(): Promise<Delivery[]> {
  const response = await api.get("/deliveries");
  return z.array(DeliverySchema).parse(response.data);
}

export async function getDeliveryById(id: string): Promise<Delivery> {
  const response = await api.get(`/deliveries/${id}`);
  return DeliverySchema.parse(response.data);
}
