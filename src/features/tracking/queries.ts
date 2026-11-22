import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";

import { env } from "@/lib/env";
import { type LocationPoint, LocationPointSchema } from "./schemas";
import { getLatestDeliveryLocation } from "./service";

export const trackingKeys = {
  all: ["tracking"] as const,
  live: (deliveryId: string) => ["tracking", deliveryId] as const,
};

// Polling customer live tracking query
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

// Subscribing to customer live tracking websocket
export function useCustomerLiveTrackingWebSocket(
  deliveryId: string,
  options?: { wsUrl?: string; enabled?: boolean },
) {
  const queryClient = useQueryClient();
  const isEnabled = options?.enabled ?? true;
  const socketRef = useRef<WebSocket | null>(null);

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
