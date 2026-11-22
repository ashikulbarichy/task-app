import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import MapView, { Marker, PROVIDER_DEFAULT, Region } from "react-native-maps";

import { useDeliveryDetail } from "@/features/deliveries/queries";
import type { RootStackParamList } from "@/features/notifications/navigation";
import {
  useCustomerLiveTrackingPolling,
  useCustomerLiveTrackingWebSocket,
} from "../queries";

type Props = NativeStackScreenProps<RootStackParamList, "CustomerTracking">;

type SyncStrategy = "polling" | "websocket";

const DEFAULT_REGION: Region = {
  latitude: 37.7749,
  longitude: -122.4194,
  latitudeDelta: 0.02,
  longitudeDelta: 0.02,
};

export function CustomerTrackingScreen({ route, navigation }: Props) {
  const { deliveryId } = route.params;

  // Order metadata query
  const { data: delivery, isPending: isDeliveryPending } = useDeliveryDetail(deliveryId);

  // Strategy toggle: Strict React Query discipline ensures either polling OR WebSocket is active
  const [strategy, setStrategy] = useState<SyncStrategy>("polling");

  const pollingQuery = useCustomerLiveTrackingPolling(
    strategy === "polling" ? deliveryId : "",
  );

  const wsQuery = useCustomerLiveTrackingWebSocket(
    strategy === "websocket" ? deliveryId : "",
    { enabled: strategy === "websocket" },
  );

  const activeQuery = strategy === "polling" ? pollingQuery : wsQuery;
  const driverLocation = activeQuery.data;

  const mapRef = useRef<MapView | null>(null);
  const driverMarkerRef = useRef<any>(null);
  const previousCoordsRef = useRef<{ latitude: number; longitude: number } | null>(null);

  // Smooth Marker Animation (glides smoothly from previous coordinate to new coordinate)
  useEffect(() => {
    if (!driverLocation) return;

    const newCoordinate = {
      latitude: driverLocation.latitude,
      longitude: driverLocation.longitude,
    };

    if (previousCoordsRef.current && driverMarkerRef.current) {
      // Smoothly animate marker over 1200ms rather than abruptly teleporting
      if (typeof driverMarkerRef.current.animateMarkerToCoordinate === "function") {
        driverMarkerRef.current.animateMarkerToCoordinate(newCoordinate, 1200);
      }
    } else {
      // First fix: center map region on driver
      mapRef.current?.animateToRegion({
        ...newCoordinate,
        latitudeDelta: 0.015,
        longitudeDelta: 0.015,
      });
    }

    previousCoordsRef.current = newCoordinate;
  }, [driverLocation?.latitude, driverLocation?.longitude]);

  const handleRecenter = () => {
    if (driverLocation) {
      mapRef.current?.animateToRegion({
        latitude: driverLocation.latitude,
        longitude: driverLocation.longitude,
        latitudeDelta: 0.015,
        longitudeDelta: 0.015,
      });
    }
  };

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        style={styles.map}
        provider={PROVIDER_DEFAULT}
        initialRegion={DEFAULT_REGION}
        showsCompass
      >
        {/* Customer Destination Marker */}
        {delivery?.latitude && delivery?.longitude && (
          <Marker
            coordinate={{
              latitude: delivery.latitude,
              longitude: delivery.longitude,
            }}
            title="Delivery Address"
            description={delivery.address}
            pinColor="#2563EB"
          />
        )}

        {/* Live Driver Marker (Animated) */}
        {driverLocation && (
          <Marker.Animated
            ref={driverMarkerRef}
            coordinate={{
              latitude: driverLocation.latitude,
              longitude: driverLocation.longitude,
            }}
            title="Your Delivery Driver"
            description={
              driverLocation.speed
                ? `Speed: ${(driverLocation.speed * 3.6).toFixed(1)} km/h`
                : "Driver Location"
            }
          >
            <View style={styles.driverMarkerIcon}>
              <Text style={styles.driverMarkerEmoji}>🚚</Text>
            </View>
          </Marker.Animated>
        )}
      </MapView>

      {/* Top Floating Header Card */}
      <View style={styles.topCard}>
        <View style={styles.topHeaderRow}>
          <View>
            <Text style={styles.orderTitle}>
              {delivery ? `Order #${delivery.orderNumber}` : "Delivery Tracking"}
            </Text>
            <Text style={styles.orderSubtitle}>
              {delivery ? delivery.customerName : "Locating driver…"}
            </Text>
          </View>

          {/* Strategy Selector Pills */}
          <View style={styles.strategyContainer}>
            <TouchableOpacity
              style={[
                styles.strategyPill,
                strategy === "polling" && styles.strategyPillActive,
              ]}
              onPress={() => setStrategy("polling")}
            >
              <Text
                style={[
                  styles.strategyPillText,
                  strategy === "polling" && styles.strategyPillTextActive,
                ]}
              >
                Poll (4s)
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.strategyPill,
                strategy === "websocket" && styles.strategyPillActive,
              ]}
              onPress={() => setStrategy("websocket")}
            >
              <Text
                style={[
                  styles.strategyPillText,
                  strategy === "websocket" && styles.strategyPillTextActive,
                ]}
              >
                WS Push
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Live Status Row */}
        <View style={styles.statusRow}>
          <View style={styles.indicatorContainer}>
            <View
              style={[
                styles.livePulseDot,
                activeQuery.isFetching && styles.livePulseDotActive,
              ]}
            />
            <Text style={styles.liveStatusText}>
              {strategy === "polling"
                ? activeQuery.isFetching
                  ? "Polling GPS…"
                  : "Live Polling (4s)"
                : "WebSocket Direct"}
            </Text>
          </View>

          {driverLocation && (
            <Text style={styles.timestampText}>
              Last fix: {new Date(driverLocation.timestamp).toLocaleTimeString()}
            </Text>
          )}
        </View>
      </View>

      {/* Recenter Button */}
      <TouchableOpacity style={styles.recenterButton} onPress={handleRecenter}>
        <Text style={styles.recenterIcon}>🎯</Text>
      </TouchableOpacity>

      {/* Bottom Floating Delivery Info Card */}
      <View style={styles.bottomCard}>
        <View style={styles.etaRow}>
          <View>
            <Text style={styles.etaLabel}>Estimated Arrival</Text>
            <Text style={styles.etaValue}>
              {delivery?.status === "completed"
                ? "Delivered ✓"
                : delivery?.status === "arrived"
                  ? "Arrived at destination!"
                  : "10-15 mins"}
            </Text>
          </View>
          <View
            style={[
              styles.statusBadge,
              delivery?.status === "completed"
                ? styles.badgeCompleted
                : styles.badgeTransit,
            ]}
          >
            <Text
              style={[
                styles.statusBadgeText,
                delivery?.status === "completed"
                  ? styles.badgeCompletedText
                  : styles.badgeTransitText,
              ]}
            >
              {delivery?.status.toUpperCase() || "IN TRANSIT"}
            </Text>
          </View>
        </View>

        {delivery?.address && (
          <Text style={styles.destinationText} numberOfLines={2}>
            📍 Destination: {delivery.address}
          </Text>
        )}

        <Pressable
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.backButtonText}>← Close Live Tracking</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8FAFC",
  },
  map: {
    ...StyleSheet.absoluteFillObject,
  },
  driverMarkerIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#FFFFFF",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#2563EB",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  driverMarkerEmoji: {
    fontSize: 22,
  },
  topCard: {
    position: "absolute",
    top: 16,
    left: 16,
    right: 16,
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  topHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  orderTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#0F172A",
  },
  orderSubtitle: {
    fontSize: 13,
    color: "#64748B",
  },
  strategyContainer: {
    flexDirection: "row",
    backgroundColor: "#F1F5F9",
    borderRadius: 20,
    padding: 2,
  },
  strategyPill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 18,
  },
  strategyPillActive: {
    backgroundColor: "#2563EB",
  },
  strategyPillText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#64748B",
  },
  strategyPillTextActive: {
    color: "#FFFFFF",
  },
  statusRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "#F1F5F9",
  },
  indicatorContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  livePulseDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#22C55E",
  },
  livePulseDotActive: {
    backgroundColor: "#3B82F6",
  },
  liveStatusText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#475569",
  },
  timestampText: {
    fontSize: 11,
    color: "#94A3B8",
  },
  recenterButton: {
    position: "absolute",
    right: 16,
    bottom: 180,
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
  bottomCard: {
    position: "absolute",
    bottom: 24,
    left: 16,
    right: 16,
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 18,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.12,
    shadowRadius: 5,
    elevation: 4,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  etaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  etaLabel: {
    fontSize: 12,
    color: "#64748B",
    fontWeight: "600",
    textTransform: "uppercase",
  },
  etaValue: {
    fontSize: 20,
    fontWeight: "800",
    color: "#0F172A",
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  statusBadgeText: {
    fontSize: 12,
    fontWeight: "700",
  },
  badgeTransit: {
    backgroundColor: "#DBEAFE",
  },
  badgeTransitText: {
    color: "#1D4ED8",
    fontSize: 12,
    fontWeight: "700",
  },
  badgeCompleted: {
    backgroundColor: "#DCFCE7",
  },
  badgeCompletedText: {
    color: "#166534",
    fontSize: 12,
    fontWeight: "700",
  },
  destinationText: {
    fontSize: 13,
    color: "#475569",
    marginTop: 4,
    marginBottom: 12,
  },
  backButton: {
    alignItems: "center",
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: "#F1F5F9",
  },
  backButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#2563EB",
  },
});
