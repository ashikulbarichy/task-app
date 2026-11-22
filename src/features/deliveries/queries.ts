import { useQuery } from "@tanstack/react-query";

import { getDeliveries, getDeliveryById } from "./service";

/**
 * Key factory for deliveries feature.
 * Canonical key structure: no inline string arrays across the app.
 */
export const deliveryKeys = {
  all: ["deliveries"] as const,
  detail: (id: string) => ["deliveries", id] as const,
};

/**
 * Fetches all active deliveries.
 * Stale time set deliberately to 30 seconds per architecture brief.
 */
export function useDeliveries() {
  return useQuery({
    queryKey: deliveryKeys.all,
    queryFn: getDeliveries,
    staleTime: 30_000,
  });
}

/**
 * Fetches a single delivery by ID.
 */
export function useDelivery(id: string) {
  return useQuery({
    queryKey: deliveryKeys.detail(id),
    queryFn: () => getDeliveryById(id),
    staleTime: 30_000,
    enabled: Boolean(id),
  });
}
