import React from "react";
import {
  ActivityIndicator,
  StyleSheet,
  Switch,
  Text,
  View,
} from "react-native";

import { Card, ErrorView, LoadingView } from "@/components/ui";
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

export function NotificationSettingsScreen() {
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
    marginTop: 14,
    gap: 8,
  },
  savingText: {
    fontSize: 13,
    color: "#475569",
  },
});
