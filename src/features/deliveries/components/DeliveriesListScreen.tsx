import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import React from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";

import type { RootStackParamList } from "@/features/notifications/navigation";
import { useDeliveries } from "../queries";
import type { Delivery } from "../schemas";

type Props = NativeStackScreenProps<RootStackParamList, "DeliveriesList">;

export function DeliveriesListScreen({ navigation }: Props) {
  const { data: deliveries, isPending, error, refetch, isRefetching } =
    useDeliveries();

  if (isPending) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#2563EB" />
        <Text style={styles.loadingText}>Loading assigned deliveries…</Text>
      </View>
    );
  }

  if (error || !deliveries) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorTitle}>Could not load deliveries</Text>
        <Text style={styles.errorMessage}>
          {error?.message ?? "An unexpected error occurred."}
        </Text>
        <Pressable style={styles.primaryButton} onPress={() => void refetch()}>
          <Text style={styles.primaryButtonText}>Retry</Text>
        </Pressable>
      </View>
    );
  }

  const renderItem = ({ item }: { item: Delivery }) => (
    <Pressable
      style={styles.card}
      onPress={() =>
        navigation.navigate("DeliveryDetail", { deliveryId: item.id })
      }
    >
      <View style={styles.cardHeader}>
        <Text style={styles.orderNumber}>#{item.orderNumber}</Text>
        <View style={[styles.statusBadge, getStatusStyle(item.status)]}>
          <Text style={styles.statusBadgeText}>
            {item.status.toUpperCase()}
          </Text>
        </View>
      </View>
      <Text style={styles.customerName}>{item.customerName}</Text>
      <Text style={styles.address}>{item.address}</Text>
      {item.updatedAt && (
        <Text style={styles.timestamp}>Updated: {item.updatedAt}</Text>
      )}
    </Pressable>
  );

  return (
    <View style={styles.container}>
      <View style={styles.headerBar}>
        <Text style={styles.title}>Active Deliveries</Text>
        <View style={styles.headerButtons}>
          <Pressable
            style={styles.mapButton}
            onPress={() => navigation.navigate("DriverMap", undefined)}
          >
            <Text style={styles.mapButtonText}>📍 Live Map</Text>
          </Pressable>
          <Pressable
            style={styles.settingsButton}
            onPress={() => navigation.navigate("NotificationSettings")}
          >
            <Text style={styles.settingsButtonText}>Settings</Text>
          </Pressable>
        </View>
      </View>

      <FlatList
        data={deliveries}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={() => void refetch()}
            colors={["#2563EB"]}
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No deliveries found.</Text>
          </View>
        }
      />
    </View>
  );
}

function getStatusStyle(status: Delivery["status"]) {
  switch (status) {
    case "in_transit":
      return { backgroundColor: "#DBEAFE" };
    case "arrived":
      return { backgroundColor: "#FEF3C7" };
    case "completed":
      return { backgroundColor: "#DCFCE7" };
    case "cancelled":
      return { backgroundColor: "#FEE2E2" };
    default:
      return { backgroundColor: "#F1F5F9" };
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8FAFC",
  },
  headerBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  title: {
    fontSize: 22,
    fontWeight: "700",
    color: "#0F172A",
  },
  headerButtons: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  mapButton: {
    backgroundColor: "#2563EB",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  mapButtonText: {
    color: "#FFFFFF",
    fontWeight: "600",
    fontSize: 13,
  },
  settingsButton: {
    backgroundColor: "#EFF6FF",
    borderWidth: 1,
    borderColor: "#BFDBFE",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  settingsButtonText: {
    color: "#2563EB",
    fontWeight: "600",
    fontSize: 13,
  },
  listContent: {
    padding: 16,
    gap: 12,
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  orderNumber: {
    fontSize: 16,
    fontWeight: "700",
    color: "#0F172A",
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#1E293B",
  },
  customerName: {
    fontSize: 15,
    fontWeight: "600",
    color: "#334155",
  },
  address: {
    fontSize: 13,
    color: "#64748B",
    marginTop: 2,
  },
  timestamp: {
    fontSize: 11,
    color: "#94A3B8",
    marginTop: 8,
  },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
    backgroundColor: "#F8FAFC",
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: "#64748B",
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#0F172A",
    marginBottom: 4,
  },
  errorMessage: {
    fontSize: 14,
    color: "#64748B",
    textAlign: "center",
    marginBottom: 16,
  },
  primaryButton: {
    backgroundColor: "#2563EB",
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontWeight: "600",
  },
  emptyContainer: {
    padding: 32,
    alignItems: "center",
  },
  emptyText: {
    color: "#64748B",
    fontSize: 14,
  },
});
