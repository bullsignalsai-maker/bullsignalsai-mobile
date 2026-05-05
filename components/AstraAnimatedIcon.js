import React from "react";
import { View } from "react-native";
import { Ionicons, MaterialIcons } from "@expo/vector-icons";

export default function AstraAnimatedIcon({ size = 44 }) {
  const bubbleSize = size;
  const starSize = size * 0.38;

  return (
    <View
      style={{
        width: bubbleSize,
        height: bubbleSize,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {/* Chat Bubble */}
      <Ionicons
        name="chatbubble-outline"
        size={bubbleSize}
        color="#00E396"
      />

      {/* Clear Astra Star */}
      <View
        style={{
          position: "absolute",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <MaterialIcons
          name="auto-awesome"
          size={starSize}
          color="#6EE7F9"
        />
      </View>
    </View>
  );
}