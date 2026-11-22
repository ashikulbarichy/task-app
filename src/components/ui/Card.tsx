import React from "react";
import {
  Pressable,
  StyleSheet,
  View,
  type ViewProps,
  type ViewStyle,
} from "react-native";

interface CardProps extends ViewProps {
  children: React.ReactNode;
  onPress?: () => void;
  style?: ViewStyle;
}

// Rendering card
export function Card({ children, onPress, style, ...rest }: CardProps) {
  if (onPress) {
    return (
      <Pressable
        style={({ pressed }) => [
          styles.card,
          pressed && styles.pressed,
          style,
        ]}
        onPress={onPress}
        {...rest}
      >
        {children}
      </Pressable>
    );
  }

  return (
    <View style={[styles.card, style]} {...rest}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  pressed: {
    opacity: 0.92,
  },
});
