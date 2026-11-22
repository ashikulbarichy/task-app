import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Linking,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

import {
  checkLocationPermissions,
  promptBatteryOptimizationInfo,
  requestAllLocationPermissions,
} from "../backgroundTask";

interface LocationPermissionScreenProps {
  onPermissionsGranted?: () => void;
  onContinueAnyway?: () => void;
}

export function LocationPermissionScreen({
  onPermissionsGranted,
  onContinueAnyway,
}: LocationPermissionScreenProps) {
  const [loading, setLoading] = useState(true);
  const [requesting, setRequesting] = useState(false);
  const [foregroundGranted, setForegroundGranted] = useState(false);
  const [backgroundGranted, setBackgroundGranted] = useState(false);

  const refreshPermissions = async () => {
    setLoading(true);
    try {
      const perms = await checkLocationPermissions();
      setForegroundGranted(perms.foregroundGranted);
      setBackgroundGranted(perms.backgroundGranted);

      if (perms.foregroundGranted && perms.backgroundGranted && onPermissionsGranted) {
        onPermissionsGranted();
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refreshPermissions();
  }, []);

  const handleRequestPermissions = async () => {
    setRequesting(true);
    try {
      const result = await requestAllLocationPermissions();
      setForegroundGranted(result.foregroundGranted);
      setBackgroundGranted(result.backgroundGranted);

      if (result.foregroundGranted && result.backgroundGranted) {
        promptBatteryOptimizationInfo();
        if (onPermissionsGranted) {
          onPermissionsGranted();
        }
      }
    } finally {
      setRequesting(false);
    }
  };

  const allGranted = foregroundGranted && backgroundGranted;

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#2563EB" />
        <Text style={styles.loadingText}>Checking location permissions...</Text>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.header}>
        <View style={styles.iconCircle}>
          <Text style={styles.iconEmoji}>📍</Text>
        </View>
        <Text style={styles.title}>Driver Location Access</Text>
        <Text style={styles.subtitle}>
          DNP Delivery needs location tracking enabled to provide dispatch and customers with
          live updates during active deliveries.
        </Text>
      </View>

      <View style={styles.cardSection}>
        {/* Permission 1: Foreground */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>1. Foreground Location</Text>
            <View
              style={[
                styles.badge,
                foregroundGranted ? styles.badgeGranted : styles.badgePending,
              ]}
            >
              <Text
                style={[
                  styles.badgeText,
                  foregroundGranted ? styles.badgeTextGranted : styles.badgeTextPending,
                ]}
              >
                {foregroundGranted ? "Granted" : "Required"}
              </Text>
            </View>
          </View>
          <Text style={styles.cardDescription}>
            Used while the app is open to display your current position on the map and route you
            to customer drop-off points.
          </Text>
        </View>

        {/* Permission 2: Background */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>
              2. Background Location ({Platform.OS === "android" ? '"Allow all the time"' : '"Always"'})
            </Text>
            <View
              style={[
                styles.badge,
                backgroundGranted ? styles.badgeGranted : styles.badgePending,
              ]}
            >
              <Text
                style={[
                  styles.badgeText,
                  backgroundGranted ? styles.badgeTextGranted : styles.badgeTextPending,
                ]}
              >
                {backgroundGranted ? "Granted" : "Required"}
              </Text>
            </View>
          </View>
          <Text style={styles.cardDescription}>
            Essential for background delivery updates. Ensures your live location continues
            broadcasting even when the screen is off or you switch to Google Maps or Waze.
          </Text>
        </View>
      </View>

      {/* Rationale Notice */}
      <View style={styles.noticeBox}>
        <Text style={styles.noticeText}>
          🔒 Your location is only captured and transmitted while an active delivery order is
          marked &quot;In Transit&quot;. It stops immediately upon order completion.
        </Text>
      </View>

      {/* Action Buttons */}
      <View style={styles.buttonContainer}>
        {!allGranted ? (
          <>
            <TouchableOpacity
              style={[styles.primaryButton, requesting && styles.buttonDisabled]}
              onPress={handleRequestPermissions}
              disabled={requesting}
            >
              {requesting ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.primaryButtonText}>Grant Location Access</Text>
              )}
            </TouchableOpacity>

            {foregroundGranted && !backgroundGranted && (
              <TouchableOpacity
                style={styles.secondaryButton}
                onPress={() => void Linking.openSettings()}
              >
                <Text style={styles.secondaryButtonText}>
                  Open Settings to Choose &quot;Allow all the time&quot;
                </Text>
              </TouchableOpacity>
            )}

            {onContinueAnyway && (
              <TouchableOpacity
                style={styles.textButton}
                onPress={onContinueAnyway}
              >
                <Text style={styles.textButtonLabel}>Continue to Map with Limited Access</Text>
              </TouchableOpacity>
            )}
          </>
        ) : (
          <TouchableOpacity
            style={styles.successButton}
            onPress={() => onPermissionsGranted?.()}
          >
            <Text style={styles.successButtonText}>✓ All Permissions Granted — Proceed to Map</Text>
          </TouchableOpacity>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 24,
    backgroundColor: "#F8FAFC",
    flexGrow: 1,
    justifyContent: "space-between",
  },
  centerContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#F8FAFC",
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: "#64748B",
  },
  header: {
    alignItems: "center",
    marginTop: 20,
    marginBottom: 24,
  },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "#EFF6FF",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#BFDBFE",
  },
  iconEmoji: {
    fontSize: 32,
  },
  title: {
    fontSize: 22,
    fontWeight: "800",
    color: "#0F172A",
    marginBottom: 8,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 14,
    color: "#64748B",
    textAlign: "center",
    lineHeight: 20,
    paddingHorizontal: 8,
  },
  cardSection: {
    gap: 16,
    marginBottom: 20,
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#1E293B",
    flex: 1,
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  badgeGranted: {
    backgroundColor: "#DCFCE7",
  },
  badgePending: {
    backgroundColor: "#FEF3C7",
  },
  badgeText: {
    fontSize: 12,
    fontWeight: "700",
  },
  badgeTextGranted: {
    color: "#166534",
  },
  badgeTextPending: {
    color: "#92400E",
  },
  cardDescription: {
    fontSize: 13,
    color: "#475569",
    lineHeight: 18,
  },
  noticeBox: {
    backgroundColor: "#F1F5F9",
    borderRadius: 12,
    padding: 14,
    borderLeftWidth: 4,
    borderLeftColor: "#2563EB",
    marginBottom: 24,
  },
  noticeText: {
    fontSize: 12,
    color: "#334155",
    lineHeight: 18,
  },
  buttonContainer: {
    gap: 12,
    marginBottom: 16,
  },
  primaryButton: {
    backgroundColor: "#2563EB",
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  secondaryButton: {
    backgroundColor: "#EFF6FF",
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#BFDBFE",
  },
  secondaryButtonText: {
    color: "#1D4ED8",
    fontSize: 14,
    fontWeight: "600",
    textAlign: "center",
    paddingHorizontal: 12,
  },
  textButton: {
    paddingVertical: 8,
    alignItems: "center",
  },
  textButtonLabel: {
    color: "#64748B",
    fontSize: 13,
    textDecorationLine: "underline",
  },
  successButton: {
    backgroundColor: "#16A34A",
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: "center",
  },
  successButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
  },
});
