import React from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  type TextStyle,
  type ViewStyle,
} from "react-native";

export type ButtonVariant =
  | "primary"
  | "secondary"
  | "warning"
  | "success"
  | "danger"
  | "outline";

interface AppButtonProps {
  title: string;
  onPress: () => void;
  variant?: ButtonVariant;
  isLoading?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
  icon?: React.ReactNode;
}

export function AppButton({
  title,
  onPress,
  variant = "primary",
  isLoading = false,
  disabled = false,
  style,
  textStyle,
  icon,
}: AppButtonProps) {
  const isInteractionDisabled = disabled || isLoading;
  const variantStyles = VARIANT_STYLES[variant];

  return (
    <Pressable
      style={({ pressed }) => [
        styles.baseButton,
        variantStyles.button,
        isInteractionDisabled && styles.disabledButton,
        pressed && !isInteractionDisabled && styles.pressedButton,
        style,
      ]}
      onPress={onPress}
      disabled={isInteractionDisabled}
    >
      {isLoading ? (
        <ActivityIndicator
          size="small"
          color={variant === "outline" || variant === "secondary" ? "#2563EB" : "#FFFFFF"}
        />
      ) : (
        <>
          {icon ? icon : null}
          <Text
            style={[
              styles.baseText,
              variantStyles.text,
              isInteractionDisabled && styles.disabledText,
              textStyle,
            ]}
          >
            {title}
          </Text>
        </>
      )}
    </Pressable>
  );
}

const VARIANT_STYLES: Record<ButtonVariant, { button: ViewStyle; text: TextStyle }> = {
  primary: {
    button: { backgroundColor: "#2563EB" },
    text: { color: "#FFFFFF" },
  },
  secondary: {
    button: {
      backgroundColor: "#EFF6FF",
      borderWidth: 1,
      borderColor: "#BFDBFE",
    },
    text: { color: "#1D4ED8" },
  },
  warning: {
    button: { backgroundColor: "#D97706" },
    text: { color: "#FFFFFF" },
  },
  success: {
    button: { backgroundColor: "#16A34A" },
    text: { color: "#FFFFFF" },
  },
  danger: {
    button: { backgroundColor: "#DC2626" },
    text: { color: "#FFFFFF" },
  },
  outline: {
    button: {
      backgroundColor: "transparent",
      borderWidth: 1,
      borderColor: "#CBD5E1",
    },
    text: { color: "#475569" },
  },
};

const styles = StyleSheet.create({
  baseButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 10,
    gap: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 2,
  },
  baseText: {
    fontSize: 15,
    fontWeight: "700",
  },
  disabledButton: {
    opacity: 0.6,
  },
  disabledText: {
    opacity: 0.9,
  },
  pressedButton: {
    opacity: 0.85,
    transform: [{ scale: 0.99 }],
  },
});
