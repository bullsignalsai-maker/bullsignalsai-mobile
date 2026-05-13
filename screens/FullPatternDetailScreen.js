// screens/FullPatternDetailScreen.js
import React, { useEffect, useMemo, useRef, useState, memo } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Animated,
  Easing,
  LayoutAnimation,
  Platform,
  UIManager,
  Modal,
  Pressable,
  ActivityIndicator,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { getPatternDetail } from "../services/patternDetailService";
if (
  Platform.OS === "android" &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}
import { BRAND } from "../constants/theme";
import { TYPO } from "../constants/typography";

const TOOLTIP = {
  EXPECTED_RANGE: {
    title: "Historical Range",
    body:
      "This range is built from historical outcomes after this pattern appeared. " +
      "Low / Mid / High represent typical downside, average outcome, and upside over the next few days. " +
      "This is statistical context, not a prediction.",
  },
  RECENT_OCCURRENCES: {
    title: "Recent Occurrences",
    body:
      "These are recent dates when this exact pattern appeared. " +
      "Day shows the pattern-day move, while 5D and 10D show what happened afterward.",
  },
};

const fmtMoney = (n) =>
  n == null || Number.isNaN(Number(n)) ? "—" : `$${Number(n).toFixed(2)}`;

const fmtPctSigned = (n, digits = 2) => {
  if (n == null || Number.isNaN(Number(n))) return "—";
  const v = Number(n);
  const sign = v >= 0 ? "▲ " : "▼ ";
  return `${sign}${Math.abs(v).toFixed(digits)}%`;
};

// backend often returns returns as percent values (e.g. 2.03 means +2.03%)
const fmtReturn = (n) =>
  n == null || Number.isNaN(Number(n)) ? "—" : `${Number(n).toFixed(2)}%`;

const biasColor = (bias) => {
  const b = (bias || "").toLowerCase();
  if (b.includes("bull")) return BRAND.accent;
  if (b.includes("bear")) return BRAND.red;
  return BRAND.amber;
};

const labelColorFromConfidence = (pct) => {
  if (pct == null) return BRAND.amber;
  if (pct >= 70) return BRAND.accent;
  if (pct >= 60) return BRAND.blue;
  return BRAND.amber;
};

function safeNum(n) {
  const v = Number(n);
  return Number.isFinite(v) ? v : null;
}

// --- Expected Range helpers ---
const getRangeBias = (anchor, mid) => {
  if (anchor == null || mid == null) return null;
  if (mid > anchor) return "Bullish bias";
  if (mid < anchor) return "Bearish bias";
  return "Neutral bias";
};

function pickPatternBundle({
  patternInsight,
  smartPattern,
  patternStats,
  probabilityCone,
}) {
  const pi = patternInsight || null;
  const sp = smartPattern || null;
  const ps = patternStats || null;
  const cone = probabilityCone || null;

  const patternName =
    pi?.pattern ||
    sp?.pattern ||
    ps?.currentPattern?.pattern ||
    "NO CLEAR PATTERN";

  const explanation =
    pi?.explanation ||
    sp?.explanation ||
    ps?.currentPattern?.headline ||
    "No detailed explanation available.";

  const confidencePct = pi?.confidencePct ?? null;
  const label = pi?.label ?? null;

  const current = pi?.current || ps?.currentPattern || null;

  const forwardReturns =
    pi?.history?.forwardReturns ||
    ps?.historyForCurrent?.forwardReturns ||
    null;

  const occurrences =
    pi?.history?.occurrences ??
    ps?.historyForCurrent?.occurrences ??
    safeNum(cone?.occurrences) ??
    null;

  const recentSamples =
    pi?.history?.recentSamples || ps?.historyForCurrent?.samples || [];

  const allPatterns =
    ps?.allPatterns?.length > 0
      ? ps.allPatterns
      : patternName
        ? [
            {
              pattern: patternName,
              occurrences:
                pi?.history?.occurrences ??
                ps?.historyForCurrent?.occurrences ??
                safeNum(cone?.occurrences) ??
                0,
            },
          ]
        : [];

  // ✅ Normalize probability cone for BOTH shapes:
  // A) { ranges: { days5, days10 }, anchorPrice, pattern, occurrences, note }
  // B) { days5, days10, anchorPrice, pattern, note }  (your current service output)
  const coneNorm = (() => {
    if (!cone) return null;

    // shape A
    if (cone?.ranges?.days5 || cone?.ranges?.days10) return cone;

    // shape B
    if (cone?.days5 || cone?.days10) {
      return {
        ...cone,
        ranges: {
          days5: cone.days5 || null,
          days10: cone.days10 || null,
        },
      };
    }

    return null;
  })();

  return {
    patternName,
    explanation,
    confidencePct,
    label,
    current,
    forwardReturns,
    occurrences,
    recentSamples,
    allPatterns,
    cone: coneNorm,
  };
}

/* -----------------------------
   MINI HISTOGRAM (Forward Returns)
   Uses sample fwd5d/fwd10d values
----------------------------- */
const MiniHistogram = memo(function MiniHistogram({ values, label }) {
  const bins = useMemo(() => {
    const v = (values || [])
      .filter((x) => x != null && Number.isFinite(Number(x)))
      .map(Number);
    if (v.length === 0) return null;

    const min = Math.min(...v);
    const max = Math.max(...v);
    const span = Math.max(1e-6, max - min);

    const BIN_COUNT = 7;
    const edges = Array.from(
      { length: BIN_COUNT + 1 },
      (_, i) => min + (span * i) / BIN_COUNT,
    );
    const counts = Array.from({ length: BIN_COUNT }, () => 0);

    for (const x of v) {
      let idx = Math.floor(((x - min) / span) * BIN_COUNT);
      if (idx < 0) idx = 0;
      if (idx >= BIN_COUNT) idx = BIN_COUNT - 1;
      counts[idx] += 1;
    }

    const peak = Math.max(...counts, 1);

    return { edges, counts, peak, min, max };
  }, [values]);

  if (!bins) return null;

  return (
    <View style={{ marginTop: 12 }}>
      <Text style={styles.subLabel}>{label}</Text>
      <View style={styles.histRow}>
        {bins.counts.map((c, i) => {
          const h = (c / bins.peak) * 44; // px height
          return (
            <View key={`bin-${i}`} style={styles.histBin}>
              <View
                style={[
                  styles.histBar,
                  {
                    height: h,
                    backgroundColor: c === 0 ? BRAND.border : BRAND.blue,
                  },
                ]}
              />
            </View>
          );
        })}
      </View>
      <View style={styles.histMetaRow}>
        <Text style={styles.histMetaText}>{bins.min.toFixed(2)}%</Text>
        <Text style={styles.histMetaText}>{bins.max.toFixed(2)}%</Text>
      </View>
      <Text style={styles.smallNote}>
        Histogram built from this pattern’s recent historical occurrences
        (sample forward returns).
      </Text>
    </View>
  );
});

/* -----------------------------
   Animated Range Bar
----------------------------- */
const AnimatedRangeBar = memo(function AnimatedRangeBar({
  low,
  mid,
  high,
  label,
  animKey,
}) {
  const lo = safeNum(low);
  const mi = safeNum(mid);
  const hi = safeNum(high);

  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    anim.setValue(0);
    Animated.timing(anim, {
      toValue: 1,
      duration: 520,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [animKey]); // re-run animation when horizon changes / new symbol

  if (lo == null || mi == null || hi == null) {
    return (
      <View style={styles.emptyRow}>
        <Text style={styles.emptyText}>{label}: Range unavailable</Text>
      </View>
    );
  }

  // split: low->mid and mid->high
  const leftRatio = Math.max(0.1, Math.min(0.9, (mi - lo) / (hi - lo || 1)));
  const rightRatio = 1 - leftRatio;

  const leftFlex = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.001, leftRatio],
  });
  const rightFlex = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.001, rightRatio],
  });
  const dotScale = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.6, 1],
  });

  return (
    <View style={{ marginTop: 6 }}>
      <Text style={styles.rangeTitle}>{label}</Text>

      <View style={styles.rangeTrack}>
        <Animated.View style={[styles.rangeLeft, { flex: leftFlex }]} />
        <Animated.View
          style={[styles.rangeMidDot, { transform: [{ scaleY: dotScale }] }]}
        />
        <Animated.View style={[styles.rangeRight, { flex: rightFlex }]} />
      </View>

      <View style={styles.rangeValueRow}>
        <View style={styles.rangeCol}>
          <Text style={styles.rangeValue}>{fmtMoney(lo)}</Text>
          <Text style={styles.rangeCaption}>Low</Text>
        </View>

        <View style={styles.rangeCol}>
          <Text style={styles.rangeValue}>{fmtMoney(mi)}</Text>
          <Text style={styles.rangeCaption}>Mid</Text>
        </View>

        <View style={styles.rangeCol}>
          <Text style={styles.rangeValue}>{fmtMoney(hi)}</Text>
          <Text style={styles.rangeCaption}>High</Text>
        </View>
      </View>
    </View>
  );
});

export default function FullPatternDetailScreen({ route, navigation }) {
  const {
    symbol,
    companyName,
    quote,
    patternInsight,
    smartPattern,
    patternStats,
    probabilityCone,
  } = route.params || {};
  const [patternDetail, setPatternDetail] = useState(null);
  const [loadingPattern, setLoadingPattern] = useState(true);
  const [patternError, setPatternError] = useState(null);
  // Debug removed for production

  useEffect(() => {
    let mounted = true;

    async function loadPatternDetail() {
      try {
        setLoadingPattern(true);
        setPatternError(null);

        const data = await getPatternDetail(symbol);

        if (mounted) {
          setPatternDetail(data);
        }
      } catch (err) {
        console.warn("Pattern detail load failed:", err);
        if (mounted) {
          setPatternError("Pattern details unavailable.");
        }
      } finally {
        if (mounted) {
          setLoadingPattern(false);
        }
      }
    }

    if (symbol) {
      loadPatternDetail();
    } else {
      setLoadingPattern(false);
      setPatternError("Missing symbol.");
    }

    return () => {
      mounted = false;
    };
  }, [symbol]);

  // --------------------
  // Tooltip state (MUST be here)
  // --------------------
  const [tipKey, setTipKey] = useState(null);

  const openTip = (key) => setTipKey(key);

  const closeTip = () => setTipKey(null);

  const tip = tipKey ? TOOLTIP[tipKey] : null;

  const sourcePatternInsight = patternDetail?.patternInsight || patternInsight;
  const sourceSmartPattern = patternDetail?.smartPattern || smartPattern;
  const sourcePatternStats = patternDetail?.patternStats || patternStats;
  const sourceProbabilityCone =
    patternDetail?.probabilityCone || probabilityCone;

  const bundle = useMemo(
    () =>
      pickPatternBundle({
        patternInsight: sourcePatternInsight,
        smartPattern: sourceSmartPattern,
        patternStats: sourcePatternStats,
        probabilityCone: sourceProbabilityCone,
      }),
    [
      sourcePatternInsight,
      sourceSmartPattern,
      sourcePatternStats,
      sourceProbabilityCone,
    ],
  );

  // ---- Animations ----
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

  const cone = bundle.cone;

  const headerQuote = patternDetail?.quote || quote || {};

  const headerSymbol =
    patternDetail?.symbol || symbol || headerQuote?.symbol || "—";

  const headerName =
    patternDetail?.companyName || companyName || headerQuote?.name || "—";

  const headerPrice =
    headerQuote?.current ?? headerQuote?.price ?? headerQuote?.close ?? null;

  const headerChangePct = headerQuote?.changePct ?? null;

  // Toggle for forward returns view
  const [horizon, setHorizon] = useState("days5");

  // FORCE refresh when horizon changes
  const forwardReturns = bundle.forwardReturns || {};
  const fr = forwardReturns[horizon] || null;

  // Debug-safe fallback
  const has5D = !!forwardReturns.days5;
  const has10D = !!forwardReturns.days10;

  // normalize fr values
  const frAvg = safeNum(fr?.avg);
  const frMedian = safeNum(fr?.median);
  const frBest = safeNum(fr?.best);
  const frWorst = safeNum(fr?.worst);
  const frCount = safeNum(fr?.count);

  // patternStats.currentPattern (if present)
  const current = bundle.current;
  const currentBias = current?.bias || null;
  const currentChangePct = safeNum(current?.changePct);
  const currentDate = current?.date ? new Date(current.date) : null;

  const confidencePct = safeNum(bundle.confidencePct);
  const occurrences = safeNum(bundle.occurrences);

  // --- Probability cone (prices already computed by backend) ---
  const cone5 = cone?.ranges?.days5 ?? cone?.days5 ?? null;

  const cone10 = cone?.ranges?.days10 ?? cone?.days10 ?? null;

  const coneAnchor =
    safeNum(cone?.anchorPrice) ??
    safeNum(headerQuote?.current) ??
    safeNum(headerQuote?.price) ??
    null;

  const conePattern = cone?.pattern || bundle.patternName;
  const coneOcc = safeNum(cone?.occurrences ?? occurrences);

  // forward returns “bar grid”
  const ReturnMetric = memo(function ReturnMetric({ label, value }) {
    const v = safeNum(value);
    const c = v == null ? BRAND.sub : v >= 0 ? BRAND.accent : BRAND.red;
    return (
      <View style={styles.metricBox}>
        <Text style={styles.metricLabel}>{label}</Text>
        <Text style={[styles.metricValue, { color: c }]}>
          {v == null ? "—" : `${v.toFixed(2)}%`}
        </Text>
      </View>
    );
  });

  const allPatternsTop = useMemo(() => {
    const arr = Array.isArray(bundle.allPatterns) ? bundle.allPatterns : [];
    return arr
      .slice()
      .sort((a, b) => (b?.occurrences || 0) - (a?.occurrences || 0))
      .slice(0, 8);
  }, [bundle.allPatterns]);

  const maxOcc = useMemo(() => {
    if (!allPatternsTop.length) return 1;
    return Math.max(
      ...allPatternsTop.map((p) => safeNum(p.occurrences) || 0),
      1,
    );
  }, [allPatternsTop]);

  // Recent samples normalization
  const samples = useMemo(() => {
    const rs = Array.isArray(bundle.recentSamples) ? bundle.recentSamples : [];
    return rs.slice(0, 8).map((s) => ({
      date: s?.date ? new Date(s.date) : null,
      headline: s?.headline || "",
      bias: s?.bias || null,
      changePct: safeNum(s?.changePct),
      fwd5d: safeNum(s?.fwd5d ?? s?.fwd_5d),
      fwd10d: safeNum(s?.fwd10d ?? s?.fwd_10d),
      pattern: s?.pattern || bundle.patternName,
      winRate: safeNum(s?.winRate),
    }));
  }, [bundle.recentSamples, bundle.patternName]);

  // ✅ Mini histogram values from samples (forward returns)
  const histValues = useMemo(() => {
    if (!samples.length) return [];
    if (horizon === "days10")
      return samples.map((s) => s.fwd10d).filter((x) => x != null);
    return samples.map((s) => s.fwd5d).filter((x) => x != null);
  }, [samples, horizon]);

  // a stable key to re-trigger cone animation when symbol changes
  const coneAnimKey = useMemo(() => {
    return `${headerSymbol}-${coneAnchor ?? "na"}-${coneOcc ?? "na"}`;
  }, [headerSymbol, coneAnchor, coneOcc]);

  if (loadingPattern && !patternDetail) {
    return (
      <View
        style={[
          styles.container,
          { justifyContent: "center", alignItems: "center" },
        ]}
      >
        <ActivityIndicator color={BRAND.accent} />
        <Text style={{ color: BRAND.sub, marginTop: 10 }}>
          Loading pattern details...
        </Text>
      </View>
    );
  }

  if (patternError && !patternDetail) {
    return (
      <View
        style={[
          styles.container,
          { justifyContent: "center", alignItems: "center" },
        ]}
      >
        <Ionicons name="warning-outline" size={24} color={BRAND.amber} />
        <Text style={{ color: BRAND.sub, marginTop: 10 }}>{patternError}</Text>
      </View>
    );
  }
  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingBottom: 40 }}
    >
      <Animated.View
        style={{ opacity: fade, transform: [{ translateY: slide }] }}
      >
        {/* HEADER CARD */}
        <LinearGradient
          colors={["#0f172a", "#020617"]}
          style={styles.headerCard}
        >
          <View style={styles.headerRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.symbol}>{headerSymbol}</Text>
              <Text style={styles.name}>{headerName}</Text>
            </View>

            <View style={styles.priceBlock}>
              <Text style={styles.price} numberOfLines={1} adjustsFontSizeToFit>
                {fmtMoney(headerPrice)}
              </Text>
              <Text
                style={[
                  styles.pct,
                  headerChangePct >= 0 ? styles.positive : styles.negative,
                ]}
              >
                {headerChangePct == null
                  ? "—"
                  : fmtPctSigned(headerChangePct, 2)}
              </Text>
            </View>
          </View>

          <View style={styles.headerMiniRow}>
            <View style={styles.headerMiniPill}>
              <Ionicons
                name="sparkles-outline"
                size={14}
                color={BRAND.accent}
              />
              <Text style={styles.headerMiniText}>Pattern Intelligence</Text>
            </View>

            {!!currentBias && (
              <View
                style={[
                  styles.headerMiniPill,
                  { borderColor: biasColor(currentBias) },
                ]}
              >
                <Ionicons
                  name="trending-up-outline"
                  size={14}
                  color={biasColor(currentBias)}
                />
                <Text
                  style={[
                    styles.headerMiniText,
                    { color: biasColor(currentBias) },
                  ]}
                >
                  {String(currentBias).toUpperCase()}
                </Text>
              </View>
            )}

            {currentChangePct != null && (
              <View style={styles.headerMiniPill}>
                <Ionicons name="pulse-outline" size={14} color={BRAND.sub} />
                <Text style={styles.headerMiniText}>
                  Pattern Day {currentChangePct >= 0 ? "+" : ""}
                  {currentChangePct.toFixed(2)}%
                </Text>
              </View>
            )}
          </View>
        </LinearGradient>

        {/* PATTERN OVERVIEW */}
        <View style={styles.patternHeroCard}>
          <View style={styles.patternHeroTop}>
            <View style={{ flex: 1 }}>
              <Text style={styles.patternEyebrow}>Pattern Overview</Text>
              <Text style={styles.patternHeroTitle}>{bundle.patternName}</Text>
            </View>

            <View
              style={[
                styles.patternConfidenceBadge,
                { borderColor: labelColorFromConfidence(confidencePct) },
              ]}
            >
              <Text
                style={[
                  styles.patternConfidenceValue,
                  { color: labelColorFromConfidence(confidencePct) },
                ]}
              >
                {confidencePct == null ? "—" : `${confidencePct.toFixed(0)}%`}
              </Text>
              <Text style={styles.patternConfidenceLabel}>Confidence</Text>
            </View>
          </View>

          <View style={styles.patternStatsRow}>
            <View style={styles.patternStatChip}>
              <Text style={styles.patternStatLabel}>Label</Text>
              <Text style={styles.patternStatValue} numberOfLines={1}>
                {bundle.label ||
                  (confidencePct == null
                    ? "—"
                    : confidencePct >= 70
                      ? "Historically Strong"
                      : "Weak / Neutral")}
              </Text>
            </View>

            <View style={styles.patternStatChip}>
              <Text style={styles.patternStatLabel}>Occurrences</Text>
              <Text style={styles.patternStatValue}>
                {occurrences == null ? "—" : String(occurrences)}
              </Text>
            </View>
          </View>

          <View style={styles.confTrack}>
            <View
              style={[
                styles.confFill,
                {
                  width: `${Math.max(0, Math.min(100, confidencePct ?? 0))}%`,
                  backgroundColor: labelColorFromConfidence(confidencePct),
                },
              ]}
            />
          </View>

          <Text style={styles.explanation}>{bundle.explanation}</Text>
        </View>
        {/* ==== DEEP ANALYTICS WRAPPER (locked overlay if not premium) ==== */}
        <View style={{ position: "relative" }}>
          {/* FORWARD RETURNS */}
          <View style={styles.card}>
            <View style={styles.sectionHeaderRow}>
              <View style={styles.sectionAccent} />

              <View style={{ flex: 1, paddingRight: 8 }}>
                <Text style={styles.sectionTitle}>
                  Historical Forward Returns
                </Text>
                <Text style={styles.sectionSubtitle} numberOfLines={2}>
                  Pattern outcome history after this setup appeared.
                </Text>
              </View>

              <View style={styles.toggleRow}>
                {[
                  { key: "days5", label: "5D" },
                  { key: "days10", label: "10D" },
                ].map((t) => {
                  const isActive = horizon === t.key;

                  return (
                    <TouchableOpacity
                      key={t.key}
                      onPress={() => {
                        LayoutAnimation.configureNext(
                          LayoutAnimation.Presets.easeInEaseOut,
                        );
                        setHorizon(t.key);
                      }}
                      style={[
                        styles.togglePill,
                        isActive && styles.togglePillActive,
                      ]}
                      activeOpacity={0.85}
                    >
                      <Text
                        style={[
                          styles.toggleText,
                          isActive && styles.toggleTextActive,
                        ]}
                      >
                        {t.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* Metric tiles */}
            <View style={styles.metricGrid}>
              <ReturnMetric label="Average" value={frAvg} />
              <ReturnMetric label="Median" value={frMedian} />
              <ReturnMetric label="Upside Range" value={frBest} />
              <ReturnMetric label="Downside Range" value={frWorst} />
            </View>

            {/* Mini Histogram */}
            <MiniHistogram
              values={histValues}
              label={
                horizon === "days10"
                  ? "Historical Distribution (10D)"
                  : "Historical Distribution (5D)"
              }
            />

            {/* Bar visuals (use best/worst to scale) */}
            {frAvg == null &&
            frMedian == null &&
            frBest == null &&
            frWorst == null ? (
              <View style={styles.emptyBox}>
                <Ionicons
                  name="information-circle-outline"
                  size={18}
                  color={BRAND.sub}
                />
                <Text style={styles.emptyText}>
                  Forward return statistics are unavailable for this pattern
                  because there are not enough completed historical samples yet.
                </Text>
              </View>
            ) : (
              <Text style={styles.smallNote}>
                Based on {frCount == null ? "—" : frCount} historical
                occurrences for this horizon.
              </Text>
            )}
          </View>

          {/* PROBABILITY CONE */}
          <View style={styles.card}>
            <View style={styles.sectionHeaderRow}>
              <View style={styles.sectionAccent} />
              <Text style={styles.sectionTitle}>Historical Expected Range</Text>
              <TouchableOpacity
                onPress={() => openTip("EXPECTED_RANGE")}
                style={{ marginLeft: "auto" }}
              >
                <Ionicons
                  name="help-circle-outline"
                  size={18}
                  color={BRAND.sub}
                />
              </TouchableOpacity>
            </View>

            <View style={styles.expectedRangeTop}>
              <View>
                <Text style={styles.subLabel}>ANCHOR PRICE</Text>
                <Text style={styles.bigValue}>{fmtMoney(coneAnchor)}</Text>
              </View>

              {cone5?.mid != null && (
                <View style={styles.biasChip}>
                  <Ionicons
                    name={
                      getRangeBias(coneAnchor, cone5.mid) === "Bullish bias"
                        ? "trending-up"
                        : getRangeBias(coneAnchor, cone5.mid) === "Bearish bias"
                          ? "trending-down"
                          : "remove-outline"
                    }
                    size={14}
                    color={
                      getRangeBias(coneAnchor, cone5.mid) === "Bullish bias"
                        ? BRAND.accent
                        : getRangeBias(coneAnchor, cone5.mid) === "Bearish bias"
                          ? BRAND.red
                          : BRAND.amber
                    }
                  />
                  <Text style={styles.biasText}>
                    {getRangeBias(coneAnchor, cone5.mid)}
                  </Text>
                </View>
              )}
            </View>

            {cone && (cone5 || cone10) ? (
              <>
                {cone5 && (
                  <AnimatedRangeBar
                    animKey={`${coneAnimKey}-5`}
                    label="5-Day Historical Range"
                    low={cone5?.low}
                    mid={cone5?.mid}
                    high={cone5?.high}
                  />
                )}

                {cone10 && (
                  <AnimatedRangeBar
                    animKey={`${coneAnimKey}-10`}
                    label="10-Day Historical Range"
                    low={cone10?.low}
                    mid={cone10?.mid}
                    high={cone10?.high}
                  />
                )}
                <View style={styles.sampleQualityBox}>
                  <Ionicons
                    name="information-circle-outline"
                    size={15}
                    color={BRAND.amber}
                  />
                  <Text style={styles.sampleQualityText}>
                    {(horizon === "days10" ? cone10 : cone5)?.sampleQuality ||
                      "Sample quality unavailable"}
                    {(horizon === "days10" ? cone10 : cone5)?.count != null
                      ? ` • Based on ${(horizon === "days10" ? cone10 : cone5).count} completed samples`
                      : ""}
                  </Text>
                </View>
                {(() => {
                  const selectedCone = horizon === "days10" ? cone10 : cone5;

                  return (
                    <Text style={styles.rangeNarrative}>
                      Historically, outcomes have centered near{" "}
                      <Text style={styles.bold}>
                        {fmtMoney(selectedCone?.mid)}
                      </Text>{" "}
                      over the selected horizon, with downside near{" "}
                      <Text style={styles.bold}>
                        {fmtMoney(selectedCone?.low)}
                      </Text>{" "}
                      and upside toward{" "}
                      <Text style={styles.bold}>
                        {fmtMoney(selectedCone?.high)}
                      </Text>
                      .
                    </Text>
                  );
                })()}

                <Text style={styles.smallNote}>
                  {cone?.note ||
                    `Based on ${coneOcc ?? "multiple"} historical occurrences of the "${conePattern}" pattern.
                  This is a statistical range, not a prediction.`}
                </Text>
              </>
            ) : (
              <View style={styles.emptyBox}>
                <Ionicons
                  name="analytics-outline"
                  size={18}
                  color={BRAND.sub}
                />
                <Text style={styles.emptyText}>
                  Historical range is unavailable for this symbol/pattern right
                  now.
                </Text>
              </View>
            )}
          </View>

          {/* RECENT SAMPLES TIMELINE */}
          <View style={styles.card}>
            <View style={styles.sectionHeaderRow}>
              <View style={styles.sectionAccent} />
              <Text style={styles.sectionTitle}>Recent Occurrences</Text>
              <TouchableOpacity
                onPress={() => openTip("RECENT_OCCURRENCES")}
                style={{ marginLeft: "auto" }}
              >
                <Ionicons
                  name="help-circle-outline"
                  size={18}
                  color={BRAND.sub}
                />
              </TouchableOpacity>
            </View>
            <Text style={styles.sectionSubtitle}>
              Past instances when this pattern appeared, showing how price
              reacted on the day and what followed over the next 5 and 10
              trading days.
            </Text>
            <Text style={styles.sectionMeta}>
              Historical win rate for this pattern:{" "}
              <Text style={{ color: BRAND.accent, fontWeight: "700" }}>
                {confidencePct == null ? "—" : `${confidencePct.toFixed(0)}%`}
              </Text>
            </Text>
            {samples.length > 0 ? (
              <View style={{ marginTop: 6 }}>
                {samples.map((s, idx) => {
                  const bColor = biasColor(s.bias);
                  const d = s.date
                    ? s.date.toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })
                    : "—";

                  return (
                    <View key={`sample-${idx}`} style={styles.sampleCard}>
                      {/* LEFT TIMELINE DOT */}
                      <View style={styles.timelineCol}>
                        <View
                          style={[
                            styles.sampleDot,
                            { backgroundColor: bColor },
                          ]}
                        />
                        {idx < samples.length - 1 && (
                          <View style={styles.timelineLine} />
                        )}
                      </View>

                      {/* CONTENT */}
                      <View style={styles.sampleContent}>
                        {/* TOP ROW */}
                        <View style={styles.sampleTopRow}>
                          <Text style={styles.sampleDate}>{d}</Text>
                          <View
                            style={[styles.biasPill, { borderColor: bColor }]}
                          >
                            <Text
                              style={[styles.biasPillText, { color: bColor }]}
                            >
                              {(s.bias || "neutral").toUpperCase()}
                            </Text>
                          </View>
                        </View>

                        {/* RETURNS ROW */}
                        <View style={styles.returnsRow}>
                          <Text style={styles.returnItem}>
                            Day{" "}
                            <Text
                              style={{
                                color:
                                  (s.changePct ?? 0) >= 0
                                    ? BRAND.accent
                                    : BRAND.red,
                                fontFamily: TYPO.fontFamily.bold,
                              }}
                            >
                              {fmtReturn(s.changePct)}
                            </Text>
                          </Text>

                          <Text style={styles.returnItem}>
                            5D{" "}
                            <Text
                              style={{
                                color:
                                  (s.fwd5d ?? 0) >= 0
                                    ? BRAND.accent
                                    : BRAND.red,
                                fontFamily: TYPO.fontFamily.bold,
                              }}
                            >
                              {fmtReturn(s.fwd5d)}
                            </Text>
                          </Text>

                          <Text style={styles.returnItem}>
                            10D{" "}
                            <Text
                              style={{
                                color:
                                  (s.fwd10d ?? 0) >= 0
                                    ? BRAND.accent
                                    : BRAND.red,
                                fontFamily: TYPO.fontFamily.bold,
                              }}
                            >
                              {fmtReturn(s.fwd10d)}
                            </Text>
                          </Text>
                        </View>

                        {/* HEADLINE */}
                        {idx === 0 ||
                        s.headline !== samples[idx - 1]?.headline ? (
                          <Text style={styles.sampleHeadline} numberOfLines={2}>
                            {s.headline}
                          </Text>
                        ) : (
                          <Text
                            style={[styles.sampleHeadline, { opacity: 0.55 }]}
                          >
                            Same setup as previous occurrence
                          </Text>
                        )}
                      </View>
                    </View>
                  );
                })}
              </View>
            ) : (
              <View style={styles.emptyBox}>
                <Ionicons name="time-outline" size={18} color={BRAND.sub} />
                <Text style={styles.emptyText}>
                  No recent sample history available yet for this pattern.
                </Text>
              </View>
            )}
          </View>

          {/* PATTERN LANDSCAPE (Top patterns frequency) */}
          <View style={styles.card}>
            <View style={styles.sectionHeaderRow}>
              <View style={styles.sectionAccent} />
              <Text style={styles.sectionTitle}>Pattern Frequency</Text>
            </View>

            {allPatternsTop.length > 0 ? (
              <View style={{ marginTop: 6 }}>
                {/* Explanation line (you asked for user clarity) */}
                <Text style={styles.smallNote}>
                  This shows how often each pattern appears for {headerSymbol}.
                  Higher counts can indicate recurring institutional behavior.
                </Text>

                {allPatternsTop.map((p, idx) => {
                  const occ = safeNum(p?.occurrences) ?? 0;
                  const w = Math.max(0.08, Math.min(1, occ / (maxOcc || 1)));
                  const isCurrent =
                    String(p?.pattern || "").toUpperCase() ===
                    String(bundle.patternName || "").toUpperCase();

                  return (
                    <View key={`pbar-${idx}`} style={{ marginTop: 10 }}>
                      <View style={styles.barRowTop}>
                        <Text
                          style={[
                            styles.barLabel,
                            isCurrent && { color: BRAND.text },
                          ]}
                        >
                          {p?.pattern || "—"}
                        </Text>
                        <Text
                          style={[
                            styles.barValue,
                            isCurrent && { color: BRAND.accent },
                          ]}
                        >
                          {occ}x
                        </Text>
                      </View>
                      <View style={styles.barTrack}>
                        <View
                          style={[
                            styles.barFill,
                            {
                              width: `${w * 100}%`,
                              backgroundColor: isCurrent
                                ? BRAND.accent
                                : BRAND.border,
                            },
                          ]}
                        />
                      </View>
                    </View>
                  );
                })}
              </View>
            ) : (
              <View style={styles.emptyBox}>
                <Ionicons name="grid-outline" size={18} color={BRAND.sub} />
                <Text style={styles.emptyText}>
                  Pattern landscape is unavailable right now.
                </Text>
              </View>
            )}
          </View>

          <View style={styles.footerWrap}>
            <Text style={styles.powered}>
              Powered by <Text style={styles.brandText}>Alphaclara</Text>
            </Text>

            <Text style={styles.footerDisclaimer}>
              Pattern analytics, expected ranges, and historical return data are
              provided for informational and educational purposes only and do
              not constitute financial or investment advice.
            </Text>
          </View>
        </View>
      </Animated.View>
      <Modal
        visible={!!tip}
        transparent
        animationType="fade"
        onRequestClose={closeTip}
      >
        <Pressable style={styles.tooltipOverlay} onPress={closeTip}>
          <Pressable style={styles.tooltipCard} onPress={() => {}}>
            <View style={styles.tooltipHeader}>
              <Ionicons
                name="information-circle-outline"
                size={20}
                color={BRAND.accent}
              />
              <Text style={styles.tooltipTitle}>{tip?.title}</Text>
              <TouchableOpacity onPress={closeTip}>
                <Ionicons name="close-outline" size={22} color={BRAND.sub} />
              </TouchableOpacity>
            </View>

            <Text style={styles.tooltipBody}>{tip?.body}</Text>
            <Text style={styles.tooltipFoot}>
              Educational context only • Not financial advice
            </Text>
          </Pressable>
        </Pressable>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BRAND.bg,
    paddingHorizontal: 14,
    paddingTop: 10,
  },
  headerCard: {
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    paddingHorizontal: 15,
    paddingVertical: 14,
    marginBottom: 2,
    overflow: "hidden",
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  symbol: {
    color: BRAND.text,
    fontSize: 28,
    fontFamily: TYPO.fontFamily.extrabold,
    letterSpacing: -0.3,
  },
  name: {
    color: BRAND.sub,
    fontSize: 12.5,
    marginTop: 3,
    fontFamily: TYPO.fontFamily.medium,
  },
  priceBlock: { alignItems: "flex-end", maxWidth: "50%" },
  price: {
    color: BRAND.text,
    fontSize: 22,
    fontFamily: TYPO.fontFamily.extrabold,
    fontVariant: ["tabular-nums"],
  },
  pct: {
    fontSize: 13,
    fontFamily: TYPO.fontFamily.bold,
    marginTop: 2,
    fontVariant: ["tabular-nums"],
  },
  positive: { color: BRAND.accent },
  negative: { color: BRAND.red },

  headerMiniRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 7,
    marginTop: 12,
  },

  headerMiniPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    backgroundColor: "rgba(255,255,255,0.04)",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },

  headerMiniText: {
    color: BRAND.sub,
    fontSize: 11.5,
    fontFamily: TYPO.fontFamily.semibold,
  },

  card: {
    backgroundColor: BRAND.card,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: BRAND.border,
    paddingHorizontal: 14,
    paddingVertical: 13,
    marginTop: 10,
  },
  sectionHeaderRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 2,
  },
  sectionHeaderBlock: { marginBottom: 6 },
  sectionAccent: {
    width: 3,
    height: 16,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.55)",
    marginRight: 9,
  },
  sectionTitle: {
    color: BRAND.text,
    fontSize: 16,
    fontFamily: TYPO.fontFamily.extrabold,
    letterSpacing: -0.15,
  },
  sectionSubtitle: {
    color: BRAND.sub,
    fontSize: 12,
    lineHeight: 16,
    marginBottom: 0,
    fontFamily: TYPO.fontFamily.medium,
  },
  sectionMeta: {
    color: BRAND.sub,
    fontSize: 12,
    marginBottom: 4,
    fontFamily: TYPO.fontFamily.medium,
  },

  patternHeroCard: {
    backgroundColor: BRAND.card,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: BRAND.border,
    padding: 16,
    marginTop: 8,
  },
  patternHeroTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    columnGap: 12,
  },
  patternEyebrow: {
    color: BRAND.muted,
    fontSize: 11,
    fontFamily: TYPO.fontFamily.bold,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 5,
  },
  patternHeroTitle: {
    color: BRAND.text,
    fontSize: 21,
    lineHeight: 26,
    fontFamily: TYPO.fontFamily.extrabold,
    letterSpacing: -0.3,
  },
  patternConfidenceBadge: {
    minWidth: 82,
    borderRadius: 16,
    borderWidth: 1,
    backgroundColor: BRAND.card2,
    paddingVertical: 9,
    paddingHorizontal: 10,
    alignItems: "center",
  },
  patternConfidenceValue: {
    fontSize: 18,
    fontFamily: TYPO.fontFamily.extrabold,
    fontVariant: ["tabular-nums"],
  },
  patternConfidenceLabel: {
    color: BRAND.muted,
    fontSize: 10,
    marginTop: 2,
    fontFamily: TYPO.fontFamily.semibold,
  },
  patternStatsRow: { flexDirection: "row", columnGap: 8, marginTop: 14 },
  patternStatChip: {
    flex: 1,
    backgroundColor: BRAND.card2,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: BRAND.softBorder,
    paddingVertical: 9,
    paddingHorizontal: 10,
  },
  patternStatLabel: {
    color: BRAND.muted,
    fontSize: 10.5,
    fontFamily: TYPO.fontFamily.bold,
    textTransform: "uppercase",
    letterSpacing: 0.35,
    marginBottom: 4,
  },
  patternStatValue: {
    color: BRAND.text,
    fontSize: 13,
    fontFamily: TYPO.fontFamily.extrabold,
  },

  confTrack: {
    height: 8,
    backgroundColor: BRAND.card2,
    borderWidth: 1,
    borderColor: BRAND.softBorder,
    borderRadius: 999,
    overflow: "hidden",
    marginTop: 14,
  },
  confFill: { height: "100%", borderRadius: 999 },
  explanation: {
    color: BRAND.sub,
    fontSize: 13,
    lineHeight: 19,
    marginTop: 12,
    fontFamily: TYPO.fontFamily.medium,
  },

  subLabel: {
    color: BRAND.sub,
    fontSize: 11,
    marginBottom: 3,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    fontFamily: TYPO.fontFamily.bold,
  },
  bigValue: {
    color: BRAND.text,
    fontSize: 14.5,
    fontFamily: TYPO.fontFamily.extrabold,
  },

  sectionHeaderBlock: {
    marginBottom: 6,
  },

  toggleWrap: {
    marginTop: 0,
    alignItems: "flex-end",
  },
  toggleRow: {
    flexDirection: "row",
    backgroundColor: BRAND.card2,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: BRAND.softBorder,
    padding: 3,
  },
  togglePill: { paddingHorizontal: 11, paddingVertical: 5, borderRadius: 999 },
  togglePillActive: { backgroundColor: "rgba(255,255,255,0.12)" },
  toggleText: {
    color: BRAND.muted,
    fontSize: 11.5,
    fontFamily: TYPO.fontFamily.bold,
  },
  toggleTextActive: { color: BRAND.text },

  metricGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 4,
    marginTop: 4,
  },
  metricBox: {
    width: "48%",
    borderWidth: 1,
    borderColor: BRAND.softBorder,
    backgroundColor: BRAND.card2,
    borderRadius: 16,
    padding: 12,
  },
  metricLabel: {
    color: BRAND.muted,
    fontSize: 10.5,
    fontFamily: TYPO.fontFamily.bold,
    textTransform: "uppercase",
    letterSpacing: 0.35,
  },
  metricValue: {
    marginTop: 6,
    fontSize: 17,
    fontFamily: TYPO.fontFamily.extrabold,
    fontVariant: ["tabular-nums"],
  },

  histRow: {
    marginTop: 8,
    height: 58,
    borderWidth: 1,
    borderColor: BRAND.softBorder,
    backgroundColor: BRAND.card2,
    borderRadius: 16,
    paddingHorizontal: 9,
    paddingTop: 6,
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    overflow: "hidden",
  },
  histBin: {
    flex: 1,
    alignItems: "center",
    justifyContent: "flex-end",
    paddingHorizontal: 2,
  },
  histBar: { width: "100%", borderTopLeftRadius: 6, borderTopRightRadius: 6 },
  histMetaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 6,
  },
  histMetaText: {
    color: BRAND.muted,
    fontSize: 10.5,
    fontFamily: TYPO.fontFamily.semibold,
  },

  barRowTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 10,
  },

  barLabel: {
    color: BRAND.text,
    fontSize: 12.8,
    fontFamily: TYPO.fontFamily.semibold,
    flex: 1,
    paddingRight: 12,
  },

  barValue: {
    color: BRAND.muted,
    fontSize: 12,
    fontFamily: TYPO.fontFamily.bold,
  },

  barTrack: {
    height: 7,
    backgroundColor: BRAND.card2,
    borderWidth: 1,
    borderColor: BRAND.softBorder,
    borderRadius: 999,
    overflow: "hidden",
    marginTop: 5,
  },

  barFill: {
    height: "100%",
    borderRadius: 999,
  },
  emptyBox: {
    marginTop: 10,
    borderWidth: 1,
    borderColor: BRAND.softBorder,
    backgroundColor: BRAND.card2,
    borderRadius: 14,
    padding: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  emptyText: {
    color: BRAND.sub,
    fontSize: 12.5,
    flex: 1,
    lineHeight: 18,
    fontFamily: TYPO.fontFamily.medium,
  },
  emptyRow: { marginTop: 10 },
  smallNote: {
    color: BRAND.muted,
    fontSize: 11.5,
    marginTop: 7,
    lineHeight: 16,
    fontFamily: TYPO.fontFamily.medium,
  },

  rangeTitle: {
    color: BRAND.text,
    fontFamily: TYPO.fontFamily.bold,
    fontSize: 14,
    marginBottom: 6,
  },
  rangeTrack: {
    height: 12,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: BRAND.softBorder,
    backgroundColor: BRAND.card2,
    overflow: "hidden",
    flexDirection: "row",
    alignItems: "center",
    marginTop: 8,
  },
  rangeLeft: { height: "100%", backgroundColor: "rgba(0, 227, 150, 0.25)" },
  rangeRight: { height: "100%", backgroundColor: "rgba(96, 165, 250, 0.22)" },
  rangeMidDot: {
    width: 6,
    height: 18,
    borderRadius: 3,
    backgroundColor: BRAND.accent,
  },
  rangeValueRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 8,
    paddingHorizontal: 2,
  },
  rangeCol: { alignItems: "center", flex: 1 },
  rangeValue: {
    color: BRAND.text,
    fontFamily: TYPO.fontFamily.bold,
    fontSize: 13,
    marginBottom: 2,
  },
  rangeCaption: {
    color: BRAND.sub,
    fontSize: 11,
    fontFamily: TYPO.fontFamily.medium,
  },
  biasText: {
    marginLeft: 6,
    fontSize: 12,
    fontFamily: TYPO.fontFamily.semibold,
    color: BRAND.accent,
  },

  rangeNarrative: {
    marginTop: 10,
    color: BRAND.sub,
    fontSize: 12.5,
    lineHeight: 18,
    fontFamily: TYPO.fontFamily.medium,
  },
  bold: { fontFamily: TYPO.fontFamily.bold, color: BRAND.text },

  sampleQualityBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 10,
    padding: 9,
    borderRadius: 14,
    backgroundColor: "rgba(250,204,21,0.08)",
    borderWidth: 1,
    borderColor: "rgba(250,204,21,0.18)",
  },
  sampleQualityText: {
    color: BRAND.sub,
    fontSize: 12,
    lineHeight: 17,
    flex: 1,
    fontFamily: TYPO.fontFamily.medium,
  },
  sampleCard: {
    flexDirection: "row",
    marginBottom: 12,
  },

  timelineCol: {
    width: 18,
    alignItems: "center",
  },

  sampleDot: {
    width: 8,
    height: 8,
    borderRadius: 999,
    marginTop: 6,
  },

  timelineLine: {
    width: 1,
    flex: 1,
    backgroundColor: "rgba(255,255,255,0.08)",
    marginTop: 5,
  },

  sampleContent: {
    flex: 1,
    paddingLeft: 8,
    paddingBottom: 2,
  },

  sampleTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },

  sampleDate: {
    color: BRAND.text,
    fontSize: 13,
    fontFamily: TYPO.fontFamily.bold,
  },

  biasPill: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 3,
    backgroundColor: "rgba(255,255,255,0.03)",
  },

  biasPillText: {
    fontSize: 10,
    fontFamily: TYPO.fontFamily.bold,
  },

  returnsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 7,
    marginBottom: 5,
    paddingVertical: 7,
    paddingHorizontal: 9,
    borderRadius: 12,
    backgroundColor: BRAND.card2,
    borderWidth: 1,
    borderColor: BRAND.softBorder,
  },

  returnItem: {
    color: BRAND.muted,
    fontSize: 11.5,
    fontFamily: TYPO.fontFamily.medium,
  },

  sampleHeadline: {
    color: BRAND.sub,
    fontSize: 12.5,
    lineHeight: 18,
    fontFamily: TYPO.fontFamily.medium,
  },
  tooltipOverlay: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.55)",
    justifyContent: "center",
    padding: 18,
  },
  tooltipCard: {
    backgroundColor: BRAND.card,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: BRAND.border,
    padding: 14,
  },
  tooltipHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  tooltipTitle: {
    color: BRAND.text,
    fontSize: 15,
    fontFamily: TYPO.fontFamily.extrabold,
  },
  tooltipBody: {
    marginTop: 10,
    color: BRAND.sub,
    fontSize: 13,
    lineHeight: 18,
    fontFamily: TYPO.fontFamily.regular,
  },
  tooltipFoot: {
    marginTop: 12,
    color: BRAND.muted,
    fontSize: 11,
    fontFamily: TYPO.fontFamily.medium,
  },

  footerWrap: {
    alignItems: "center",
    marginTop: 28,
    marginBottom: 24,
    paddingHorizontal: 14,
  },
  powered: {
    color: BRAND.sub,
    fontSize: 12,
    marginBottom: 8,
    fontFamily: TYPO.fontFamily.medium,
  },
  brandText: {
    color: BRAND.text,
    fontSize: 13.5,
    fontFamily: TYPO.fontFamily.brand,
    letterSpacing: -0.45,
  },
  footerDisclaimer: {
    color: BRAND.muted,
    fontSize: 10.5,
    lineHeight: 16,
    textAlign: "center",
    fontFamily: TYPO.fontFamily.regular,
  },
  expectedRangeTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 6,
    marginBottom: 6,
  },

  biasChip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: BRAND.card2,
    borderWidth: 1,
    borderColor: BRAND.softBorder,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },

  biasText: {
    marginLeft: 6,
    fontSize: 12,
    fontFamily: TYPO.fontFamily.semibold,
    color: BRAND.accent,
  },
});
