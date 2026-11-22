import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";

import { env } from "@/lib/env";
import { type LocationPoint, LocationPointSchema } from "./schemas";
import { getLatestDeliveryLocation } from "./service";

/**
 * Key factory for live delivery tracking queries.
 */
export const trackingKeys = {
  all: ["tracking"] as const,
  live: (deliveryId: string) => ["tracking", deliveryId] as const,
};

/**
 * Strategy 1: Polling with refetchInterval as baseline.
 * Polls the backend every 4000ms.
 *
 * STRICT REACT QUERY RULE: Never mix refetchInterval with WebSocket pushes on the same query.
 */
export function useCustomerLiveTrackingPolling(deliveryId: string) {
  return useQuery({
    queryKey: trackingKeys.live(deliveryId),
    queryFn: () => getLatestDeliveryLocation(deliveryId),
    refetchInterval: 4000,
    refetchIntervalInBackground: false,
    staleTime: 2000,
    enabled: Boolean(deliveryId),
  });
}

/**
 * Strategy 2: WebSocket push directly into cache.
 * Sets staleTime to Infinity (strictly zero background polling).
 * Incoming WebSocket location payloads are validated against LocationPointSchema
 * and pushed into the cache via queryClient.setQueryData.
 *
 * STRICT REACT QUERY RULE: Never mix refetchInterval with WebSocket pushes on the same query.
 */
export function useCustomerLiveTrackingWebSocket(
  deliveryId: string,
  options?: { wsUrl?: string; enabled?: boolean },
) {
  const queryClient = useQueryClient();
  const isEnabled = options?.enabled ?? true;
  const socketRef = useRef<WebSocket | null>(null);

  // Baseline cache query: staleTime: Infinity guarantees zero polling overhead
  const query = useQuery({
    queryKey: trackingKeys.live(deliveryId),
    queryFn: () => getLatestDeliveryLocation(deliveryId),
    staleTime: Infinity,
    enabled: Boolean(deliveryId) && isEnabled,
  });

  useEffect(() => {
    if (!deliveryId || !isEnabled) {
      return;
    }

    // Convert API HTTP URL to WS URL (e.g. http://192.168.0.167:3000/api -> ws://192.168.0.167:3000/ws/tracking/del-101)
    const baseWsUrl =
      options?.wsUrl ||
      env.EXPO_PUBLIC_API_URL.replace(/^http:\/\//, "ws://")
        .replace(/^https:\/\//, "wss://")
        .replace(/\/api$/, "");
    const wsUrl = `${baseWsUrl}/ws/tracking/${deliveryId}`;

    let isSubscribed = true;

    try {
      const socket = new WebSocket(wsUrl);
      socketRef.current = socket;

      socket.onmessage = (event) => {
        if (!isSubscribed) return;

        try {
          const raw = typeof event.data === "string" ? JSON.parse(event.data) : event.data;
          const parsed = LocationPointSchema.safeParse(raw);

          if (parsed.success) {
            // Push directly into React Query cache
            queryClient.setQueryData<LocationPoint>(
              trackingKeys.live(deliveryId),
              parsed.data,
            );
          } else {
            console.warn("[TrackingWS] Ignored malformed location payload:", parsed.error);
          }
        } catch (err) {
          console.warn("[TrackingWS] JSON parse error on message:", err);
        }
      };

      socket.onerror = (e) => {
        console.warn("[TrackingWS] WebSocket connection event:", e);
      };
    } catch (err) {
      console.warn("[TrackingWS] Failed to connect WebSocket:", err);
    }

    return () => {
      isSubscribed = false;
      if (socketRef.current) {
        socketRef.current.close();
        socketRef.current = null;
      }
    };
  }, [deliveryId, isEnabled, options?.wsUrl, queryClient]);

  return query;
}
