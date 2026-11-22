import { zodResolver } from "@hookform/resolvers/zod";
import React from "react";
import { Controller, useForm } from "react-hook-form";
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { AppButton } from "@/components/ui";
import {
  type ProofOfDeliveryForm,
  ProofOfDeliveryFormSchema,
} from "../schemas";

interface ProofOfDeliveryModalProps {
  visible: boolean;
  onClose: () => void;
  onSubmit: (data: ProofOfDeliveryForm) => void;
  isSubmitting: boolean;
  orderNumber: string;
}

export function ProofOfDeliveryModal({
  visible,
  onClose,
  onSubmit,
  isSubmitting,
  orderNumber,
}: ProofOfDeliveryModalProps) {
  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ProofOfDeliveryForm>({
    resolver: zodResolver(ProofOfDeliveryFormSchema),
    defaultValues: {
      recipientName: "",
      notes: "",
    },
  });

  const handleFormSubmit = (data: ProofOfDeliveryForm) => {
    onSubmit(data);
    reset();
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={handleClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.overlay}
      >
        <View style={styles.card}>
          <View style={styles.header}>
            <Text style={styles.title}>Proof of Delivery</Text>
            <Text style={styles.subtitle}>Order #{orderNumber}</Text>
          </View>

          {/* Recipient Name Field */}
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>
              Recipient Name <Text style={styles.required}>*</Text>
            </Text>
            <Controller
              control={control}
              name="recipientName"
              render={({ field: { onChange, onBlur, value } }) => (
                <TextInput
                  style={[
                    styles.input,
                    errors.recipientName && styles.inputError,
                  ]}
                  placeholder="e.g. John Doe / Front Desk"
                  placeholderTextColor="#94A3B8"
                  onBlur={onBlur}
                  onChangeText={onChange}
                  value={value}
                  editable={!isSubmitting}
                />
              )}
            />
            {errors.recipientName && (
              <Text style={styles.errorText}>
                {errors.recipientName.message}
              </Text>
            )}
          </View>

          {/* Delivery Notes Field */}
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Delivery Notes (Optional)</Text>
            <Controller
              control={control}
              name="notes"
              render={({ field: { onChange, onBlur, value } }) => (
                <TextInput
                  style={[styles.input, styles.textArea]}
                  placeholder="e.g. Left with reception, signed by guard"
                  placeholderTextColor="#94A3B8"
                  multiline
                  numberOfLines={3}
                  onBlur={onBlur}
                  onChangeText={onChange}
                  value={value}
                  editable={!isSubmitting}
                />
              )}
            />
            {errors.notes && (
              <Text style={styles.errorText}>{errors.notes.message}</Text>
            )}
          </View>

          {/* Modal Actions */}
          <View style={styles.actionRow}>
            <AppButton
              title="Cancel"
              variant="outline"
              onPress={handleClose}
              disabled={isSubmitting}
              style={styles.cancelBtn}
            />

            <AppButton
              title="Confirm Delivery"
              variant="success"
              onPress={handleSubmit(handleFormSubmit)}
              isLoading={isSubmitting}
              style={styles.submitBtn}
            />
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.6)",
    justifyContent: "center",
    padding: 20,
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 5,
  },
  header: {
    marginBottom: 20,
  },
  title: {
    fontSize: 20,
    fontWeight: "800",
    color: "#0F172A",
  },
  subtitle: {
    fontSize: 14,
    color: "#64748B",
    marginTop: 4,
  },
  fieldGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 13,
    fontWeight: "700",
    color: "#334155",
    marginBottom: 6,
  },
  required: {
    color: "#DC2626",
  },
  input: {
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: "#0F172A",
    backgroundColor: "#F8FAFC",
  },
  inputError: {
    borderColor: "#DC2626",
    backgroundColor: "#FEF2F2",
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: "top",
  },
  errorText: {
    fontSize: 12,
    color: "#DC2626",
    marginTop: 4,
  },
  actionRow: {
    flexDirection: "row",
    gap: 12,
    marginTop: 8,
  },
  cancelBtn: {
    flex: 1,
  },
  submitBtn: {
    flex: 2,
  },
});
