// components/PickPriceHistoryChart.js
import React, { useMemo } from "react";
import { View, Text, StyleSheet } from "react-native";
import Svg, { Path, Circle, Defs, LinearGradient, Stop } from "react-native-svg";
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

export default function PickPriceHistoryChart({ priceHistory = [], isChecked }) {
  const chart = useMemo(() => {
    if (!priceHistory || priceHistory.length < 2) return null;

    const closes = priceHistory.map((p) => p.close);
    const min = Math.min(...closes);
    const max = Math.max(...closes);
    const range = max - min || 1;

    const usableWidth = WIDTH - PADDING_X * 2;
    const usableHeight = HEIGHT - PADDING_Y * 2;

    const points = priceHistory.map((p, i) => {
      const x = PADDING_X + (i / (priceHistory.length - 1)) * usableWidth;
      const y =
        PADDING_Y + usableHeight - ((p.close - min) / range) * usableHeight;
      return { x, y, date: p.date, close: p.close };
    });

    // Straight line segments only — no smoothing. This is a real, sparse
    // multi-point series (daily closes, weekends/holidays skipped), and
    // a smoothed curve would visually imply data between points that
    // was never fetched or observed.
    let line = `M ${points[0].x} ${points[0].y}`;
    for (let i = 1; i < points.length; i++) {
      line += ` L ${points[i].x} ${points[i].y}`;
    }
    const area = `${line} L ${points[points.length - 1].x} ${HEIGHT} L ${points[0].x} ${HEIGHT} Z`;

    const isUp = closes[closes.length - 1] >= closes[0];
    const color = isUp ? BRAND.accent : BRAND.red;

    return {
      line,
      area,
      color,
      first: points[0],
      last: points[points.length - 1],
    };
  }, [priceHistory]);

  if (!chart) {
    return (
      <View style={styles.emptyWrap}>
        <Text style={styles.emptyText}>Not enough price history yet</Text>
      </View>
    );
  }

  return (
    <View>
      <Svg width="100%" height={HEIGHT} viewBox={`0 0 ${WIDTH} ${HEIGHT}`}>
        <Defs>
          <LinearGradient id="pickHistoryGradient" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0%" stopColor={chart.color} stopOpacity="0.28" />
            <Stop offset="100%" stopColor={chart.color} stopOpacity="0" />
          </LinearGradient>
        </Defs>

        <Path d={chart.area} fill="url(#pickHistoryGradient)" />
        <Path
          d={chart.line}
          stroke={chart.color}
          strokeWidth={2}
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        <Circle
          cx={chart.first.x}
          cy={chart.first.y}
          r={3.5}
          fill={BRAND.bg}
          stroke={chart.color}
          strokeWidth={2}
        />
        <Circle cx={chart.last.x} cy={chart.last.y} r={3.5} fill={chart.color} />
      </Svg>

      <View style={styles.labelRow}>
        <View style={styles.labelBlock}>
          <Text style={styles.labelCaption}>Picked</Text>
          <Text style={styles.labelDate}>{formatShortDate(chart.first.date)}</Text>
          <Text style={styles.labelPrice}>${chart.first.close.toFixed(2)}</Text>
        </View>

        <View style={[styles.labelBlock, styles.labelBlockEnd]}>
          <Text style={styles.labelCaption}>{isChecked ? "Checked" : "Now"}</Text>
          <Text style={styles.labelDate}>
            {isChecked ? formatShortDate(chart.last.date) : "Today"}
          </Text>
          <Text style={styles.labelPrice}>${chart.last.close.toFixed(2)}</Text>
        </View>
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

  labelRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 6,
  },

  labelBlock: {
    alignItems: "flex-start",
  },

  labelBlockEnd: {
    alignItems: "flex-end",
  },

  labelCaption: {
    color: BRAND.muted,
    fontSize: 9.5,
    fontFamily: TYPO.fontFamily.bold,
    textTransform: "uppercase",
    letterSpacing: 0.3,
  },

  labelDate: {
    color: BRAND.sub,
    fontSize: 10.5,
    fontFamily: TYPO.fontFamily.medium,
    marginTop: 2,
  },

  labelPrice: {
    color: BRAND.text,
    fontSize: 12.5,
    fontFamily: TYPO.fontFamily.bold,
    fontVariant: ["tabular-nums"],
  },
});
