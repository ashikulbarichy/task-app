import * as Notifications from "expo-notifications";
import { useQueryClient } from "@tanstack/react-query";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  StyleSheet,
  Switch,
  Text,
  View,
} from "react-native";

import { resetMockData } from "@/api/mockAdapter";
import { AppButton, Card, ErrorView, LoadingView } from "@/components/ui";
import { deliveryKeys } from "@/features/deliveries/queries";
import { env } from "@/lib/env";
import {
  useNotificationSettings,
  useUpdateNotificationSettings,
} from "../queries";
import type { NotificationSettings } from "../schemas";

type SettingKey = keyof NotificationSettings;

interface SettingRowItem {
  key: SettingKey;
  title: string;
  description: string;
}

const SETTING_ROWS: readonly SettingRowItem[] = [
  {
    key: "orderUpdates",
    title: "Order Updates",
    description: "Receive real-time status changes for active deliveries.",
  },
  {
    key: "deliveryAlerts",
    title: "Driver Arrival Alerts",
    description: "High-priority alerts when a driver starts or arrives.",
  },
  {
    key: "soundEnabled",
    title: "Notification Sound",
    description: "Play an alert sound on incoming delivery updates.",
  },
  {
    key: "promotional",
    title: "Promotions & News",
    description: "Occasional service updates and announcements.",
  },
];

// Rendering notification settings screen
export function NotificationSettingsScreen() {
  const queryClient = useQueryClient();
  const [isTriggering, setIsTriggering] = useState(false);

  const {
    data: settings,
    isPending,
    error,
    refetch,
  } = useNotificationSettings();

  const {
    mutate: updateSettings,
    isPending: isUpdating,
  } = useUpdateNotificationSettings();

  const handleToggle = (key: SettingKey, nextValue: boolean) => {
    if (!settings) {
      return;
    }

    updateSettings({
      ...settings,
      [key]: nextValue,
    });
  };

  const handleTriggerDemoNotification = async () => {
    setIsTriggering(true);
    try {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: "Driver Has Arrived!",
          body: "Alex Rivera is outside with order #ORD-9481.",
          data: {
            type: "order_update",
            deliveryId: "del-101",
            status: "arrived",
            title: "Driver Has Arrived!",
            body: "Alex Rivera is outside with order #ORD-9481.",
          },
          sound: "default",
        },
        trigger: {
          channelId: env.EXPO_PUBLIC_NOTIFICATION_CHANNEL_ID,
        },
      });
    } catch {
      Alert.alert("Notification", "Could not trigger notification.");
    } finally {
      setIsTriggering(false);
    }
  };

  const handleResetDemoData = () => {
    resetMockData();
    void queryClient.invalidateQueries({ queryKey: deliveryKeys.all });
    Alert.alert("Data Reset", "Mock deliveries have been restored to initial state.");
  };

  if (isPending) {
    return <LoadingView message="Loading notification settings…" />;
  }

  if (error || !settings) {
    return (
      <ErrorView
        title="Could not load settings"
        message={error?.message ?? "An unexpected error occurred."}
        onRetry={() => void refetch()}
        retryButtonText="Try Again"
      />
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.heading}>Notification Preferences</Text>
        <Text style={styles.subheading}>
          Control which push alerts you receive on this device.
        </Text>
      </View>

      <Card style={styles.card}>
        {SETTING_ROWS.map((row, index) => {
          const isLast = index === SETTING_ROWS.length - 1;
          return (
            <View
              key={row.key}
              style={[styles.row, !isLast && styles.rowBorder]}
            >
              <View style={styles.rowTextContainer}>
                <Text style={styles.rowTitle}>{row.title}</Text>
                <Text style={styles.rowDescription}>{row.description}</Text>
              </View>
              <Switch
                value={settings[row.key]}
                disabled={isUpdating}
                onValueChange={(val) => handleToggle(row.key, val)}
                trackColor={{ false: "#CBD5E1", true: "#93C5FD" }}
                thumbColor={settings[row.key] ? "#2563EB" : "#F8FAFC"}
              />
            </View>
          );
        })}
      </Card>

      {isUpdating && (
        <View style={styles.savingRow}>
          <ActivityIndicator size="small" color="#2563EB" />
          <Text style={styles.savingText}>Saving changes…</Text>
        </View>
      )}

      <View style={styles.demoSection}>
        <Text style={styles.demoSectionTitle}>Demo & Standalone Testing</Text>
        <AppButton
          title="🔔 Trigger Demo Arrival Notification"
          variant="secondary"
          onPress={handleTriggerDemoNotification}
          isLoading={isTriggering}
        />
        <AppButton
          title="↻ Reset Mock Data"
          variant="outline"
          onPress={handleResetDemoData}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8FAFC",
    padding: 16,
  },
  header: {
    marginBottom: 16,
  },
  heading: {
    fontSize: 22,
    fontWeight: "700",
    color: "#0F172A",
  },
  subheading: {
    marginTop: 4,
    fontSize: 14,
    color: "#64748B",
  },
  card: {
    padding: 0,
    overflow: "hidden",
    marginBottom: 16,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 16,
    gap: 12,
  },
  rowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
  },
  rowTextContainer: {
    flex: 1,
  },
  rowTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#0F172A",
  },
  rowDescription: {
    marginTop: 2,
    fontSize: 13,
    color: "#64748B",
  },
  savingRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
    gap: 8,
  },
  savingText: {
    fontSize: 13,
    color: "#475569",
  },
  demoSection: {
    gap: 10,
    marginTop: 8,
  },
  demoSectionTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#64748B",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 2,
  },
});
