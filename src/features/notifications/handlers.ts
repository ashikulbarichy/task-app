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

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

// Invalidating queries on order update
function handleOrderUpdateInvalidation(payload: OrderUpdateNotification): void {
  void queryClient.invalidateQueries({
    queryKey: deliveryKeys.all,
  });
  void queryClient.invalidateQueries({
    queryKey: deliveryKeys.detail(payload.deliveryId),
  });
}

// Handling background message
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

// Displaying foreground local notification
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

// Setting up foreground notification handler
function setupForegroundHandler(): () => void {
  return messaging().onMessage(async (remoteMessage) => {
    const payload = safeParsePushNotification(remoteMessage.data);

    if (payload?.type === "order_update") {
      handleOrderUpdateInvalidation(payload);
    }

    await showForegroundLocalNotification(remoteMessage, payload);
  });
}

// Setting up notification opened handler
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

// Checking killed state initial notification
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

// Attaching notification handlers hook
export function useNotificationHandlers(): void {
  useEffect(() => {
    const unsubscribeForeground = setupForegroundHandler();
    const unsubscribeOpened = setupNotificationOpenedHandler();

    void checkKilledStateInitialNotification();

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
