// components/LiveMarketStatus.js
import React, { useEffect, useRef } from "react";
import { View, Text, Animated, StyleSheet } from "react-native";

export default function LiveMarketStatus({ marketStatus }) {
  const livePulse = useRef(new Animated.Value(0)).current;

  // Only pulse when market is open
  useEffect(() => {
    if (marketStatus !== "Open") {
      livePulse.setValue(0); // Reset to static dot
      return;
    }

    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(livePulse, {
          toValue: 1,
          duration: 900,
          useNativeDriver: true,
        }),
        Animated.timing(livePulse, {
          toValue: 0,
          duration: 900,
          useNativeDriver: true,
        }),
      ])
    );

    animation.start();

    return () => animation.stop();
  }, [marketStatus, livePulse]);

  // Determine color and label based on marketStatus + smart weekend fallback
  const getMarketInfo = () => {
    if (marketStatus === "Open") {
      return {
        color: "#00E396", // Green
        label: "Live • Market Open",
        pulse: true,
      };
    }

    // If market is closed, we still want to show "Weekend" on Sat/Sun (in ET)
    const now = new Date();
    const est = new Date(now.toLocaleString("en-US", { timeZone: "America/New_York" }));
    const isWeekend = est.getDay() === 0 || est.getDay() === 6;

    if (isWeekend) {
      return {
        color: "#6B7280", // Gray
        label: "Weekend • No Trading",
        pulse: false,
      };
    }

    return {
      color: "#FEB019", // Amber
      label: "After Hours • Market Closed",
      pulse: false,
    };
  };

  const { color, label } = getMarketInfo();

  return (
    <View style={styles.statusRow}>
      <Animated.View
        style={[
          styles.pulseDot,
          {
            backgroundColor: color,
            shadowColor: color,
            transform: [
              {
                scale: marketStatus === "Open"
                  ? livePulse.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0.8, 1.3],
                    })
                  : 1, // No animation when closed
              },
            ],
            opacity: marketStatus === "Open"
              ? livePulse.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0.7, 1],
                })
              : 0.8,
          },
        ]}
      />
      <Text style={styles.syncText}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    marginLeft: 8,
  },
  pulseDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 6,
    elevation: 6, // Android shadow
  },
  syncText: {
    color: "#9CA3AF",
    fontSize: 12,
    fontWeight: "500",
    marginTop: 1,
  },
});