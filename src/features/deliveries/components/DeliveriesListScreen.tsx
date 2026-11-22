import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import React from "react";
import {
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";

import {
  Card,
  DeliveryStatusBadge,
  ErrorView,
  LoadingView,
} from "@/components/ui";
import type { RootStackParamList } from "@/features/notifications/navigation";
import { useDeliveries } from "../queries";
import type { Delivery } from "../schemas";

type Props = NativeStackScreenProps<RootStackParamList, "DeliveriesList">;

// Rendering deliveries list screen
export function DeliveriesListScreen({ navigation }: Props) {
  const { data: deliveries, isPending, error, refetch, isRefetching } =
    useDeliveries();

  if (isPending) {
    return <LoadingView message="Loading assigned deliveries…" />;
  }

  if (error || !deliveries) {
    return (
      <ErrorView
        title="Could not load deliveries"
        message={error?.message ?? "An unexpected error occurred."}
        onRetry={() => void refetch()}
        retryButtonText="Retry"
      />
    );
  }

  const renderItem = ({ item }: { item: Delivery }) => (
    <Card
      onPress={() =>
        navigation.navigate("DeliveryDetail", { deliveryId: item.id })
      }
    >
      <View style={styles.cardHeader}>
        <Text style={styles.orderNumber}>#{item.orderNumber}</Text>
        <DeliveryStatusBadge status={item.status} />
      </View>
      <Text style={styles.customerName}>{item.customerName}</Text>
      <Text style={styles.address}>{item.address}</Text>
      {item.updatedAt && (
        <Text style={styles.timestamp}>Updated: {item.updatedAt}</Text>
      )}
    </Card>
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
    gap: 8,
  },
  mapButton: {
    backgroundColor: "#EFF6FF",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#BFDBFE",
  },
  mapButtonText: {
    color: "#2563EB",
    fontSize: 13,
    fontWeight: "600",
  },
  settingsButton: {
    backgroundColor: "#F1F5F9",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  settingsButtonText: {
    color: "#475569",
    fontSize: 13,
    fontWeight: "600",
  },
  listContent: {
    padding: 16,
    gap: 12,
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
  customerName: {
    fontSize: 15,
    fontWeight: "600",
    color: "#1E293B",
    marginBottom: 4,
  },
  address: {
    fontSize: 13,
    color: "#64748B",
    lineHeight: 18,
  },
  timestamp: {
    fontSize: 11,
    color: "#94A3B8",
    marginTop: 8,
  },
  emptyContainer: {
    paddingVertical: 64,
    alignItems: "center",
  },
  emptyText: {
    color: "#94A3B8",
    fontSize: 14,
  },
});
