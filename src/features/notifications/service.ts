import messaging from "@react-native-firebase/messaging";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { PermissionsAndroid, Platform } from "react-native";
import { z } from "zod";

import { api } from "@/api/client";
import { env } from "@/lib/env";
import {
  FcmTokenPayloadSchema,
  NotificationSettingsSchema,
  type FcmTokenPayload,
  type NotificationSettings,
} from "./schemas";

const ApiResponseSuccessSchema = z.object({
  success: z.boolean(),
  message: z.string().optional(),
});

// Saving FCM token
export async function saveFcmToken(
  payload: FcmTokenPayload,
): Promise<{ success: boolean }> {
  const validated = FcmTokenPayloadSchema.parse(payload);
  const response = await api.post("/notifications/token", validated);
  return ApiResponseSuccessSchema.parse(response.data);
}

// Fetching notification settings
export async function getNotificationSettings(): Promise<NotificationSettings> {
  const response = await api.get("/notifications/settings");
  return NotificationSettingsSchema.parse(response.data);
}

// Updating notification settings
export async function updateNotificationSettings(
  settings: NotificationSettings,
): Promise<NotificationSettings> {
  const validated = NotificationSettingsSchema.parse(settings);
  const response = await api.put("/notifications/settings", validated);
  return NotificationSettingsSchema.parse(response.data);
}

// Requesting notification permissions
export async function requestNotificationPermissions(): Promise<boolean> {
  if (Platform.OS === "android") {
    if (Platform.Version >= 33) {
      const permission = PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS;
      if (!permission) {
        return false;
      }
      const granted = await PermissionsAndroid.request(permission);
      return granted === PermissionsAndroid.RESULTS.GRANTED;
    }
    return true;
  }

  if (Platform.OS === "ios") {
    const authStatus = await messaging().requestPermission();
    return (
      authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
      authStatus === messaging.AuthorizationStatus.PROVISIONAL
    );
  }

  return false;
}

// Creating Android notification channels
export async function createAndroidNotificationChannels(): Promise<void> {
  if (Platform.OS !== "android") {
    return;
  }

  await Notifications.setNotificationChannelAsync(
    env.EXPO_PUBLIC_NOTIFICATION_CHANNEL_ID,
    {
      name: "Delivery Updates",
      description: "Notifications for live order updates and driver arrival alerts",
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: "#2563EB",
      sound: "default",
      enableVibrate: true,
      showBadge: true,
    },
  );
}

// Fetching FCM token from device
export async function getFcmToken(): Promise<string | null> {
  try {
    if (Platform.OS === "ios") {
      await messaging().registerDeviceForRemoteMessages();
    }

    const token = await messaging().getToken();
    return token || null;
  } catch (error) {
    if (__DEV__) {
      console.warn("[FCM] Failed to retrieve FCM token:", error);
    }
    return null;
  }
}

// Building FCM token payload
export function buildFcmTokenPayload(token: string): FcmTokenPayload {
  return {
    token,
    platform: Platform.OS === "ios" ? "ios" : "android",
    deviceModel: Device.modelName ?? undefined,
    appVersion: Device.osVersion ?? undefined,
  };
}
