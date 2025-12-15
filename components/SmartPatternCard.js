// components/SmartPatternCard.js
import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { BRAND } from "../styles/theme"; // make sure you have this file

export default function SmartPatternCard({ patternData }) {
  if (!patternData) return null;

  const {
    pattern,
    headline,
    winRate,
    occurrences,
    forwardReturns = {},
    samples = [],
    dates = [],
  } = patternData;

  const days5 = forwardReturns?.days5 || null;
  const days10 = forwardReturns?.days10 || null;

  return (
    <View style={styles.card}>
      {/* Header */}
      <View style={styles.headerRow}>
        <View style={styles.accentBox} />
        <Text style={styles.title}>Smart Pattern Detection</Text>
      </View>

      {/* Pattern Name */}
      <Text style={styles.patternName}>{pattern || "—"}</Text>
      <Text style={styles.headline}>{headline || ""}</Text>

      {/* Win Rate + Occurrences */}
      <View style={styles.statsRow}>
        <Text style={styles.statText}>
          <Text style={styles.bold}>Win rate:</Text>{" "}
          {winRate ? (winRate * 100).toFixed(1) + "%" : "—"}
        </Text>
        <Text style={styles.statText}>
          <Text style={styles.bold}>Occurrences:</Text> {occurrences ?? 0}
        </Text>
      </View>

      {/* Recent Dates */}
      {dates?.length > 0 && (
        <View style={styles.sectionBlock}>
          <Text style={styles.sectionTitle}>Recent appearances</Text>
          {dates.slice(0, 3).map((d, idx) => (
            <Text key={idx} style={styles.dateItem}>
              • {new Date(d.date).toLocaleDateString()} ({d.changePct > 0 ? "+" : ""}
              {d.changePct?.toFixed(2)}%)
            </Text>
          ))}
        </View>
      )}

      {/* Forward Stats */}
      {(days5 || days10) && (
        <View style={styles.sectionBlock}>
          <Text style={styles.sectionTitle}>Typical performance</Text>

          {days5 && (
            <Text style={styles.forwardText}>
              <Text style={styles.bold}>Next 5 days:</Text>{" "}
              {days5.avg.toFixed(2)}% avg
            </Text>
          )}

          {days10 && (
            <Text style={styles.forwardText}>
              <Text style={styles.bold}>Next 10 days:</Text>{" "}
              {days10.avg.toFixed(2)}% avg
            </Text>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: BRAND.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: BRAND.border,
    paddingHorizontal: 14,
    paddingVertical: 14,
    marginTop: 10,
  },

  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 6,
  },
  accentBox: {
    width: 4,
    height: 18,
    backgroundColor: BRAND.accent,
    borderRadius: 2,
    marginRight: 8,
  },
  title: {
    color: BRAND.accent,
    fontSize: 15,
    fontWeight: "700",
  },

  // Pattern content
  patternName: {
    color: BRAND.text,
    fontSize: 20,
    fontWeight: "800",
    marginTop: 4,
  },
  headline: {
    color: BRAND.sub,
    marginTop: 4,
    fontSize: 13.5,
    lineHeight: 18,
  },

  // Win rate + occurrences
  statsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 12,
    marginBottom: 6,
  },
  statText: {
    color: BRAND.sub,
    fontSize: 13,
  },
  bold: {
    fontWeight: "700",
    color: BRAND.text,
  },

  // Recent dates
  sectionBlock: {
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: BRAND.border,
  },
  sectionTitle: {
    color: BRAND.sub,
    fontSize: 12,
    marginBottom: 6,
    fontWeight: "600",
    textTransform: "uppercase",
  },
  dateItem: {
    color: BRAND.text,
    fontSize: 13,
    marginBottom: 2,
  },

  forwardText: {
    color: BRAND.text,
    fontSize: 13,
    marginBottom: 3,
  },
});
