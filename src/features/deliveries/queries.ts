import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { stopBackgroundTracking } from "@/features/tracking/backgroundTask";
import type { Delivery, ProofOfDeliveryForm, StatusTransitionPayload } from "./schemas";
import {
  completeDelivery,
  getDeliveries,
  getDeliveryById,
  updateDeliveryStatus,
} from "./service";

export const deliveryKeys = {
  all: ["deliveries"] as const,
  detail: (id: string) => ["deliveries", id] as const,
};

// Fetching deliveries query
export function useDeliveries() {
  return useQuery({
    queryKey: deliveryKeys.all,
    queryFn: getDeliveries,
    staleTime: 30_000,
  });
}

// Fetching delivery detail query
export function useDeliveryDetail(id: string) {
  return useQuery({
    queryKey: deliveryKeys.detail(id),
    queryFn: () => getDeliveryById(id),
    staleTime: 30_000,
    enabled: Boolean(id),
  });
}

// Updating delivery status mutation
export function useUpdateDeliveryStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (
      params: StatusTransitionPayload & { simulateFailure?: boolean },
    ) => updateDeliveryStatus(params),

    onMutate: async (newStatusPayload) => {
      const detailKey = deliveryKeys.detail(newStatusPayload.id);

      await queryClient.cancelQueries({ queryKey: deliveryKeys.all });
      await queryClient.cancelQueries({ queryKey: detailKey });

      const previousAll = queryClient.getQueryData<Delivery[]>(deliveryKeys.all);
      const previousDetail = queryClient.getQueryData<Delivery>(detailKey);

      const timestamp = new Date().toLocaleTimeString();

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

      if (previousDetail) {
        queryClient.setQueryData<Delivery>(detailKey, {
          ...previousDetail,
          status: newStatusPayload.nextStatus,
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

    onSuccess: (_data, vars) => {
      void queryClient.invalidateQueries({ queryKey: deliveryKeys.all });
      void queryClient.invalidateQueries({ queryKey: deliveryKeys.detail(vars.id) });
    },

    onSettled: (_data, _err, vars) => {
      void queryClient.invalidateQueries({ queryKey: deliveryKeys.all });
      void queryClient.invalidateQueries({ queryKey: deliveryKeys.detail(vars.id) });
    },
  });
}

// Completing delivery mutation
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
      try {
        await stopBackgroundTracking();
      } catch (err) {
        console.warn("[useCompleteDelivery] Error stopping background tracking:", err);
      }

      void queryClient.invalidateQueries({ queryKey: deliveryKeys.all });
      void queryClient.invalidateQueries({ queryKey: deliveryKeys.detail(vars.id) });
    },

    onSettled: (_data, _err, vars) => {
      void queryClient.invalidateQueries({ queryKey: deliveryKeys.all });
      void queryClient.invalidateQueries({ queryKey: deliveryKeys.detail(vars.id) });
    },
  });
}
