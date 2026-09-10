// components/PicksStatRow.js
import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { BRAND } from "../constants/theme";
import { TYPO } from "../constants/typography";

// Fixed thresholds, same convention as factorScoreColor on
// PickDetailScreen — a stat means the same thing regardless of what
// else is on screen, never scaled/recolored relative to other picks.
function signColor(n) {
  if (n > 0) return BRAND.accent;
  if (n < 0) return BRAND.red;
  return BRAND.sub;
}

export default function PicksStatRow({ accuracyReport }) {
  const n = accuracyReport?.n;
  const pctPositive = accuracyReport?.pctPositive;
  const meanReturnPct = accuracyReport?.meanReturnPct;

  if (!n || pctPositive == null || meanReturnPct == null) return null;

  const winRateColor = signColor(pctPositive - 50);
  const avgReturnColor = signColor(meanReturnPct);

  return (
    <View style={styles.row}>
      <View style={styles.card}>
        <Text style={styles.label}>Graded Outcomes</Text>
        <Text style={[styles.value, { color: BRAND.text }]}>{n}</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.label}>Win Rate</Text>
        <Text style={[styles.value, { color: winRateColor }]}>
          {Math.round(pctPositive)}%
        </Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.label}>Avg Return</Text>
        <Text style={[styles.value, { color: avgReturnColor }]}>
          {meanReturnPct > 0 ? "+" : ""}
          {meanReturnPct.toFixed(2)}%
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    gap: 8,
    marginHorizontal: 12,
    marginTop: 8,
    marginBottom: 6,
  },

  card: {
    flex: 1,
    backgroundColor: BRAND.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: BRAND.softBorder,
    paddingVertical: 10,
    paddingHorizontal: 6,
    alignItems: "center",
  },

  label: {
    color: BRAND.muted,
    fontSize: 9.5,
    fontFamily: TYPO.fontFamily.semibold,
    marginBottom: 3,
    textAlign: "center",
  },

  value: {
    fontSize: 16,
    fontFamily: TYPO.fontFamily.extrabold,
    fontVariant: ["tabular-nums"],
  },
});
