import React from "react";
import { ActivityIndicator, StyleSheet, Text, View, type ViewStyle } from "react-native";

interface LoadingViewProps {
  message?: string;
  size?: "small" | "large";
  color?: string;
  style?: ViewStyle;
}

// Rendering loading view
export function LoadingView({
  message = "Loading…",
  size = "large",
  color = "#2563EB",
  style,
}: LoadingViewProps) {
  return (
    <View style={[styles.centered, style]}>
      <ActivityIndicator size={size} color={color} />
      {message ? <Text style={styles.loadingText}>{message}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
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
    textAlign: "center",
  },
});
