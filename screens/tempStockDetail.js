import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Svg, Path, Rect, Circle } from "react-native-svg";
import * as Haptics from "expo-haptics";

import { getStockDetailUI } from "../services/stockDetailService";

/* ================= THEME (UNCHANGED) ================= */
const BRAND = {
  bg: "#000000",
  card: "#0B1220",
  border: "#1F2937",
  text: "#FFFFFF",
  sub: "#9CA3AF",
  accent: "#22C55E",
  red: "#EF4444",
  amber: "#FACC15",
};

/* ================= HELPERS ================= */
const timeAgo = (ts) => {
  if (!ts) return "";
  const m = Math.floor((Date.now() - new Date(ts)) / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
};

const signalColor = (s) => {
  if (!s) return BRAND.amber;
  s = s.toUpperCase();
  if (s.includes("BUY")) return BRAND.accent;
  if (s.includes("SELL")) return BRAND.red;
  return BRAND.amber;
};

/* ================= MINI SPARKLINE ================= */
const Sparkline = ({ path, direction }) => {
  if (!path)
    return (
      <Text style={{ color: BRAND.sub, fontSize: 12 }}>
        Price trend unavailable
      </Text>
    );

  return (
    <Svg height={42} width="100%">
      <Path
        d={path}
        stroke={
          direction === "up"
            ? BRAND.accent
            : direction === "down"
            ? BRAND.red
            : BRAND.amber
        }
        strokeWidth={2}
        fill="none"
      />
    </Svg>
  );
};

/* ================= PROBABILITY RANGE BAR ================= */
const RangeBar = ({ label, low, high, anchor }) => {
  if (!low || !high || !anchor) return null;

  const min = low;
  const max = high;
  const pos = ((anchor - min) / (max - min)) * 100;

  return (
    <View style={{ marginTop: 10 }}>
      <Text style={styles.metaLabel}>{label}</Text>
      <Svg height={14} width="100%">
        <Rect
          x="0"
          y="4"
          width="100%"
          height="6"
          rx="3"
          fill="#1F2937"
        />
        <Rect
          x="0"
          y="4"
          width="100%"
          height="6"
          rx="3"
          fill="url(#grad)"
        />
        <Circle
          cx={`${pos}%`}
          cy="7"
          r="6"
          fill={BRAND.text}
        />
      </Svg>
      <View style={styles.rangeRow}>
        <Text style={styles.rangeText}>${low.toFixed(2)}</Text>
        <Text style={styles.rangeText}>${high.toFixed(2)}</Text>
      </View>
    </View>
  );
};

/* ================= SCREEN ================= */
export default function StockDetailScreen({ route }) {
  const { symbol } = route.params;
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await getStockDetailUI(symbol);
    setData(res);
    setLoading(false);
  }, [symbol]);

  useEffect(() => {
    load();
  }, [load]);

  const onRefresh = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  if (loading || !data) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={BRAND.accent} />
      </View>
    );
  }

  const {
    quote,
    sparkline,
    hybridSignal,
    hybridScore,
    hybridProbUp,
    riskLevel,
    hybridNarrative,
    technical,
    smartPattern,
    probabilityCone,
    news,
    freshness,
  } = data;

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={BRAND.accent}
        />
      }
    >
      {/* ================= HEADER ================= */}
      <LinearGradient
        colors={["#0B1220", "#020617"]}
        style={styles.card}
      >
        <Text style={styles.symbol}>{quote.symbol}</Text>
        <Text style={styles.company}>{quote.name}</Text>

        <View style={styles.priceRow}>
          <Text style={styles.price}>
            {quote.current ? `$${quote.current.toFixed(2)}` : "—"}
          </Text>
          <Text
            style={[
              styles.change,
              { color: quote.changePct >= 0 ? BRAND.accent : BRAND.red },
            ]}
          >
            {quote.changePct
              ? `${quote.changePct >= 0 ? "▲" : "▼"} ${Math.abs(
                  quote.changePct
                ).toFixed(2)}%`
              : ""}
          </Text>
        </View>

        <Sparkline
          path={sparkline.path}
          direction={sparkline.direction}
        />

        <Text style={styles.meta}>
          {freshness?.label} • Updated {timeAgo(quote.updatedAt)}
        </Text>
      </LinearGradient>

      {/* ================= AI HYBRID SIGNAL ================= */}
      <View style={styles.card}>
        <Text style={styles.section}>AI Hybrid Signal</Text>

        <View style={styles.signalRow}>
          <View
            style={[
              styles.signalPill,
              { backgroundColor: signalColor(hybridSignal) },
            ]}
          >
            <Text style={styles.signalText}>{hybridSignal}</Text>
          </View>
          <Text style={styles.signalExplain}>
            {hybridNarrative ||
              "This signal blends price trends, momentum, and trading activity into a single easy-to-read view."}
          </Text>
        </View>

        <View style={styles.kpiRow}>
          <View>
            <Text style={styles.kpiLabel}>Confidence</Text>
            <Text style={styles.kpiValue}>
              {hybridScore ? `${hybridScore.toFixed(1)}%` : "—"}
            </Text>
          </View>
          <View>
            <Text style={styles.kpiLabel}>Chance of Upside</Text>
            <Text style={styles.kpiValue}>
              {hybridProbUp ? `${(hybridProbUp * 100).toFixed(1)}%` : "—"}
            </Text>
          </View>
          <View>
            <Text style={styles.kpiLabel}>Risk</Text>
            <Text style={styles.kpiValue}>{riskLevel}</Text>
          </View>
        </View>
      </View>

      {/* ================= EXPECTED RANGE ================= */}
      {probabilityCone && (
        <View style={styles.card}>
          <Text style={styles.section}>Expected Price Range</Text>
          <Text style={styles.body}>
            Based on how this stock behaved during similar historical patterns.
            This is not a prediction.
          </Text>

          <RangeBar
            label="Next ~5 trading days"
            low={probabilityCone.ranges.days5.low}
            high={probabilityCone.ranges.days5.high}
            anchor={probabilityCone.anchorPrice}
          />

          <RangeBar
            label="Next ~10 trading days"
            low={probabilityCone.ranges.days10.low}
            high={probabilityCone.ranges.days10.high}
            anchor={probabilityCone.anchorPrice}
          />
        </View>
      )}

      {/* ================= SMART PATTERN (HERO) ================= */}
      {smartPattern && (
        <View style={[styles.card, styles.patternCard]}>
          <Text style={styles.section}>Smart Pattern Detection</Text>

          <Text style={styles.patternTitle}>
            {smartPattern.pattern}
          </Text>

          <Text style={styles.body}>
            This pattern has appeared{" "}
            <Text style={styles.bold}>
              {smartPattern.history?.occurrences || 0}
            </Text>{" "}
            times in the past. When it occurred, prices tended to behave in
            similar ways, making this insight historically meaningful.
          </Text>

          <View style={styles.kpiRow}>
            <View>
              <Text style={styles.kpiLabel}>Win Rate</Text>
              <Text style={styles.kpiValue}>
                {smartPattern.confidencePct
                  ? `${smartPattern.confidencePct}%`
                  : "—"}
              </Text>
            </View>
            <View>
              <Text style={styles.kpiLabel}>Bias</Text>
              <Text style={styles.kpiValue}>
                {smartPattern.current?.bias || "Neutral"}
              </Text>
            </View>
          </View>

          <Text style={styles.body}>
            Recent examples show that prices often moved modestly before choosing
            a clearer direction.
          </Text>
        </View>
      )}

      {/* ================= TECHNICAL SNAPSHOT ================= */}
      <View style={styles.card}>
        <Text style={styles.section}>Technical Snapshot</Text>

        <Text style={styles.body}>
          • Trend: {technical?.trend?.summary || "Direction is currently mixed."}
        </Text>
        <Text style={styles.body}>
          • Momentum:{" "}
          {technical?.momentum?.summary_rsi ||
            "Buying and selling pressure are balanced."}
        </Text>
        <Text style={styles.body}>
          • Volatility:{" "}
          {technical?.volatility?.summary ||
            "Price swings are within normal range."}
        </Text>
        <Text style={styles.body}>
          • Volume:{" "}
          {technical?.volume?.summary ||
            "Trading activity is close to recent averages."}
        </Text>
      </View>

      {/* ================= NEWS ================= */}
      {news?.length > 0 && (
        <View style={styles.card}>
          <Text style={styles.section}>News & Market Sentiment</Text>
          {news.slice(0, 4).map((n, i) => (
            <View key={i} style={{ marginBottom: 8 }}>
              <Text style={styles.bold}>{n.title}</Text>
              <Text style={styles.meta}>
                {n.source} • {timeAgo(n.pubDate * 1000)}
              </Text>
            </View>
          ))}
        </View>
      )}

      <Text style={styles.footer}>Powered by BullSignalsAI</Text>
    </ScrollView>
  );
}

/* ================= STYLES ================= */
const styles = StyleSheet.create({
  container: { backgroundColor: BRAND.bg, padding: 14 },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },

  card: {
    backgroundColor: BRAND.card,
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: BRAND.border,
  },

  patternCard: {
    borderColor: BRAND.accent,
  },

  symbol: { fontSize: 26, fontWeight: "800", color: BRAND.text },
  company: { color: BRAND.sub, marginBottom: 6 },

  priceRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "baseline",
  },
  price: { fontSize: 22, fontWeight: "700", color: BRAND.text },
  change: { fontSize: 14, fontWeight: "600" },

  section: {
    color: BRAND.accent,
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 6,
  },

  signalRow: { marginTop: 6 },
  signalPill: {
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    marginBottom: 6,
  },
  signalText: { color: "#000", fontWeight: "800" },
  signalExplain: { color: BRAND.text, lineHeight: 20 },

  kpiRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 10,
  },
  kpiLabel: { color: BRAND.sub, fontSize: 12 },
  kpiValue: { color: BRAND.text, fontWeight: "600" },

  patternTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: BRAND.text,
    marginVertical: 6,
  },

  body: {
    color: BRAND.text,
    fontSize: 14,
    lineHeight: 20,
    marginTop: 4,
  },

  bold: { fontWeight: "700", color: BRAND.text },

  meta: { color: BRAND.sub, fontSize: 12, marginTop: 6 },

  metaLabel: { color: BRAND.sub, fontSize: 12, marginTop: 6 },
  rangeRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  rangeText: { color: BRAND.sub, fontSize: 11 },

  footer: {
    textAlign: "center",
    color: BRAND.sub,
    fontSize: 11,
    marginVertical: 20,
  },
});
