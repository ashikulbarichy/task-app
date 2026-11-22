import messaging from "@react-native-firebase/messaging";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { QueryClientProvider } from "@tanstack/react-query";
import { StatusBar } from "expo-status-bar";
import React, { useEffect } from "react";
import { Alert } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { DeliveriesListScreen } from "@/features/deliveries/components/DeliveriesListScreen";
import { DeliveryDetailScreen } from "@/features/deliveries/components/DeliveryDetailScreen";
import { NotificationSettingsScreen } from "@/features/notifications/components/NotificationSettingsScreen";
import { CustomerTrackingScreen } from "@/features/tracking/components/CustomerTrackingScreen";
import { DriverMapScreen } from "@/features/tracking/components/DriverMapScreen";
import { LocationPermissionScreen } from "@/features/tracking/components/LocationPermissionScreen";
import { checkAndResumeTrackingOnStartup } from "@/features/tracking/backgroundTask";
import { setupLocationQueueNetworkListener } from "@/features/tracking/locationQueue";
import {
  backgroundMessageHandler,
  useNotificationHandlers,
} from "@/features/notifications/handlers";
import {
  navigationRef,
  onNavigationReady,
  type RootStackParamList,
} from "@/features/notifications/navigation";
import { useFcmTokenSync } from "@/features/notifications/queries";
import { env } from "@/lib/env";
import {
  queryClient,
  registerGlobalErrorHandlers,
  setupQueryClientListeners,
} from "@/lib/queryClient";

messaging().setBackgroundMessageHandler(backgroundMessageHandler);

const Stack = createNativeStackNavigator<RootStackParamList>();

const linking = {
  prefixes: [`${env.EXPO_PUBLIC_APP_SCHEME}://`, "https://dnp.app"],
  config: {
    screens: {
      DeliveriesList: "",
      DeliveryDetail: "delivery/:deliveryId",
      NotificationSettings: "settings/notifications",
      DriverMap: "tracking/driver-map",
      LocationPermission: "tracking/permissions",
      CustomerTracking: "tracking/customer/:deliveryId",
    },
  },
};

// Rendering root app navigator
function RootAppNavigator() {
  useFcmTokenSync();
  useNotificationHandlers();

  useEffect(() => {
    const cleanupListeners = setupQueryClientListeners();
    const cleanupNetworkQueue = setupLocationQueueNetworkListener();

    void checkAndResumeTrackingOnStartup();

    registerGlobalErrorHandlers({
      onUnauthorized: () => {
        Alert.alert("Session Expired", "Please log in again.");
      },
      onToast: ({ title, message }) => {
        Alert.alert(title, message);
      },
    });

    return () => {
      cleanupListeners();
      cleanupNetworkQueue();
    };
  }, []);

  return (
    <NavigationContainer
      ref={navigationRef}
      onReady={onNavigationReady}
      linking={linking}
    >
      <Stack.Navigator
        initialRouteName="DeliveriesList"
        screenOptions={{
          headerStyle: { backgroundColor: "#FFFFFF" },
          headerTintColor: "#0F172A",
          headerTitleStyle: { fontWeight: "700" },
          contentStyle: { backgroundColor: "#F8FAFC" },
        }}
      >
        <Stack.Screen
          name="DeliveriesList"
          component={DeliveriesListScreen}
          options={{ title: "DNP Delivery" }}
        />
        <Stack.Screen
          name="DeliveryDetail"
          component={DeliveryDetailScreen}
          options={{ title: "Delivery Details" }}
        />
        <Stack.Screen
          name="NotificationSettings"
          component={NotificationSettingsScreen}
          options={{ title: "Notification Settings" }}
        />
        <Stack.Screen
          name="DriverMap"
          component={DriverMapScreen}
          options={{ title: "Driver Live Map" }}
        />
        <Stack.Screen
          name="LocationPermission"
          component={LocationPermissionScreen}
          options={{ title: "Location Permissions" }}
        />
        <Stack.Screen
          name="CustomerTracking"
          component={CustomerTrackingScreen}
          options={{ title: "Live Order Tracking" }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

// Rendering root application
export default function App() {
  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <StatusBar style="dark" />
        <RootAppNavigator />
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
