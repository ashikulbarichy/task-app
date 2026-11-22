import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

import type { RootStackParamList } from "@/features/notifications/navigation";
import { startBackgroundTracking } from "@/features/tracking/backgroundTask";
import {
  useCompleteDelivery,
  useDeliveryDetail,
  useUpdateDeliveryStatus,
} from "../queries";
import type { DeliveryStatus, ProofOfDeliveryForm } from "../schemas";
import { ProofOfDeliveryModal } from "./ProofOfDeliveryModal";

type Props = NativeStackScreenProps<RootStackParamList, "DeliveryDetail">;

const LIFECYCLE_STEPS: { status: DeliveryStatus; label: string }[] = [
  { status: "pending", label: "Pending" },
  { status: "started", label: "Started" },
  { status: "arrived", label: "Arrived" },
  { status: "completed", label: "Completed" },
];

export function DeliveryDetailScreen({ route, navigation }: Props) {
  const { deliveryId } = route.params;
  const { data: delivery, isPending, error, refetch } = useDeliveryDetail(deliveryId);

  const updateStatusMutation = useUpdateDeliveryStatus();
  const completeMutation = useCompleteDelivery();

  const [isPodModalVisible, setIsPodModalVisible] = useState(false);
  const [simulateServerFailure, setSimulateServerFailure] = useState(false);

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

  const isMutating = updateStatusMutation.isPending || completeMutation.isPending;

  // 1. Advance to "started" and automatically start background tracking
  const handleStartDelivery = () => {
    updateStatusMutation.mutate(
      {
        id: delivery.id,
        currentStatus: delivery.status,
        nextStatus: "started",
        simulateFailure: simulateServerFailure,
      },
      {
        onSuccess: async () => {
          const res = await startBackgroundTracking({ deliveryId: delivery.id });
          if (res.success) {
            Alert.alert(
              "Delivery Started",
              "Status set to 'started'. Background location tracking is now actively broadcasting.",
            );
          }
        },
        onError: (err) => {
          Alert.alert("Action Failed", err.message || "Failed to start delivery.");
        },
      },
    );
  };

  // 2. Advance to "arrived"
  const handleMarkArrived = () => {
    updateStatusMutation.mutate(
      {
        id: delivery.id,
        currentStatus: delivery.status,
        nextStatus: "arrived",
        simulateFailure: simulateServerFailure,
      },
      {
        onSuccess: () => {
          Alert.alert("Arrived", "Status updated to 'arrived'. Driver is at drop-off location.");
        },
        onError: (err) => {
          Alert.alert("Action Failed", err.message || "Failed to mark arrived.");
        },
      },
    );
  };

  // 3. Submit POD form and complete delivery
  const handlePodSubmit = (proof: ProofOfDeliveryForm) => {
    completeMutation.mutate(
      {
        id: delivery.id,
        proof,
        simulateFailure: simulateServerFailure,
      },
      {
        onSuccess: () => {
          setIsPodModalVisible(false);
          Alert.alert(
            "Delivery Completed",
            `Proof recorded for ${proof.recipientName}. Background tracking has stopped.`,
          );
        },
        onError: (err) => {
          Alert.alert("Completion Failed", err.message || "Failed to complete delivery.");
        },
      },
    );
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Simulation / Testing Panel */}
      <View style={styles.simulatorCard}>
        <View style={styles.simulatorRow}>
          <View style={styles.simulatorTextContainer}>
            <Text style={styles.simulatorTitle}>Simulate Server 500 Error</Text>
            <Text style={styles.simulatorSubtitle}>
              Test optimistic UI rollback on network failure
            </Text>
          </View>
          <Switch
            value={simulateServerFailure}
            onValueChange={setSimulateServerFailure}
            thumbColor={simulateServerFailure ? "#DC2626" : "#F8FAFC"}
            trackColor={{ false: "#CBD5E1", true: "#FCA5A5" }}
          />
        </View>
      </View>

      {/* Main Order Card */}
      <View style={styles.card}>
        <View style={styles.statusRow}>
          <Text style={styles.orderNumber}>Order #{delivery.orderNumber}</Text>
          <View style={[styles.statusBadge, getStatusBadgeStyle(delivery.status)]}>
            <Text style={[styles.statusText, getStatusTextStyle(delivery.status)]}>
              {delivery.status.toUpperCase()}
            </Text>
          </View>
        </View>

        {/* Linear Lifecycle Progress Bar */}
        <View style={styles.lifecycleContainer}>
          {LIFECYCLE_STEPS.map((step, idx) => {
            const isCurrent = delivery.status === step.status;
            const isCompleted = getStepIndex(delivery.status) >= idx;

            return (
              <View key={step.status} style={styles.lifecycleStep}>
                <View
                  style={[
                    styles.lifecycleCircle,
                    isCompleted && styles.lifecycleCircleCompleted,
                    isCurrent && styles.lifecycleCircleCurrent,
                  ]}
                >
                  <Text
                    style={[
                      styles.lifecycleCircleText,
                      isCompleted && styles.lifecycleCircleTextCompleted,
                    ]}
                  >
                    {isCompleted ? "✓" : idx + 1}
                  </Text>
                </View>
                <Text
                  style={[
                    styles.lifecycleStepLabel,
                    isCurrent && styles.lifecycleStepLabelCurrent,
                  ]}
                >
                  {step.label}
                </Text>
              </View>
            );
          })}
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

        {delivery.recipientName && (
          <>
            <View style={styles.divider} />
            <Text style={styles.sectionTitle}>Proof of Delivery</Text>
            <Text style={styles.fieldLabel}>Received By</Text>
            <Text style={styles.fieldValue}>{delivery.recipientName}</Text>
          </>
        )}

        {delivery.notes && (
          <>
            <Text style={styles.fieldLabel}>Notes</Text>
            <Text style={styles.fieldValue}>{delivery.notes}</Text>
          </>
        )}

        {delivery.updatedAt && (
          <Text style={styles.lastUpdated}>
            Last state sync: {delivery.updatedAt}
          </Text>
        )}
      </View>

      {/* Action Buttons Based On Strict Lifecycle */}
      <View style={styles.actionSection}>
        {delivery.status === "pending" && (
          <TouchableOpacity
            style={[styles.actionButton, styles.primaryActionButton]}
            onPress={handleStartDelivery}
            disabled={isMutating}
          >
            {isMutating ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.actionButtonText}>▶ Start Delivery</Text>
            )}
          </TouchableOpacity>
        )}

        {delivery.status === "started" && (
          <>
            <TouchableOpacity
              style={[styles.actionButton, styles.warningActionButton]}
              onPress={handleMarkArrived}
              disabled={isMutating}
            >
              {isMutating ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.actionButtonText}>📍 Mark Arrived</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionButton, styles.secondaryActionButton]}
              onPress={() => navigation.navigate("DriverMap", { deliveryId: delivery.id })}
            >
              <Text style={styles.secondaryActionButtonText}>🗺 View Live Route on Map</Text>
            </TouchableOpacity>
          </>
        )}

        {delivery.status === "arrived" && (
          <TouchableOpacity
            style={[styles.actionButton, styles.successActionButton]}
            onPress={() => setIsPodModalVisible(true)}
            disabled={isMutating}
          >
            <Text style={styles.actionButtonText}>✍ Complete Delivery (POD)</Text>
          </TouchableOpacity>
        )}

        {delivery.status === "completed" && (
          <View style={styles.completedNotice}>
            <Text style={styles.completedNoticeTitle}>✓ Delivery Completed</Text>
            <Text style={styles.completedNoticeText}>
              All steps finished. Background tracking has automatically halted.
            </Text>
          </View>
        )}
      </View>

      <Pressable
        style={styles.backButton}
        onPress={() => navigation.navigate("DeliveriesList")}
      >
        <Text style={styles.backButtonText}>← Back to Deliveries</Text>
      </Pressable>

      {/* Proof of Delivery Modal */}
      <ProofOfDeliveryModal
        visible={isPodModalVisible}
        orderNumber={delivery.orderNumber}
        onClose={() => setIsPodModalVisible(false)}
        onSubmit={handlePodSubmit}
        isSubmitting={completeMutation.isPending}
      />
    </ScrollView>
  );
}

function getStepIndex(status: DeliveryStatus): number {
  switch (status) {
    case "pending":
      return 0;
    case "started":
      return 1;
    case "arrived":
      return 2;
    case "completed":
      return 3;
    default:
      return 0;
  }
}

function getStatusBadgeStyle(status: DeliveryStatus) {
  switch (status) {
    case "started":
      return { backgroundColor: "#DBEAFE" };
    case "arrived":
      return { backgroundColor: "#FEF3C7" };
    case "completed":
      return { backgroundColor: "#DCFCE7" };
    case "pending":
    default:
      return { backgroundColor: "#F1F5F9" };
  }
}

function getStatusTextStyle(status: DeliveryStatus) {
  switch (status) {
    case "started":
      return { color: "#1D4ED8" };
    case "arrived":
      return { color: "#B45309" };
    case "completed":
      return { color: "#15803D" };
    case "pending":
    default:
      return { color: "#475569" };
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8FAFC",
  },
  content: {
    padding: 16,
    paddingBottom: 32,
  },
  simulatorCard: {
    backgroundColor: "#FEF2F2",
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: "#FECACA",
    marginBottom: 16,
  },
  simulatorRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  simulatorTextContainer: {
    flex: 1,
    paddingRight: 12,
  },
  simulatorTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#991B1B",
  },
  simulatorSubtitle: {
    fontSize: 12,
    color: "#B91C1C",
    marginTop: 2,
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
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  statusText: {
    fontSize: 12,
    fontWeight: "700",
  },
  lifecycleContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 18,
    paddingHorizontal: 4,
  },
  lifecycleStep: {
    alignItems: "center",
    flex: 1,
  },
  lifecycleCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#E2E8F0",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 4,
  },
  lifecycleCircleCompleted: {
    backgroundColor: "#22C55E",
  },
  lifecycleCircleCurrent: {
    backgroundColor: "#2563EB",
  },
  lifecycleCircleText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#64748B",
  },
  lifecycleCircleTextCompleted: {
    color: "#FFFFFF",
  },
  lifecycleStepLabel: {
    fontSize: 11,
    color: "#94A3B8",
    fontWeight: "600",
  },
  lifecycleStepLabelCurrent: {
    color: "#0F172A",
    fontWeight: "700",
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
  actionSection: {
    gap: 12,
    marginBottom: 16,
  },
  actionButton: {
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  primaryActionButton: {
    backgroundColor: "#2563EB",
  },
  warningActionButton: {
    backgroundColor: "#D97706",
  },
  successActionButton: {
    backgroundColor: "#16A34A",
  },
  secondaryActionButton: {
    backgroundColor: "#EFF6FF",
    borderWidth: 1,
    borderColor: "#BFDBFE",
  },
  actionButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
  },
  secondaryActionButtonText: {
    color: "#1D4ED8",
    fontSize: 15,
    fontWeight: "700",
  },
  completedNotice: {
    backgroundColor: "#DCFCE7",
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#BBF7D0",
    alignItems: "center",
  },
  completedNoticeTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#15803D",
    marginBottom: 4,
  },
  completedNoticeText: {
    fontSize: 13,
    color: "#166534",
    textAlign: "center",
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
