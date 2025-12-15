// screens/FullChartScreen.js
import React, { useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Dimensions,
  TouchableOpacity,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Svg, Polyline, Defs, LinearGradient, Stop, Rect } from "react-native-svg";
import { useNavigation, useRoute } from "@react-navigation/native";

// === Brand palette (same as other screens) ===
const BRAND = {
  bg: "#000000",
  card: "#111827",
  border: "#1F2937",
  text: "#FFFFFF",
  sub: "#9CA3AF",
  accent: "#00E396",
  red: "#EF4444",
  amber: "#FACC15",
};

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const CHART_HORIZONTAL_PADDING = 24;
const CHART_WIDTH = SCREEN_WIDTH - CHART_HORIZONTAL_PADDING * 2;
const CHART_HEIGHT = 220;

// --- Helpers ---
function formatNumberShort(n) {
  if (n === null || n === undefined || isNaN(n)) return "N/A";
  if (n >= 1e12) return (n / 1e12).toFixed(2).replace(/\.0+$/, "") + "T";
  if (n >= 1e9) return (n / 1e9).toFixed(2).replace(/\.0+$/, "") + "B";
  if (n >= 1e6) return (n / 1e6).toFixed(2).replace(/\.0+$/, "") + "M";
  if (n >= 1e3) return (n / 1e3).toFixed(2).replace(/\.0+$/, "") + "K";
  return n.toString();
}

function formatPct(v) {
  if (v === null || v === undefined || isNaN(v)) return "—";
  const sign = v > 0 ? "+" : "";
  return `${sign}${v.toFixed(2)}%`;
}

function formatDateLabel(isoString) {
  if (!isoString) return "";
  try {
    const d = new Date(isoString);
    return d.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
    });
  } catch {
    return "";
  }
}

// Map BullBrain / Hybrid signal to pill color
function resolveSignal(signalRaw) {
  const s = (signalRaw || "HOLD").toUpperCase();
  if (s.includes("STRONG BUY")) return { label: "STRONG BUY", color: BRAND.accent };
  if (s.includes("BUY")) return { label: "BUY", color: BRAND.accent };
  if (s.includes("STRONG SELL")) return { label: "STRONG SELL", color: BRAND.red };
  if (s.includes("SELL")) return { label: "SELL", color: BRAND.red };
  if (s.includes("HOLD") || s.includes("NEUTRAL"))
    return { label: "HOLD", color: BRAND.amber };
  return { label: s, color: BRAND.amber };
}

// --- Build polyline points from candle closes ---
function buildChartPoints(candlesSlice) {
  if (!candlesSlice || candlesSlice.length === 0) return "";
  const closes = candlesSlice.map((c) => c.close).filter((v) => v != null);

  if (!closes.length) return "";

  const min = Math.min(...closes);
  const max = Math.max(...closes);
  const span = max - min || 1;

  const n = closes.length;
  return closes
    .map((price, idx) => {
      const x = (idx / (n - 1 || 1)) * CHART_WIDTH;
      const y = CHART_HEIGHT - ((price - min) / span) * CHART_HEIGHT;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
}

// --- Slice candles by range (just by count; they are already sorted) ---
function sliceByRange(candles, range) {
  if (!candles || candles.length === 0) return [];
  const n = candles.length;

  const rangeMap = {
    "1D": 1,
    "5D": 5,
    "1M": 22,
    "6M": 120,
    "1Y": 252,
    MAX: n,
  };

  const count = rangeMap[range] || n;
  const startIndex = Math.max(0, n - count);
  return candles.slice(startIndex);
}

// Infer regime / risk labels from technical snapshot
function deriveRegime(technical, features) {
  const trendText = technical?.trend?.summary || "";
  const volText = technical?.volatility?.summary || "";
  const vol20 = technical?.volatility?.volatility_20d ?? features?.volatility_20d;
  const intraday = features?.intraday_range_pct ?? technical?.candle?.intraday_range_pct;

  let regime = "Neutral";
  const t = trendText.toLowerCase();
  if (t.includes("down")) regime = "Bearish";
  else if (t.includes("up") || t.includes("uptrend")) regime = "Bullish";

  let volZone = "Normal";
  const v = volText.toLowerCase();
  if (v.includes("elevated") || v.includes("high")) volZone = "High";
  if (v.includes("low")) volZone = "Low";

  let heat = "Warm";
  if (volZone === "High") heat = "Hot";
  else if (volZone === "Low") heat = "Cool";

  const expectedMove =
    typeof vol20 === "number"
      ? Math.max(Math.min(vol20, 40), 0) // clamp 0–40% just for display
      : null;

  let risk = "Moderate";
  if (volZone === "High" || (intraday && intraday > 5)) risk = "High";
  if (volZone === "Low") risk = "Low";

  return { regime, volZone, heat, expectedMove, risk };
}

export default function FullChartScreen() {
  const navigation = useNavigation();
  const route = useRoute();

  // ✅ avoid features = null crash by handling params first
  const params = route.params || {};

  const {
    symbol = "TSLA",
    name,
    candles: rawCandles = [],
    quote = null,
    technical = null,
    bullbrain = null,
    hybridProbUp = null,
    hybridSignal = null,
    hybridScore = null,
    news = [],
    grok = null,
  } = params;

  const features = params.features || {};

  const candles = Array.isArray(rawCandles) ? rawCandles : rawCandles.candles || [];

  // Timeframe
  const [range, setRange] = useState("6M");

  const slicedCandles = useMemo(
    () => sliceByRange(candles, range),
    [candles, range]
  );

  const chartPoints = useMemo(
    () => buildChartPoints(slicedCandles),
    [slicedCandles]
  );

  const lastCandle = candles.length ? candles[candles.length - 1] : null;
  const prevCandle = candles.length > 1 ? candles[candles.length - 2] : null;

  const lastClose =
    quote?.current ??
    features?.close ??
    (lastCandle ? lastCandle.close : null);

  const dayChange =
    quote?.change ??
    (lastCandle && prevCandle ? lastCandle.close - prevCandle.close : null);

  const dayChangePct =
    quote?.changePct ??
    (lastCandle && prevCandle && prevCandle.close
      ? ((lastCandle.close - prevCandle.close) / prevCandle.close) * 100
      : null);

  // 52w range from all candles
  const allHighs = candles.map((c) => c.high).filter((v) => v != null);
  const allLows = candles.map((c) => c.low).filter((v) => v != null);
  const high52 = allHighs.length ? Math.max(...allHighs) : null;
  const low52 = allLows.length ? Math.min(...allLows) : null;

  // Avg volume (30 most recent candles)
  const volSlice = candles.slice(-30).map((c) => c.volume).filter((v) => v != null);
  const avgVol30 =
    volSlice.length > 0
      ? volSlice.reduce((sum, v) => sum + v, 0) / volSlice.length
      : null;

  const intradayRangePct =
    typeof features?.intraday_range_pct === "number"
      ? features.intraday_range_pct
      : lastCandle && lastCandle.low && lastCandle.high
      ? ((lastCandle.high - lastCandle.low) / lastCandle.low) * 100
      : null;

  // Returns from features if present (already % from backend)
  const return1d =
    typeof features?.return_1d === "number" ? features.return_1d : null;
  const return5d =
    typeof features?.return_5d === "number" ? features.return_5d : null;
  const return10d =
    typeof features?.return_10d === "number" ? features.return_10d : null;

  // AI & Hybrid
  const hybridUpsidePct =
    hybridProbUp != null
      ? hybridProbUp * 100
      : bullbrain?.probabilities?.BUY
      ? bullbrain.probabilities.BUY * 100
      : null;

  const bbSignal = bullbrain?.signal || hybridSignal || "HOLD";
  const { label: signalLabel, color: signalColor } = resolveSignal(bbSignal);

  const bbConfidence = bullbrain?.confidence ?? null;
  const probBuy = bullbrain?.probabilities?.BUY ?? null;
  const probHold = bullbrain?.probabilities?.HOLD ?? null;
  const probSell = bullbrain?.probabilities?.SELL ?? null;

  const trendSummary = technical?.trend?.summary || "No clear trend";
  const momentumSummary =
    technical?.momentum?.summary_rsi ||
    technical?.momentum?.summary_macd ||
    null;
  const volatilitySummary = technical?.volatility?.summary || null;
  const volumeSummary = technical?.volume?.summary || null;
  const rsiValue =
    typeof technical?.momentum?.rsi14 === "number"
      ? technical.momentum.rsi14
      : typeof features?.rsi14 === "number"
      ? features.rsi14
      : null;

  const priceActionSummary = useMemo(() => {
    if (!technical?.candle) return null;
    const bodyPct = technical.candle.body_pct;
    const rangePct = technical.candle.intraday_range_pct;

    if (rangePct > 5 && Math.abs(bodyPct) < 1.5) {
      return "Wide intraday swings with indecision candle.";
    }
    if (bodyPct > 2) {
      return "Strong bullish candle with solid body.";
    }
    if (bodyPct < -2) {
      return "Strong bearish candle with solid body.";
    }
    return "Balanced price action with typical daily range.";
  }, [technical]);

  const riskNote =
    grok?.risk_note ||
    "Stock prices are volatile and past performance does not guarantee future results. Always manage position size and risk.";

  // Market regime derived values
  const { regime, volZone, heat, expectedMove, risk } = deriveRegime(
    technical,
    features
  );

  // First & last date labels for the active range
  const startLabel = slicedCandles.length
    ? formatDateLabel(slicedCandles[0].t)
    : "";
  const endLabel = slicedCandles.length
    ? formatDateLabel(slicedCandles[slicedCandles.length - 1].t)
    : "";

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingBottom: 40 }}
    >
      {/* Header */}
      <View style={styles.headerRow}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backButton}
        >
          <Ionicons name="chevron-back" size={22} color={BRAND.text} />
        </TouchableOpacity>

        <View style={{ flex: 1 }}>
          <Text style={styles.headerSymbol}>{symbol}</Text>
          <Text style={styles.headerName}>
            {name || "Full chart & AI analysis"}
          </Text>
        </View>

        {lastClose != null && (
          <View style={styles.headerPriceBlock}>
            <Text style={styles.headerPrice}>${lastClose.toFixed(2)}</Text>
            {dayChangePct != null && (
              <Text
                style={[
                  styles.headerChange,
                  dayChangePct >= 0 ? styles.positive : styles.negative,
                ]}
              >
                {dayChangePct >= 0 ? "▲ " : "▼ "}
                {dayChangePct.toFixed(2)}%
              </Text>
            )}
          </View>
        )}
      </View>

      {/* AI Signal Summary */}
      <View style={styles.card}>
        <View style={styles.sectionHeaderRow}>
          <View style={styles.sectionAccent} />
          <Text style={styles.cardTitle}>AI Hybrid Signal</Text>
        </View>

        <View style={styles.aiRow}>
          <View style={styles.aiLeft}>
            <View style={[styles.signalPill, { backgroundColor: signalColor }]}>
              <Text style={styles.signalPillText}>{signalLabel}</Text>
            </View>
            <Text style={styles.aiSubtitle}>
              Blended view from BullBrain model v2.
            </Text>
          </View>

          <View style={styles.aiRight}>
            {bbConfidence != null && (
              <Text style={styles.aiMetric}>
                Confidence{" "}
                <Text style={styles.aiMetricValue}>
                  {bbConfidence.toFixed(1)}%
                </Text>
              </Text>
            )}

            {hybridUpsidePct != null && (
              <Text style={styles.aiMetric}>
                Upside odds{" "}
                <Text style={styles.aiMetricValue}>
                  {hybridUpsidePct.toFixed(1)}%
                </Text>
              </Text>
            )}

            {hybridScore != null && (
              <Text style={styles.aiMetric}>
                Hybrid score{" "}
                <Text style={styles.aiMetricValue}>
                  {hybridScore.toFixed(1)}/100
                </Text>
              </Text>
            )}
          </View>
        </View>

        {(probBuy != null || probHold != null || probSell != null) && (
          <View style={styles.aiProbRow}>
            <View style={styles.aiProbCol}>
              <Text style={styles.aiProbLabel}>BUY</Text>
              <Text style={styles.aiProbValue}>
                {probBuy != null ? (probBuy * 100).toFixed(1) + "%" : "—"}
              </Text>
            </View>
            <View style={styles.aiProbCol}>
              <Text style={styles.aiProbLabel}>HOLD</Text>
              <Text style={styles.aiProbValue}>
                {probHold != null ? (probHold * 100).toFixed(1) + "%" : "—"}
              </Text>
            </View>
            <View style={styles.aiProbCol}>
              <Text style={styles.aiProbLabel}>SELL</Text>
              <Text style={styles.aiProbValue}>
                {probSell != null ? (probSell * 100).toFixed(1) + "%" : "—"}
              </Text>
            </View>
          </View>
        )}
      </View>

      {/* Chart Card */}
      <View style={styles.card}>
        <View style={styles.sectionHeaderRow}>
          <View style={styles.sectionAccent} />
          <Text style={styles.cardTitle}>Price Chart</Text>
          <View style={{ flex: 1 }} />
          {startLabel && endLabel && (
            <Text style={styles.dateRangeLabel}>
              {startLabel} – {endLabel}
            </Text>
          )}
        </View>

        {/* Timeframe tabs */}
        <View style={styles.rangeTabsRow}>
          {["1D", "5D", "1M", "6M", "1Y", "MAX"].map((r) => (
            <TouchableOpacity
              key={r}
              onPress={() => setRange(r)}
              style={[
                styles.rangeTab,
                range === r && styles.rangeTabActive,
              ]}
            >
              <Text
                style={[
                  styles.rangeTabText,
                  range === r && styles.rangeTabTextActive,
                ]}
              >
                {r}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Chart */}
        <View style={styles.chartWrapper}>
          <Svg width={CHART_WIDTH} height={CHART_HEIGHT}>
            {/* Background */}
            <Defs>
              <LinearGradient
                id="bgGradient"
                x1="0"
                y1="0"
                x2="0"
                y2={CHART_HEIGHT}
              >
                <Stop offset="0" stopColor="#111827" stopOpacity="1" />
                <Stop offset="1" stopColor="#020617" stopOpacity="1" />
              </LinearGradient>

              <LinearGradient
                id="lineGradient"
                x1="0"
                y1="0"
                x2="1"
                y2="0"
              >
                <Stop offset="0" stopColor="#00E396" stopOpacity="1" />
                <Stop offset="1" stopColor="#22C55E" stopOpacity="1" />
              </LinearGradient>
            </Defs>

            <Rect
              x="0"
              y="0"
              width={CHART_WIDTH}
              height={CHART_HEIGHT}
              fill="url(#bgGradient)"
              rx="12"
              ry="12"
            />

            {chartPoints ? (
              <Polyline
                points={chartPoints}
                fill="none"
                stroke="url(#lineGradient)"
                strokeWidth={2}
              />
            ) : null}
          </Svg>
        </View>
      </View>

      {/* Technical Snapshot */}
      <View style={styles.card}>
        <View style={styles.sectionHeaderRow}>
          <View style={styles.sectionAccent} />
          <Text style={styles.cardTitle}>Technical Snapshot</Text>
        </View>

        {/* Quick numbers row */}
        <View style={styles.statsRow}>
          <View style={styles.statsCol}>
            <Text style={styles.statsLabel}>52W High</Text>
            <Text style={styles.statsValue}>
              {high52 != null ? `$${high52.toFixed(2)}` : "—"}
            </Text>
          </View>
          <View style={styles.statsCol}>
            <Text style={styles.statsLabel}>52W Low</Text>
            <Text style={styles.statsValue}>
              {low52 != null ? `$${low52.toFixed(2)}` : "—"}
            </Text>
          </View>
        </View>

        <View style={styles.statsRow}>
          <View style={styles.statsCol}>
            <Text style={styles.statsLabel}>Avg Vol (30d)</Text>
            <Text style={styles.statsValue}>
              {avgVol30 != null ? formatNumberShort(avgVol30) : "—"}
            </Text>
          </View>
          <View style={styles.statsCol}>
            <Text style={styles.statsLabel}>Day Range</Text>
            <Text style={styles.statsValue}>
              {lastCandle?.low != null && lastCandle?.high != null
                ? `$${lastCandle.low.toFixed(2)} – $${lastCandle.high.toFixed(
                    2
                  )}`
                : "—"}
            </Text>
          </View>
        </View>

        <View style={styles.statsRow}>
          <View style={styles.statsCol}>
            <Text style={styles.statsLabel}>Intraday Range</Text>
            <Text style={styles.statsValue}>
              {intradayRangePct != null
                ? intradayRangePct.toFixed(1) + "%"
                : "—"}
            </Text>
          </View>
          <View style={styles.statsCol}>
            <Text style={styles.statsLabel}>Today Change</Text>
            <Text
              style={[
                styles.statsValue,
                dayChangePct >= 0 ? styles.positive : styles.negative,
              ]}
            >
              {dayChange != null ? `$${dayChange.toFixed(2)} ` : ""}
              {dayChangePct != null ? `(${dayChangePct.toFixed(2)}%)` : ""}
            </Text>
          </View>
        </View>

        {/* Current conditions header */}
        <View style={styles.currentHeaderRow}>
          <Text style={styles.currentHeaderText}>Current Conditions</Text>
        </View>

        {/* Compact 3x2 grid */}
        <View style={styles.conditionsGrid}>
          <ConditionPill
            label="Trend"
            icon="trending-down-outline"
            value={trendSummary}
            tone="trend"
          />
          <ConditionPill
            label="Momentum"
            icon="pulse-outline"
            value={momentumSummary || "Neutral momentum"}
            tone="momentum"
          />
          <ConditionPill
            label="Volatility"
            icon="stats-chart-outline"
            value={volatilitySummary || "Normal volatility"}
            tone="vol"
          />
          <ConditionPill
            label="Volume"
            icon="bar-chart-outline"
            value={volumeSummary || "Normal volume"}
            tone="volume"
          />
          <ConditionPill
            label="RSI (14)"
            icon="speedometer-outline"
            value={
              rsiValue != null
                ? `${rsiValue.toFixed(1)}${
                    rsiValue < 30
                      ? " (Oversold)"
                      : rsiValue > 70
                      ? " (Overbought)"
                      : " (Neutral)"
                  }`
                : "N/A"
            }
            tone="rsi"
          />
          <ConditionPill
            label="Price Action"
            icon="swap-vertical-outline"
            value={priceActionSummary || "Typical daily candle"}
            tone="price"
          />
        </View>
      </View>

      {/* Returns Card */}
      <View style={styles.card}>
        <View style={styles.sectionHeaderRow}>
          <View style={styles.sectionAccent} />
          <Text style={styles.cardTitle}>Returns Snapshot</Text>
        </View>
        <View style={styles.returnsRow}>
          <ReturnStat label="1D" value={return1d} />
          <ReturnStat label="5D" value={return5d} />
          <ReturnStat label="10D" value={return10d} />
        </View>
        <Text style={styles.returnsNote}>
          Short-term returns are based on recent closing prices and can change
          quickly with market moves.
        </Text>
      </View>

      {/* Market Regime & Volatility Zones */}
      <View style={styles.card}>
        <View style={styles.sectionHeaderRow}>
          <View style={styles.sectionAccent} />
          <Text style={styles.cardTitle}>Market Regime & Volatility Zones</Text>
        </View>

        <View style={styles.regimeRow}>
          <View style={styles.regimeCol}>
            <Text style={styles.regimeLabel}>Regime</Text>
            <Text style={[styles.regimeValue, styles.regimeEmphasis]}>
              {regime}
            </Text>
          </View>
          <View style={styles.regimeCol}>
            <Text style={styles.regimeLabel}>Volatility Zone</Text>
            <Text style={[styles.regimeValue, styles.regimeEmphasis]}>
              {volZone}
            </Text>
          </View>
        </View>

        <View style={styles.regimeRow}>
          <View style={styles.regimeCol}>
            <Text style={styles.regimeLabel}>Heat Level</Text>
            <Text style={styles.regimeValue}>{heat}</Text>
          </View>
          <View style={styles.regimeCol}>
            <Text style={styles.regimeLabel}>Expected Move</Text>
            <Text style={styles.regimeValue}>
              {expectedMove != null ? `±${expectedMove.toFixed(1)}%` : "—"}
            </Text>
          </View>
        </View>

        <View style={styles.regimeRow}>
          <View style={styles.regimeCol}>
            <Text style={styles.regimeLabel}>Risk Level</Text>
            <Text
              style={[
                styles.regimeValue,
                risk === "High"
                  ? styles.negative
                  : risk === "Low"
                  ? styles.positive
                  : null,
              ]}
            >
              {risk}
            </Text>
          </View>
        </View>
      </View>

      {/* Risk Note */}
      <View style={styles.card}>
        <View style={styles.sectionHeaderRow}>
          <View style={styles.sectionAccent} />
          <Text style={styles.cardTitle}>Risk Note</Text>
        </View>
        <Text style={styles.riskText}>{riskNote}</Text>
      </View>

      {/* Footer */}
      <View style={styles.footer}>
        <Text style={styles.footerText}>
          Powered by{" "}
          <Text style={{ color: BRAND.accent, fontWeight: "600" }}>
            BullSignalsAI
          </Text>
        </Text>
      </View>
    </ScrollView>
  );
}

// --- Small subcomponents ---

function ReturnStat({ label, value }) {
  const has = value !== null && value !== undefined && !isNaN(value);
  const pctStr = has ? formatPct(value) : "—";

  let styleExtra = {};
  if (has && value > 0) styleExtra = styles.positive;
  if (has && value < 0) styleExtra = styles.negative;

  return (
    <View style={styles.returnStatBox}>
      <Text style={styles.returnLabel}>{label}</Text>
      <Text style={[styles.returnValue, styleExtra]}>{pctStr}</Text>
    </View>
  );
}

function ConditionPill({ label, icon, value, tone }) {
  const text = value || "—";

  let borderColor = BRAND.border;
  if (tone === "trend" && text.toLowerCase().includes("down"))
    borderColor = BRAND.red;
  if (tone === "trend" && text.toLowerCase().includes("up"))
    borderColor = BRAND.accent;

  if (tone === "vol" && text.toLowerCase().includes("high"))
    borderColor = BRAND.red;
  if (tone === "vol" && text.toLowerCase().includes("low"))
    borderColor = BRAND.accent;

  if (tone === "rsi" && text.toLowerCase().includes("oversold"))
    borderColor = BRAND.accent;
  if (tone === "rsi" && text.toLowerCase().includes("overbought"))
    borderColor = BRAND.red;

  return (
    <View style={[styles.conditionPill, { borderColor }]}>
      <View style={styles.conditionHeader}>
        <Ionicons name={icon} size={13} color={BRAND.sub} style={{ marginRight: 4 }} />
        <Text style={styles.conditionLabel}>{label}</Text>
      </View>
      <Text style={styles.conditionValue} numberOfLines={2}>
        {text}
      </Text>
    </View>
  );
}

// --- Styles ---
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BRAND.bg,
    paddingHorizontal: 16,
    paddingTop: 75,
  },

  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  backButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: BRAND.border,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 8,
  },
  headerSymbol: {
    color: BRAND.text,
    fontSize: 20,
    fontWeight: "800",
  },
  headerName: {
    color: BRAND.sub,
    fontSize: 12,
    marginTop: 2,
  },
  headerPriceBlock: {
    alignItems: "flex-end",
    marginLeft: 8,
  },
  headerPrice: {
    color: BRAND.text,
    fontSize: 18,
    fontWeight: "700",
  },
  headerChange: {
    fontSize: 12,
    marginTop: 2,
    fontWeight: "600",
  },

  card: {
    backgroundColor: BRAND.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: BRAND.border,
    padding: 12,
    marginTop: 10,
  },

  sectionHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 6,
  },
  sectionAccent: {
    width: 4,
    height: 16,
    borderRadius: 2,
    backgroundColor: BRAND.accent,
    marginRight: 8,
  },
  cardTitle: {
    color: BRAND.text,
    fontSize: 15,
    fontWeight: "700",
  },
  dateRangeLabel: {
    color: BRAND.sub,
    fontSize: 11,
  },

  // AI section
  aiRow: {
    flexDirection: "row",
    marginTop: 6,
  },
  aiLeft: {
    flex: 1,
    paddingRight: 6,
  },
  aiRight: {
    flex: 1,
    paddingLeft: 6,
    borderLeftWidth: 1,
    borderLeftColor: BRAND.border,
  },
  signalPill: {
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  signalPillText: {
    color: "#000",
    fontSize: 11,
    fontWeight: "800",
  },
  aiSubtitle: {
    color: BRAND.sub,
    fontSize: 11,
    marginTop: 6,
  },
  aiMetric: {
    color: BRAND.sub,
    fontSize: 11,
    marginBottom: 2,
  },
  aiMetricValue: {
    color: BRAND.text,
    fontWeight: "600",
  },
  aiProbRow: {
    flexDirection: "row",
    marginTop: 8,
    borderTopWidth: 1,
    borderTopColor: BRAND.border,
    paddingTop: 6,
  },
  aiProbCol: {
    flex: 1,
    alignItems: "center",
  },
  aiProbLabel: {
    color: BRAND.sub,
    fontSize: 11,
    marginBottom: 2,
  },
  aiProbValue: {
    color: BRAND.text,
    fontSize: 12,
    fontWeight: "600",
  },

  // Chart
  rangeTabsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 4,
    marginBottom: 10,
  },
  rangeTab: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: BRAND.border,
    marginHorizontal: 2,
  },
  rangeTabActive: {
    backgroundColor: "#020617",
    borderColor: BRAND.accent,
  },
  rangeTabText: {
    fontSize: 11,
    color: BRAND.sub,
  },
  rangeTabTextActive: {
    color: BRAND.accent,
    fontWeight: "600",
  },
  chartWrapper: {
    alignItems: "center",
    justifyContent: "center",
    marginTop: 4,
  },

  // Stats & technical snapshot
  statsRow: {
    flexDirection: "row",
    marginTop: 6,
  },
  statsCol: {
    flex: 1,
  },
  statsLabel: {
    color: BRAND.sub,
    fontSize: 11,
  },
  statsValue: {
    color: BRAND.text,
    fontSize: 13,
    fontWeight: "600",
    marginTop: 2,
  },

  currentHeaderRow: {
    marginTop: 10,
    borderTopWidth: 1,
    borderTopColor: BRAND.border,
    paddingTop: 8,
  },
  currentHeaderText: {
    color: BRAND.sub,
    fontSize: 12,
    fontWeight: "600",
  },

  conditionsGrid: {
    marginTop: 6,
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },
  conditionPill: {
    width: "48%",
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 6,
    marginBottom: 8,
    backgroundColor: "#020617",
  },
  conditionHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 3,
  },
  conditionLabel: {
    color: BRAND.sub,
    fontSize: 11,
    fontWeight: "600",
  },
  conditionValue: {
    color: BRAND.text,
    fontSize: 12,
    lineHeight: 16,
  },

  // Returns
  returnsRow: {
    flexDirection: "row",
    marginTop: 8,
  },
  returnStatBox: {
    flex: 1,
    alignItems: "center",
  },
  returnLabel: {
    color: BRAND.sub,
    fontSize: 11,
    marginBottom: 2,
  },
  returnValue: {
    color: BRAND.text,
    fontSize: 13,
    fontWeight: "600",
  },
  returnsNote: {
    color: BRAND.sub,
    fontSize: 11,
    marginTop: 8,
  },

  // Market Regime
  regimeRow: {
    flexDirection: "row",
    marginTop: 6,
  },
  regimeCol: {
    flex: 1,
    marginBottom: 4,
  },
  regimeLabel: {
    color: BRAND.sub,
    fontSize: 11,
  },
  regimeValue: {
    color: BRAND.text,
    fontSize: 13,
    marginTop: 2,
  },
  regimeEmphasis: {
    fontWeight: "600",
  },

  // Risk
  riskText: {
    color: BRAND.text,
    fontSize: 13,
    lineHeight: 19,
    marginTop: 2,
  },

  // Colors
  positive: {
    color: BRAND.accent,
  },
  negative: {
    color: BRAND.red,
  },

  footer: {
    marginTop: 16,
    alignItems: "center",
  },
  footerText: {
    color: BRAND.sub,
    fontSize: 11,
  },
});
