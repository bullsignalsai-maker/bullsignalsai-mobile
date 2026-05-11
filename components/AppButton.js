import React from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text } from "react-native";
import { BRAND } from "../constants/theme";
import { TYPO } from "../constants/typography";

export default function AppButton({
  title,
  onPress,
  variant = "primary",
  size = "medium",
  loading = false,
  disabled = false,
  style,
  textStyle,
}) {
  const isDisabled = disabled || loading;

  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.base,
        styles[size],
        styles[variant],
        isDisabled && styles.disabled,
        pressed && !isDisabled && styles.pressed,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator
          size="small"
          color={variant === "primary" ? "#0A0A0A" : BRAND.text}
        />
      ) : (
        <Text style={[styles.text, styles[`${variant}Text`], textStyle]}>
          {title}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 16,
  },

  medium: {
    paddingVertical: 14,
    paddingHorizontal: 18,
  },

  large: {
    paddingVertical: 16,
    paddingHorizontal: 22,
    borderRadius: 18,
  },

  small: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
  },

  primary: {
    backgroundColor: "#FFFFFF",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.28,
    shadowRadius: 16,
    elevation: 4,
  },

  secondary: {
    backgroundColor: "rgba(255,255,255,0.07)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
  },

  outline: {
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
  },

  danger: {
    backgroundColor: "rgba(255,99,115,0.16)",
    borderWidth: 1,
    borderColor: "rgba(255,99,115,0.45)",
  },

  disabled: {
    opacity: 0.45,
  },

  pressed: {
    opacity: 0.72,
    transform: [{ scale: 0.992 }],
  },

  text: {
    fontFamily: TYPO.fontFamily.bold,
    fontSize: TYPO.size.button,
    letterSpacing: 0.1,
  },

  primaryText: {
    color: "#0A0A0A",
  },

  secondaryText: {
    color: BRAND.text,
  },

  outlineText: {
    color: BRAND.text,
  },

  dangerText: {
    color: "#FF99A4",
  },
});
