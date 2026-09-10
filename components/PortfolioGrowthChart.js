// components/PortfolioGrowthChart.js
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

function fmtDollar(v) {
  return `$${v.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

// Both series are the same unit (dollars, both anchored near $1,000),
// unlike AccuracyTrendChart's win-rate-% vs cumulative-return-% pair —
// so they share ONE min/max scale here rather than each being
// independently normalized. Independent normalization would stretch
// each line to fill the full height regardless of the other, erasing
// the actual dollar gap between the two portfolios, which is the
// entire point of this chart.
function buildLines(values, spyValues) {
  const all = [...values, ...spyValues];
  const min = Math.min(...all);
  const max = Math.max(...all);
  const range = max - min || 1;
  const usableWidth = WIDTH - PADDING_X * 2;
  const usableHeight = HEIGHT - PADDING_Y * 2;

  function toPoints(vals) {
    return vals.map((v, i) => {
      const x = PADDING_X + (i / (vals.length - 1)) * usableWidth;
      const y = PADDING_Y + usableHeight - ((v - min) / range) * usableHeight;
      return { x, y, value: v };
    });
  }

  function toLine(points) {
    let line = `M ${points[0].x} ${points[0].y}`;
    for (let i = 1; i < points.length; i++) {
      line += ` L ${points[i].x} ${points[i].y}`;
    }
    return line;
  }

  const picksPoints = toPoints(values);
  const spyPoints = toPoints(spyValues);

  return {
    picks: {
      line: toLine(picksPoints),
      first: picksPoints[0],
      last: picksPoints[picksPoints.length - 1],
    },
    spy: {
      line: toLine(spyPoints),
      first: spyPoints[0],
      last: spyPoints[spyPoints.length - 1],
    },
  };
}

export default function PortfolioGrowthChart({ points = [] }) {
  const chart = useMemo(() => {
    if (!points || points.length < 2) return null;

    const picksValues = points.map((p) => p.hypotheticalValue);
    const spyValues = points.map((p) => p.spyHypotheticalValue);
    const lines = buildLines(picksValues, spyValues);

    return {
      ...lines,
      firstDate: points[0].date,
      lastDate: points[points.length - 1].date,
    };
  }, [points]);

  if (!chart) {
    return (
      <View style={styles.emptyWrap}>
        <Text style={styles.emptyText}>Not enough portfolio history yet</Text>
      </View>
    );
  }

  return (
    <View>
      <View style={styles.legendRow}>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: BRAND.accent }]} />
          <Text style={styles.legendLabel}>
            Alphaclara Picks: {fmtDollar(chart.picks.first.value)}
            {" → "}
            {fmtDollar(chart.picks.last.value)}
          </Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: BRAND.blue }]} />
          <Text style={styles.legendLabel}>
            S&P 500: {fmtDollar(chart.spy.first.value)}
            {" → "}
            {fmtDollar(chart.spy.last.value)}
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
          d={chart.picks.line}
          stroke={BRAND.accent}
          strokeWidth={2}
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        <Circle cx={chart.spy.last.x} cy={chart.spy.last.y} r={3} fill={BRAND.blue} />
        <Circle
          cx={chart.picks.last.x}
          cy={chart.picks.last.y}
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
