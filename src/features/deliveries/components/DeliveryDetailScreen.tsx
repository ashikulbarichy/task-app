import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import React, { useState } from "react";
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from "react-native";

import {
  AppButton,
  Card,
  DeliveryStatusBadge,
  ErrorView,
  LoadingView,
} from "@/components/ui";
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

// Rendering delivery detail screen
export function DeliveryDetailScreen({ route, navigation }: Props) {
  const { deliveryId } = route.params;
  const { data: delivery, isPending, error, refetch } = useDeliveryDetail(deliveryId);

  const updateStatusMutation = useUpdateDeliveryStatus();
  const completeMutation = useCompleteDelivery();

  const [isPodModalVisible, setIsPodModalVisible] = useState(false);
  const [simulateServerFailure, setSimulateServerFailure] = useState(false);

  if (isPending) {
    return <LoadingView message={`Fetching order #${deliveryId}…`} />;
  }

  if (error || !delivery) {
    return (
      <ErrorView
        title="Could not load delivery"
        message={error?.message ?? "The requested delivery was not found."}
        onRetry={() => void refetch()}
        retryButtonText="Retry"
      />
    );
  }

  const isMutating = updateStatusMutation.isPending || completeMutation.isPending;

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

      <Card style={styles.orderCard}>
        <View style={styles.statusRow}>
          <Text style={styles.orderNumber}>Order #{delivery.orderNumber}</Text>
          <DeliveryStatusBadge status={delivery.status} />
        </View>

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
      </Card>

      <View style={styles.actionSection}>
        {delivery.status === "pending" && (
          <AppButton
            title="▶ Start Delivery"
            variant="primary"
            onPress={handleStartDelivery}
            isLoading={isMutating}
          />
        )}

        {delivery.status === "started" && (
          <>
            <AppButton
              title="📍 Mark Arrived"
              variant="warning"
              onPress={handleMarkArrived}
              isLoading={isMutating}
            />

            <AppButton
              title="🗺 View Live Route on Map"
              variant="secondary"
              onPress={() => navigation.navigate("DriverMap", { deliveryId: delivery.id })}
            />
          </>
        )}

        {delivery.status === "arrived" && (
          <AppButton
            title="✍ Complete Delivery (POD)"
            variant="success"
            onPress={() => setIsPodModalVisible(true)}
            isLoading={isMutating}
          />
        )}

        {delivery.status === "completed" && (
          <View style={styles.completedNotice}>
            <Text style={styles.completedNoticeTitle}>✓ Delivery Completed</Text>
            <Text style={styles.completedNoticeText}>
              All steps finished. Background tracking has automatically halted.
            </Text>
          </View>
        )}

        <AppButton
          title="👁 View Customer Live Tracking"
          variant="secondary"
          onPress={() => navigation.navigate("CustomerTracking", { deliveryId: delivery.id })}
          style={styles.customerViewButton}
          textStyle={styles.customerViewButtonText}
        />
      </View>

      <Pressable
        style={styles.backButton}
        onPress={() => navigation.navigate("DeliveriesList")}
      >
        <Text style={styles.backButtonText}>← Back to Deliveries</Text>
      </Pressable>

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

// Getting lifecycle step index
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
  orderCard: {
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
    backgroundColor: "#16A34A",
  },
  lifecycleCircleCurrent: {
    backgroundColor: "#2563EB",
    borderWidth: 2,
    borderColor: "#93C5FD",
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
    color: "#64748B",
    fontWeight: "500",
  },
  lifecycleStepLabelCurrent: {
    color: "#2563EB",
    fontWeight: "700",
  },
  divider: {
    height: 1,
    backgroundColor: "#F1F5F9",
    marginVertical: 14,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#475569",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  fieldLabel: {
    fontSize: 12,
    color: "#64748B",
    marginTop: 4,
  },
  fieldValue: {
    fontSize: 15,
    fontWeight: "600",
    color: "#0F172A",
    marginBottom: 4,
  },
  itemText: {
    fontSize: 14,
    color: "#334155",
    marginBottom: 4,
  },
  lastUpdated: {
    fontSize: 11,
    color: "#94A3B8",
    fontStyle: "italic",
    marginTop: 12,
  },
  actionSection: {
    gap: 12,
    marginBottom: 16,
  },
  customerViewButton: {
    marginTop: 4,
  },
  customerViewButtonText: {
    fontWeight: "600",
  },
  completedNotice: {
    backgroundColor: "#F0FDF4",
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#BBF7D0",
    alignItems: "center",
  },
  completedNoticeTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#16A34A",
    marginBottom: 4,
  },
  completedNoticeText: {
    fontSize: 13,
    color: "#15803D",
    textAlign: "center",
  },
  backButton: {
    padding: 12,
    alignItems: "center",
  },
  backButtonText: {
    color: "#64748B",
    fontSize: 14,
    fontWeight: "600",
  },
});
