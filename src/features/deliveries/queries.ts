import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { stopBackgroundTracking } from "@/features/tracking/backgroundTask";
import type { Delivery, ProofOfDeliveryForm, StatusTransitionPayload } from "./schemas";
import {
  completeDelivery,
  getDeliveries,
  getDeliveryById,
  updateDeliveryStatus,
} from "./service";

/**
 * Key factory for deliveries feature.
 * Canonical key structure: no inline string arrays across the app.
 */
export const deliveryKeys = {
  all: ["deliveries"] as const,
  detail: (id: string) => ["deliveries", id] as const,
};

/**
 * Hook to fetch all active deliveries with 30s stale time.
 */
export function useDeliveries() {
  return useQuery({
    queryKey: deliveryKeys.all,
    queryFn: getDeliveries,
    staleTime: 30_000,
  });
}

/**
 * Hook to fetch a single delivery by ID.
 */
export function useDeliveryDetail(id: string) {
  return useQuery({
    queryKey: deliveryKeys.detail(id),
    queryFn: () => getDeliveryById(id),
    staleTime: 30_000,
    enabled: Boolean(id),
  });
}

/**
 * Mutation for delivery status transitions with FULL optimistic cache updates.
 *
 * 1. onMutate:
 *    - Cancels ongoing queries to prevent race conditions.
 *    - Snapshots previous query cache data for both list and detail.
 *    - Optimistically updates UI state immediately.
 * 2. onError:
 *    - Automatically rolls back cache to snapshot if server fails.
 * 3. onSettled:
 *    - Revalidates cache with ground truth from the server.
 */
export function useUpdateDeliveryStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (
      params: StatusTransitionPayload & { simulateFailure?: boolean },
    ) => updateDeliveryStatus(params),

    onMutate: async (newStatusPayload) => {
      const detailKey = deliveryKeys.detail(newStatusPayload.id);

      // Cancel outgoing refetches so they don't overwrite optimistic update
      await queryClient.cancelQueries({ queryKey: deliveryKeys.all });
      await queryClient.cancelQueries({ queryKey: detailKey });

      // Snapshot previous cache state
      const previousAll = queryClient.getQueryData<Delivery[]>(deliveryKeys.all);
      const previousDetail = queryClient.getQueryData<Delivery>(detailKey);

      const timestamp = new Date().toLocaleTimeString();

      // Optimistically update Deliveries List
      if (previousAll) {
        queryClient.setQueryData<Delivery[]>(
          deliveryKeys.all,
          previousAll.map((item) =>
            item.id === newStatusPayload.id
              ? { ...item, status: newStatusPayload.nextStatus, updatedAt: timestamp }
              : item,
          ),
        );
      }

      // Optimistically update Delivery Detail
      if (previousDetail) {
        queryClient.setQueryData<Delivery>(detailKey, {
          ...previousDetail,
          status: newStatusPayload.nextStatus,
          updatedAt: timestamp,
        });
      }

      // Return context for rollback
      return { previousAll, previousDetail, detailKey };
    },

    onError: (_err, _vars, context) => {
      // Rollback to previous state on failure (e.g. 500 error)
      if (context?.previousAll) {
        queryClient.setQueryData(deliveryKeys.all, context.previousAll);
      }
      if (context?.previousDetail && context?.detailKey) {
        queryClient.setQueryData(context.detailKey, context.previousDetail);
      }
    },

    onSettled: (_data, _err, vars) => {
      // Always re-sync with server state after mutation completes
      void queryClient.invalidateQueries({ queryKey: deliveryKeys.all });
      void queryClient.invalidateQueries({ queryKey: deliveryKeys.detail(vars.id) });
    },
  });
}

/**
 * Mutation to complete a delivery using Proof of Delivery (POD).
 * On successful completion, automatically stops background location tracking
 * to conserve battery and protect driver privacy.
 */
export function useCompleteDelivery() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (params: {
      id: string;
      proof: ProofOfDeliveryForm;
      simulateFailure?: boolean;
    }) => completeDelivery(params),

    onMutate: async ({ id, proof }) => {
      const detailKey = deliveryKeys.detail(id);

      await queryClient.cancelQueries({ queryKey: deliveryKeys.all });
      await queryClient.cancelQueries({ queryKey: detailKey });

      const previousAll = queryClient.getQueryData<Delivery[]>(deliveryKeys.all);
      const previousDetail = queryClient.getQueryData<Delivery>(detailKey);

      const timestamp = new Date().toLocaleTimeString();

      if (previousAll) {
        queryClient.setQueryData<Delivery[]>(
          deliveryKeys.all,
          previousAll.map((item) =>
            item.id === id
              ? {
                  ...item,
                  status: "completed",
                  recipientName: proof.recipientName,
                  notes: proof.notes,
                  updatedAt: timestamp,
                }
              : item,
          ),
        );
      }

      if (previousDetail) {
        queryClient.setQueryData<Delivery>(detailKey, {
          ...previousDetail,
          status: "completed",
          recipientName: proof.recipientName,
          notes: proof.notes,
          updatedAt: timestamp,
        });
      }

      return { previousAll, previousDetail, detailKey };
    },

    onError: (_err, _vars, context) => {
      if (context?.previousAll) {
        queryClient.setQueryData(deliveryKeys.all, context.previousAll);
      }
      if (context?.previousDetail && context?.detailKey) {
        queryClient.setQueryData(context.detailKey, context.previousDetail);
      }
    },

    onSuccess: async (_data, vars) => {
      // Stop background location updates now that the delivery is finalized
      try {
        await stopBackgroundTracking();
      } catch (err) {
        console.warn("[useCompleteDelivery] Error stopping background tracking:", err);
      }

      void queryClient.invalidateQueries({ queryKey: deliveryKeys.all });
      void queryClient.invalidateQueries({ queryKey: deliveryKeys.detail(vars.id) });
    },
  });
}
