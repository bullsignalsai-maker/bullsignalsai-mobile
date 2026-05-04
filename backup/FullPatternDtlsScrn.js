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
  Modal,          // ✅ ADD
  Pressable,      // ✅ ADD
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";

if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

// === Brand palette (match StockDetail) ===
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

const TOOLTIP = {
  EXPECTED_RANGE: {
    title: "Expected Range",
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

function pickPatternBundle({ patternInsight, smartPattern, patternStats, probabilityCone }) {
  // Prefer patternInsight (premium-ready), fallback to smartPattern, then stats
 

  const pi = patternInsight || null;
  const sp = smartPattern || null;
  const ps = patternStats || null;
  const cone = probabilityCone || null;

  const patternName =
    pi?.pattern || sp?.pattern || ps?.currentPattern?.pattern || "NO CLEAR PATTERN";

  const explanation =
    pi?.explanation ||
    sp?.explanation ||
    ps?.currentPattern?.headline ||
    "No detailed explanation available.";

  const confidencePct = pi?.confidencePct ?? null;
  const label = pi?.label ?? null;

  const current = pi?.current || ps?.currentPattern || null;

  const forwardReturns =
    pi?.history?.forwardReturns || ps?.historyForCurrent?.forwardReturns || null;

  const occurrences =
    pi?.history?.occurrences ??
    ps?.historyForCurrent?.occurrences ??
    (safeNum(cone?.occurrences) ?? null);

  const recentSamples = pi?.history?.recentSamples || ps?.historyForCurrent?.samples || [];

  const allPatterns = ps?.allPatterns || [];

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
    const v = (values || []).filter((x) => x != null && Number.isFinite(Number(x))).map(Number);
    if (v.length === 0) return null;

    const min = Math.min(...v);
    const max = Math.max(...v);
    const span = Math.max(1e-6, max - min);

    const BIN_COUNT = 7;
    const edges = Array.from({ length: BIN_COUNT + 1 }, (_, i) => min + (span * i) / BIN_COUNT);
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
        Histogram built from this pattern’s recent historical occurrences (sample forward returns).
      </Text>
    </View>
  );
});

/* -----------------------------
   Animated Range Bar
----------------------------- */
const AnimatedRangeBar = memo(function AnimatedRangeBar({ low, mid, high, label, animKey }) {
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
    <View style={{ marginTop: 10 }}>
     <Text style={styles.rangeTitle}>{label}</Text>


      <View style={styles.rangeTrack}>
        <Animated.View style={[styles.rangeLeft, { flex: leftFlex }]} />
        <Animated.View style={[styles.rangeMidDot, { transform: [{ scaleY: dotScale }] }]} />
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
    // optional: pass this later when you add premium
    isPremium: isPremiumParam,
  } = route.params || {};
  console.log(
  "🧪 PROBABILITY CONE RECEIVED:",
  JSON.stringify(route.params?.probabilityCone, null, 2)
);
  // ✅ You said: "when user comes to this screen means they are premium users"
  // So default premium to TRUE unless explicitly passed false.
  const isPremium = isPremiumParam === undefined ? true : !!isPremiumParam;

// --------------------
// Tooltip state (MUST be here)
// --------------------
const [tipKey, setTipKey] = useState(null);
const [tipAnchor, setTipAnchor] = useState(null);

const openTip = (key) => setTipKey(key);



const closeTip = () => setTipKey(null);

const tip = tipKey ? TOOLTIP[tipKey] : null;


  const bundle = useMemo(
    () =>
      pickPatternBundle({
        patternInsight,
        smartPattern,
        patternStats,
        probabilityCone,
      }),
    [patternInsight, smartPattern, patternStats, probabilityCone]
  );

  // ---- Animations ----
  const fade = useRef(new Animated.Value(0)).current;
  const slide = useRef(new Animated.Value(10)).current;
  const pulse = useRef(new Animated.Value(0)).current;

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

    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 900, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 900, useNativeDriver: true }),
      ])
    ).start();
  }, [fade, slide, pulse]);

  const cone = bundle.cone;

  const headerSymbol = symbol || quote?.symbol || "—";
  const headerName = companyName || quote?.name || "—";
  const headerPrice = quote?.current ?? quote?.price ?? quote?.close ?? null;
  const headerChangePct = quote?.changePct ?? null;

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
const cone5 =
  cone?.ranges?.days5 ??
  cone?.days5 ??
  null;

const cone10 =
  cone?.ranges?.days10 ??
  cone?.days10 ??
  null;


  const coneAnchor =
  safeNum(cone?.anchorPrice) ??
  safeNum(quote?.current) ??
  safeNum(quote?.price) ??
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

  const Bar = memo(function Bar({ label, value, maxAbs = 10 }) {
    const v = safeNum(value);
    const w = v == null ? 0 : Math.min(1, Math.abs(v) / (maxAbs || 1));
    const isPos = (v ?? 0) >= 0;
    return (
      <View style={{ marginTop: 10 }}>
        <View style={styles.barRowTop}>
          <Text style={styles.barLabel}>{label}</Text>
          <Text style={[styles.barValue, { color: v == null ? BRAND.sub : isPos ? BRAND.accent : BRAND.red }]}>
            {fmtReturn(v)}
          </Text>
        </View>
        <View style={styles.barTrack}>
          <View
            style={[
              styles.barFill,
              {
                width: `${w * 100}%`,
                backgroundColor: v == null ? BRAND.border : isPos ? BRAND.accent : BRAND.red,
              },
            ]}
          />
        </View>
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
    return Math.max(...allPatternsTop.map((p) => safeNum(p.occurrences) || 0), 1);
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
    if (horizon === "days10") return samples.map((s) => s.fwd10d).filter((x) => x != null);
    return samples.map((s) => s.fwd5d).filter((x) => x != null);
  }, [samples, horizon]);

  // a stable key to re-trigger cone animation when symbol changes
  const coneAnimKey = useMemo(() => {
    return `${headerSymbol}-${coneAnchor ?? "na"}-${coneOcc ?? "na"}`;
  }, [headerSymbol, coneAnchor, coneOcc]);

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40 }}>
      <Animated.View style={{ opacity: fade, transform: [{ translateY: slide }] }}>
        {/* HEADER CARD */}
        <LinearGradient colors={["#0f172a", "#020617"]} style={styles.headerCard}>
          
         
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
                {headerChangePct == null ? "—" : fmtPctSigned(headerChangePct, 2)}
              </Text>
            </View>
          </View>

          <View style={styles.headerMiniRow}>
            <View style={styles.headerMiniPill}>
              <Ionicons name="sparkles-outline" size={14} color={BRAND.accent} />
              <Text style={styles.headerMiniText}>Pattern Intelligence</Text>
            </View>

            {!!currentBias && (
              <View style={[styles.headerMiniPill, { borderColor: biasColor(currentBias) }]}>
                <Ionicons name="trending-up-outline" size={14} color={biasColor(currentBias)} />
                <Text style={[styles.headerMiniText, { color: biasColor(currentBias) }]}>
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

            {isPremium && (
              <View style={[styles.headerMiniPill, { borderColor: BRAND.accent, backgroundColor: "#022c22" }]}>
                <Ionicons name="diamond-outline" size={14} color={BRAND.accent} />
                <Text style={[styles.headerMiniText, { color: BRAND.accent }]}>Premium</Text>
              </View>
            )}
          </View>

          {!!currentDate && (
            <Text style={styles.asofText}>
              As of{" "}
              {currentDate.toLocaleString(undefined, {
                month: "short",
                day: "numeric",
                year: "numeric",
              })}
            </Text>
          )}
        </LinearGradient>

        {/* PATTERN OVERVIEW */}
        <View style={styles.card}>
          <View style={styles.sectionHeaderRow}>
            <View style={styles.sectionAccent} />
            <Text style={styles.sectionTitle}>Pattern Overview</Text>
          </View>

          <Text style={styles.patternTitle}>{bundle.patternName}</Text>

          {/* Confidence row (if present) */}
          <View style={styles.overviewRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.subLabel}>Confidence</Text>
              <Text style={[styles.bigValue, { color: labelColorFromConfidence(confidencePct) }]}>
                {confidencePct == null ? "—" : `${confidencePct.toFixed(0)}%`}
              </Text>
            </View>

            <View style={{ flex: 1 }}>
              <Text style={styles.subLabel}>Label</Text>
              <Text style={styles.bigValue}>
                {bundle.label ||
                  (confidencePct == null
                    ? "—"
                    : confidencePct >= 70
                    ? "Historically Strong"
                    : "Weak / Neutral")}
              </Text>
            </View>

            <View style={{ flex: 1 }}>
              <Text style={styles.subLabel}>Occurrences</Text>
              <Text style={styles.bigValue}>{occurrences == null ? "—" : String(occurrences)}</Text>
            </View>
          </View>

          {/* Confidence bar */}
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
              <Text style={styles.sectionTitle}>Forward Returns</Text>
              <View style={{ flex: 1 }} />

              {/* Toggle */}
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
                        // 🔒 force UI refresh + state update
                        LayoutAnimation.configureNext(
                            LayoutAnimation.Presets.easeInEaseOut
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
              <ReturnMetric label="Best" value={frBest} />
              <ReturnMetric label="Worst" value={frWorst} />
            </View>

            {/* Mini Histogram */}
            <MiniHistogram
              values={histValues}
              label={horizon === "days10" ? "Distribution (10D)" : "Distribution (5D)"}
            />

            {/* Bar visuals (use best/worst to scale) */}
            {(() => {
              const maxAbs = Math.max(
                5,
                Math.abs(frBest ?? 0),
                Math.abs(frWorst ?? 0),
                Math.abs(frAvg ?? 0),
                Math.abs(frMedian ?? 0)
              );

              if (frAvg == null && frMedian == null && frBest == null && frWorst == null) {
                return (
                  <View style={styles.emptyBox}>
                    <Ionicons name="information-circle-outline" size={18} color={BRAND.sub} />
                    <Text style={styles.emptyText}>
                      Forward return statistics unavailable for this pattern (not enough historical samples yet).
                    </Text>
                  </View>
                );
              }

              return (
                <View style={{ marginTop: 6 }}>
                  <Bar label="Average" value={frAvg} maxAbs={maxAbs} />
                  <Bar label="Median" value={frMedian} maxAbs={maxAbs} />
                  <Bar label="Best" value={frBest} maxAbs={maxAbs} />
                  <Bar label="Worst" value={frWorst} maxAbs={maxAbs} />
                  <Text style={styles.smallNote}>
                    Based on {frCount == null ? "—" : frCount} historical occurrences for this horizon.
                  </Text>
                </View>
              );
            })()}
          </View>

          {/* PROBABILITY CONE */}
          <View style={styles.card}>
            <View style={styles.sectionHeaderRow}>
            <View style={styles.sectionAccent} />
            <Text style={styles.sectionTitle}>Expected Range</Text>
            <TouchableOpacity onPress={() => openTip("EXPECTED_RANGE")} style={{ marginLeft: "auto" }}>
              <Ionicons name="help-circle-outline" size={18} color={BRAND.sub} />
            </TouchableOpacity>
          </View>


            <View style={styles.coneHeaderRow}>
              {/* LEFT: Anchor */}
              <View style={styles.coneLeft}>
                <Text style={styles.subLabel}>ANCHOR PRICE</Text>
                <Text style={styles.bigValue}>{fmtMoney(coneAnchor)}</Text>

                {cone5?.mid != null && (
                  <View style={styles.biasRow}>
                    <Ionicons
                      name={
                        getRangeBias(coneAnchor, cone5.mid) === "Bullish bias"
                          ? "trending-up"
                          : "trending-down"
                      }
                      size={14}
                      color={
                        getRangeBias(coneAnchor, cone5.mid) === "Bullish bias"
                          ? BRAND.accent
                          : BRAND.red
                      }
                    />
                    <Text style={styles.biasText}>
                      {getRangeBias(coneAnchor, cone5.mid)} (5D)
                    </Text>
                  </View>
                )}
              </View>

              {/* RIGHT: Pattern context */}
              <View style={styles.coneRight}>
                <Text style={styles.metaText}>Pattern</Text>
                <Text style={styles.metaStrong}>{conePattern}</Text>

                <Text style={[styles.metaText, { marginTop: 6 }]}>
                  Occurrences
                </Text>
                <Text style={styles.metaStrong}>{coneOcc}</Text>
              </View>
            </View>



            {cone?.ranges && (cone5 || cone10) ? (

              <>
                <AnimatedRangeBar
                  animKey={`${coneAnimKey}-5`}
                  label="5-Day Expected Range"
                  low={cone5?.low}
                  mid={cone5?.mid}
                  high={cone5?.high}
                />
                <AnimatedRangeBar
                  animKey={`${coneAnimKey}-10`}
                  label="10D Expected Range"
                  low={cone10?.low}
                  mid={cone10?.mid}
                  high={cone10?.high}
                />
                <Text style={styles.rangeNarrative}>
                Historically, price tends to gravitate near{" "}
                <Text style={styles.bold}>{fmtMoney(cone5?.mid)}</Text> over the next 5 days,
                with typical downside toward{" "}
                <Text style={styles.bold}>{fmtMoney(cone5?.low)}</Text> and upside toward{" "}
                <Text style={styles.bold}>{fmtMoney(cone5?.high)}</Text>.
              </Text>

              <Text style={styles.smallNote}>
                {cone?.note ||
                  `Based on ${coneOcc ?? "multiple"} historical occurrences of the "${conePattern}" pattern.
                  This is a statistical range, not a prediction.`}
              </Text>


              </>
            ) : (
              <View style={styles.emptyBox}>
                <Ionicons name="analytics-outline" size={18} color={BRAND.sub} />
                <Text style={styles.emptyText}>
                  Expected range is unavailable for this symbol/pattern right now.
                </Text>
              </View>
            )}
          </View>

          {/* RECENT SAMPLES TIMELINE */}
          <View style={styles.card}>
            <View style={styles.sectionHeaderRow}>
              <View style={styles.sectionAccent} />
              <Text style={styles.sectionTitle}>Recent Occurrences</Text>
              <TouchableOpacity onPress={() => openTip("RECENT_OCCURRENCES")} style={{ marginLeft: "auto" }}>
              <Ionicons name="help-circle-outline" size={18} color={BRAND.sub} />
            </TouchableOpacity>

            </View>
             <Text style={styles.sectionSubtitle}>
                Past instances when this pattern appeared, showing how price reacted on the day
                and what followed over the next 5 and 10 trading days.
              </Text>
              <Text style={styles.sectionMeta}>
              Historical win rate for this pattern:{" "}
              <Text style={{ color: BRAND.accent, fontWeight: "700" }}>73%</Text>
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
                      <View style={[styles.sampleDot, { backgroundColor: bColor }]} />
                      {idx < samples.length - 1 && <View style={styles.timelineLine} />}
                    </View>

                    {/* CONTENT */}
                    <View style={styles.sampleContent}>
                      {/* TOP ROW */}
                      <View style={styles.sampleTopRow}>
                        <Text style={styles.sampleDate}>{d}</Text>
                        <View style={[styles.biasPill, { borderColor: bColor }]}>
                          <Text style={[styles.biasPillText, { color: bColor }]}>
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
                              color: (s.changePct ?? 0) >= 0 ? BRAND.accent : BRAND.red,
                              fontWeight: "600",
                            }}
                          >
                            {fmtReturn(s.changePct)}
                          </Text>
                        </Text>

                        <Text style={styles.returnItem}>
                          5D{" "}
                          <Text
                            style={{
                              color: (s.fwd5d ?? 0) >= 0 ? BRAND.accent : BRAND.red,
                              fontWeight: "600",
                            }}
                          >
                            {fmtReturn(s.fwd5d)}
                          </Text>
                        </Text>

                        <Text style={styles.returnItem}>
                          10D{" "}
                          <Text
                            style={{
                              color: (s.fwd10d ?? 0) >= 0 ? BRAND.accent : BRAND.red,
                              fontWeight: "600",
                            }}
                          >
                            {fmtReturn(s.fwd10d)}
                          </Text>
                        </Text>
                      </View>

                      {/* HEADLINE */}
                      {idx === 0 || s.headline !== samples[idx - 1]?.headline ? (
                      <Text style={styles.sampleHeadline} numberOfLines={2}>
                        {s.headline}
                      </Text>
                    ) : (
                      <Text style={[styles.sampleHeadline, { opacity: 0.55 }]}>
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
              <Text style={styles.sectionTitle}>Pattern Landscape</Text>
            </View>

            {allPatternsTop.length > 0 ? (
              <View style={{ marginTop: 6 }}>
                {/* Explanation line (you asked for user clarity) */}
                <Text style={styles.smallNote}>
                  This shows how often each pattern appears for {headerSymbol}. Higher counts can indicate recurring
                  institutional behavior.
                </Text>

                {allPatternsTop.map((p, idx) => {
                  const occ = safeNum(p?.occurrences) ?? 0;
                  const w = Math.max(0.08, Math.min(1, occ / (maxOcc || 1)));
                  const isCurrent =
                    String(p?.pattern || "").toUpperCase() === String(bundle.patternName || "").toUpperCase();

                  return (
                    <View key={`pbar-${idx}`} style={{ marginTop: 10 }}>
                      <View style={styles.barRowTop}>
                        <Text style={[styles.barLabel, isCurrent && { color: BRAND.accent }]}>
                          {p?.pattern || "—"}
                        </Text>
                        <Text style={[styles.barValue, isCurrent && { color: BRAND.accent }]}>
                          {occ}x
                        </Text>
                      </View>
                      <View style={styles.barTrack}>
                        <View
                          style={[
                            styles.barFill,
                            {
                              width: `${w * 100}%`,
                              backgroundColor: isCurrent ? BRAND.accent : BRAND.border,
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
              Educational only • Not financial advice
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
    paddingHorizontal: 16,
    paddingTop: 12,
  },

  headerCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: BRAND.border,
    paddingHorizontal: 12,
    paddingVertical: 12,
    marginBottom: 8,
    overflow: "hidden",
  },
  premiumRibbon: {
    position: "absolute",
    top: 10,
    right: -36,
    transform: [{ rotate: "35deg" }],
    backgroundColor: "rgba(0,227,150,0.18)",
    borderWidth: 1,
    borderColor: "rgba(0,227,150,0.35)",
    paddingVertical: 4,
    paddingHorizontal: 42,
  },
  premiumRibbonText: {
    color: BRAND.accent,
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1,
    textAlign: "center",
  },

  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  symbol: { color: BRAND.text, fontSize: 26, fontWeight: "800" },
  name: { color: BRAND.sub, fontSize: 13, marginTop: 2 },
  priceBlock: { alignItems: "flex-end", maxWidth: "50%" },
  price: { color: BRAND.text, fontSize: 22, fontWeight: "700" },
  pct: { fontSize: 13, fontWeight: "600", marginTop: 2 },
  positive: { color: BRAND.accent },
  negative: { color: BRAND.red },
  asofText: { color: BRAND.sub, fontSize: 11, marginTop: 8, textAlign: "right" },

  headerMiniRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 10 },
  headerMiniPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
    borderColor: BRAND.border,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  headerMiniText: { color: BRAND.sub, fontSize: 12, fontWeight: "600" },

  card: {
    backgroundColor: BRAND.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: BRAND.border,
    paddingHorizontal: 12,
    paddingVertical: 12,
    marginTop: 10,
  },
  sectionHeaderRow: { flexDirection: "row", alignItems: "center", marginBottom: 6 },
  sectionAccent: {
    width: 4,
    height: 18,
    borderRadius: 2,
    backgroundColor: BRAND.accent,
    marginRight: 8,
  },
  sectionTitle: { color: BRAND.accent, fontSize: 15, fontWeight: "800" },

  patternTitle: { color: BRAND.text, fontSize: 20, fontWeight: "900", marginTop: 4 },
  explanation: { color: BRAND.text, fontSize: 13.5, lineHeight: 19, marginTop: 10 },

  overviewRow: { flexDirection: "row", marginTop: 12, gap: 10 },
  subLabel: { color: BRAND.sub, fontSize: 11, marginBottom: 3, textTransform: "uppercase", letterSpacing: 0.5 },
  bigValue: { color: BRAND.text, fontSize: 14.5, fontWeight: "800" },

  confTrack: {
    height: 10,
    backgroundColor: "#0b1220",
    borderWidth: 1,
    borderColor: BRAND.border,
    borderRadius: 999,
    overflow: "hidden",
    marginTop: 10,
  },
  confFill: { height: "100%", borderRadius: 999 },


  toggleRow: { flexDirection: "row", gap: 6 },
  togglePill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "transparent",
    backgroundColor: "#0b1220",
  },
  togglePillActive: { borderColor: BRAND.accent, backgroundColor: "#022c22" },
  toggleText: { color: BRAND.sub, fontSize: 12, fontWeight: "700" },
  toggleTextActive: { color: BRAND.accent },

  metricGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 8 },
  metricBox: {
    width: "48%",
    borderWidth: 1,
    borderColor: BRAND.border,
    backgroundColor: "#020617",
    borderRadius: 10,
    padding: 10,
  },
  metricLabel: { color: BRAND.sub, fontSize: 12, fontWeight: "700" },
  metricValue: { marginTop: 6, fontSize: 16, fontWeight: "900" },

  // Histogram
  histRow: {
    marginTop: 8,
    height: 52,
    borderWidth: 1,
    borderColor: BRAND.border,
    backgroundColor: "#020617",
    borderRadius: 10,
    paddingHorizontal: 8,
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
  histBar: {
    width: "100%",
    borderTopLeftRadius: 6,
    borderTopRightRadius: 6,
  },
  histMetaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 6,
  },
  histMetaText: { color: BRAND.sub, fontSize: 11, fontWeight: "700" },

  barRowTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  barLabel: { color: BRAND.text, fontSize: 13, fontWeight: "700", flex: 1, paddingRight: 12 },
  barValue: { color: BRAND.sub, fontSize: 13, fontWeight: "800" },
  barTrack: {
    height: 10,
    backgroundColor: "#0b1220",
    borderWidth: 1,
    borderColor: BRAND.border,
    borderRadius: 999,
    overflow: "hidden",
    marginTop: 6,
  },
  barFill: { height: "100%", borderRadius: 999 },

  emptyBox: {
    marginTop: 10,
    borderWidth: 1,
    borderColor: BRAND.border,
    backgroundColor: "#020617",
    borderRadius: 10,
    padding: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  emptyText: { color: BRAND.sub, fontSize: 12.5, flex: 1, lineHeight: 18 },
  emptyRow: { marginTop: 10 },
  smallNote: { color: BRAND.sub, fontSize: 11.5, marginTop: 10, lineHeight: 16 },

 
  coneTile: {
    flex: 1,
    borderWidth: 1,
    borderColor: BRAND.border,
    backgroundColor: "#020617",
    borderRadius: 10,
    padding: 10,
  },
  rangeTopRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  rangeLabel: { color: BRAND.text, fontSize: 13, fontWeight: "800" },
  rangeMeta: { color: BRAND.sub, fontSize: 11.5, fontWeight: "600" },
  rangeTrack: {
    height: 12,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: BRAND.border,
    backgroundColor: "#0b1220",
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
  rangeCaptionRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 6 },
  rangeCaption: { color: BRAND.sub, fontSize: 11, fontWeight: "700" },

  // Samples
  sampleRow: {
    flexDirection: "row",
    gap: 10,
    borderWidth: 1,
    borderColor: BRAND.border,
    backgroundColor: "#020617",
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
  },
  sampleDot: { width: 10, height: 10, borderRadius: 999, marginTop: 6 },
  sampleTopRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  sampleDate: { color: BRAND.text, fontSize: 12.5, fontWeight: "800" },
  biasPill: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  biasPillText: { fontSize: 11, fontWeight: "900" },
  sampleHeadline: { color: BRAND.sub, fontSize: 12.5, marginTop: 6, lineHeight: 18 },
  sampleStatsRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 10 },
  sampleStat: { flex: 1 },
  sampleStatLabel: { color: BRAND.sub, fontSize: 11, fontWeight: "700" },
  sampleStatValue: { color: BRAND.text, fontSize: 12.5, fontWeight: "900", marginTop: 4 },

  // Lock overlay
  lockOverlay: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    justifyContent: "center",
    alignItems: "center",
    padding: 18,
  },
  lockCard: {
    width: "100%",
    borderWidth: 1,
    borderColor: BRAND.border,
    borderRadius: 16,
    backgroundColor: "rgba(2, 6, 23, 0.92)",
    padding: 16,
    alignItems: "center",
  },
  lockTitle: { color: BRAND.text, fontSize: 16, fontWeight: "900", marginTop: 8 },
  lockText: { color: BRAND.sub, fontSize: 12.5, lineHeight: 18, textAlign: "center", marginTop: 8 },
  unlockBtn: {
    marginTop: 12,
    width: "100%",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: BRAND.accent,
    paddingVertical: 12,
    alignItems: "center",
  },
  unlockBtnText: { color: BRAND.accent, fontSize: 14, fontWeight: "900" },
  lockFinePrint: { marginTop: 10, color: BRAND.sub, fontSize: 11, textAlign: "center" },
rangeNarrative: {
  marginTop: 10,
  color: BRAND.text,
  fontSize: 12.5,
  lineHeight: 18,
},

bold: {
  fontWeight: "900",
  color: BRAND.accent,
},
premiumPill: {
  flexDirection: "row",
  alignItems: "center",
  backgroundColor: "#F5C56B",
  paddingHorizontal: 10,
  paddingVertical: 4,
  borderRadius: 14,
},

premiumText: {
  marginLeft: 4,
  fontWeight: "700",
  color: "#1E1B10",
  fontSize: 12,
},
rangeTitle: {
  color: "#E8F0FF",
  fontWeight: "600",
  fontSize: 14,
  marginBottom: 6,
},

rangeValueRow: {
  flexDirection: "row",
  justifyContent: "space-between",
  marginTop: 8,
  paddingHorizontal: 2,
},

rangeCol: {
  alignItems: "center",
  flex: 1,
},

rangeValue: {
  color: BRAND.accent,
  fontWeight: "700",
  fontSize: 13,
  marginBottom: 2,
},

rangeCaption: {
  color: BRAND.sub,
  fontSize: 11,
},
coneHeaderRow: {
  flexDirection: "row",
  justifyContent: "space-between",
  marginBottom: 14,
},

coneLeft: {
  flex: 1,
},

coneRight: {
  alignItems: "flex-end",
  justifyContent: "center",
},

metaText: {
  color: BRAND.sub,
  fontSize: 11,
},

metaStrong: {
  color: "#E8F0FF",
  fontWeight: "600",
  fontSize: 12,
},

biasRow: {
  flexDirection: "row",
  alignItems: "center",
  marginTop: 6,
},

biasText: {
  marginLeft: 6,
  fontSize: 12,
  fontWeight: "600",
  color: BRAND.accent,
},
sampleCard: {
  flexDirection: "row",
  marginBottom: 14,
},

timelineCol: {
  width: 18,
  alignItems: "center",
},

timelineLine: {
  width: 2,
  flex: 1,
  backgroundColor: "rgba(255,255,255,0.08)",
  marginTop: 4,
},

sampleContent: {
  flex: 1,
  paddingLeft: 8,
},

returnsRow: {
  flexDirection: "row",
  justifyContent: "space-between",
  marginTop: 6,
  marginBottom: 6,
},

returnItem: {
  color: BRAND.sub,
  fontSize: 12,
},

sampleHeadline: {
  color: "#D6E2FF",
  fontSize: 13,
  lineHeight: 18,
  opacity: 0.85,
},
sectionSubtitle: {
  color: BRAND.sub,
  fontSize: 12.5,
  lineHeight: 17,
  marginBottom: 6,
},
sectionMeta: {
  color: BRAND.sub,
  fontSize: 12,
  marginBottom: 4,
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
  backgroundColor: "#020617",
  borderRadius: 16,
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
  fontWeight: "800",
},
tooltipBody: {
  marginTop: 10,
  color: BRAND.sub,
  fontSize: 13,
  lineHeight: 18,
},
tooltipFoot: {
  marginTop: 12,
  color: BRAND.sub,
  fontSize: 11,
  opacity: 0.8,
},
tooltipFloating: {
  position: "absolute",
  zIndex: 999,
  width: 320,
},

});
