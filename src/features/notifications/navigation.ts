import { createNavigationContainerRef } from "@react-navigation/native";

export type RootStackParamList = {
  DeliveriesList: undefined;
  DeliveryDetail: { deliveryId: string };
  NotificationSettings: undefined;
  DriverMap: { deliveryId?: string } | undefined;
  LocationPermission: undefined;
};

export const navigationRef = createNavigationContainerRef<RootStackParamList>();

let pendingKilledStateDeliveryId: string | null = null;

/**
 * Safely navigates to the delivery detail screen.
 * If the React Navigation tree is not yet mounted (e.g. killed state startup),
 * the deliveryId is queued until onNavigationReady() is called.
 */
export function navigateToDeliveryDetail(deliveryId: string): void {
  if (navigationRef.isReady()) {
    navigationRef.navigate("DeliveryDetail", { deliveryId });
  } else {
    pendingKilledStateDeliveryId = deliveryId;
  }
}

/**
 * Called by NavigationContainer's onReady prop.
 * Flushes any pending killed-state deep link once navigation is mounted.
 */
export function onNavigationReady(): void {
  if (pendingKilledStateDeliveryId && navigationRef.isReady()) {
    const deliveryId = pendingKilledStateDeliveryId;
    pendingKilledStateDeliveryId = null;
    navigationRef.navigate("DeliveryDetail", { deliveryId });
  }
}
