// components/AccuracyTrendChart.js
import React, { useMemo } from "react";
import { View, Text, StyleSheet } from "react-native";
import Svg, { Path, Circle } from "react-native-svg";
import { BRAND } from "../constants/theme";
import { TYPO } from "../constants/typography";

const WIDTH = 300;
const HEIGHT = 120;
const PADDING_Y = 16;
const PADDING_X = 6;

function formatShortDate(dateStr) {
  if (!dateStr) return null;
  const [y, m, d] = String(dateStr).split("-").map(Number);
  if (!y || !m || !d) return null;
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

// Builds one normalized line (own min/max, so it fills the chart height
// regardless of the other series' scale — win rate lives around 50-60%,
// cumulative SPY return in a ±few-percent band, so a shared axis would
// flatten one of them to near-invisible).
function buildLine(values) {
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const usableWidth = WIDTH - PADDING_X * 2;
  const usableHeight = HEIGHT - PADDING_Y * 2;

  const points = values.map((v, i) => {
    const x = PADDING_X + (i / (values.length - 1)) * usableWidth;
    const y = PADDING_Y + usableHeight - ((v - min) / range) * usableHeight;
    return { x, y, value: v };
  });

  let line = `M ${points[0].x} ${points[0].y}`;
  for (let i = 1; i < points.length; i++) {
    line += ` L ${points[i].x} ${points[i].y}`;
  }

  return { line, first: points[0], last: points[points.length - 1] };
}

// spy_return_pct is a daily 1-day return, null on days the quote was
// unavailable. Compounds forward into a cumulative curve, holding flat
// (not projecting) across null gaps — matches the backend's own
// never-interpolate stance on this endpoint.
function buildCumulativeSpy(points) {
  let cumProduct = 1;
  return points.map((p) => {
    if (p.spyReturnPct != null) {
      cumProduct *= 1 + p.spyReturnPct / 100;
    }
    return (cumProduct - 1) * 100;
  });
}

export default function AccuracyTrendChart({ points = [], horizon }) {
  const chart = useMemo(() => {
    if (!points || points.length < 2) return null;

    const winRateValues = points.map((p) => p.pctPositive);
    const cumulativeSpyValues = buildCumulativeSpy(points);

    return {
      winRate: buildLine(winRateValues),
      spy: buildLine(cumulativeSpyValues),
      firstDate: points[0].date,
      lastDate: points[points.length - 1].date,
    };
  }, [points]);

  if (!chart) {
    return (
      <View style={styles.emptyWrap}>
        <Text style={styles.emptyText}>Not enough trend history yet</Text>
      </View>
    );
  }

  return (
    <View>
      <View style={styles.legendRow}>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: BRAND.accent }]} />
          <Text style={styles.legendLabel}>
            Win Rate{horizon ? ` (${horizon})` : ""}: {chart.winRate.first.value.toFixed(1)}%
            {" → "}
            {chart.winRate.last.value.toFixed(1)}%
          </Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: BRAND.blue }]} />
          <Text style={styles.legendLabel}>
            S&P 500 (cumulative): {chart.spy.first.value >= 0 ? "+" : ""}
            {chart.spy.first.value.toFixed(2)}%{" → "}
            {chart.spy.last.value >= 0 ? "+" : ""}
            {chart.spy.last.value.toFixed(2)}%
          </Text>
        </View>
      </View>

      <Svg width="100%" height={HEIGHT} viewBox={`0 0 ${WIDTH} ${HEIGHT}`}>
        <Path
          d={chart.spy.line}
          stroke={BRAND.blue}
          strokeWidth={2}
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <Path
          d={chart.winRate.line}
          stroke={BRAND.accent}
          strokeWidth={2}
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        <Circle cx={chart.spy.last.x} cy={chart.spy.last.y} r={3} fill={BRAND.blue} />
        <Circle
          cx={chart.winRate.last.x}
          cy={chart.winRate.last.y}
          r={3}
          fill={BRAND.accent}
        />
      </Svg>

      <View style={styles.labelRow}>
        <Text style={styles.labelDate}>{formatShortDate(chart.firstDate)}</Text>
        <Text style={styles.labelDate}>{formatShortDate(chart.lastDate)}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  emptyWrap: {
    height: 80,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.04)",
    alignItems: "center",
    justifyContent: "center",
  },

  emptyText: {
    color: BRAND.muted,
    fontSize: 11.5,
    fontFamily: TYPO.fontFamily.medium,
  },

  legendRow: {
    marginBottom: 8,
    gap: 4,
  },

  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },

  legendDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },

  legendLabel: {
    color: BRAND.sub,
    fontSize: 11,
    fontFamily: TYPO.fontFamily.medium,
    fontVariant: ["tabular-nums"],
  },

  labelRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 6,
  },

  labelDate: {
    color: BRAND.muted,
    fontSize: 10,
    fontFamily: TYPO.fontFamily.medium,
  },
});
