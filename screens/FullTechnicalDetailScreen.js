// screens/FullTechnicalDetailScreen.js
import React, { useMemo, useRef, useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Animated,
  Easing,
  TouchableOpacity,
  Modal,
  Pressable,
  Share,
  Platform,
  ActivityIndicator
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { buildTechnicalNarrative } from "../utils/technicalNarrative";
import { shareBullSignalsPDF } from "../utils/share/BullSignalsPDF";
import { getTechnicalDetail } from "../services/technicalDetailService";


/* ================= BRAND ================= */
const BRAND = {
  bg: "#000000",
  card: "#111827",
  border: "#1F2937",
  text: "#FFFFFF",
  sub: "#9CA3AF",
  accent: "#00E396",
  red: "#EF4444",
  amber: "#FACC15",
  blue: "#60A5FA",
};

/* ================= HELPERS ================= */
const safe = (n) => (Number.isFinite(Number(n)) ? Number(n) : null);
const num = (n, d = 2) => (n == null ? "—" : Number(n).toFixed(d));
const pct = (n, d = 2) => (n == null ? "—" : `${Number(n).toFixed(d)}%`);
const money = (n) => (n == null ? "—" : `$${Number(n).toFixed(2)}`);

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

function bullBearColorFromLabel(label) {
  const s = String(label || "").toLowerCase();
  if (s.includes("bull") || s.includes("above") || s.includes("up") || s.includes("strong"))
    return BRAND.accent;
  if (s.includes("bear") || s.includes("below") || s.includes("down") || s.includes("weak"))
    return BRAND.red;
  if (s.includes("overbought")) return BRAND.red;
  if (s.includes("oversold")) return BRAND.blue;
  return BRAND.amber;
}

function colorFromSigned(v) {
  if (v == null) return BRAND.sub;
  return v >= 0 ? BRAND.accent : BRAND.red;
}

// RSI semantics
function rsiBandColor(rsi) {
  if (rsi == null) return BRAND.sub;
  if (rsi >= 70) return BRAND.red; // overbought
  if (rsi <= 30) return BRAND.blue; // oversold
  return BRAND.accent; // neutral/healthy
}

// Trend strength is 0..1-ish; show amber if weak
function trendStrengthColor(ts) {
  if (ts == null) return BRAND.sub;
  if (ts >= 0.65) return BRAND.accent;
  if (ts >= 0.35) return BRAND.amber;
  return BRAND.sub;
}

/* ================= EDUCATIONAL TOOLTIP COPY ================= */
const TOOLTIP = {
  RSI: {
    title: "RSI (Relative Strength Index)",
    body:
      "RSI estimates momentum on a 0–100 scale. Above ~70 can indicate overbought (price stretched), below ~30 can indicate oversold. It’s a momentum gauge, not a guarantee of reversal.",
  },
  MACD: {
    title: "MACD",
    body:
      "MACD measures trend momentum using two moving averages (typically 12 & 26 EMA). When MACD > Signal it’s generally bullish momentum; Histogram shows the gap between them (momentum acceleration/decay).",
  },
  TREND: {
    title: "Trend Strength",
    body:
      "Trend strength approximates how directional price has been recently (vs choppy/sideways). Higher values mean cleaner directional movement; lower values mean range-bound conditions.",
  },
  VOLUME: {
    title: "Volume vs MA20",
    body:
      "Compares today’s volume to the 20-day average. Above 0% means heavier-than-normal participation (often institutional interest). Below 0% can mean quieter trading.",
  },
  VOL: {
    title: "Volatility & ATR",
    body:
      "Volatility describes how wide price swings are. ATR(14) is a common measure of typical daily range (in price units). Higher values mean bigger moves and wider risk bands.",
  },
  RETURNS: {
    title: "Returns (1D / 5D / 10D)",
    body:
      "Simple historical returns over recent windows. Useful for context and momentum, but returns can mean-revert. Pair with trend/momentum/volume to interpret.",
  },
  MA: {
    title: "Moving Averages (SMA)",
    body:
      "SMA20/50/200 are common trend baselines. Price above a longer SMA often implies a stronger uptrend; below can imply weakness. Crossovers can be useful, but can whipsaw in sideways markets.",
  },
  CANDLE: {
    title: "Candlestick Anatomy",
    body:
      "Body shows open→close move. Wicks show extremes (high/low). Large body suggests conviction; long wicks suggest rejection/indecision. Range% captures overall day’s movement.",
  },
};

/* ================= COMPONENT ================= */
export default function FullTechnicalDetailScreen({ route }) {
  const { symbol, companyName, quote, technical, featuresMeta } = route.params || {};
  const [technicalDetail, setTechnicalDetail] = useState(null);
const [loadingTechnical, setLoadingTechnical] = useState(true);
const [technicalError, setTechnicalError] = useState(null);

useEffect(() => {
  let mounted = true;

  async function loadTechnicalDetail() {
    try {
      setLoadingTechnical(true);
      setTechnicalError(null);

      const data = await getTechnicalDetail(symbol);

      if (mounted) setTechnicalDetail(data);
    } catch (err) {
      console.warn("Technical detail load failed:", err);
      if (mounted) setTechnicalError("Technical details unavailable.");
    } finally {
      if (mounted) setLoadingTechnical(false);
    }
  }

  if (symbol) loadTechnicalDetail();

  return () => {
    mounted = false;
  };
}, [symbol]);
const sourceSymbol = technicalDetail?.symbol || symbol;
const sourceCompanyName = technicalDetail?.companyName || companyName;
const sourceQuote = technicalDetail?.quote || quote || {};
const sourceTechnical = technicalDetail?.technical || technical || {};
const sourceFeaturesMeta = technicalDetail?.featuresMeta || featuresMeta || {};
const sourceSummary = technicalDetail?.summary || {};

  /* ========= animation ========= */
  const fade = useRef(new Animated.Value(0)).current;
  const slide = useRef(new Animated.Value(10)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fade, {
        toValue: 1,
        duration: 420,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(slide, {
        toValue: 0,
        duration: 420,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  }, [fade, slide]);

  /* ========= tooltip modal ========= */
  const [tipKey, setTipKey] = useState(null);
  const openTip = useCallback((key) => setTipKey(key), []);
  const closeTip = useCallback(() => setTipKey(null), []);
  const tip = tipKey ? TOOLTIP[tipKey] : null;

  /* ========= normalized + memoized derived values ========= */
  const derived = useMemo(() => {
  const tech = sourceTechnical || {};
  const feat = sourceFeaturesMeta || {};

  return {
    /* ================= MOMENTUM ================= */
    rsi: safe(feat.rsi14),
    rsiLabel: tech.rsi?.label ?? "—",
    rsiComment: tech.rsi?.comment ?? "—",

    macd: safe(feat.macd),
    macdSignal: safe(feat.macd_signal),
    macdHist: safe(feat.macd_hist),
    macdLabel: tech.macd?.label ?? "—",
    macdComment: tech.macd?.comment ?? "—",

    /* ================= TREND ================= */
    trendStrength: safe(tech.trend?.trend_strength_20 ?? feat.trend_strength_20),
    trendLabel: tech.trend?.label ?? "—",
    trendComment: tech.trend?.comment ?? "—",
    priceVsSMA20: safe(feat.price_vs_sma20_pct),

    /* ================= VOLUME ================= */
    volumeVsMA20: safe(feat.volume_vs_ma20_pct),
    volumeLabel:
  tech.volume?.label ??
  (feat.volume_vs_ma20_pct == null
    ? "—"
    : feat.volume_vs_ma20_pct >= 0
    ? "High Volume"
    : "Low Volume"),

    volumeComment: tech.volume?.comment ?? "—",

    /* ================= VOLATILITY ================= */
    volatility20d: safe(feat.volatility_20d),
    atr14: safe(feat.atr14),
    volLabel:
  tech.volatility?.label ??
  (feat.volatility_20d == null
    ? "—"
    : feat.volatility_20d >= 0.03
    ? "High Volatility"
    : "Low Volatility"),

    volComment: tech.volatility?.comment ?? "—",

    /* ================= RETURNS ================= */
    ret1d: safe(feat.return_1d),
    ret5d: safe(feat.return_5d),
    ret10d: safe(feat.return_10d),

    /* ================= MOVING AVERAGES ================= */
    sma20: safe(feat.sma20),
    sma50: safe(feat.sma50),
    sma200: safe(feat.sma200),

    /* ================= CANDLE ================= */
    bodyPct: safe(feat.body_pct),
    upperWickPct: safe(feat.upper_shadow_pct),
    lowerWickPct: safe(feat.lower_shadow_pct),
    rangePct: safe(feat.intraday_range_pct),
    gapPct: safe(feat.gap_pct),

    /* ================= SUMMARY ================= */
    summary: tech.summary ?? "Technical snapshot unavailable.",
  };
}, [sourceTechnical, sourceFeaturesMeta]);
 /* ========= NARRATIVE (ADD-ONLY) ========= */
  const narrative = useMemo(
    () =>
      buildTechnicalNarrative({
        technical: sourceTechnical,
        features: sourceFeaturesMeta,
        quote: sourceQuote,
      }),
    [technical, featuresMeta, quote]
  );


const fmt = {
  num: (v, d = 2) =>
    v == null || isNaN(v) ? "—" : Number(v).toFixed(d),

  pct: (v, d = 2) =>
    v == null || isNaN(v) ? "—" : `${Number(v).toFixed(d)}%`,

  rsiLabel: (v) =>
    v == null ? "—"
    : v >= 70 ? "Overbought"
    : v <= 30 ? "Oversold"
    : "Neutral",
};


  /* ========= share/export ========= */
const onShare = async () => {
  try {
    await shareBullSignalsPDF({
      title: `${symbol} Technical Analysis`,
      subtitle: "AI-Driven Market Intelligence",
      sections: [
        {
          label: "Company",
          text: companyName || "—",
        },
        {
          label: "Trend",
          text: `${derived.trendLabel || "—"} (Strength: ${fmt.num(derived.trendStrength)})`,
        },
        {
          label: "Momentum",
          text:
            `RSI ${fmt.num(derived.rsi)} — ${fmt.rsiLabel(derived.rsi)}\n` +
            `MACD ${fmt.num(derived.macd)} | Signal ${fmt.num(derived.macdSignal)}`,
        },
        {
          label: "Volatility",
          text:
            `20D Volatility: ${fmt.num(derived.volatility20d)}\n` +
            `ATR(14): ${fmt.num(derived.atr14)}`,
        },
        {
          label: "Returns",
          text:
            `1D ${fmt.pct(derived.ret1d)} • ` +
            `5D ${fmt.pct(derived.ret5d)} • ` +
            `10D ${fmt.pct(derived.ret10d)}`,
        },
      ],
    });
  } catch {
    Share.share({
      title: "Alphaclara — Technical Snapshot",
      message: `${symbol}\nRSI: ${fmt.num(derived.rsi)}\nTrend: ${derived.trendLabel}\n\nEducational only.`,
    });
  }
};


  /* ================= RENDER ================= */
  const headerPrice = sourceQuote?.current ?? sourceQuote?.price ?? null;
  const headerChangePct = sourceQuote?.changePct ?? null;
if (loadingTechnical && !technicalDetail) {
  return (
    <View style={[styles.container, { justifyContent: "center", alignItems: "center" }]}>
      <ActivityIndicator color={BRAND.accent} />
      <Text style={{ color: BRAND.sub, marginTop: 10 }}>
        Loading technical details...
      </Text>
    </View>
  );
}

if (technicalError && !technicalDetail) {
  return (
    <View style={[styles.container, { justifyContent: "center", alignItems: "center" }]}>
      <Ionicons name="warning-outline" size={24} color={BRAND.amber} />
      <Text style={{ color: BRAND.sub, marginTop: 10 }}>
        {technicalError}
      </Text>
    </View>
  );
}
  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40 }}>
      <Animated.View style={{ opacity: fade, transform: [{ translateY: slide }] }}>
        {/* ===== HEADER ===== */}
        <LinearGradient colors={["#0f172a", "#020617"]} style={styles.headerCard}>
          <View style={styles.headerTopRow}>
            <View style={{ flex: 1, paddingRight: 10 }}>
              <Text style={styles.symbol}>{sourceSymbol || "—"}</Text>
              <Text style={styles.name} numberOfLines={1}>
                {sourceCompanyName || "—"}
              </Text>
            </View>

            <View style={{ alignItems: "flex-end" }}>
              <Text style={styles.price}>{money(headerPrice)}</Text>
              <Text style={[styles.change, headerChangePct >= 0 ? styles.pos : styles.neg]}>
                {headerChangePct == null
                  ? "—"
                  : `${headerChangePct >= 0 ? "+" : ""}${headerChangePct.toFixed(2)}%`}
              </Text>
            </View>
          </View>

          <View style={styles.headerActionsRow}>
            <View style={styles.premiumBadge}>
              <Ionicons name="sparkles-outline" size={14} color={BRAND.accent} />
              <Text style={styles.premiumBadgeText}>Premium • Full Technicals</Text>
            </View>

            <TouchableOpacity onPress={onShare} style={styles.shareBtn} activeOpacity={0.85}>
              <Ionicons name="share-outline" size={16} color={BRAND.text} />
              <Text style={styles.shareBtnText}>Share</Text>
            </TouchableOpacity>
          </View>

         <Text style={styles.summary}>
          {narrative?.summary || derived.summary}
        </Text>

        </LinearGradient>

        {/* ===== RSI ===== */}
        <View style={styles.card}>
          <SectionHeader title="Relative Strength Index (RSI)" onInfo={() => openTip("RSI")} />
          <Text style={[styles.big, { color: rsiBandColor(derived.rsi) }]}>
            {derived.rsi == null ? "—" : derived.rsi.toFixed(1)}
          </Text>

          <View style={styles.bar}>
            <View
              style={[
                styles.fill,
                {
                  width: `${derived.rsi == null ? 0 : clamp(derived.rsi, 0, 100)}%`,
                  backgroundColor: rsiBandColor(derived.rsi),
                },
              ]}
            />
          </View>

          <View style={styles.semanticRow}>
            <Pill
              label={
                derived.rsi == null
                  ? "RSI: —"
                  : derived.rsi >= 70
                  ? "Overbought"
                  : derived.rsi <= 30
                  ? "Oversold"
                  : "Neutral"
              }
              color={rsiBandColor(derived.rsi)}
              icon="pulse-outline"
            />
          </View>

          {narrative?.sections?.momentum?.narrative && (
          <Text style={styles.note}>
            {narrative.sections.momentum.narrative}
          </Text>
        )}
          

        </View>

        {/* ===== MACD ===== */}
        <View style={styles.card}>
          <SectionHeader title="MACD Momentum" onInfo={() => openTip("MACD")} />

          <View style={styles.row}>
            <Metric label="MACD" value={derived.macd} color={colorFromSigned(derived.macd)} />
            <Metric label="Signal" value={derived.macdSignal} color={BRAND.sub} />
            <Metric
              label="Histogram"
              value={derived.macdHist}
              color={colorFromSigned(derived.macdHist)}
            />
          </View>

          <View style={styles.semanticRow}>
            <Pill
              label={
                derived.macd == null || derived.macdSignal == null
                  ? "Momentum: —"
                  : derived.macd >= derived.macdSignal
                  ? "Bullish Momentum"
                  : "Bearish Momentum"
              }
              color={
                derived.macd == null || derived.macdSignal == null
                  ? BRAND.sub
                  : derived.macd >= derived.macdSignal
                  ? BRAND.accent
                  : BRAND.red
              }
              icon="trending-up-outline"
            />
          </View>

             {narrative?.sections?.momentum?.narrative && (
  <Text style={styles.note}>
    {narrative.sections.momentum.narrative}
  </Text>
)}
       

        </View>

        {/* ===== TREND ===== */}
        <View style={styles.card}>
          <SectionHeader title="Trend Strength" onInfo={() => openTip("TREND")} />

          <Text style={[styles.big, { color: bullBearColorFromLabel(derived.trendLabel) }]}>
            {derived.trendLabel || "—"}
          </Text>

          <View style={styles.bar}>
            <View
              style={[
                styles.fill,
                {
                  width: `${derived.trendStrength == null ? 0 : clamp(derived.trendStrength, 0, 1) * 100}%`,
                  backgroundColor: trendStrengthColor(derived.trendStrength),
                },
              ]}
            />
          </View>

          <View style={styles.semanticRow}>
            <Pill
              label={
                derived.trendStrength == null
                  ? "Strength: —"
                  : derived.trendStrength >= 0.65
                  ? "Directional"
                  : derived.trendStrength >= 0.35
                  ? "Mixed"
                  : "Choppy / Sideways"
              }
              color={trendStrengthColor(derived.trendStrength)}
              icon="analytics-outline"
            />
            <Pill
              label={
                derived.priceVsSMA20 == null
                  ? "vs SMA20: —"
                  : `${derived.priceVsSMA20 >= 0 ? "Above" : "Below"} SMA20`
              }
              color={derived.priceVsSMA20 == null ? BRAND.sub : colorFromSigned(derived.priceVsSMA20)}
              icon="swap-vertical-outline"
            />
          </View>

          {narrative?.sections?.trend?.narrative && (
  <Text style={styles.note}>
    {narrative.sections.trend.narrative}
  </Text>
)}

        </View>

        {/* ===== VOLUME ===== */}
        <View style={styles.card}>
          <SectionHeader title="Volume Activity" onInfo={() => openTip("VOLUME")} />

          <View style={styles.row}>
            <Metric
              label="Volume vs MA20"
              value={derived.volumeVsMA20}
              suffix="%"
              color={derived.volumeVsMA20 == null ? BRAND.sub : colorFromSigned(derived.volumeVsMA20)}
            />
            <Metric
              label="Bias"
              value={derived.volumeVsMA20 == null ? null : derived.volumeVsMA20}
              suffix=""
              format={(v) =>
                v == null ? "—" : v >= 0 ? "High" : "Low"
              }
              color={derived.volumeVsMA20 == null ? BRAND.sub : vSignColor(derived.volumeVsMA20)}
            />
          </View>

          <View style={styles.semanticRow}>
            <Pill
              label={
                derived.volumeVsMA20 == null
                  ? "Participation: —"
                  : derived.volumeVsMA20 >= 0
                  ? "Above Average Participation"
                  : "Below Average Participation"
              }
              color={derived.volumeVsMA20 == null ? BRAND.sub : colorFromSigned(derived.volumeVsMA20)}
              icon="bar-chart-outline"
            />
            <Pill
              label={derived.volumeLabel || "—"}
              color={bullBearColorFromLabel(derived.volumeLabel)}
              icon="flash-outline"
            />
          </View>

          {narrative?.sections?.volume?.narrative && (
          <Text style={styles.note}>
            {narrative.sections.volume.narrative}
          </Text>
        )}

        </View>

        {/* ===== VOLATILITY ===== */}
        <View style={styles.card}>
          <SectionHeader title="Volatility" onInfo={() => openTip("VOL")} />

          <View style={styles.row}>
            <Metric label="20D Volatility" value={derived.volatility20d} color={BRAND.sub} />
            <Metric label="ATR (14)" value={derived.atr14} color={BRAND.sub} />
          </View>

          <View style={styles.semanticRow}>
            <Pill
              label={derived.volLabel || "—"}
              color={bullBearColorFromLabel(derived.volLabel)}
              icon="pulse-outline"
            />
          </View>

          {narrative?.sections?.volatility?.narrative && (
  <Text style={styles.note}>
    {narrative.sections.volatility.narrative}
  </Text>
)}

        </View>

        {/* ===== CANDLESTICK ANATOMY ===== */}
        <View style={styles.card}>
          <SectionHeader title="Candlestick Anatomy" onInfo={() => openTip("CANDLE")} />

          <View style={styles.candleWrap}>
            <View style={styles.candleVisual}>
            {/* wick */}
            <View
              style={[
                styles.wick,
                {
                  height: Math.max(
                    40,
                    clamp((derived.rangePct ?? 1) / 2, 0.3, 1) * 120
                  ),
                  top: 20,
                },
              ]}
            />

            {/* body */}
            <View
              style={[
                styles.body,
                {
                  height: Math.max(
                    30,
                    clamp((derived.bodyPct ?? 0.8) / 2, 0.25, 1) * 80
                  ),
                  marginTop: "auto",
                  marginBottom: "auto",
                  backgroundColor:
                    derived.bodyPct == null
                      ? BRAND.border
                      : (quote?.changePct ?? 0) >= 0
                      ? BRAND.accent
                      : BRAND.red,
                },
              ]}
            />
          </View>

            <View style={{ flex: 1 }}>
              <View style={styles.row}>
                <Metric label="Body" value={derived.bodyPct} suffix="%" color={BRAND.text} />
                <Metric label="Upper Wick" value={derived.upperWickPct} suffix="%" color={BRAND.sub} />
              </View>
              <View style={styles.row}>
                <Metric label="Lower Wick" value={derived.lowerWickPct} suffix="%" color={BRAND.sub} />
                <Metric label="Range" value={derived.rangePct} suffix="%" color={BRAND.sub} />
              </View>

              <View style={styles.semanticRow}>
                <Pill
                  label={derived.gapPct == null ? "Gap: —" : `Gap ${derived.gapPct >= 0 ? "+" : ""}${derived.gapPct.toFixed(2)}%`}
                  color={derived.gapPct == null ? BRAND.sub : colorFromSigned(derived.gapPct)}
                  icon="resize-outline"
                />
              </View>
            </View>
            
          </View>
          {narrative?.sections?.candle?.narrative && (
          <Text style={styles.note}>
            {narrative.sections.candle.narrative}
          </Text>
        )}

        </View>

        {/* ===== RETURNS ===== */}
        <View style={styles.card}>
          <SectionHeader title="Returns" onInfo={() => openTip("RETURNS")} />
          <View style={styles.row}>
            <Metric label="1 Day" value={derived.ret1d} suffix="%" color={colorFromSigned(derived.ret1d)} />
            <Metric label="5 Day" value={derived.ret5d} suffix="%" color={colorFromSigned(derived.ret5d)} />
            <Metric label="10 Day" value={derived.ret10d} suffix="%" color={colorFromSigned(derived.ret10d)} />
          </View>
            {(narrative?.sections?.returns?.narrative ||
          derived.ret1d != null ||
          derived.ret5d != null ||
          derived.ret10d != null) && (
          <Text style={styles.note}>
            {narrative?.sections?.returns?.narrative ??
              `Short-term returns show ${
                derived.ret1d >= 0 ? "positive" : "negative"
              } momentum recently. Returns should be interpreted alongside trend and volume to avoid false signals.`}
          </Text>
        )}

        </View>
      



        {/* ===== MOVING AVERAGES ===== */}
        <View style={styles.card}>
          <SectionHeader title="Moving Averages" onInfo={() => openTip("MA")} />
          <View style={styles.row}>
            <Metric label="SMA 20" value={derived.sma20} color={BRAND.sub} />
            <Metric label="SMA 50" value={derived.sma50} color={BRAND.sub} />
            <Metric label="SMA 200" value={derived.sma200} color={BRAND.sub} />
          </View>
          <Text style={styles.note}>
            {narrative?.sections?.ma?.narrative ??
              (derived.sma20 && derived.sma50 && derived.sma200
                ? `Price relative to key moving averages helps define trend structure. Alignment above longer-term averages often confirms strength, while compression can signal consolidation.`
                : `Moving averages provide trend context by smoothing price action across time.`)}
          </Text>
          <View style={styles.disclaimerCard}>
            <View style={styles.disclaimerHeader}>
              <Ionicons name="shield-checkmark-outline" size={17} color={BRAND.amber} />
              <Text style={styles.disclaimerTitle}>Educational Note</Text>
            </View>

            <Text style={styles.disclaimerText}>
              Technical indicators are based on historical price, volume, volatility,
              and momentum data. They do not guarantee future results. This analysis is
              for educational and research purposes only and should not be treated as
              financial advice.
            </Text>
          </View>
        </View>
        
      </Animated.View>

      {/* ===== TOOLTIP MODAL ===== */}
      <Modal visible={!!tip} transparent animationType="fade" onRequestClose={closeTip}>
        <Pressable style={styles.modalBackdrop} onPress={closeTip}>
          <Pressable style={styles.modalCard} onPress={() => {}}>
            <View style={styles.modalHeader}>
              <Ionicons name="information-circle-outline" size={20} color={BRAND.accent} />
              <Text style={styles.modalTitle}>{tip?.title || ""}</Text>
              <TouchableOpacity onPress={closeTip} hitSlop={10}>
                <Ionicons name="close-outline" size={22} color={BRAND.sub} />
              </TouchableOpacity>
            </View>
            <Text style={styles.modalBody}>{tip?.body || ""}</Text>
            <Text style={styles.modalFoot}>Educational only • Not financial advice</Text>
          </Pressable>
        </Pressable>
      </Modal>
    </ScrollView>
  );
}

/* ================= PERF: MEMOIZED SUB COMPONENTS ================= */
function vSignColor(v) {
  if (v == null) return BRAND.sub;
  return v >= 0 ? BRAND.accent : BRAND.red;
}

const SectionHeader = React.memo(function SectionHeader({ title, onInfo }) {
  return (
    <View style={styles.sectionRow}>
      <Text style={styles.section}>{title}</Text>
      <TouchableOpacity onPress={onInfo} style={styles.infoBtn} activeOpacity={0.85}>
        <Ionicons name="help-circle-outline" size={18} color={BRAND.sub} />
      </TouchableOpacity>
    </View>
  );
});

const Metric = React.memo(function Metric({ label, value, suffix = "", color, format }) {
  const display = useMemo(() => {
    if (format) return format(value);
    if (value == null) return "—";
    return `${Number(value).toFixed(2)}${suffix}`;
  }, [value, suffix, format]);

  return (
    <View style={styles.metric}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={[styles.metricValue, { color: color || colorFromSigned(value) }]}>
        {display}
      </Text>
    </View>
  );
});

const Pill = React.memo(function Pill({ label, color, icon }) {
  return (
    <View style={[styles.pill, { borderColor: color || BRAND.border }]}>
      <Ionicons name={icon} size={14} color={color || BRAND.sub} />
      <Text style={[styles.pillText, { color: color || BRAND.sub }]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
});

/* ================= STYLES ================= */
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BRAND.bg, padding: 16 },

  headerCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: BRAND.border,
    padding: 14,
  },
  headerTopRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  symbol: { color: BRAND.text, fontSize: 26, fontWeight: "900" },
  name: { color: BRAND.sub, fontSize: 13, marginTop: 2 },
  price: { color: BRAND.text, fontSize: 22, fontWeight: "800" },
  change: { fontSize: 13, fontWeight: "700", marginTop: 2 },
  pos: { color: BRAND.accent },
  neg: { color: BRAND.red },

  headerActionsRow: { flexDirection: "row", alignItems: "center", marginTop: 10, gap: 10 },
  premiumBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: BRAND.border,
    backgroundColor: "#020617",
  },
  premiumBadgeText: { color: BRAND.text, fontSize: 12, fontWeight: "800" },
  shareBtn: {
    marginLeft: "auto",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: BRAND.border,
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  shareBtnText: { color: BRAND.text, fontSize: 12, fontWeight: "900" },

  summary: {
    marginTop: 10,
    color: BRAND.sub,
    fontSize: 13,
    lineHeight: 18,
  },

  card: {
    backgroundColor: BRAND.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: BRAND.border,
    padding: 14,
    marginTop: 12,
  },

  sectionRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  section: {
    color: BRAND.accent,
    fontSize: 15,
    fontWeight: "800",
    marginBottom: 6,
    flex: 1,
    paddingRight: 8,
  },
  infoBtn: { paddingLeft: 8, paddingBottom: 6 },

  big: {
    color: BRAND.text,
    fontSize: 22,
    fontWeight: "900",
    marginBottom: 8,
  },

  bar: {
    height: 10,
    backgroundColor: "#020617",
    borderRadius: 999,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: BRAND.border,
  },
  fill: { height: "100%" },

  row: { flexDirection: "row", gap: 10, marginTop: 8 },

  metric: {
    flex: 1,
    borderWidth: 1,
    borderColor: BRAND.border,
    borderRadius: 10,
    padding: 10,
    backgroundColor: "#020617",
    minWidth: 0,
  },
  metricLabel: {
    color: BRAND.sub,
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  metricValue: {
    marginTop: 6,
    fontSize: 15,
    fontWeight: "900",
  },

  semanticRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 10 },

  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: "rgba(2,6,23,0.75)",
    maxWidth: "100%",
  },
  pillText: { fontSize: 12, fontWeight: "800" },

  note: {
    marginTop: 8,
    color: BRAND.sub,
    fontSize: 12.5,
    lineHeight: 18,
  },

  // Candlestick anatomy
  candleWrap: { flexDirection: "row", gap: 12, marginTop: 6, alignItems: "center" },
  candleVisual: {
    width: 70,
    height: 160,
    borderWidth: 1,
    borderColor: BRAND.border,
    backgroundColor: "#020617",
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
  },
  wick: {
  width: 3,
  borderRadius: 2,
  backgroundColor: "rgba(156,163,175,0.55)",
  position: "absolute",
  top: 20,
},

  body: {
    width: 26,
    borderRadius: 6,
    backgroundColor: BRAND.accent,
  },

  // Tooltip modal
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
    justifyContent: "center",
    padding: 18,
  },
  modalCard: {
    backgroundColor: "rgba(2, 6, 23, 0.96)",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: BRAND.border,
    padding: 14,
  },
  modalHeader: { flexDirection: "row", alignItems: "center", gap: 10 },
  modalTitle: { color: BRAND.text, fontSize: 14.5, fontWeight: "900", flex: 1 },
  modalBody: { marginTop: 10, color: BRAND.sub, fontSize: 13, lineHeight: 18 },
  modalFoot: { marginTop: 12, color: BRAND.sub, fontSize: 11, opacity: 0.85 },
  disclaimerCard: {
  backgroundColor: "#020617",
  borderRadius: 12,
  borderWidth: 1,
  borderColor: BRAND.border,
  paddingHorizontal: 12,
  paddingVertical: 12,
  marginTop: 12,
  marginBottom: 20,
},

disclaimerHeader: {
  flexDirection: "row",
  alignItems: "center",
  marginBottom: 6,
},

disclaimerTitle: {
  color: BRAND.amber,
  fontSize: 14,
  fontWeight: "800",
  marginLeft: 8,
},

disclaimerText: {
  color: BRAND.sub,
  fontSize: 12.5,
  lineHeight: 18,
},
});
