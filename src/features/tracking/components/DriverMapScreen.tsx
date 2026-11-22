import * as Location from "expo-location";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import MapView, { Marker, PROVIDER_DEFAULT, Region } from "react-native-maps";

import { AppButton, Card } from "@/components/ui";
import {
  checkLocationPermissions,
  isBackgroundTrackingActive,
  startBackgroundTracking,
  stopBackgroundTracking,
} from "../backgroundTask";
import { flushQueue, getQueueLength } from "../locationQueue";
import { LocationPermissionScreen } from "./LocationPermissionScreen";

interface DriverMapScreenProps {
  deliveryId?: string;
}

const DEFAULT_REGION: Region = {
  latitude: 37.7749,
  longitude: -122.4194,
  latitudeDelta: 0.015,
  longitudeDelta: 0.015,
};

export function DriverMapScreen({ deliveryId }: DriverMapScreenProps) {
  const mapRef = useRef<MapView | null>(null);

  const [hasPermissions, setHasPermissions] = useState<boolean | null>(null);
  const [currentCoords, setCurrentCoords] = useState<{
    latitude: number;
    longitude: number;
    accuracy: number | null;
    heading: number | null;
  } | null>(null);
  const [isTracking, setIsTracking] = useState(false);
  const [queuedCount, setQueuedCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);

  // 1. Check initial permissions & background tracking status
  useEffect(() => {
    let isMounted = true;

    async function init() {
      const perms = await checkLocationPermissions();
      if (!isMounted) return;

      if (!perms.foregroundGranted) {
        setHasPermissions(false);
        return;
      }

      setHasPermissions(true);
      const tracking = await isBackgroundTrackingActive();
      if (isMounted) setIsTracking(tracking);

      const count = await getQueueLength();
      if (isMounted) setQueuedCount(count);

      // Fetch initial one-time position
      try {
        const initialLoc = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        if (isMounted) {
          setCurrentCoords({
            latitude: initialLoc.coords.latitude,
            longitude: initialLoc.coords.longitude,
            accuracy: initialLoc.coords.accuracy,
            heading: initialLoc.coords.heading,
          });
          mapRef.current?.animateToRegion({
            latitude: initialLoc.coords.latitude,
            longitude: initialLoc.coords.longitude,
            latitudeDelta: 0.01,
            longitudeDelta: 0.01,
          });
        }
      } catch (e) {
        console.warn("[DriverMapScreen] Failed to get initial position:", e);
      }
    }

    void init();

    return () => {
      isMounted = false;
    };
  }, []);

  // 2. Watch foreground location while screen is mounted
  useEffect(() => {
    if (!hasPermissions) return;

    let sub: Location.LocationSubscription | null = null;

    async function startWatching() {
      try {
        sub = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.High,
            timeInterval: 4000,
            distanceInterval: 5,
          },
          (loc) => {
            setCurrentCoords({
              latitude: loc.coords.latitude,
              longitude: loc.coords.longitude,
              accuracy: loc.coords.accuracy,
              heading: loc.coords.heading,
            });
          },
        );
      } catch (err) {
        console.warn("[DriverMapScreen] Foreground watch error:", err);
      }
    }

    void startWatching();

    return () => {
      sub?.remove();
    };
  }, [hasPermissions]);

  // 3. Periodic queue count refresh
  useEffect(() => {
    const interval = setInterval(async () => {
      const count = await getQueueLength();
      setQueuedCount(count);
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  const handleToggleTracking = async () => {
    if (isTracking) {
      await stopBackgroundTracking();
      setIsTracking(false);
      Alert.alert("Tracking Stopped", "Background location updates are paused.");
    } else {
      const result = await startBackgroundTracking({ deliveryId });
      if (result.success) {
        setIsTracking(true);
        Alert.alert(
          "Tracking Active",
          "Broadcasting live delivery updates to customer and dispatch.",
        );
      } else {
        Alert.alert("Tracking Error", result.error || "Could not start tracking.");
      }
    }
    const count = await getQueueLength();
    setQueuedCount(count);
  };

  const handleManualSync = async () => {
    setIsSyncing(true);
    try {
      const res = await flushQueue();
      setQueuedCount(res.remaining);
      Alert.alert(
        "Offline Queue Sync",
        res.sent > 0
          ? `Successfully synced ${res.sent} location points.`
          : res.remaining === 0
            ? "Queue is already empty."
            : `Sync failed. ${res.remaining} points remain queued.`,
      );
    } finally {
      setIsSyncing(false);
    }
  };

  const handleRecenter = () => {
    if (currentCoords) {
      mapRef.current?.animateToRegion({
        latitude: currentCoords.latitude,
        longitude: currentCoords.longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      });
    }
  };

  // If permissions missing, render the rationale screen
  if (hasPermissions === false) {
    return (
      <LocationPermissionScreen
        onPermissionsGranted={() => setHasPermissions(true)}
        onContinueAnyway={() => setHasPermissions(true)}
      />
    );
  }

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        style={styles.map}
        provider={PROVIDER_DEFAULT}
        initialRegion={DEFAULT_REGION}
        showsUserLocation
        showsMyLocationButton={false}
        showsCompass
      >
        {currentCoords && (
          <Marker
            coordinate={{
              latitude: currentCoords.latitude,
              longitude: currentCoords.longitude,
            }}
            title="Your Vehicle"
            description={
              currentCoords.accuracy
                ? `GPS Accuracy: ±${Math.round(currentCoords.accuracy)}m`
                : "Driver Location"
            }
          />
        )}
      </MapView>

      {/* Top Floating Dashboard Card */}
      <Card style={styles.dashboardCard}>
        <View style={styles.statusRow}>
          <View style={styles.statusIndicator}>
            <View
              style={[
                styles.statusDot,
                isTracking ? styles.statusDotActive : styles.statusDotInactive,
              ]}
            />
            <Text style={styles.statusLabel}>
              {isTracking ? "Live Tracking Active" : "Tracking Paused"}
            </Text>
          </View>
          {queuedCount > 0 ? (
            <TouchableOpacity
              style={styles.queueBadge}
              onPress={handleManualSync}
              disabled={isSyncing}
            >
              {isSyncing ? (
                <ActivityIndicator size="small" color="#B45309" />
              ) : (
                <Text style={styles.queueBadgeText}>
                  {queuedCount} queued ↻
                </Text>
              )}
            </TouchableOpacity>
          ) : (
            <View style={styles.syncedBadge}>
              <Text style={styles.syncedBadgeText}>✓ Synced</Text>
            </View>
          )}
        </View>

        {currentCoords ? (
          <Text style={styles.coordsText}>
            Lat: {currentCoords.latitude.toFixed(5)}, Lng: {currentCoords.longitude.toFixed(5)}
            {currentCoords.accuracy
              ? `  (±${Math.round(currentCoords.accuracy)}m)`
              : ""}
          </Text>
        ) : (
          <Text style={styles.coordsText}>Acquiring GPS fix...</Text>
        )}
      </Card>

      {/* Floating Recenter Button */}
      <TouchableOpacity style={styles.recenterButton} onPress={handleRecenter}>
        <Text style={styles.recenterIcon}>🎯</Text>
      </TouchableOpacity>

      {/* Bottom Floating Control Panel */}
      <View style={styles.controlPanel}>
        <AppButton
          title={isTracking ? "⏹ Stop Background Tracking" : "▶ Start Background Tracking"}
          variant={isTracking ? "danger" : "primary"}
          onPress={handleToggleTracking}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F1F5F9",
  },
  map: {
    ...StyleSheet.absoluteFillObject,
  },
  dashboardCard: {
    position: "absolute",
    top: 16,
    left: 16,
    right: 16,
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  statusRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  statusIndicator: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  statusDotActive: {
    backgroundColor: "#22C55E",
  },
  statusDotInactive: {
    backgroundColor: "#94A3B8",
  },
  statusLabel: {
    fontSize: 14,
    fontWeight: "700",
    color: "#0F172A",
  },
  queueBadge: {
    backgroundColor: "#FEF3C7",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#FDE68A",
  },
  queueBadgeText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#B45309",
  },
  syncedBadge: {
    backgroundColor: "#DCFCE7",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  syncedBadgeText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#166534",
  },
  coordsText: {
    fontSize: 12,
    color: "#64748B",
    fontVariant: ["tabular-nums"],
  },
  recenterButton: {
    position: "absolute",
    right: 16,
    bottom: 96,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#FFFFFF",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
    elevation: 3,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  recenterIcon: {
    fontSize: 20,
  },
  controlPanel: {
    position: "absolute",
    bottom: 24,
    left: 16,
    right: 16,
  },
  trackingToggleButton: {
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
    elevation: 3,
  },
  startButton: {
    backgroundColor: "#2563EB",
  },
  stopButton: {
    backgroundColor: "#DC2626",
  },
  trackingToggleText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
  },
});
