import React from "react";
import { View } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";

export default function AstraAnimatedIcon({ size = 52 }) {
  return (
    <View
      style={{
        width: size,
        height: size,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "transparent",
      }}
    >
      <MaterialIcons name="auto-awesome" size={size * 0.72} color="#FFFFFF" />
    </View>
  );
}
