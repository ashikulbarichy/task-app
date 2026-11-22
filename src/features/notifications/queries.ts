import messaging from "@react-native-firebase/messaging";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect } from "react";

import type { NotificationSettings } from "./schemas";
import {
  buildFcmTokenPayload,
  createAndroidNotificationChannels,
  getFcmToken,
  getNotificationSettings,
  requestNotificationPermissions,
  saveFcmToken,
  updateNotificationSettings,
} from "./service";

/**
 * Query key factory for the notifications feature.
 * No inline string arrays allowed anywhere in components or hooks.
 */
export const notificationKeys = {
  all: ["notifications"] as const,
  settings: () => [...notificationKeys.all, "settings"] as const,
  token: () => [...notificationKeys.all, "token"] as const,
};

/**
 * Loads user notification preferences.
 * Static/low-churn configuration uses a deliberate 10-minute staleTime.
 */
export function useNotificationSettings() {
  return useQuery({
    queryKey: notificationKeys.settings(),
    queryFn: getNotificationSettings,
    staleTime: 10 * 60 * 1_000,
  });
}

/**
 * Persists updated notification preferences to the backend and invalidates
 * the settings query so all subscribers receive fresh server truth.
 */
export function useUpdateNotificationSettings() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (settings: NotificationSettings) =>
      updateNotificationSettings(settings),
    onSuccess: (updatedSettings) => {
      queryClient.setQueryData(notificationKeys.settings(), updatedSettings);
      void queryClient.invalidateQueries({
        queryKey: notificationKeys.settings(),
      });
    },
  });
}

/**
 * Sends the device FCM token to the backend via the service layer.
 */
export function useSaveFcmToken() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: saveFcmToken,
    meta: {
      // Background token sync should not spam error toasts if the user is offline;
      // global 401 handling still runs cleanly.
      suppressErrorToast: true,
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: notificationKeys.token(),
      });
    },
  });
}

/**
 * Orchestrates the full FCM token lifecycle on mount:
 * 1. Creates Android high-importance notification channels.
 * 2. Requests Android 13+ / iOS APNs permissions.
 * 3. Fetches the current FCM token and saves it via React Query mutation.
 * 4. Subscribes to Firebase `onTokenRefresh` so rotated tokens sync automatically.
 */
export function useFcmTokenSync(enabled = true) {
  const { mutate: persistToken, isPending: isSyncing } = useSaveFcmToken();

  const syncToken = useCallback(async () => {
    await createAndroidNotificationChannels();

    const granted = await requestNotificationPermissions();
    if (!granted) {
      return;
    }

    const token = await getFcmToken();
    if (token) {
      persistToken(buildFcmTokenPayload(token));
    }
  }, [persistToken]);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    void syncToken();

    // Listen for background/runtime token rotations by FCM
    const unsubscribeRefresh = messaging().onTokenRefresh((newToken) => {
      if (newToken) {
        persistToken(buildFcmTokenPayload(newToken));
      }
    });

    return () => {
      unsubscribeRefresh();
    };
  }, [enabled, syncToken, persistToken]);

  return {
    syncToken,
    isSyncing,
  };
}
