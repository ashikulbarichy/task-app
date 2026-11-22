import messaging, {
  type FirebaseMessagingTypes,
} from "@react-native-firebase/messaging";
import * as Notifications from "expo-notifications";
import { useEffect } from "react";

import { deliveryKeys } from "@/features/deliveries/queries";
import { env } from "@/lib/env";
import { queryClient } from "@/lib/queryClient";
import { navigateToDeliveryDetail } from "./navigation";
import {
  safeParsePushNotification,
  type OrderUpdateNotification,
  type PushNotificationPayload,
} from "./schemas";

/**
 * Configure foreground notification display behavior for expo-notifications.
 */
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

/**
 * Invalidation Rule:
 * When an `order_update` arrives, immediately invalidate the deliveries list
 * and the specific delivery query so any visible screen auto-refreshes.
 */
function handleOrderUpdateInvalidation(payload: OrderUpdateNotification): void {
  void queryClient.invalidateQueries({
    queryKey: deliveryKeys.all,
  });
  void queryClient.invalidateQueries({
    queryKey: deliveryKeys.detail(payload.deliveryId),
  });
}

/**
 * 1. Background state handler (Headless / App closed):
 * Registered at the root entry point before React runs.
 */
export async function backgroundMessageHandler(
  remoteMessage: FirebaseMessagingTypes.RemoteMessage,
): Promise<void> {
  const payload = safeParsePushNotification(remoteMessage.data);
  if (!payload) {
    if (__DEV__) {
      console.warn(
        "[Notifications:Background] Ignored malformed payload:",
        remoteMessage.data,
      );
    }
    return;
  }

  if (payload.type === "order_update") {
    handleOrderUpdateInvalidation(payload);
  }
}

/**
 * Helper to display an Expo local notification inside the 'delivery-updates' channel
 * when the app is running in the FOREGROUND.
 */
async function showForegroundLocalNotification(
  remoteMessage: FirebaseMessagingTypes.RemoteMessage,
  payload: PushNotificationPayload | null,
): Promise<void> {
  const title =
    payload?.title ??
    remoteMessage.notification?.title ??
    (payload?.type === "order_update" ? "Order Update" : "Delivery Alert");

  const body =
    payload?.body ??
    remoteMessage.notification?.body ??
    (payload?.type === "order_update"
      ? `Update for order #${payload.deliveryId}`
      : "You have a new update");

  await Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      data: remoteMessage.data ?? {},
      sound: "default",
    },
    trigger: {
      channelId: env.EXPO_PUBLIC_NOTIFICATION_CHANNEL_ID,
    },
  });
}

/**
 * 2. Foreground handler (App active):
 * Processes FCM onMessage events, validates defensively with Zod, invalidates
 * React Query cache, and triggers a local high-importance notification banner.
 */
function setupForegroundHandler(): () => void {
  return messaging().onMessage(async (remoteMessage) => {
    // Defense: Validate with safeParse so malformed pushes NEVER crash the app
    const payload = safeParsePushNotification(remoteMessage.data);

    if (payload?.type === "order_update") {
      handleOrderUpdateInvalidation(payload);
    }

    // Always show local notification in foreground
    await showForegroundLocalNotification(remoteMessage, payload);
  });
}

/**
 * 3. Background tap-to-navigate handler:
 * Fires when user taps a push notification while the app was running in the background.
 */
function setupNotificationOpenedHandler(): () => void {
  return messaging().onNotificationOpenedApp((remoteMessage) => {
    const payload = safeParsePushNotification(remoteMessage.data);
    if (!payload) {
      if (__DEV__) {
        console.warn(
          "[Notifications:OpenedApp] Malformed notification payload ignored:",
          remoteMessage.data,
        );
      }
      return;
    }

    if (payload.type === "order_update") {
      handleOrderUpdateInvalidation(payload);
      navigateToDeliveryDetail(payload.deliveryId);
    }
  });
}

/**
 * 4. Killed state handler (Cold-start):
 * Checks if the app was launched by tapping a push notification from the killed state.
 */
async function checkKilledStateInitialNotification(): Promise<void> {
  const initialMessage = await messaging().getInitialNotification();
  if (!initialMessage) {
    return;
  }

  const payload = safeParsePushNotification(initialMessage.data);
  if (!payload) {
    if (__DEV__) {
      console.warn(
        "[Notifications:KilledState] Malformed initial notification payload ignored:",
        initialMessage.data,
      );
    }
    return;
  }

  if (payload.type === "order_update") {
    handleOrderUpdateInvalidation(payload);
    navigateToDeliveryDetail(payload.deliveryId);
  }
}

/**
 * React hook to attach all notification runtime handlers inside the app container:
 * - Foreground listener
 * - Background tap-to-navigate listener
 * - Killed-state initial notification check
 * - Expo local notification response tap listener
 */
export function useNotificationHandlers(): void {
  useEffect(() => {
    // 1. Foreground listener
    const unsubscribeForeground = setupForegroundHandler();

    // 2. Background tap listener
    const unsubscribeOpened = setupNotificationOpenedHandler();

    // 3. Killed state check
    void checkKilledStateInitialNotification();

    // 4. Handle tap on Expo foreground local notifications
    const subscriptionLocalTap =
      Notifications.addNotificationResponseReceivedListener((response) => {
        const data = response.notification.request.content.data;
        const payload = safeParsePushNotification(data);

        if (payload?.type === "order_update") {
          navigateToDeliveryDetail(payload.deliveryId);
        }
      });

    return () => {
      unsubscribeForeground();
      unsubscribeOpened();
      subscriptionLocalTap.remove();
    };
  }, []);
}
