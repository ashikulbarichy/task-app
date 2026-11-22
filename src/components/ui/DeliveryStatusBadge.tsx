import React from "react";
import { StyleSheet, Text, View, type TextStyle, type ViewStyle } from "react-native";

import type { DeliveryStatus } from "@/features/deliveries/schemas";

interface DeliveryStatusBadgeProps {
  status: DeliveryStatus | string;
  style?: ViewStyle;
  textStyle?: TextStyle;
}

interface StatusTheme {
  bg: string;
  text: string;
  label: string;
}

const STATUS_THEMES: Record<string, StatusTheme> = {
  pending: {
    bg: "#F1F5F9",
    text: "#475569",
    label: "PENDING",
  },
  started: {
    bg: "#DBEAFE",
    text: "#1D4ED8",
    label: "STARTED",
  },
  arrived: {
    bg: "#FEF3C7",
    text: "#B45309",
    label: "ARRIVED",
  },
  completed: {
    bg: "#DCFCE7",
    text: "#15803D",
    label: "COMPLETED",
  },
  assigned: {
    bg: "#F1F5F9",
    text: "#475569",
    label: "ASSIGNED",
  },
  in_transit: {
    bg: "#DBEAFE",
    text: "#1D4ED8",
    label: "IN TRANSIT",
  },
  cancelled: {
    bg: "#FEE2E2",
    text: "#B91C1C",
    label: "CANCELLED",
  },
};

// Rendering delivery status badge
export function DeliveryStatusBadge({
  status,
  style,
  textStyle,
}: DeliveryStatusBadgeProps) {
  const normalizedStatus = status.toLowerCase();
  const theme = STATUS_THEMES[normalizedStatus] ?? {
    bg: "#F1F5F9",
    text: "#475569",
    label: status.toUpperCase(),
  };

  return (
    <View style={[styles.badge, { backgroundColor: theme.bg }, style]}>
      <Text style={[styles.badgeText, { color: theme.text }, textStyle]}>
        {theme.label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    alignSelf: "flex-start",
  },
  badgeText: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.3,
  },
});
