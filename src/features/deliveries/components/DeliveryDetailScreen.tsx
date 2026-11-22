import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import React from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import type { RootStackParamList } from "@/features/notifications/navigation";
import { useDelivery } from "../queries";

type Props = NativeStackScreenProps<RootStackParamList, "DeliveryDetail">;

export function DeliveryDetailScreen({ route, navigation }: Props) {
  const { deliveryId } = route.params;
  const { data: delivery, isPending, error, refetch } = useDelivery(deliveryId);

  if (isPending) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#2563EB" />
        <Text style={styles.loadingText}>Fetching order #{deliveryId}…</Text>
      </View>
    );
  }

  if (error || !delivery) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorTitle}>Could not load delivery</Text>
        <Text style={styles.errorMessage}>
          {error?.message ?? "The requested delivery was not found."}
        </Text>
        <Pressable style={styles.primaryButton} onPress={() => void refetch()}>
          <Text style={styles.primaryButtonText}>Retry</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.card}>
        <View style={styles.statusRow}>
          <Text style={styles.orderNumber}>Order #{delivery.orderNumber}</Text>
          <View style={styles.statusBadge}>
            <Text style={styles.statusText}>
              {delivery.status.toUpperCase()}
            </Text>
          </View>
        </View>

        <View style={styles.divider} />

        <Text style={styles.sectionTitle}>Customer Details</Text>
        <Text style={styles.fieldLabel}>Name</Text>
        <Text style={styles.fieldValue}>{delivery.customerName}</Text>

        <Text style={styles.fieldLabel}>Destination</Text>
        <Text style={styles.fieldValue}>{delivery.address}</Text>

        {delivery.items.length > 0 && (
          <>
            <View style={styles.divider} />
            <Text style={styles.sectionTitle}>Items ({delivery.items.length})</Text>
            {delivery.items.map((item, index) => (
              <Text key={index} style={styles.itemText}>
                • {item}
              </Text>
            ))}
          </>
        )}

        {delivery.notes && (
          <>
            <View style={styles.divider} />
            <Text style={styles.sectionTitle}>Delivery Notes</Text>
            <Text style={styles.fieldValue}>{delivery.notes}</Text>
          </>
        )}

        {delivery.updatedAt && (
          <Text style={styles.lastUpdated}>
            Last server sync: {delivery.updatedAt}
          </Text>
        )}
      </View>

      <Pressable
        style={styles.backButton}
        onPress={() => navigation.navigate("DeliveriesList")}
      >
        <Text style={styles.backButtonText}>← Back to Deliveries</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8FAFC",
  },
  content: {
    padding: 16,
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 20,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
    marginBottom: 16,
  },
  statusRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  orderNumber: {
    fontSize: 20,
    fontWeight: "700",
    color: "#0F172A",
  },
  statusBadge: {
    backgroundColor: "#DBEAFE",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  statusText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#1E40AF",
  },
  divider: {
    height: 1,
    backgroundColor: "#F1F5F9",
    marginVertical: 16,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#0F172A",
    marginBottom: 8,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: "#94A3B8",
    marginTop: 6,
    textTransform: "uppercase",
  },
  fieldValue: {
    fontSize: 15,
    color: "#334155",
    marginTop: 2,
  },
  itemText: {
    fontSize: 14,
    color: "#475569",
    marginTop: 4,
  },
  lastUpdated: {
    marginTop: 16,
    fontSize: 12,
    color: "#94A3B8",
    fontStyle: "italic",
    textAlign: "right",
  },
  backButton: {
    alignItems: "center",
    padding: 12,
  },
  backButtonText: {
    color: "#2563EB",
    fontWeight: "600",
    fontSize: 15,
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
});
