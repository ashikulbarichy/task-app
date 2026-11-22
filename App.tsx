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
import {
  queryClient,
  registerGlobalErrorHandlers,
  setupQueryClientListeners,
} from "@/lib/queryClient";

/**
 * Register Firebase background message handler at top-level.
 * Ensures headless execution when the app is in the background or killed.
 */
messaging().setBackgroundMessageHandler(backgroundMessageHandler);

const Stack = createNativeStackNavigator<RootStackParamList>();

/**
 * Deep linking configuration for Expo Dev Client and push notifications.
 * Matches the scheme defined in app.json ("dnpdelivery").
 */
const linking = {
  prefixes: ["dnpdelivery://", "https://dnp.app"],
  config: {
    screens: {
      DeliveriesList: "",
      DeliveryDetail: "delivery/:deliveryId",
      NotificationSettings: "settings/notifications",
    },
  },
};

function RootAppNavigator() {
  // 1. Sync FCM token & subscribe to token rotations
  useFcmTokenSync();

  // 2. Attach foreground, background-tap, and killed-state notification handlers
  useNotificationHandlers();

  // 3. Connect AppState and NetInfo to TanStack React Query focus/online managers
  useEffect(() => {
    const cleanupListeners = setupQueryClientListeners();

    // Register global UI reactions for 401 expiry and error toasts
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
      </Stack.Navigator>
    </NavigationContainer>
  );
}

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
