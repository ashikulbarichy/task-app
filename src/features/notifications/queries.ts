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

export const notificationKeys = {
  all: ["notifications"] as const,
  settings: () => [...notificationKeys.all, "settings"] as const,
  token: () => [...notificationKeys.all, "token"] as const,
};

// Fetching notification settings query
export function useNotificationSettings() {
  return useQuery({
    queryKey: notificationKeys.settings(),
    queryFn: getNotificationSettings,
    staleTime: 10 * 60 * 1_000,
  });
}

// Updating notification settings mutation
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

// Saving FCM token mutation
export function useSaveFcmToken() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: saveFcmToken,
    meta: {
      suppressErrorToast: true,
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: notificationKeys.token(),
      });
    },
  });
}

// Syncing FCM token hook
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
