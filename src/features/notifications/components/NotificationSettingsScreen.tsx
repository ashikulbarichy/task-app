import React from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  View,
} from "react-native";

import type { NotificationSettings } from "../schemas";
import {
  useNotificationSettings,
  useUpdateNotificationSettings,
} from "../queries";

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

/**
 * Notification Settings UI Screen.
 * Strictly obeys architecture rules:
 * - Zero direct Axios/fetch calls.
 * - Zero server data copied into `useState`.
 * - Consumes React Query hooks (`data`, `isPending`, `error`) directly.
 */
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
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#2563EB" />
        <Text style={styles.statusText}>Loading notification settings…</Text>
      </View>
    );
  }

  if (error || !settings) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorTitle}>Could not load settings</Text>
        <Text style={styles.errorMessage}>
          {error?.message ?? "An unexpected error occurred."}
        </Text>
        <Pressable
          style={styles.retryButton}
          onPress={() => {
            void refetch();
          }}
        >
          <Text style={styles.retryButtonText}>Try Again</Text>
        </Pressable>
      </View>
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

      <View style={styles.card}>
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
      </View>

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
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
    backgroundColor: "#F8FAFC",
  },
  statusText: {
    marginTop: 12,
    fontSize: 15,
    color: "#475569",
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#0F172A",
    marginBottom: 6,
  },
  errorMessage: {
    fontSize: 14,
    color: "#64748B",
    textAlign: "center",
    marginBottom: 16,
  },
  retryButton: {
    backgroundColor: "#2563EB",
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  retryButtonText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "600",
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
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
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
