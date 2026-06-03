// screens/FullChartScreen.js
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Animated,
  Easing,
  Modal,
  Pressable,
  PanResponder,
  ActivityIndicator,
  Platform,
  Image,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import Svg, { Path, Line, Circle, Rect } from "react-native-svg";
import { getFullYearCandles } from "../services/candleService";
import { StatusBar } from "react-native";
import { BRAND } from "../constants/theme";
import { TYPO } from "../constants/typography";
import { displayRating, signalColor } from "../utils/signalUtils";
/* ================= HELPERS ================= */
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const money = (n) => (n == null ? "—" : `$${Number(n).toFixed(2)}`);
const pct = (n, d = 2) => (n == null ? "—" : `${Number(n).toFixed(d)}%`);
const safeNum = (n) => (Number.isFinite(Number(n)) ? Number(n) : null);

function colorFromSigned(v) {
  if (v == null) return BRAND.sub;
  return v >= 0 ? BRAND.accent : BRAND.red;
}
function formatDateShort(iso) {
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return "—";
  const d = new Date(ms);
  const m = d.toLocaleString("en-US", { month: "short" });
  const day = d.getDate();
  return `${m} ${day}`;
}

function stdev(arr) {
  if (!arr || arr.length < 2) return null;
  const mean = arr.reduce((a, b) => a + b, 0) / arr.length;
  const v =
    arr.reduce((a, b) => a + (b - mean) * (b - mean), 0) / (arr.length - 1);
  return Math.sqrt(v);
}

function corr(x, y) {
  if (!x || !y || x.length !== y.length || x.length < 3) return null;
  const mx = x.reduce((a, b) => a + b, 0) / x.length;
  const my = y.reduce((a, b) => a + b, 0) / y.length;
  let num = 0;
  let dx = 0;
  let dy = 0;
  for (let i = 0; i < x.length; i++) {
    const a = x[i] - mx;
    const b = y[i] - my;
    num += a * b;
    dx += a * a;
    dy += b * b;
  }
  const den = Math.sqrt(dx * dy);
  if (!den) return null;
  return num / den;
}

function linearSlope(y) {
  // slope of y vs index (0..n-1)
  if (!y || y.length < 2) return null;
  const n = y.length;
  const xMean = (n - 1) / 2;
  const yMean = y.reduce((a, b) => a + b, 0) / n;
  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i++) {
    const dx = i - xMean;
    num += dx * (y[i] - yMean);
    den += dx * dx;
  }
  if (!den) return null;
  return num / den;
}

function buildPath(points) {
  if (!points || points.length === 0) return "";
  const [p0] = points;
  let d = `M ${p0.x.toFixed(2)} ${p0.y.toFixed(2)}`;
  for (let i = 1; i < points.length; i++) {
    const p = points[i];
    d += ` L ${p.x.toFixed(2)} ${p.y.toFixed(2)}`;
  }
  return d;
}

/* ================= TOOLTIP COPY ================= */
const TOOLTIP = {
  VOL: {
    title: "Volatility (Realized)",
    body: "This screen estimates realized volatility from daily returns. Higher volatility means wider swings and wider risk bands.",
  },
  DD: {
    title: "Pullback",
    body: "Pullback measures the peak-to-trough decline during the period. Bigger drawdowns mean deeper pullbacks from highs.",
  },
  VOLCONF: {
    title: "Volume Context",
    body: "Volume can confirm price moves: higher volume on breakouts supports conviction. Falling price on rising volume can signal distribution.",
  },
};

/* ================= COMPONENT ================= */
export default function FullChartScreen({ route, navigation }) {
  const params = route?.params || {};
  const symbol = String(params.symbol || "").toUpperCase();
  const companyName = params.companyName || params.name || symbol || "—";
  const logoUrl = params.logoUrl || params.profile?.logoUrl || null;
  const quote = params.quote || null;
  const bullbrain = params.bullbrain || null;

  const fade = useRef(new Animated.Value(0)).current;
  const slide = useRef(new Animated.Value(10)).current;

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);
  const [payload, setPayload] = useState(null);

  const [tipKey, setTipKey] = useState(null);
  const openTip = useCallback((k) => setTipKey(k), []);
  const closeTip = useCallback(() => setTipKey(null), []);
  const tip = tipKey ? TOOLTIP[tipKey] : null;
  const [chartTouch, setChartTouch] = useState(false);

  // tooltip interaction
  const [activeIdx, setActiveIdx] = useState(null);

  // ✅ NEW: chart width measured at runtime so drag index math is correct
  const [chartW, setChartW] = useState(360);

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

  const load = useCallback(async () => {
    if (!symbol) {
      setErr("Missing symbol");
      setLoading(false);
      return;
    }

    setLoading(true);
    setErr(null);

    try {
      const res = await getFullYearCandles(symbol);
      setPayload(res);
    } catch (e) {
      setErr(e?.message || "Failed to load chart data");
    } finally {
      setLoading(false);
    }
  }, [symbol]);

  useEffect(() => {
    load();
  }, [load]);

  const candles = payload?.candles || [];

  const derived = useMemo(() => {
    if (!candles.length) {
      return {
        last: null,
        first: null,
        high: null,
        low: null,
        intradayHigh: null,
        intradayLow: null,
        highIdx: null,
        lowIdx: null,
        ret1yPct: null,
        volAnn: null,
        maxDrawdownPct: null,
        trendLabel: "—",
        trendNote: "No price history available.",
        volumeNote: "No volume history available.",
        volumeUpDownRatio: null,
        volAbsRetCorr: null,
      };
    }

    const closes = candles
      .map((c) => safeNum(c.close))
      .filter((x) => x != null);

    const first = candles[0]?.close ?? null;
    const last = candles[candles.length - 1]?.close ?? null;

    let hi = -Infinity;
    let lo = Infinity;
    let hiIdx = null;
    let loIdx = null;

    let intradayHigh = -Infinity;
    let intradayLow = Infinity;

    for (let i = 0; i < candles.length; i++) {
      const c = safeNum(candles[i]?.close);
      const h = safeNum(candles[i]?.high);
      const l = safeNum(candles[i]?.low);

      if (c != null) {
        if (c > hi) {
          hi = c;
          hiIdx = i;
        }

        if (c < lo) {
          lo = c;
          loIdx = i;
        }
      }

      if (h != null && h > intradayHigh) {
        intradayHigh = h;
      }

      if (l != null && l < intradayLow) {
        intradayLow = l;
      }
    }
    const ret1yPct =
      first != null && last != null && first !== 0
        ? ((last - first) / first) * 100
        : null;

    // daily returns
    const rets = [];
    const absRets = [];
    for (let i = 1; i < candles.length; i++) {
      const p0 = safeNum(candles[i - 1]?.close);
      const p1 = safeNum(candles[i]?.close);
      if (p0 == null || p1 == null || p0 === 0) continue;
      const r = (p1 - p0) / p0;
      rets.push(r);
      absRets.push(Math.abs(r));
    }

    const volDaily = stdev(rets);
    const volAnn = volDaily == null ? null : volDaily * Math.sqrt(252) * 100;

    // max drawdown
    let peak = -Infinity;
    let maxDD = 0;
    for (let i = 0; i < closes.length; i++) {
      const p = closes[i];
      peak = Math.max(peak, p);
      const dd = peak === 0 ? 0 : (p - peak) / peak; // negative
      maxDD = Math.min(maxDD, dd);
    }
    const maxDrawdownPct = maxDD * 100;

    // trend: slope of closes
    const slope = linearSlope(closes);
    let trendLabel = "Sideways";
    if (slope != null) {
      // normalize slope vs price level
      const level = closes.reduce((a, b) => a + b, 0) / closes.length;
      const norm = level ? slope / level : 0;
      if (norm > 0.00035) trendLabel = "Uptrend";
      else if (norm < -0.00035) trendLabel = "Downtrend";
      else trendLabel = "Sideways";
    }

    const volState =
      volAnn == null
        ? "unknown"
        : volAnn >= 60
          ? "high"
          : volAnn >= 35
            ? "moderate"
            : "low";

    const trendNote =
      trendLabel === "Uptrend"
        ? `Price has generally climbed over the last year with ${volState} volatility. Pullbacks were present, but trend direction stayed constructive.`
        : trendLabel === "Downtrend"
          ? `Price has generally declined over the last year with ${volState} volatility. Rallies have struggled to hold, suggesting weaker structure.`
          : `Price has been range-bound overall with ${volState} volatility. Breakouts may need volume confirmation to be trusted.`;

    // volume confirmation
    const upVol = [];
    const downVol = [];
    const absRetForCorr = [];
    const volForCorr = [];
    for (let i = 1; i < candles.length; i++) {
      const p0 = safeNum(candles[i - 1]?.close);
      const p1 = safeNum(candles[i]?.close);
      const v = safeNum(candles[i]?.volume);
      if (p0 == null || p1 == null || v == null || p0 === 0) continue;
      const r = (p1 - p0) / p0;
      if (r >= 0) upVol.push(v);
      else downVol.push(v);
      absRetForCorr.push(Math.abs(r));
      volForCorr.push(v);
    }

    const avg = (a) =>
      a.length ? a.reduce((x, y) => x + y, 0) / a.length : null;
    const upAvg = avg(upVol);
    const downAvg = avg(downVol);

    const volumeUpDownRatio =
      upAvg != null && downAvg != null && downAvg !== 0
        ? upAvg / downAvg
        : null;

    const volAbsRetCorr = corr(absRetForCorr, volForCorr);

    let volumeNote = "Volume data is limited for this period.";
    if (volumeUpDownRatio != null) {
      if (volumeUpDownRatio > 1.08) {
        volumeNote =
          "Volume tends to be heavier on up days than down days, which can support bullish follow-through when price breaks higher.";
      } else if (volumeUpDownRatio < 0.92) {
        volumeNote =
          "Volume tends to be heavier on down days than up days, which can be a caution sign (distribution) if price starts slipping.";
      } else {
        volumeNote =
          "Volume is fairly balanced between up and down days, so price trend (and breakouts) may need extra confirmation.";
      }
    }

    // add volatility confirmation sentence
    if (volAbsRetCorr != null) {
      if (volAbsRetCorr > 0.25) {
        volumeNote +=
          " Also, bigger moves often come with higher volume (strong participation).";
      } else if (volAbsRetCorr < -0.15) {
        volumeNote +=
          " Interestingly, bigger moves are not consistently supported by volume (mixed participation).";
      } else {
        volumeNote +=
          " Participation is inconsistent — not every big move is strongly backed by volume.";
      }
    }

    return {
      last,
      first,
      high: hi === -Infinity ? null : hi,
      low: lo === Infinity ? null : lo,
      intradayHigh: intradayHigh === -Infinity ? null : intradayHigh,
      intradayLow: intradayLow === Infinity ? null : intradayLow,
      highIdx: hiIdx,
      lowIdx: loIdx,
      ret1yPct,
      volAnn,
      maxDrawdownPct,
      trendLabel,
      trendNote,
      volumeNote,
      volumeUpDownRatio,
      volAbsRetCorr,
    };
  }, [candles]);

  // Chart geometry (✅ CHART_W now dynamic, CHART_H unchanged)
  const CHART_W = chartW;
  const CHART_H = 170;
  const PAD_X = 8;
  const PAD_Y = 10;

  const chart = useMemo(() => {
    if (!candles.length) return null;

    const closes = candles
      .map((c) => safeNum(c.close))
      .map((v) => (v == null ? 0 : v));
    const vols = candles
      .map((c) => safeNum(c.volume))
      .map((v) => (v == null ? 0 : v));

    let min = Infinity;
    let max = -Infinity;

    for (let i = 0; i < closes.length; i++) {
      const v = closes[i];
      if (!Number.isFinite(v)) continue;
      min = Math.min(min, v);
      max = Math.max(max, v);
    }

    if (!Number.isFinite(min) || !Number.isFinite(max) || min === max) {
      min = min === Infinity ? 0 : min - 1;
      max = max === -Infinity ? 1 : max + 1;
    }

    const innerW = CHART_W - PAD_X * 2;
    const innerH = CHART_H - PAD_Y * 2;

    const points = closes.map((v, i) => {
      const x = PAD_X + (i / Math.max(1, closes.length - 1)) * innerW;
      const y = PAD_Y + (1 - (v - min) / (max - min)) * innerH;
      return { x, y, v, i };
    });

    const path = buildPath(points);

    const maxVol = Math.max(...vols, 1);
    const volBars = vols.map((v, i) => {
      const x = PAD_X + (i / Math.max(1, vols.length - 1)) * innerW;
      const h = (v / maxVol) * 46; // small histogram height
      return { x, h };
    });

    return { min, max, points, path, volBars, innerW, innerH };
  }, [candles, CHART_W]);

  // ✅ drag crosshair (keep your logic, but improve UX)
  const xToIndex = useCallback(
    (x) => {
      if (!chart || !candles.length || !Number.isFinite(x)) return null;
      const innerW = CHART_W - PAD_X * 2;
      const rel = clamp((x - PAD_X) / innerW, 0, 1);
      const idx = Math.round(rel * (candles.length - 1));
      return clamp(idx, 0, candles.length - 1);
    },
    [chart, candles.length, CHART_W, PAD_X],
  );

  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onStartShouldSetPanResponderCapture: () => true,
      onMoveShouldSetPanResponderCapture: () => true,
      onPanResponderTerminationRequest: () => false,

      onPanResponderGrant: (evt) => {
        setChartTouch(true);
        const x = evt.nativeEvent.locationX;
        setActiveIdx(xToIndex(x));
      },
      onPanResponderMove: (evt) => {
        const x = evt.nativeEvent.locationX;
        setActiveIdx(xToIndex(x));
      },
      onPanResponderRelease: () => {
        setChartTouch(false);
      },
      onPanResponderTerminate: () => {
        setChartTouch(false);
      },
    }),
  ).current;

  const active = useMemo(() => {
    if (activeIdx == null || !chart) return null;
    const p = chart.points[activeIdx];
    const c = candles[activeIdx];
    if (!p || !c) return null;
    return {
      idx: activeIdx,
      x: p.x,
      y: p.y,
      close: c.close ?? null,
      open: c.open ?? null,
      high: c.high ?? null,
      low: c.low ?? null,
      volume: c.volume ?? null,
      t: c.t,
    };
  }, [activeIdx, chart, candles]);
  const headerPrice = quote?.current ?? derived.last ?? null;
  const headerChangePct = quote?.changePct ?? null;
  const signal =
    bullbrain?.signal ??
    params.authoritativeSignal ??
    params.hybridSignal ??
    null;
  const confidence = bullbrain?.confidence ?? params.hybridScore ?? null;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingBottom: 40 }}
      scrollEnabled={!chartTouch}
    >
      {/* ✅ NEW: Top spacing + back row like you asked */}
      <View style={styles.topBar}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backBtn}
          activeOpacity={0.85}
        >
          <Ionicons name="chevron-back" size={22} color={BRAND.text} />
        </TouchableOpacity>
        <Text style={styles.topBarTitle}>Chart Details</Text>
        <View style={{ width: 44 }} />
      </View>

      <Animated.View
        style={{ opacity: fade, transform: [{ translateY: slide }] }}
      >
        {/* ===== HEADER ===== */}
        <LinearGradient
          colors={["#0f172a", "#020617"]}
          style={styles.headerCard}
        >
          <View style={styles.headerTopRow}>
            <View style={styles.headerIdentity}>
              <View style={styles.headerLogoWrap}>
                {logoUrl ? (
                  <Image
                    source={{ uri: logoUrl }}
                    style={styles.headerLogo}
                    resizeMode="contain"
                  />
                ) : (
                  <Text style={styles.headerLogoText}>
                    {String(symbol || "A").slice(0, 1)}
                  </Text>
                )}
              </View>

              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.symbol}>{symbol || "—"}</Text>
                <Text style={styles.name} numberOfLines={1}>
                  {companyName || "—"}
                </Text>
              </View>
            </View>

            <View style={{ alignItems: "flex-end" }}>
              <Text style={styles.price}>{money(headerPrice)}</Text>
              <Text
                style={[
                  styles.change,
                  headerChangePct >= 0 ? styles.pos : styles.neg,
                ]}
              >
                {headerChangePct == null
                  ? "—"
                  : `${headerChangePct >= 0 ? "+" : ""}${Number(headerChangePct).toFixed(2)}%`}
              </Text>
            </View>
          </View>

          <View style={styles.headerActionsRow}>
            <View style={styles.premiumBadge}>
              <Ionicons
                name="analytics-outline"
                size={14}
                color={BRAND.accent}
              />
              <Text style={styles.premiumBadgeText}>Full Chart View</Text>
            </View>

            {signal ? (
              <View
                style={[
                  styles.signalPill,
                  { borderColor: signalColor(signal) },
                ]}
              >
                <Ionicons
                  name="sparkles-outline"
                  size={14}
                  color={signalColor(signal)}
                />
                <Text
                  style={[
                    styles.signalPillText,
                    { color: signalColor(signal) },
                  ]}
                >
                  {displayRating(signal)}
                  {confidence != null
                    ? ` • ${Number(confidence).toFixed(1)}%`
                    : ""}
                </Text>
              </View>
            ) : null}
          </View>

          <Text style={styles.summary}>
            {candles.length
              ? `Showing ~1 year of daily candles (${candles.length} sessions). Drag on the chart to inspect price.`
              : `Chart data will load when this screen opens.`}
          </Text>
        </LinearGradient>

        {/* ===== CHART CARD ===== */}
        <View style={styles.card}>
          <View style={styles.chartSectionHeaderRow}>
            <View style={styles.sectionAccent} />

            <Text style={styles.sectionTitle}>1-Year Price Movement</Text>

            <TouchableOpacity
              onPress={load}
              style={styles.refreshBtn}
              activeOpacity={0.85}
            >
              <Ionicons name="refresh-outline" size={16} color={BRAND.sub} />
            </TouchableOpacity>
          </View>
          <Text style={styles.helperText}>
            Daily price history with volume activity for market context. Data
            may be delayed or unavailable.
          </Text>
          {loading ? (
            <View style={styles.loadingBox}>
              <ActivityIndicator />
              <Text style={styles.loadingText}>Loading candles…</Text>
            </View>
          ) : err ? (
            <View style={styles.errorBox}>
              <Ionicons
                name="alert-circle-outline"
                size={18}
                color={BRAND.red}
              />
              <Text style={styles.errorText}>{err}</Text>
              <TouchableOpacity
                onPress={load}
                style={styles.retryBtn}
                activeOpacity={0.85}
              >
                <Text style={styles.retryText}>Retry</Text>
              </TouchableOpacity>
            </View>
          ) : !chart ? (
            <Text style={styles.note}>No chart points available.</Text>
          ) : (
            // ✅ IMPORTANT: Measure width on layout so drag index is accurate
            <View
              style={styles.chartWrap}
              onLayout={(e) => {
                const w = Math.max(
                  240,
                  Math.floor(e.nativeEvent.layout.width) - 20,
                ); // minus padding
                if (Number.isFinite(w) && w > 0 && w !== chartW) setChartW(w);
              }}
            >
              {/* Tooltip (top) */}
              {active ? (
                <View style={styles.tooltip}>
                  <Text style={styles.tooltipTitle}>
                    {formatDateShort(active.t)} • {money(active.close)}
                  </Text>
                  <Text style={styles.tooltipSub}>
                    O {money(active.open)} H {money(active.high)} L{" "}
                    {money(active.low)} V{" "}
                    {active.volume == null
                      ? "—"
                      : `${Math.round(active.volume).toLocaleString()}`}
                  </Text>
                </View>
              ) : (
                <View style={styles.tooltipMuted}>
                  <Text style={styles.tooltipMutedText}>
                    Drag to inspect price
                  </Text>
                </View>
              )}

              <View style={{ position: "relative" }}>
                {/* SVG = visual only */}
                <Svg width={CHART_W} height={CHART_H} pointerEvents="none">
                  {/* baseline */}
                  <Line
                    x1={PAD_X}
                    y1={CHART_H - PAD_Y}
                    x2={CHART_W - PAD_X}
                    y2={CHART_H - PAD_Y}
                    stroke="rgba(148,163,184,0.20)"
                    strokeWidth="1"
                  />

                  {/* price line */}
                  <Path
                    d={chart.path}
                    stroke="rgba(0,227,150,0.95)"
                    strokeWidth="2.2"
                    fill="none"
                  />

                  {/* crosshair */}
                  {active && (
                    <>
                      <Line
                        x1={active.x}
                        y1={PAD_Y}
                        x2={active.x}
                        y2={CHART_H - PAD_Y}
                        stroke="rgba(255,255,255,0.22)"
                        strokeWidth="1"
                      />
                      <Circle
                        cx={active.x}
                        cy={active.y}
                        r="4.2"
                        fill="rgba(255,255,255,0.9)"
                      />
                    </>
                  )}

                  {/* volume bars */}
                  {chart.volBars.map((b, i) => {
                    const w =
                      (CHART_W - PAD_X * 2) / Math.max(1, chart.volBars.length);
                    const x = clamp(b.x - w / 2, PAD_X, CHART_W - PAD_X);
                    const h = clamp(b.h, 0, 46);
                    const y = CHART_H - PAD_Y - h;

                    return (
                      <Rect
                        key={`v_${i}`}
                        x={x}
                        y={y}
                        width={Math.max(1, w * 0.75)}
                        height={h}
                        fill="rgba(96,165,250,0.18)"
                      />
                    );
                  })}
                </Svg>

                {/* 🔥 TOUCH CAPTURE LAYER */}
                <View
                  style={[
                    StyleSheet.absoluteFill,
                    {
                      zIndex: 10,
                      backgroundColor: "transparent",
                    },
                  ]}
                  pointerEvents="box-only"
                  onStartShouldSetResponderCapture={() => true}
                  onMoveShouldSetResponderCapture={() => true}
                  onTouchStart={(e) => {
                    setChartTouch(true);
                    const x = e.nativeEvent.locationX;
                    setActiveIdx(xToIndex(x));
                  }}
                  onTouchMove={(e) => {
                    const x = e.nativeEvent.locationX;
                    setActiveIdx(xToIndex(x));
                  }}
                  onTouchEnd={() => {
                    setChartTouch(false);
                  }}
                  {...pan.panHandlers}
                />
              </View>

              {/* Range labels */}
              <View style={styles.rangeRow}>
                <Text style={styles.rangeText}>
                  Close Low: {money(chart.min)}
                </Text>
                <Text style={styles.rangeText}>
                  Close High: {money(chart.max)}
                </Text>
              </View>
            </View>
          )}
        </View>

        {/* ===== BEHAVIOR ===== */}
        <View style={styles.card}>
          {/* ✅ renamed title */}
          <SectionHeader title="1-Year Performance" />
          <View style={styles.row}>
            <Metric
              label="1Y Return"
              value={derived.ret1yPct}
              suffix="%"
              color={colorFromSigned(derived.ret1yPct)}
            />
            <Metric
              label="Realized Volatility"
              value={derived.volAnn}
              suffix="%"
              color={BRAND.sub}
              onInfo={() => openTip("VOL")}
            />
            <Metric
              label="Largest Pullback"
              value={derived.maxDrawdownPct}
              suffix="%"
              color={BRAND.sub}
              onInfo={() => openTip("DD")}
            />
          </View>
          <Text style={styles.note}>{derived.trendNote}</Text>
        </View>

        {/* ===== HIGHS / LOWS ===== */}
        <View style={styles.card}>
          {/* ✅ renamed title */}
          <SectionHeader title="High & Low Zones" />
          <View style={styles.row}>
            <Metric
              label="1Y Close High"
              value={derived.high}
              prefix="$"
              color={BRAND.text}
              formatMoney
            />
            <Metric
              label="1Y Close Low"
              value={derived.low}
              prefix="$"
              color={BRAND.text}
              formatMoney
            />
          </View>

          {candles.length ? (
            <View style={styles.semanticRow}>
              <Pill
                label={
                  derived.highIdx == null
                    ? "High —"
                    : `High ${formatDateShort(candles[derived.highIdx]?.t)}`
                }
                color={BRAND.accent}
                icon="arrow-up-outline"
              />

              <Pill
                label={
                  derived.lowIdx == null
                    ? "Low —"
                    : `Low ${formatDateShort(candles[derived.lowIdx]?.t)}`
                }
                color={BRAND.blue}
                icon="arrow-down-outline"
              />

              <Pill
                label={
                  derived.trendLabel === "Uptrend"
                    ? "Up"
                    : derived.trendLabel === "Downtrend"
                      ? "Down"
                      : "Sideways"
                }
                color={
                  derived.trendLabel === "Uptrend"
                    ? BRAND.accent
                    : derived.trendLabel === "Downtrend"
                      ? BRAND.red
                      : BRAND.amber
                }
                icon={
                  derived.trendLabel === "Uptrend"
                    ? "trending-up-outline"
                    : derived.trendLabel === "Downtrend"
                      ? "trending-down-outline"
                      : "remove-outline"
                }
              />
            </View>
          ) : null}

          <Text style={styles.note}>
            These zones show where price previously reached major highs and lows
            during the selected period. They are useful for context, but future
            reactions can differ.
          </Text>
        </View>
        {/* ===== INTRADAY EXTREMES ===== */}
        <View style={styles.card}>
          <SectionHeader title="Intraday Extremes" />

          <Text style={styles.helperText}>
            Based on the highest traded high and lowest traded low during the
            1-year candle period.
          </Text>

          <View style={styles.row}>
            <Metric
              label="Intraday High"
              value={derived.intradayHigh}
              prefix="$"
              color={BRAND.text}
              formatMoney
            />

            <Metric
              label="Intraday Low"
              value={derived.intradayLow}
              prefix="$"
              color={BRAND.text}
              formatMoney
            />
          </View>
        </View>
        {/* ===== TREND QUALITY ===== */}
        <View style={styles.card}>
          {/* ✅ renamed title */}
          <SectionHeader title="Trend Context" />
          <View style={styles.semanticRow}>
            <Pill
              label={
                derived.trendLabel === "Uptrend"
                  ? "Healthy / Constructive"
                  : derived.trendLabel === "Downtrend"
                    ? "Breaking Down"
                    : "Range / Mixed"
              }
              color={
                derived.trendLabel === "Uptrend"
                  ? BRAND.accent
                  : derived.trendLabel === "Downtrend"
                    ? BRAND.red
                    : BRAND.amber
              }
              icon="pulse-outline"
            />
            <Pill
              label={
                derived.volAnn == null
                  ? "Volatility: —"
                  : derived.volAnn >= 60
                    ? "Volatility: High"
                    : derived.volAnn >= 35
                      ? "Volatility: Moderate"
                      : "Volatility: Low"
              }
              color={
                derived.volAnn == null
                  ? BRAND.sub
                  : derived.volAnn >= 60
                    ? BRAND.red
                    : derived.volAnn >= 35
                      ? BRAND.amber
                      : BRAND.accent
              }
              icon="analytics-outline"
            />
          </View>

          <Text style={styles.note}>
            {derived.trendLabel === "Uptrend"
              ? "An uptrend is healthiest when pullbacks are controlled and recoveries happen on meaningful participation."
              : derived.trendLabel === "Downtrend"
                ? "Downtrends often keep rejecting rallies. Watch for a series of higher lows and stronger up-move volume to signal recovery."
                : "Sideways periods can produce mixed signals. Clearer direction usually appears when price movement and volume align."}
          </Text>
        </View>

        {/* ===== VOLUME CONFIRMATION ===== */}
        <View style={styles.card}>
          <SectionHeader
            title="Volume Context"
            onInfo={() => openTip("VOLCONF")}
          />

          <View style={styles.row}>
            <Metric
              label="Up/Down Volume"
              value={
                derived.volumeUpDownRatio == null
                  ? null
                  : derived.volumeUpDownRatio
              }
              color={
                derived.volumeUpDownRatio == null
                  ? BRAND.sub
                  : derived.volumeUpDownRatio >= 1
                    ? BRAND.accent
                    : BRAND.red
              }
              format={(v) => (v == null ? "—" : `${v.toFixed(2)}x`)}
            />
            <Metric
              label="Volume–Move Link"
              value={derived.volAbsRetCorr}
              color={
                derived.volAbsRetCorr == null
                  ? BRAND.sub
                  : derived.volAbsRetCorr >= 0
                    ? BRAND.accent
                    : BRAND.red
              }
              format={(v) => (v == null ? "—" : v.toFixed(2))}
            />
          </View>

          <Text style={styles.note}>{derived.volumeNote}</Text>
        </View>
        <View style={styles.footerWrap}>
          <Text style={styles.powered}>
            Powered by <Text style={styles.brandText}>Alphaclara</Text>
          </Text>

          <Text style={styles.disclaimer}>
            Chart analytics are provided for informational and educational
            purposes only and do not constitute financial or investment advice.
          </Text>
        </View>
      </Animated.View>

      {/* ===== TOOLTIP MODAL ===== */}
      <Modal
        visible={!!tip}
        transparent
        animationType="fade"
        onRequestClose={closeTip}
      >
        <Pressable style={styles.modalBackdrop} onPress={closeTip}>
          <Pressable style={styles.modalCard} onPress={() => {}}>
            <View style={styles.modalHeader}>
              <Ionicons
                name="information-circle-outline"
                size={20}
                color={BRAND.accent}
              />
              <Text style={styles.modalTitle}>{tip?.title || ""}</Text>
              <TouchableOpacity onPress={closeTip} hitSlop={10}>
                <Ionicons name="close-outline" size={22} color={BRAND.sub} />
              </TouchableOpacity>
            </View>
            <Text style={styles.modalBody}>{tip?.body || ""}</Text>
            <Text style={styles.modalFoot}>
              Educational only • Not financial advice
            </Text>
          </Pressable>
        </Pressable>
      </Modal>
    </ScrollView>
  );
}

/* ================= SUB COMPONENTS ================= */
const SectionHeader = React.memo(function SectionHeader({ title, onInfo }) {
  return (
    <View style={styles.sectionHeaderRow}>
      <View style={styles.sectionAccent} />

      <Text style={styles.sectionTitle}>{title}</Text>

      {onInfo ? (
        <TouchableOpacity
          onPress={onInfo}
          style={styles.infoBtn}
          activeOpacity={0.85}
        >
          <Ionicons name="help-circle-outline" size={18} color={BRAND.sub} />
        </TouchableOpacity>
      ) : null}
    </View>
  );
});

const Metric = React.memo(function Metric({
  label,
  value,
  suffix = "",
  prefix = "",
  color,
  format,
  onInfo,
  formatMoney,
}) {
  const display = useMemo(() => {
    if (format) return format(value);
    if (formatMoney)
      return value == null ? "—" : `$${Number(value).toFixed(2)}`;
    if (value == null) return "—";
    const n = Number(value);
    if (!Number.isFinite(n)) return "—";
    return `${prefix}${n.toFixed(2)}${suffix}`;
  }, [value, suffix, prefix, format, formatMoney]);

  return (
    <View style={styles.metric}>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <Text style={styles.metricLabel}>{label}</Text>
        {onInfo ? (
          <TouchableOpacity onPress={onInfo} hitSlop={10} activeOpacity={0.85}>
            <Ionicons name="help-circle-outline" size={16} color={BRAND.sub} />
          </TouchableOpacity>
        ) : null}
      </View>
      <Text style={[styles.metricValue, { color: color || BRAND.text }]}>
        {display}
      </Text>
    </View>
  );
});

const Pill = React.memo(function Pill({ label, color, icon }) {
  return (
    <View style={[styles.pill, { borderColor: color || BRAND.border }]}>
      <Ionicons name={icon} size={14} color={color || BRAND.sub} />
      <Text
        style={[styles.pillText, { color: color || BRAND.sub }]}
        numberOfLines={1}
      >
        {label}
      </Text>
    </View>
  );
});

/* ================= STYLES ================= */
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BRAND.bg,
    paddingHorizontal: 14,
  },

  topBar: {
    paddingTop: Platform.OS === "ios" ? 44 : StatusBar.currentHeight || 16,
    paddingBottom: 8,
    marginBottom: 6,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  backBtn: {
    width: 42,
    height: 42,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    backgroundColor: "rgba(255,255,255,0.04)",
    alignItems: "center",
    justifyContent: "center",
  },

  topBarTitle: {
    color: BRAND.text,
    fontSize: 16,
    fontFamily: TYPO.fontFamily.extrabold,
    letterSpacing: 0.2,
  },

  headerCard: {
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    paddingHorizontal: 15,
    paddingVertical: 14,
    overflow: "hidden",
  },

  headerTopRow: {
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

  price: {
    color: BRAND.text,
    fontSize: 22,
    fontFamily: TYPO.fontFamily.extrabold,
    fontVariant: ["tabular-nums"],
  },

  change: {
    fontSize: 13,
    fontFamily: TYPO.fontFamily.bold,
    marginTop: 2,
    fontVariant: ["tabular-nums"],
  },

  pos: { color: BRAND.accent },
  neg: { color: BRAND.red },

  headerActionsRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 12,
  },

  premiumBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    backgroundColor: "rgba(255,255,255,0.04)",
  },

  premiumBadgeText: {
    color: BRAND.sub,
    fontSize: 11.5,
    fontFamily: TYPO.fontFamily.semibold,
  },

  signalPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    backgroundColor: "rgba(255,255,255,0.04)",
  },

  signalPillText: {
    fontSize: 11.5,
    fontFamily: TYPO.fontFamily.bold,
  },

  summary: {
    marginTop: 10,
    color: BRAND.sub,
    fontSize: 13,
    lineHeight: 19,
    fontFamily: TYPO.fontFamily.medium,
  },

  card: {
    backgroundColor: BRAND.card,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    paddingHorizontal: 14,
    paddingTop: 14,
    paddingBottom: 11,
    marginTop: 10,
  },

  sectionHeaderRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 8,
  },

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
    flex: 1,
    paddingRight: 8,
  },

  infoBtn: {
    paddingLeft: 8,
    paddingTop: 1,
  },

  refreshBtn: {
    width: 34,
    height: 34,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    backgroundColor: BRAND.card2,
    alignItems: "center",
    justifyContent: "center",
  },

  helperText: {
    color: BRAND.muted,
    fontSize: 11.5,
    lineHeight: 16,
    fontFamily: TYPO.fontFamily.semibold,
    marginTop: -2,
    marginBottom: 8,
  },

  row: {
    flexDirection: "row",
    gap: 8,
    marginTop: 8,
  },

  metric: {
    flex: 1,
    borderWidth: 1,
    borderColor: BRAND.softBorder,
    borderRadius: 15,
    paddingHorizontal: 10,
    paddingVertical: 10,
    backgroundColor: BRAND.card2,
    minWidth: 0,
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
    fontSize: 15.5,
    fontFamily: TYPO.fontFamily.extrabold,
    fontVariant: ["tabular-nums"],
  },

  note: {
    marginTop: 7,
    color: BRAND.sub,
    fontSize: 12.5,
    lineHeight: 18,
    fontFamily: TYPO.fontFamily.medium,
  },

  semanticRow: {
    flexDirection: "row",
    flexWrap: "nowrap",
    gap: 6,
    marginTop: 10,
  },

  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 5,
    backgroundColor: BRAND.card2,
    maxWidth: "100%",
  },

  pillText: {
    fontSize: 10.8,
    fontFamily: TYPO.fontFamily.bold,
  },

  chartWrap: {
    marginTop: 8,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: BRAND.softBorder,
    backgroundColor: BRAND.card2,
    padding: 10,
    overflow: "hidden",
  },

  tooltip: {
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    backgroundColor: BRAND.card,
    borderRadius: 14,
    paddingVertical: 8,
    paddingHorizontal: 10,
    marginBottom: 10,
  },

  tooltipTitle: {
    color: BRAND.text,
    fontSize: 13,
    fontFamily: TYPO.fontFamily.extrabold,
  },

  tooltipSub: {
    marginTop: 2,
    color: BRAND.sub,
    fontSize: 11.5,
    fontFamily: TYPO.fontFamily.semibold,
  },

  tooltipMuted: {
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    backgroundColor: "rgba(255,255,255,0.04)",
    borderRadius: 14,
    paddingVertical: 8,
    paddingHorizontal: 10,
    marginBottom: 10,
  },

  tooltipMutedText: {
    color: BRAND.sub,
    fontSize: 12,
    fontFamily: TYPO.fontFamily.bold,
  },

  rangeRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 8,
  },

  rangeText: {
    color: BRAND.muted,
    fontSize: 11.5,
    fontFamily: TYPO.fontFamily.bold,
  },

  loadingBox: {
    paddingVertical: 18,
    alignItems: "center",
    gap: 10,
  },

  loadingText: {
    color: BRAND.sub,
    fontFamily: TYPO.fontFamily.bold,
  },

  errorBox: {
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(239,68,68,0.35)",
    backgroundColor: "rgba(239,68,68,0.06)",
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },

  errorText: {
    color: BRAND.text,
    flex: 1,
    fontSize: 12.5,
    fontFamily: TYPO.fontFamily.bold,
  },

  retryBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: BRAND.softBorder,
    backgroundColor: "rgba(255,255,255,0.06)",
  },

  retryText: {
    color: BRAND.text,
    fontFamily: TYPO.fontFamily.extrabold,
    fontSize: 12,
  },

  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
    justifyContent: "center",
    padding: 18,
  },

  modalCard: {
    backgroundColor: BRAND.card,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: BRAND.border,
    padding: 14,
  },

  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },

  modalTitle: {
    color: BRAND.text,
    fontSize: 15,
    fontFamily: TYPO.fontFamily.extrabold,
    flex: 1,
  },

  modalBody: {
    marginTop: 10,
    color: BRAND.sub,
    fontSize: 13,
    lineHeight: 18,
    fontFamily: TYPO.fontFamily.regular,
  },

  modalFoot: {
    marginTop: 12,
    color: BRAND.muted,
    fontSize: 11,
    fontFamily: TYPO.fontFamily.medium,
  },

  footerWrap: {
    alignItems: "center",
    marginTop: 22,
    paddingHorizontal: 12,
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

  disclaimer: {
    color: BRAND.muted,
    fontSize: 10.5,
    lineHeight: 16,
    textAlign: "center",
    fontFamily: TYPO.fontFamily.regular,
  },
  chartSectionHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 6,
  },
  headerIdentity: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    paddingRight: 10,
  },

  headerLogoWrap: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 11,
  },

  headerLogo: {
    width: 28,
    height: 28,
  },

  headerLogoText: {
    color: BRAND.accent,
    fontSize: 18,
    fontFamily: TYPO.fontFamily.extrabold,
  },
});
