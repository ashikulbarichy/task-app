import { createNavigationContainerRef } from "@react-navigation/native";

export type RootStackParamList = {
  DeliveriesList: undefined;
  DeliveryDetail: { deliveryId: string };
  NotificationSettings: undefined;
  DriverMap: { deliveryId?: string } | undefined;
  LocationPermission: undefined;
  CustomerTracking: { deliveryId: string };
};

export const navigationRef = createNavigationContainerRef<RootStackParamList>();

let pendingKilledStateDeliveryId: string | null = null;

// Navigating to delivery detail
export function navigateToDeliveryDetail(deliveryId: string): void {
  if (navigationRef.isReady()) {
    navigationRef.navigate("DeliveryDetail", { deliveryId });
  } else {
    pendingKilledStateDeliveryId = deliveryId;
  }
}

// Handling navigation ready state
export function onNavigationReady(): void {
  if (pendingKilledStateDeliveryId && navigationRef.isReady()) {
    const deliveryId = pendingKilledStateDeliveryId;
    pendingKilledStateDeliveryId = null;
    navigationRef.navigate("DeliveryDetail", { deliveryId });
  }
}
