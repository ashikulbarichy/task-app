import { z } from "zod";

/**
 * Payload sent to backend when registering or updating the device's FCM token.
 */
export const FcmTokenPayloadSchema = z.object({
  token: z.string().min(1, "FCM token cannot be empty"),
  platform: z.enum(["android", "ios"]),
  deviceModel: z.string().optional(),
  appVersion: z.string().optional(),
});

export type FcmTokenPayload = z.infer<typeof FcmTokenPayloadSchema>;

/**
 * Driver/Customer notification preferences loaded and saved via React Query.
 */
export const NotificationSettingsSchema = z.object({
  orderUpdates: z.boolean(),
  deliveryAlerts: z.boolean(),
  promotional: z.boolean(),
  soundEnabled: z.boolean(),
});

export type NotificationSettings = z.infer<typeof NotificationSettingsSchema>;

/**
 * Specialized schema for delivery lifecycle push notifications (Feature 1 Stage 3).
 * Validated via .safeParse() so invalid delivery payloads never crash the app.
 */
export const OrderUpdateNotificationSchema = z.object({
  type: z.literal("order_update"),
  deliveryId: z.string().min(1, "Delivery ID is required"),
  status: z.enum(["pending", "started", "arrived", "completed", "assigned", "in_transit", "cancelled"]).optional(),
  title: z.string().optional(),
  body: z.string().optional(),
});

export type OrderUpdateNotification = z.infer<typeof OrderUpdateNotificationSchema>;

/**
 * General announcement or alert notification payload.
 */
export const GeneralNotificationSchema = z.object({
  type: z.literal("general"),
  title: z.string().min(1, "Title is required"),
  body: z.string().min(1, "Body is required"),
  url: z.string().url().optional(),
});

export type GeneralNotification = z.infer<typeof GeneralNotificationSchema>;

/**
 * Discriminated union of all supported incoming push notification payloads.
 */
export const PushNotificationPayloadSchema = z.discriminatedUnion("type", [
  OrderUpdateNotificationSchema,
  GeneralNotificationSchema,
]);

export type PushNotificationPayload = z.infer<typeof PushNotificationPayloadSchema>;

/**
 * Defensive parsing helper:
 * Safely parses raw FCM / APNs remote messages data. Returns null on validation failure
 * without throwing, preventing incoming malformed payloads from crashing the app.
 */
export function safeParsePushNotification(
  data: unknown,
): PushNotificationPayload | null {
  if (!data || typeof data !== "object") {
    return null;
  }

  const result = PushNotificationPayloadSchema.safeParse(data);
  if (result.success) {
    return result.data;
  }

  if (__DEV__) {
    console.warn(
      "[PushNotifications] Ignored malformed notification payload:",
      result.error.flatten(),
    );
  }
  return null;
}
