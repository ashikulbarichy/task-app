import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import React, { useEffect, useRef, useState } from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import MapView, { Marker, type MapMarker, PROVIDER_DEFAULT, Region } from "react-native-maps";

import { Card, DeliveryStatusBadge } from "@/components/ui";
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

// Rendering customer tracking screen
export function CustomerTrackingScreen({ route, navigation }: Props) {
  const { deliveryId } = route.params;

  const { data: delivery } = useDeliveryDetail(deliveryId);

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
  const driverMarkerRef = useRef<MapMarker | null>(null);
  const previousCoordsRef = useRef<{ latitude: number; longitude: number } | null>(null);

  const [initialMarkerCoord, setInitialMarkerCoord] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);

  useEffect(() => {
    if (!driverLocation) return;

    const newCoordinate = {
      latitude: driverLocation.latitude,
      longitude: driverLocation.longitude,
    };

    if (!initialMarkerCoord) {
      setInitialMarkerCoord(newCoordinate);
      mapRef.current?.animateToRegion({
        ...newCoordinate,
        latitudeDelta: 0.015,
        longitudeDelta: 0.015,
      });
    } else {
      if (typeof driverMarkerRef.current?.animateMarkerToCoordinate === "function") {
        driverMarkerRef.current.animateMarkerToCoordinate(newCoordinate, 1200);
      }
    }

    previousCoordsRef.current = newCoordinate;
  }, [driverLocation?.latitude, driverLocation?.longitude, initialMarkerCoord]);

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

        {initialMarkerCoord && (
          <Marker.Animated
            ref={driverMarkerRef}
            coordinate={initialMarkerCoord}
            title="Your Delivery Driver"
            description={
              driverLocation?.speed
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

      <Card style={styles.topCard}>
        <View style={styles.topHeaderRow}>
          <View>
            <Text style={styles.orderTitle}>
              {delivery ? `Order #${delivery.orderNumber}` : "Delivery Tracking"}
            </Text>
            <Text style={styles.orderSubtitle}>
              {delivery ? delivery.customerName : "Locating driver…"}
            </Text>
          </View>

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
      </Card>

      <TouchableOpacity style={styles.recenterButton} onPress={handleRecenter}>
        <Text style={styles.recenterIcon}>🎯</Text>
      </TouchableOpacity>

      <Card style={styles.bottomCard}>
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
          <DeliveryStatusBadge status={delivery?.status || "started"} />
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
      </Card>
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
    backgroundColor: "#94A3B8",
  },
  livePulseDotActive: {
    backgroundColor: "#16A34A",
  },
  liveStatusText: {
    fontSize: 12,
    color: "#475569",
    fontWeight: "600",
  },
  timestampText: {
    fontSize: 11,
    color: "#94A3B8",
  },
  recenterButton: {
    position: "absolute",
    right: 16,
    bottom: 210,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#FFFFFF",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  recenterIcon: {
    fontSize: 22,
  },
  bottomCard: {
    position: "absolute",
    bottom: 24,
    left: 16,
    right: 16,
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 5,
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
    fontWeight: "500",
  },
  etaValue: {
    fontSize: 18,
    fontWeight: "800",
    color: "#0F172A",
    marginTop: 2,
  },
  destinationText: {
    fontSize: 13,
    color: "#475569",
    lineHeight: 18,
    marginBottom: 12,
  },
  backButton: {
    paddingVertical: 10,
    alignItems: "center",
    borderTopWidth: 1,
    borderTopColor: "#F1F5F9",
  },
  backButtonText: {
    color: "#64748B",
    fontSize: 13,
    fontWeight: "600",
  },
});
