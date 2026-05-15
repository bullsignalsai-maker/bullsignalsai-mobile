// screens/StockDetailScreen.js
import React, { useEffect, useState, useCallback, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
  RefreshControl,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import {
  LinearGradient as SvgLinearGradient,
  Svg,
  Path,
  Defs,
  Stop,
} from "react-native-svg";
import { LinearGradient as ExpoLinearGradient } from "expo-linear-gradient";
import { API_BASE_URL } from "../config/apiKeys"; // ✅ backend base URL
import { getStockDetail } from "../services/stockDetailService";
import AstraChat from "../components/AstraChat";
import AstraAnimatedIcon from "../components/AstraAnimatedIcon";
import { BRAND } from "../constants/theme";
import { TYPO } from "../constants/typography";
import {
  displayRating,
  signalColor,
  getAuthoritativeSignal,
} from "../utils/signalUtils";
// Grok cache TTL (frontend, extra safety on top of backend cache)
const GROK_CACHE_TTL_HOURS = 6;

// -------- Helpers --------
function timeAgo(tsMs) {
  if (!tsMs) return "";
  const diff = Date.now() - tsMs;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function GreenBullets({ items = [] }) {
  if (!items.length) return null;
  return items.map((line, idx) => (
    <View key={`gb-${idx}`} style={styles.bulletRow}>
      <Text style={styles.bulletDot}>•</Text>
      <Text style={styles.bulletText}>{line}</Text>
    </View>
  ));
}

function formatNewsTime(pubDate) {
  if (!pubDate) return "";
  const ts = new Date(pubDate).getTime();
  return timeAgo(ts);
}

// --- Parse Key Statistics text into structured pairs ---
function parseKeyStats(text = "") {
  if (!text) return [];
  return text
    .split(/\n|•|-/)
    .map((line) => line.trim())
    .filter((l) => l.includes(":"))
    .map((line) => {
      const [label, ...rest] = line.split(":");
      const value = rest.join(":").trim();
      return { label: label.trim(), value };
    })
    .filter((item) => item.label && item.value);
}

// Parse Grok text into named sections by headings
function parseStructuredSections(text) {
  if (!text) return {};
  const cleaned = text
    .replace(/\*\*/g, "")
    .replace(/#+/g, "")
    .replace(/[-–—]{2,}/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
  const lower = cleaned.toLowerCase();

  const defs = [
    { id: "aiSignal", labels: ["ai signal", "signal summary"] },
    { id: "predictions", labels: ["predictions", "price targets & scenarios"] },
    { id: "execSummary", labels: ["executive summary"] },
    { id: "keyStats", labels: ["key statistics", "key stats"] },
    { id: "tech", labels: ["technical outlook"] },
    {
      id: "sentiment",
      labels: ["news & market sentiment", "market sentiment"],
    },
    {
      id: "risks",
      labels: ["risks & opportunities", "risks and opportunities"],
    },
    { id: "tradeIdea", labels: ["trade idea", "trade ideas"] },
    { id: "recommendation", labels: ["recommendation", "bottom line"] },
  ];

  const found = [];
  defs.forEach((def) => {
    def.labels.forEach((label) => {
      const idx = lower.indexOf(label);
      if (idx !== -1) {
        found.push({ id: def.id, label, index: idx });
      }
    });
  });

  if (found.length === 0) {
    return { execSummary: cleaned };
  }

  found.sort((a, b) => a.index - b.index);

  const sections = {};
  for (let i = 0; i < found.length; i++) {
    const start = found[i].index;
    const end = i < found.length - 1 ? found[i + 1].index : cleaned.length;
    const slice = cleaned.slice(start, end).trim();
    const lines = slice.split(/\n+/);
    const body = lines.slice(1).join("\n").trim();
    sections[found[i].id] = body || "";
  }
  return sections;
}

// Extract Short / Medium / Long term prediction lines (fallback)
function extractPredictionLines(predictionsBody = "") {
  const lines = predictionsBody
    .split(/\n+/)
    .map((l) => l.trim())
    .filter(Boolean);

  const findLine = (keyword) =>
    lines.find((l) => new RegExp(`^${keyword}`, "i").test(l)) ||
    lines.find((l) => new RegExp(keyword, "i").test(l)) ||
    "";

  const shortTerm = findLine("Short-Term");
  const mediumTerm = findLine("Medium-Term");
  const longTerm = findLine("Long-Term");

  if (!shortTerm && !mediumTerm && !longTerm) {
    return {
      shortTerm: lines[0] || "",
      mediumTerm: lines[1] || "",
      longTerm: lines[2] || "",
    };
  }

  return { shortTerm, mediumTerm, longTerm };
}

function formatPercentFromProb(prob, digits = 1) {
  if (prob === null || prob === undefined || isNaN(prob)) return "N/A";
  return (prob * 100).toFixed(digits) + "%";
}

function buildHybridSignalSummary({
  hybridSignal,
  hybridProbUp,
  technical,
  bullbrain,
}) {
  if (!hybridSignal) return "AI model is evaluating current conditions.";

  const bullets = [];

  // Trend
  if (technical?.trend?.summary) {
    bullets.push(technical.trend.summary);
  }

  // Momentum
  if (technical?.momentum?.summary_rsi || technical?.momentum?.summary_macd) {
    bullets.push(
      technical.momentum.summary_rsi || technical.momentum.summary_macd,
    );
  }

  // AI probability
  if (hybridProbUp != null) {
    bullets.push(`${Math.round(hybridProbUp * 100)}% probability of upside`);
  }

  // Fallback to BullBrain
  if (!bullets.length && bullbrain?.confidence != null) {
    bullets.push(`BullBrain confidence ${bullbrain.confidence.toFixed(0)}%`);
  }

  return bullets.slice(0, 2).join(" • ");
}

// Build narrative explaining why the hybrid signal is what it is
function buildHybridNarrative(hybridSignal, technical, bullbrain) {
  const parts = [];
  const signal = (hybridSignal || "").toUpperCase();

  const trendSummary = technical?.trend?.summary;
  const priceVsSma20 = technical?.trend?.price_vs_sma20_pct;
  const distHigh = technical?.trend?.distance_from_20d_high;
  const distLow = technical?.trend?.distance_from_20d_low;

  const rsi = technical?.momentum?.rsi14;
  const rsiSummary = technical?.momentum?.summary_rsi;
  const macdSummary = technical?.momentum?.summary_macd;

  const volSummary = technical?.volume?.summary;
  const volZ = technical?.volume?.volume_zscore_20;
  const volVs20 = technical?.volume?.volume_vs_ma20_pct;

  const volatSummary = technical?.volatility?.summary;

  if (trendSummary) {
    parts.push(
      trendSummary +
        (priceVsSma20 != null
          ? ` with price about ${Math.abs(priceVsSma20).toFixed(1)}% ${
              priceVsSma20 < 0 ? "below" : "above"
            } its 20-day average.`
          : "."),
    );
  }

  if (rsi != null || rsiSummary || macdSummary) {
    if (rsiSummary || macdSummary) {
      parts.push(
        `${rsiSummary || ""}${
          rsiSummary && macdSummary ? " and " : ""
        }${macdSummary || ""}`.replace(/\s+/g, " "),
      );
    } else if (rsi != null) {
      if (rsi < 30) {
        parts.push(
          `Momentum is oversold (RSI ~${rsi.toFixed(
            0,
          )}), suggesting the move may be stretched.`,
        );
      } else if (rsi > 70) {
        parts.push(
          `Momentum is overbought (RSI ~${rsi.toFixed(
            0,
          )}), so a pause or pullback would not be surprising.`,
        );
      }
    }
  }

  if (volSummary || volZ != null || volVs20 != null) {
    const volBits = [];
    if (volSummary) volBits.push(volSummary);
    if (volZ != null && Math.abs(volZ) > 2) {
      volBits.push(`volume Z-score around ${volZ.toFixed(1)}`);
    }
    if (volVs20 != null && Math.abs(volVs20) > 5) {
      volBits.push(
        `roughly ${Math.abs(volVs20).toFixed(1)}% ${
          volVs20 > 0 ? "above" : "below"
        } its 20-day average`,
      );
    }
    if (volBits.length > 0) {
      parts.push(
        `Trading activity is ${volBits.join(", ")}.`.replace(/\s+/g, " "),
      );
    }
  }

  if (volatSummary) {
    parts.push(volatSummary + ".");
  }

  const bbSignal = bullbrain?.signal;
  const bbConf = bullbrain?.confidence;
  if (bbSignal && bbConf != null) {
    parts.push(
      `The BullBrain model leans ${bbSignal.toUpperCase()} with about ${bbConf.toFixed(
        1,
      )}% confidence, which is blended with technicals into a ${
        signal || "HYBRID"
      } view.`,
    );
  }

  if (!parts.length) {
    if (signal.includes("BUY")) {
      return "The hybrid model sees favorable risk–reward and constructive technical behavior, but prices can still move against the thesis.";
    }
    if (signal.includes("SELL")) {
      return "The hybrid model flags deteriorating technicals and/or weakening momentum, suggesting caution or risk management is warranted.";
    }
    if (signal.includes("HOLD")) {
      return "The hybrid model does not see a clear edge in either direction right now, suggesting patience or smaller position sizing.";
    }
    return "The hybrid model blends AI signals with technical behavior to produce this view. Markets are uncertain and prices can move rapidly.";
  }

  return parts.join(" ");
}

// ================================
//   GROK CACHE HELPERS (frontend)
// ================================
async function loadCachedGrok(symbol) {
  try {
    const raw = await AsyncStorage.getItem(`grok_${symbol}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || !parsed.text || !parsed.updatedAt) return null;
    const ageHours = (Date.now() - parsed.updatedAt) / 3600000;
    if (ageHours > GROK_CACHE_TTL_HOURS) return null;
    return parsed;
  } catch (err) {
    console.warn("loadCachedGrok error:", err);
    return null;
  }
}

async function saveGrokCache(symbol, text) {
  try {
    const payload = {
      text,
      updatedAt: Date.now(),
    };
    await AsyncStorage.setItem(`grok_${symbol}`, JSON.stringify(payload));
  } catch (err) {
    console.warn("saveGrokCache error:", err);
  }
}

// ================================
//   GROK ANALYSIS (via backend essay)
// ================================
async function fetchGrokAnalysis(symbol, force = false) {
  // 1️⃣ Try local cache first (avoid re-spend)
  if (!force) {
    const cached = await loadCachedGrok(symbol);
    if (cached) {
      return cached;
    }
  }

  try {
    const res = await fetch(
      `${API_BASE_URL}/grok-stock/${symbol}?force=${force ? "true" : "false"}`,
    );
    const json = await res.json();

    const text = json?.text?.trim() || "⚠️ AI analysis unavailable.";
    const updatedAtIso = json?.updatedAt;
    const updatedAt = updatedAtIso
      ? new Date(updatedAtIso).getTime()
      : Date.now();

    await saveGrokCache(symbol, text);

    return { text, updatedAt };
  } catch (err) {
    console.warn("fetchGrokAnalysis backend error:", err);
    // 2️⃣ Hard fallback to last good local cache
    const cached = await loadCachedGrok(symbol);
    if (cached) {
      return cached;
    }
    return { text: "⚠️ Failed to fetch AI analysis.", updatedAt: null };
  }
}

function smoothPath(path) {
  if (!path || typeof path !== "string") return null;

  // Extract x,y pairs
  const matches = path.match(/(\d+(\.\d+)?),(\d+(\.\d+)?)/g);
  if (!matches || matches.length < 3) return null;

  const points = matches.map((pair) => {
    const [x, y] = pair.split(",").map(Number);
    return { x, y };
  });

  let d = `M ${points[0].x},${points[0].y}`;

  for (let i = 1; i < points.length - 1; i++) {
    const p1 = points[i];
    const p2 = points[i + 1];

    const cx = (p1.x + p2.x) / 2;
    const cy = (p1.y + p2.y) / 2;

    d += ` Q ${p1.x},${p1.y} ${cx},${cy}`;
  }

  const last = points[points.length - 1];
  d += ` L ${last.x},${last.y}`;

  return d;
}

function PriceSparkline({ sparkline }) {
  if (!sparkline?.path) {
    return (
      <View style={styles.sparklineEmpty}>
        <Text style={styles.sparklineEmptyText}>Chart data unavailable</Text>
      </View>
    );
  }
  const isUp = sparkline.direction === "up";
  const stroke = isUp ? BRAND.accent : BRAND.red;
  const gradientId = isUp ? "gradUp" : "gradDown";

  // ✅ FIX: compute BEFORE JSX
  const smoothD = smoothPath(sparkline.path);

  return (
    <View style={styles.sparklineWrap}>
      <Svg viewBox="0 0 100 30" width="100%" height={72}>
        <Defs>
          <SvgLinearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <Stop
              offset="0%"
              stopColor={
                sparkline.direction === "up" ? BRAND.accent : BRAND.red
              }
              stopOpacity="0.35"
            />
            <Stop offset="60%" stopColor={stroke} stopOpacity="0.08" />
            <Stop offset="100%" stopColor={stroke} stopOpacity="0" />
          </SvgLinearGradient>
        </Defs>

        {/* Area fill */}
        {smoothD && (
          <Path
            d={`${smoothD} L 100,30 L 0,30 Z`}
            fill={`url(#${gradientId})`}
          />
        )}

        {/* Line */}
        <Path
          d={sparkline.path}
          fill="none"
          stroke={stroke}
          strokeWidth={1}
          strokeLinecap="round"
          strokeLinejoin="bevel"
        />
      </Svg>

      <View style={styles.sparklineMeta}>
        <Text style={styles.sparklineMetaText}>
          1Y Close Low $
          {sparkline?.rangeStats?.closeLow != null
            ? sparkline.rangeStats.closeLow.toFixed(2)
            : sparkline.min.toFixed(2)}
        </Text>
        <Text style={styles.sparklineMetaText}>
          1Y Close High $
          {sparkline?.rangeStats?.closeHigh != null
            ? sparkline.rangeStats.closeHigh.toFixed(2)
            : sparkline.max.toFixed(2)}
        </Text>
        <Text
          style={[
            styles.sparklineMetaText,
            {
              color: sparkline.direction === "up" ? BRAND.accent : BRAND.red,
            },
          ]}
        >
          {sparkline.direction === "up" ? "Uptrend" : "Downtrend"}
        </Text>
      </View>
      {sparkline?.rangeStats && (
        <Text style={styles.sparklineSourceText}>
          {sparkline.range || "1Y"} {sparkline.basis || "close"} range •{" "}
          {sparkline.rangeStats.candleCount || "—"} sessions
          {sparkline.rangeStats.returnPct != null
            ? ` • ${sparkline.rangeStats.returnPct >= 0 ? "+" : ""}${sparkline.rangeStats.returnPct.toFixed(2)}%`
            : ""}
        </Text>
      )}
    </View>
  );
}

// =======================
//   COMPONENT
// =======================
export default function StockDetailScreen({ route, navigation }) {
  const {
    symbol: initialSymbol = "TSLA",
    name: initialName = "Tesla Inc.",
    source, // ✅ ADD THIS
  } = route.params || {};

  const [symbol] = useState(initialSymbol);
  const [detail, setDetail] = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(true);

  const [rawGrokText, setRawGrokText] = useState("");
  const [grokUpdatedAt, setGrokUpdatedAt] = useState(null);
  const [loadingGrok, setLoadingGrok] = useState(true);

  const [refreshing, setRefreshing] = useState(false);
  const [astraVisible, setAstraVisible] = useState(false);

  const loadAll = useCallback(
    async (forceGrok = false) => {
      setLoadingDetail(true);
      const sd = await getStockDetail(symbol, { fromUI: source === "ui" });

      setDetail(sd);
      setLoadingDetail(false);

      // Grok long-form essay for trade idea / key stats / final rec
      setLoadingGrok(true);
      const grok = await fetchGrokAnalysis(symbol, forceGrok);
      setRawGrokText(grok.text || "");
      setGrokUpdatedAt(grok.updatedAt || null);
      setLoadingGrok(false);
    },
    [symbol, source],
  );

  useEffect(() => {
    loadAll(false);
  }, [loadAll]);

  const onRefresh = async () => {
    setRefreshing(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await loadAll(true); // force fresh Grok essay and stockdetail
    setRefreshing(false);
  };

  const quote = detail?.quote;
  const bullbrain = detail?.bullbrain;
  const patternInsight = detail?.patternInsight || null;
  // ---- SMART PATTERN (from /stockdetail) ----
  const technical = detail?.technical;
  const tickerNews = detail?.news || [];
  const structuredGrok = detail?.grok || {};
  const risksOpportunities =
    detail?.explanations?.groups?.risks_opportunities || null;

  const tradeIdea = detail?.explanations?.groups?.trade_idea || null;
  const finalRecommendation =
    detail?.explanations?.groups?.final_recommendation || null;

  const hybridSignal = detail?.hybridSignal;
  const authoritativeSignal = getAuthoritativeSignal(detail);
  const hybridProbUp = detail?.hybridProbUp;
  const hybridScore = detail?.hybridScore;
  const ratingSignal = authoritativeSignal;

  const ratingConfidence = detail?.content?.signal?.confidence ?? hybridScore;

  const probUp = detail?.content?.probability?.up ?? hybridProbUp ?? null;

  const probDown =
    detail?.content?.probability?.down ?? (probUp != null ? 1 - probUp : null);

  const probBias = detail?.content?.probability?.bias || "Neutral";
  const hybridUpdatedTs = structuredGrok?.updatedAt
    ? new Date(structuredGrok.updatedAt).getTime()
    : null;

  const astraStockContext = detail
    ? {
        contextType: "stock_detail",
        symbol: detail.symbol,
        companyName: detail.companyName,
        total_value: 0,
        total_gain: 0,
        today_gain: 0,
        positions: [],
      }
    : null;
  // ---- Derived sections from Grok essay ----
  const grokSections = useMemo(
    () => parseStructuredSections(rawGrokText),
    [rawGrokText],
  );

  const outlookBullets = detail?.insights?.combinedTechnicalSummary
    ? detail.insights.combinedTechnicalSummary
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean)
    : [];

  return (
    <View style={{ flex: 1, backgroundColor: BRAND.bg }}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={{ paddingBottom: 40 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={BRAND.accent}
          />
        }
      >
        {/* HEADER: Price & Basic Info */}
        <ExpoLinearGradient
          colors={["#0f172a", "#020617"]}
          style={styles.headerCard}
        >
          {loadingDetail ? (
            <ActivityIndicator color={BRAND.accent} />
          ) : quote ? (
            <>
              {/* HEADER ROW */}
              <View style={styles.headerRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.symbol}>{quote?.symbol || symbol}</Text>
                  <Text style={styles.name}>
                    {quote?.name || initialName || symbol}
                  </Text>
                </View>

                <View style={styles.priceBlock}>
                  <Text
                    style={styles.price}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                  >
                    {quote?.current != null
                      ? `$${quote.current.toFixed(2)}`
                      : "—"}
                  </Text>
                  <Text
                    style={[
                      styles.pct,
                      quote?.changePct >= 0 ? styles.positive : styles.negative,
                    ]}
                  >
                    {quote?.changePct != null
                      ? `${
                          quote.changePct >= 0 ? "▲ " : "▼ "
                        }${quote.changePct.toFixed(2)}%`
                      : "—"}
                  </Text>
                </View>
              </View>

              {/* ROW 1: Day Range + Prev Close */}
              <View style={styles.headerMetaRow}>
                <View style={styles.metaCol}>
                  <Text style={styles.headerMeta}>Day Range</Text>
                  <Text style={styles.headerMetaValue}>
                    {quote?.low != null && quote?.high != null
                      ? `$${quote.low.toFixed(2)} – $${quote.high.toFixed(2)}`
                      : "—"}
                  </Text>
                </View>
                <View style={[styles.metaCol, { alignItems: "flex-end" }]}>
                  <Text style={styles.headerMeta}>Previous Close</Text>

                  <Text style={styles.headerMetaValue}>
                    {quote?.prevClose != null
                      ? `$${quote.prevClose.toFixed(2)}`
                      : "—"}
                  </Text>
                </View>
              </View>

              {/* ROW 2: Open + Volume */}
              <View style={styles.headerCompactRow}>
                <Text style={styles.headerCompactText}>
                  Open{" "}
                  <Text style={styles.headerCompactValue}>
                    {quote?.open != null ? `$${quote.open.toFixed(2)}` : "—"}
                  </Text>
                  {detail?.asOf ? "  •  As of " : ""}
                  {detail?.asOf
                    ? new Date(detail.asOf).toLocaleString(undefined, {
                        month: "short",
                        day: "numeric",
                        hour: "numeric",
                        minute: "2-digit",
                      })
                    : ""}
                </Text>
              </View>
            </>
          ) : (
            <Text style={{ color: BRAND.sub }}>Failed to load quote.</Text>
          )}
        </ExpoLinearGradient>

        {/* PRICE CHART */}
        <View style={styles.card}>
          <View style={styles.sectionHeaderRow}>
            <View style={styles.sectionAccent} />

            <View style={{ flex: 1 }}>
              <Text style={styles.sectionTitle}>1Y Price Snapshot</Text>
              <Text style={styles.cardSubText}>Recent price movement</Text>
            </View>

            <TouchableOpacity
              style={styles.chartMiniButton}
              onPress={() =>
                navigation.navigate("FullChartScreen", {
                  symbol: detail?.symbol,
                  companyName: detail?.companyName || detail?.symbol,
                  quote: detail?.quote || null,
                  bullbrain: detail?.bullbrain || null,
                  hybridSignal: authoritativeSignal,
                  hybridScore: detail?.hybridScore ?? null,
                  isPremium: true,
                })
              }
            >
              <Text style={styles.chartMiniButtonText}>Full Chart</Text>
              <Ionicons name="chevron-forward" size={14} color={BRAND.text} />
            </TouchableOpacity>
          </View>

          <PriceSparkline sparkline={detail?.sparkline} />
        </View>

        {/* AI HYBRID SIGNAL */}
        <View style={styles.card}>
          <View style={styles.sectionHeaderRow}>
            <View style={styles.sectionAccent} />
            <View style={{ flex: 1 }}>
              <Text style={styles.sectionTitle}>AI Rating</Text>
              <Text style={styles.cardSubText}>
                Powered by Alphaclara •{" "}
                {hybridUpdatedTs
                  ? `Updated ${timeAgo(hybridUpdatedTs)}`
                  : "Market context"}
              </Text>
            </View>

            <TouchableOpacity
              onPress={() => loadAll(true)}
              disabled={loadingDetail || loadingGrok}
              style={styles.refreshBtn}
            >
              {loadingDetail || loadingGrok ? (
                <ActivityIndicator color={BRAND.accent} size="small" />
              ) : (
                <Ionicons name="refresh" size={18} color={BRAND.accent} />
              )}
            </TouchableOpacity>
          </View>

          <View style={styles.signalGradient}>
            {/* Signal row */}
            <View style={styles.signalRow}>
              <View
                style={[
                  styles.signalPill,
                  { backgroundColor: signalColor(authoritativeSignal) },
                ]}
              >
                <Text style={styles.signalPillText}>
                  {displayRating(authoritativeSignal)}
                </Text>
              </View>

              <View style={{ flex: 1 }}>
                <Text style={styles.signalTagline}>
                  {structuredGrok.ai_signal ||
                    "Alphaclara blends AI context, technicals, and probabilities into this rating."}
                </Text>
              </View>
            </View>

            {/* Bias badge */}
            {detail?.ui?.decision?.bias && (
              <View
                style={{
                  marginLeft: 6,
                  paddingHorizontal: 8,
                  paddingVertical: 3,
                  borderRadius: 999,
                  backgroundColor:
                    detail.ui.decision.bias.label === "Bullish"
                      ? "rgba(0,227,150,0.18)"
                      : detail.ui.decision.bias.label === "Bearish"
                        ? "rgba(239,68,68,0.18)"
                        : "rgba(250,204,21,0.18)",
                }}
              >
                <Text
                  style={{
                    fontSize: 11,
                    fontWeight: "800",
                    color:
                      detail.ui.decision.bias.label === "Bullish"
                        ? BRAND.accent
                        : detail.ui.decision.bias.label === "Bearish"
                          ? BRAND.red
                          : BRAND.amber,
                  }}
                >
                  {detail.ui.decision.bias.label}
                </Text>
              </View>
            )}

            {/* Numbers row */}
            <View style={styles.hybridNumbersRow}>
              <View style={styles.hybridNumCol}>
                <Text style={styles.hybridLabel}>Confidence</Text>
                <Text style={styles.hybridValue}>
                  {ratingConfidence != null
                    ? `${ratingConfidence.toFixed(1)}%`
                    : "N/A"}
                </Text>
              </View>

              <View style={styles.hybridNumCol}>
                <Text style={styles.hybridLabel}>Upside probability</Text>
                <Text style={styles.hybridValue}>
                  {probUp != null ? formatPercentFromProb(probUp, 1) : "N/A"}
                </Text>
              </View>

              <View style={styles.hybridNumCol}>
                <Text style={styles.hybridLabel}>Model context</Text>
                <Text style={styles.hybridValue} numberOfLines={2}>
                  {bullbrain?.signal
                    ? `${bullbrain.signal.toUpperCase()} ${
                        bullbrain.confidence != null
                          ? bullbrain.confidence.toFixed(1) + "%"
                          : ""
                      }`
                    : "N/A"}
                </Text>
              </View>
            </View>

            {/* Progress bar */}
            <View style={styles.probBlock}>
              <View style={styles.probBarWrap}>
                <View
                  style={[
                    styles.probBarFill,
                    {
                      width: `${probUp != null ? Math.round(probUp * 100) : 0}%`,
                      backgroundColor:
                        probBias === "Bullish"
                          ? BRAND.accent
                          : probBias === "Bearish"
                            ? BRAND.red
                            : BRAND.amber,
                    },
                  ]}
                />
              </View>

              <View style={styles.probRow}>
                <Text style={styles.probText}>
                  Upside {probUp != null ? Math.round(probUp * 100) : 0}%
                </Text>

                <Text style={styles.probText}>
                  Downside {probDown != null ? Math.round(probDown * 100) : 0}%
                </Text>
              </View>

              <Text style={styles.probBias}>{probBias} probability bias</Text>
            </View>
            <Text style={styles.ratingDisclaimer}>
              AI ratings are informational only and are not investment
              recommendations.
            </Text>
            {/* Narrative */}
            <View style={styles.hybridNarrativeBox}>
              <Text style={styles.hybridNarrativeText}>
                {buildHybridSignalSummary({
                  hybridSignal: ratingSignal,
                  hybridProbUp: probUp,
                  technical,
                  bullbrain,
                })}
              </Text>
            </View>

            {/* Why this signal */}
            {detail?.ui?.decision?.reasons?.length > 0 && (
              <View style={styles.whyBlock}>
                <Text style={styles.whyLabel}>Why this rating?</Text>

                {detail.ui.decision.reasons.map((reason, idx) => (
                  <Text key={`reason-${idx}`} style={styles.whyText}>
                    • {reason.replace(/([A-Z])/g, " $1").trim()}
                  </Text>
                ))}
              </View>
            )}

            {/* CTA — Full Signal Details */}
            <TouchableOpacity
              style={styles.techButton}
              onPress={() =>
                navigation.navigate("FullDecisionDetailScreen", {
                  symbol: detail.symbol,
                  companyName: detail.companyName,
                  quote: detail.quote,
                  hybridSignal: authoritativeSignal,
                  hybridScore: detail.hybridScore,
                  bullbrain: detail.bullbrain,
                  technical: detail.technical,
                  pattern: detail.pattern,
                  isPremium: true,
                })
              }
            >
              <Text style={styles.techButtonText}>Why This Rating?</Text>
            </TouchableOpacity>
          </View>
        </View>
        {/* SMART PATTERN (SUMMARY ONLY) */}
        {patternInsight && (
          <View style={styles.card}>
            <View style={styles.sectionHeaderRow}>
              <View style={styles.sectionAccent} />
              <Text style={styles.sectionTitle}>Pattern Context</Text>
            </View>
            <Text style={styles.patternNote}>
              Pattern context is based on historical behavior and does not
              guarantee future results.
            </Text>
            <Text style={styles.patternTitle}>{patternInsight.pattern}</Text>

            {patternInsight.confidencePct != null && (
              <Text style={styles.patternMeta}>
                Historical Confidence:{" "}
                <Text
                  style={{
                    fontWeight: "800",
                    color:
                      patternInsight.confidencePct >= 65
                        ? BRAND.accent
                        : BRAND.amber,
                  }}
                >
                  {patternInsight.confidencePct}%
                </Text>{" "}
                • {patternInsight.label}
              </Text>
            )}

            <Text style={styles.patternExplanation} numberOfLines={6}>
              {patternInsight.shortSummary ||
                patternInsight.explanation?.split(". ").slice(0, 2).join(". ") +
                  "."}
            </Text>

            {/* CTA */}
            <TouchableOpacity
              style={styles.patternButton}
              onPress={() =>
                navigation.navigate("FullPatternDetailScreen", {
                  symbol: detail.symbol,
                  companyName: detail.companyName,
                  quote: detail.quote,
                  patternInsight: detail.patternInsight,
                  smartPattern: detail.smartPattern,
                  patternStats: detail.patternStats,
                  probabilityCone: detail.probabilityCone,
                  isPremium: true,
                })
              }
            >
              <Text style={styles.patternButtonText}>View Pattern Details</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* OUTLOOK CARD: Short / Medium / Long */}
        {outlookBullets.length > 0 && (
          <View style={styles.card}>
            <View style={styles.sectionHeaderRow}>
              <View style={styles.sectionAccent} />
              <Text style={styles.sectionTitle}>Market Outlook</Text>
            </View>
            <Text style={styles.patternNote}>
              Market outlook reflects current conditions based on AI analysis,
              technical context, and probability signals.
            </Text>
            <View style={{ marginTop: 2 }}>
              <View style={{ marginTop: 4 }}>
                <GreenBullets items={outlookBullets} />
              </View>
            </View>
          </View>
        )}
        {/* TECHNICAL SNAPSHOT: Trend, Momentum, Volatility, Volume */}
        {detail?.technical && (
          <View style={styles.card}>
            <View style={styles.sectionHeaderRow}>
              <View style={styles.sectionAccent} />
              <Text style={styles.sectionTitle}>Technical Context</Text>
            </View>

            <Text style={styles.patternNote}>
              Technical context summarizes trend, momentum, volatility, and
              volume conditions.
            </Text>

            <View style={styles.techGrid}>
              <View style={styles.techMiniCard}>
                <Text style={styles.techMiniLabel}>Trend</Text>
                <Text style={styles.techMiniValue}>
                  {detail.technical.trend?.label || "—"}
                </Text>
                <Text style={styles.techMiniSub}>
                  {detail.technical.trend?.priceVsSma20Pct != null
                    ? `${detail.technical.trend.priceVsSma20Pct.toFixed(1)}% vs SMA20`
                    : "Trend context"}
                </Text>
              </View>

              <View style={styles.techMiniCard}>
                <Text style={styles.techMiniLabel}>Momentum</Text>
                <Text style={styles.techMiniValue}>
                  {detail.technical.momentum?.rsiLabel || "—"}
                </Text>
                <Text style={styles.techMiniSub}>
                  {detail.technical.momentum?.rsi != null
                    ? `RSI ${detail.technical.momentum.rsi.toFixed(1)}`
                    : "Momentum context"}
                </Text>
              </View>

              <View style={styles.techMiniCard}>
                <Text style={styles.techMiniLabel}>Volatility</Text>
                <Text style={styles.techMiniValue}>
                  {detail.technical.volatility?.label || "—"}
                </Text>
                <Text style={styles.techMiniSub}>
                  {detail.technical.volatility?.atr14 != null
                    ? `ATR ${detail.technical.volatility.atr14.toFixed(2)}`
                    : "Volatility context"}
                </Text>
              </View>

              <View style={styles.techMiniCard}>
                <Text style={styles.techMiniLabel}>Volume</Text>
                <Text style={styles.techMiniValue}>
                  {detail.technical.volume?.label || "—"}
                </Text>
                <Text style={styles.techMiniSub}>
                  {detail.technical.volume?.volumeVsMa20Pct != null
                    ? `${detail.technical.volume.volumeVsMa20Pct.toFixed(1)}% vs avg`
                    : "Volume context"}
                </Text>
              </View>
            </View>

            <TouchableOpacity
              style={styles.techButton}
              onPress={() =>
                navigation.navigate("FullTechnicalDetailScreen", {
                  symbol: detail.symbol,
                  companyName: detail.companyName,
                  quote: detail.quote,
                  technical: detail.technical,
                  featuresMeta: detail.featuresMeta,
                })
              }
            >
              <Text style={styles.techButtonText}>View Technical Details</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* EXEC SUMMARY */}
        {detail?.ui?.executiveSummaryShort && (
          <View style={styles.card}>
            <View style={styles.sectionHeaderRow}>
              <View style={styles.sectionAccent} />
              <Text style={styles.sectionTitle}>Executive Summary</Text>
            </View>
            <Text style={styles.sectionBody}>
              {detail.ui.executiveSummaryShort}
            </Text>
          </View>
        )}

        {/* KEY STATS (ticker-specific from Grok essay) */}
        {grokSections.keyStats &&
          (() => {
            const stats = parseKeyStats(grokSections.keyStats);
            return (
              <View style={styles.card}>
                <View style={styles.sectionHeaderRow}>
                  <View style={styles.sectionAccent} />
                  <Text style={styles.sectionTitle}>Key Statistics</Text>
                </View>

                {stats.length > 0 ? (
                  <View style={styles.statsGrid}>
                    {stats.map((s, idx) => (
                      <View key={idx} style={styles.statsRow}>
                        <Text style={styles.statsLabel}>{s.label}</Text>
                        <Text style={styles.statsValue}>{s.value}</Text>
                      </View>
                    ))}
                  </View>
                ) : (
                  <Text style={styles.sectionBody}>
                    {grokSections.keyStats}
                  </Text>
                )}
              </View>
            );
          })()}

        {/* NEWS */}
        {tickerNews.length > 0 && (
          <View style={styles.card}>
            <View style={styles.sectionHeaderRow}>
              <View style={styles.sectionAccent} />
              <Text style={styles.sectionTitle}>Market News</Text>
            </View>
            <Text style={styles.patternNote}>
              Recent headlines are provided for market context and may come from
              third-party sources.
            </Text>
            {tickerNews.slice(0, 5).map((n, idx) => (
              <View key={`news-${idx}`} style={styles.newsItem}>
                <Text style={styles.newsTitle}>{n.title || n.headline}</Text>

                {!!(n.summary || n.description) && (
                  <Text style={styles.newsSummary} numberOfLines={2}>
                    {n.summary || n.description}
                  </Text>
                )}

                <Text style={styles.newsMeta}>
                  {(n.source || "News") +
                    (n.pubDate || n.datetime
                      ? ` • ${formatNewsTime(n.pubDate || n.datetime * 1000)}`
                      : "")}
                </Text>
              </View>
            ))}
          </View>
        )}

        {risksOpportunities && (
          <View style={styles.card}>
            <View style={styles.sectionHeaderRow}>
              <View style={styles.sectionAccent} />
              <Text style={styles.sectionTitle}>
                Risks & Opportunities Context
              </Text>
            </View>
            <Text style={styles.patternNote}>
              Risk and opportunity context is based on current probability,
              technical, and pattern signals.
            </Text>
            {/* Short summary */}
            {risksOpportunities.short && (
              <Text style={styles.sectionBody}>{risksOpportunities.short}</Text>
            )}

            {/* Medium summary */}
            {risksOpportunities.medium && (
              <Text style={[styles.sectionBody, { marginTop: 6 }]}>
                {risksOpportunities.medium}
              </Text>
            )}

            {/* Risks */}
            {Array.isArray(risksOpportunities.risks) &&
              risksOpportunities.risks.length > 0 && (
                <>
                  <Text style={styles.subSectionLabelRisk}>Risks Factors</Text>
                  {risksOpportunities.risks.map((r, idx) => (
                    <View key={`risk-${idx}`} style={styles.bulletRow}>
                      <Text style={styles.bulletDot}>•</Text>
                      <Text style={styles.bulletText}>{r}</Text>
                    </View>
                  ))}
                </>
              )}

            {/* Opportunities */}
            {Array.isArray(risksOpportunities.opportunities) &&
              risksOpportunities.opportunities.length > 0 && (
                <>
                  <Text style={styles.subSectionLabelOpportunity}>
                    Opportunities Factors
                  </Text>
                  {risksOpportunities.opportunities.map((o, idx) => (
                    <View key={`opp-${idx}`} style={styles.bulletRow}>
                      <Text style={styles.bulletDot}>•</Text>
                      <Text style={styles.bulletText}>{o}</Text>
                    </View>
                  ))}
                </>
              )}
          </View>
        )}

        {tradeIdea && (
          <View style={styles.card}>
            <View style={styles.sectionHeaderRow}>
              <View style={styles.sectionAccent} />
              <Text style={styles.sectionTitle}>Market Scenario</Text>
            </View>
            <Text style={styles.patternNote}>
              This scenario describes current market context and is not a
              trading recommendation.
            </Text>
            {/* Stance */}
            {tradeIdea.stance && (
              <Text style={styles.scenarioStance}>
                {displayRating(tradeIdea.stance)} context
              </Text>
            )}

            {/* Summary */}
            {tradeIdea.summary && (
              <Text style={styles.sectionBody}>{tradeIdea.summary}</Text>
            )}

            {/* Note / disclaimer */}
            {tradeIdea.note && (
              <View
                style={{
                  marginTop: 8,
                  paddingTop: 6,
                  borderTopWidth: 1,
                  borderTopColor: BRAND.border,
                }}
              >
                <Text
                  style={{
                    color: BRAND.sub,
                    fontSize: 11.5,
                    lineHeight: 16,
                  }}
                >
                  📊 {tradeIdea.note}
                </Text>
              </View>
            )}
          </View>
        )}

        {finalRecommendation && (
          <View style={[styles.card, styles.finalCard]}>
            <View style={styles.sectionHeaderRow}>
              <View style={styles.sectionAccent} />
              <Text style={styles.sectionTitle}>AI Rating Summary</Text>
            </View>

            {/* Signal + Confidence */}
            {(finalRecommendation.signal ||
              finalRecommendation.confidence != null) && (
              <View style={styles.ratingSummaryRow}>
                {finalRecommendation.signal && (
                  <Text
                    style={[
                      styles.ratingSummarySignal,
                      { color: signalColor(finalRecommendation.signal) },
                    ]}
                  >
                    {displayRating(finalRecommendation.signal)}
                  </Text>
                )}

                {finalRecommendation.confidence != null && (
                  <Text style={styles.ratingSummaryConfidence}>
                    • {finalRecommendation.confidence.toFixed(1)}% confidence
                  </Text>
                )}
              </View>
            )}

            {/* Trend context */}
            {finalRecommendation.trend && (
              <Text
                style={[
                  styles.sectionBody,
                  { marginBottom: 4, color: BRAND.sub },
                ]}
              >
                Trend: {finalRecommendation.trend}
              </Text>
            )}

            {/* Recommendation text */}
            {finalRecommendation.text && (
              <Text style={styles.sectionBody}>{finalRecommendation.text}</Text>
            )}
          </View>
        )}

        {/* EDUCATIONAL NOTE / RISK FOOTER */}
        <View style={styles.riskFooterCard}>
          <View style={styles.riskFooterHeader}>
            <Ionicons
              name="shield-checkmark-outline"
              size={16}
              color={BRAND.amber}
            />
            <Text style={styles.riskFooterTitle}>Educational Note</Text>
          </View>

          {structuredGrok.risk_note ? (
            <Text style={styles.riskNoteText}>{structuredGrok.risk_note}</Text>
          ) : null}

          <Text style={styles.riskNoteText}>
            Alphaclara insights are generated using historical price data,
            technical indicators, probability models, pattern analysis, and
            market behavior. These signals do not guarantee future performance.
          </Text>

          <Text style={styles.riskNoteText}>
            This information is provided for educational and research purposes
            only and should not be treated as financial or investment advice.
          </Text>
        </View>

        {/* Footer credit */}
        <View style={styles.footerWrap}>
          <Text style={styles.powered}>
            Powered by <Text style={styles.brand}>Alphaclara</Text>
          </Text>

          <Text style={styles.disclaimer}>
            Market insights, AI ratings, and alerts are provided for
            informational and educational purposes only and do not constitute
            financial or investment advice.
          </Text>
        </View>

        <View style={{ height: 60 }} />
      </ScrollView>

      {detail && (
        <TouchableOpacity
          style={styles.astraFab}
          activeOpacity={0.85}
          onPress={() => setAstraVisible(true)}
        >
          <AstraAnimatedIcon size={52} />
        </TouchableOpacity>
      )}

      {astraStockContext && (
        <AstraChat
          visible={astraVisible}
          onClose={() => setAstraVisible(false)}
          portfolioData={astraStockContext}
        />
      )}
    </View>
  );
}

// =======================
//   STYLES
// =======================
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BRAND.bg,
    paddingHorizontal: 16,
    paddingTop: 12,
  },

  headerCard: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: BRAND.border,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 8,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  symbol: {
    color: BRAND.text,
    fontSize: 28,
    fontWeight: "900",
    letterSpacing: 0.3,
  },
  name: {
    color: BRAND.sub,
    fontSize: 13,
    marginTop: 3,
    fontWeight: "700",
  },
  priceBlock: { alignItems: "flex-end", maxWidth: "50%" },
  price: {
    color: BRAND.text,
    fontSize: 24,
    fontWeight: "900",
  },
  pct: {
    fontSize: 13,
    fontWeight: "800",
    marginTop: 3,
  },
  positive: { color: BRAND.accent },
  negative: { color: BRAND.red },
  footerWrap: {
    alignItems: "center",
    marginTop: 24,
    paddingHorizontal: 12,
  },

  powered: {
    color: BRAND.sub,
    fontSize: 12,
    marginBottom: 8,
  },

  brand: {
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
  },
  headerMetaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: BRAND.border,
  },
  headerMeta: {
    color: BRAND.muted,
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  sparklineEmpty: {
    paddingVertical: 18,
    alignItems: "center",
  },

  sparklineEmptyText: {
    color: BRAND.muted,
    fontSize: 12,
    fontWeight: "700",
  },
  headerMetaValue: {
    color: BRAND.text,
    fontSize: 13,
    fontWeight: "800",
    marginTop: 3,
  },

  metaCol: {
    flex: 1,
  },

  card: {
    backgroundColor: BRAND.card,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: BRAND.border,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginTop: 8,
  },
  cardSubText: {
    color: BRAND.muted,
    fontSize: 11.5,
    marginTop: 2,
    fontFamily: TYPO.fontFamily.medium,
  },

  sectionHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
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
    fontSize: 15,
    fontFamily: TYPO.fontFamily.extrabold,
    letterSpacing: -0.15,
  },
  refreshBtn: {
    borderWidth: 1,
    borderColor: BRAND.border,
    borderRadius: 999,
    padding: 6,
  },
  chartMiniButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
  },

  chartMiniButtonText: {
    color: BRAND.text,
    fontSize: 12,
    fontFamily: TYPO.fontFamily.bold,
    marginRight: 3,
  },

  ratingSummaryRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 6,
  },

  ratingSummarySignal: {
    fontWeight: "900",
    fontSize: 13.5,
  },

  ratingSummaryConfidence: {
    color: BRAND.sub,
    fontSize: 13,
    fontWeight: "700",
  },

  // Hybrid signal
  signalGradient: {
    marginTop: 6,
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: BRAND.border,
    backgroundColor: "#020617",
  },
  signalRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    marginBottom: 8,
    columnGap: 10,
    rowGap: 4,
  },
  signalPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  signalPillText: {
    color: "#000",
    fontSize: 12,
    fontWeight: "800",
  },
  signalTagline: {
    flexShrink: 1,
    flexGrow: 1,
    color: BRAND.text,
    fontSize: 13,
    lineHeight: 18,
    minWidth: 0,
  },
  hybridNumbersRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 6,
  },
  hybridNumCol: {
    flex: 1,
    paddingRight: 6,
  },
  hybridLabel: {
    color: BRAND.sub,
    fontSize: 11,
  },
  hybridValue: {
    color: BRAND.text,
    fontSize: 13,
    fontWeight: "600",
    marginTop: 2,
  },
  hybridNarrativeBox: {
    marginTop: 8,
    borderTopWidth: 1,
    borderTopColor: BRAND.border,
    paddingTop: 6,
  },
  hybridNarrativeText: {
    color: BRAND.text,
    fontSize: 13,
    lineHeight: 19,
  },
  sectionBody: {
    color: BRAND.text,
    fontSize: 13.5,
    lineHeight: 19,
  },

  subSectionLabelRisk: {
    color: BRAND.red,
    fontSize: 14,
    fontFamily: TYPO.fontFamily.bold,
    marginTop: 8,
    marginBottom: 4,
  },

  subSectionLabelOpportunity: {
    color: BRAND.accent,
    fontSize: 14,
    fontFamily: TYPO.fontFamily.bold,
    marginTop: 8,
    marginBottom: 4,
  },

  bulletRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 4,
  },
  bulletDot: {
    color: "rgba(255,255,255,0.45)",
    fontSize: 16,
    lineHeight: 20,
    marginRight: 6,
  },
  bulletText: {
    color: BRAND.text,
    fontSize: 13.5,
    lineHeight: 20,
    flex: 1,
  },

  statsGrid: {
    marginTop: 6,
    borderTopWidth: 1,
    borderTopColor: BRAND.border,
    paddingTop: 4,
    rowGap: 4,
  },
  statsRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderBottomColor: BRAND.border,
    paddingVertical: 6,
  },
  statsLabel: {
    color: BRAND.sub,
    fontSize: 13,
    fontWeight: "500",
    flexShrink: 0,
    minWidth: "38%",
    maxWidth: "45%",
    marginRight: 10,
    lineHeight: 18,
  },
  statsValue: {
    color: BRAND.text,
    fontSize: 13.5,
    fontWeight: "600",
    flexGrow: 1,
    flexShrink: 1,
    flexWrap: "wrap",
    textAlign: "right",
    lineHeight: 18,
  },

  finalCard: {
    marginBottom: 8,
  },

  riskNoteText: {
    color: BRAND.sub,
    fontSize: 11.5,
    lineHeight: 17,
    marginBottom: 4,
  },
  whyBlock: {
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: BRAND.border,
  },
  whyLabel: {
    color: BRAND.sub,
    fontSize: 11,
    marginBottom: 2,
    fontWeight: "600",
    textTransform: "uppercase",
  },
  whyText: {
    color: BRAND.text,
    fontSize: 13,
    lineHeight: 18,
  },
  patternTitle: {
    color: BRAND.text,
    fontSize: 16,
    fontWeight: "800",
    marginBottom: 4,
  },

  patternMeta: {
    color: BRAND.sub,
    fontSize: 13,
    marginBottom: 6,
  },

  patternExplanation: {
    color: BRAND.text,
    fontSize: 13.5,
    lineHeight: 19,
    marginBottom: 10,
  },
  techButton: {
    marginTop: 10,
    paddingVertical: 12,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    alignItems: "center",
    justifyContent: "center",
  },

  techButtonText: {
    color: BRAND.text,
    fontSize: 13.5,
    fontFamily: TYPO.fontFamily.bold,
  },

  patternButton: {
    marginTop: 10,
    paddingVertical: 12,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    alignItems: "center",
    justifyContent: "center",
  },
  patternButtonText: {
    color: BRAND.text,
    fontSize: 13.5,
    fontFamily: TYPO.fontFamily.bold,
  },

  sparklineWrap: {
    marginTop: 10,
    paddingHorizontal: 4,
    alignItems: "center",
  },

  sparklineMeta: {
    marginTop: 6,
    width: "100%",
    flexDirection: "row",
    justifyContent: "space-between",
  },

  sparklineMetaText: {
    color: BRAND.sub,
    fontSize: 11,
    opacity: 0.85,
  },
  riskFooterCard: {
    backgroundColor: BRAND.card2,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: BRAND.border,
    paddingHorizontal: 12,
    paddingVertical: 12,
    marginTop: 12,
    marginBottom: 8,
  },

  riskFooterHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 6,
  },

  riskFooterTitle: {
    color: BRAND.amber,
    fontSize: 14,
    fontWeight: "800",
    marginLeft: 8,
  },
  astraFab: {
    position: "absolute",
    left: 20,
    bottom: 82,
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: "transparent",
    borderWidth: 0,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 50,
    elevation: 10,
  },
  headerCompactRow: {
    marginTop: 6,
  },

  headerCompactText: {
    color: BRAND.muted,
    fontSize: 11.5,
    fontWeight: "700",
  },

  headerCompactValue: {
    color: BRAND.text,
    fontWeight: "800",
  },
  ratingDisclaimer: {
    color: BRAND.muted,
    fontSize: 10.5,
    lineHeight: 15,
    marginTop: 6,
    fontWeight: "700",
  },
  patternNote: {
    color: BRAND.muted,
    fontSize: 10.5,
    lineHeight: 15,
    marginBottom: 8,
    fontWeight: "700",
  },
  probBlock: {
    marginTop: 8,
  },

  probBarWrap: {
    height: 8,
    backgroundColor: BRAND.border,
    borderRadius: 999,
    overflow: "hidden",
  },

  probBarFill: {
    height: "100%",
    borderRadius: 999,
  },

  probRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 6,
  },

  probText: {
    color: BRAND.sub,
    fontSize: 11.5,
    fontWeight: "800",
  },

  probBias: {
    color: BRAND.muted,
    fontSize: 10.5,
    marginTop: 4,
    fontWeight: "700",
    textAlign: "center",
  },
  newsItem: {
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: BRAND.border,
  },

  newsTitle: {
    color: BRAND.text,
    fontSize: 13.5,
    lineHeight: 18,
    fontWeight: "800",
  },

  newsSummary: {
    color: BRAND.sub,
    fontSize: 12,
    lineHeight: 17,
    marginTop: 4,
  },

  newsMeta: {
    color: BRAND.muted,
    fontSize: 11,
    fontWeight: "700",
    marginTop: 5,
  },
  scenarioStance: {
    color: BRAND.amber,
    fontSize: 13.5,
    fontFamily: TYPO.fontFamily.extrabold,
    marginBottom: 6,
  },
  techGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 8,
  },

  techMiniCard: {
    width: "48%",
    backgroundColor: BRAND.card2,
    borderWidth: 1,
    borderColor: BRAND.border,
    borderRadius: 12,
    padding: 10,
  },

  techMiniLabel: {
    color: BRAND.muted,
    fontSize: 10.5,
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },

  techMiniValue: {
    color: BRAND.text,
    fontSize: 14,
    fontWeight: "900",
    marginTop: 4,
  },

  techMiniSub: {
    color: BRAND.sub,
    fontSize: 11,
    fontWeight: "700",
    marginTop: 3,
  },
  sparklineSourceText: {
    color: BRAND.muted,
    fontSize: 10,
    fontWeight: "700",
    marginTop: 5,
    textAlign: "center",
  },
});
