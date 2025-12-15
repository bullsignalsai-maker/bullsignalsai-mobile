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
import { LinearGradient } from "expo-linear-gradient";
import { Svg, Path } from "react-native-svg";
import { API_BASE_URL } from "../config/apiKeys"; // ✅ backend base URL
import SmartPatternCard from "../components/SmartPatternCard";

// === Brand palette ===
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

// Grok cache TTL (frontend, extra safety on top of backend cache)
const GROK_CACHE_TTL_HOURS = 6;

// --- Format large numbers like 1,200,000 → 1.2M ---
function formatNumberShort(n) {
  if (n === null || n === undefined || isNaN(n)) return "N/A";
  if (n >= 1e12) return (n / 1e12).toFixed(2).replace(/\.0+$/, "") + "T";
  if (n >= 1e9) return (n / 1e9).toFixed(2).replace(/\.0+$/, "") + "B";
  if (n >= 1e6) return (n / 1e6).toFixed(2).replace(/\.0+$/, "") + "M";
  if (n >= 1e3) return (n / 1e3).toFixed(2).replace(/\.0+$/, "") + "K";
  return n.toString();
}

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
    { id: "sentiment", labels: ["news & market sentiment", "market sentiment"] },
    { id: "risks", labels: ["risks & opportunities", "risks and opportunities"] },
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

// --- Separate Risks and Opportunities inside one section ---
function splitRisksAndOpportunities(text = "") {
  if (!text) return { risks: [], opportunities: [] };

  const cleaned = text
    .replace(/\*\*/g, "")
    .replace(/#{1,3}\s*/g, "")
    .replace(/\s{2,}/g, " ")
    .replace(/\.\.+/g, ".")
    .replace(/\s*\.\s*/g, ". ")
    .trim();

  const lower = cleaned.toLowerCase();
  const riskIdx = lower.indexOf("risk");
  const oppIdx = lower.indexOf("opportunit");

  let risks = "";
  let opportunities = "";

  if (riskIdx !== -1 && oppIdx !== -1) {
    if (riskIdx < oppIdx) {
      risks = cleaned.slice(riskIdx, oppIdx).trim();
      opportunities = cleaned.slice(oppIdx).trim();
    } else {
      opportunities = cleaned.slice(oppIdx, riskIdx).trim();
      risks = cleaned.slice(riskIdx).trim();
    }
  } else if (riskIdx !== -1) {
    risks = cleaned.slice(riskIdx).trim();
  } else if (oppIdx !== -1) {
    opportunities = cleaned.slice(oppIdx).trim();
  } else {
    risks = cleaned;
  }

  const sentenceSplit = (txt) =>
    txt
      .replace(/^[^a-zA-Z]*risks?:?/i, "")
      .replace(/^[^a-zA-Z]*opportunit(y|ies)?:?/i, "")
      .split(/(?<=[.!?])\s+(?=[A-Z(])/)
      .map((s) => s.trim().replace(/^[-–•]+/, ""))
      .filter((s) => s.length > 3);

  return {
    risks: sentenceSplit(risks),
    opportunities: sentenceSplit(opportunities),
  };
}

// --- Convert sentiment text into clean bullet points ---
function formatSentimentAsBullets(text = "") {
  if (!text) return [];

  const cleaned = text
    .replace(/\*\*/g, "")
    .replace(/#{1,3}\s*/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();

  const parts = cleaned
    .split(/[\n•\-–]|(?<=\.)\s+/)
    .map((p) => p.trim())
    .filter((p) => p.length > 3);

  return parts;
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

function getSignalColor(label) {
  if (!label) return BRAND.amber;
  const s = label.toUpperCase();
  if (s.includes("STRONG BUY")) return BRAND.accent;
  if (s.includes("BUY")) return BRAND.accent;
  if (s.includes("STRONG SELL")) return BRAND.red;
  if (s.includes("SELL")) return BRAND.red;
  if (s.includes("HOLD") || s.includes("NEUTRAL")) return BRAND.amber;
  return BRAND.amber;
}

function formatPercentFromProb(prob, digits = 1) {
  if (prob === null || prob === undefined || isNaN(prob)) return "N/A";
  return (prob * 100).toFixed(digits) + "%";
}

function formatPercent(n, digits = 1) {
  if (n === null || n === undefined || isNaN(n)) return "N/A";
  return n.toFixed(digits) + "%";
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
          : ".")
    );
  }

  if (rsi != null || rsiSummary || macdSummary) {
    if (rsiSummary || macdSummary) {
      parts.push(
        `${rsiSummary || ""}${
          rsiSummary && macdSummary ? " and " : ""
        }${macdSummary || ""}`.replace(/\s+/g, " ")
      );
    } else if (rsi != null) {
      if (rsi < 30) {
        parts.push(
          `Momentum is oversold (RSI ~${rsi.toFixed(
            0
          )}), suggesting the move may be stretched.`
        );
      } else if (rsi > 70) {
        parts.push(
          `Momentum is overbought (RSI ~${rsi.toFixed(
            0
          )}), so a pause or pullback would not be surprising.`
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
        } its 20-day average`
      );
    }
    if (volBits.length > 0) {
      parts.push(
        `Trading activity is ${volBits.join(", ")}.`.replace(/\s+/g, " ")
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
        1
      )}% confidence, which is blended with technicals into a ${
        signal || "HYBRID"
      } view.`
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
//   STOCKDETAIL BACKEND CALL
// ================================
async function fetchStockDetail(symbol) {
  try {
    const res = await fetch(`${API_BASE_URL}/stockdetail/${symbol}`);
    const json = await res.json();
    if (!res.ok || json?.error) {
      console.warn("stockdetail backend error:", json?.error || res.status);
      return null;
    }
    return json;
  } catch (err) {
    console.warn("fetchStockDetail error:", err);
    return null;
  }
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
      console.log(`💾 Using cached Grok analysis for ${symbol}`);
      return cached;
    }
  }

  try {
    const res = await fetch(
      `${API_BASE_URL}/grok-stock/${symbol}?force=${force ? "true" : "false"}`
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
      console.log(`♻️ Falling back to cached Grok essay for ${symbol}`);
      return cached;
    }
    return { text: "⚠️ Failed to fetch AI analysis.", updatedAt: null };
  }
}

// ================
//   MINI CHART
// ================
function MiniChart({ candles, rangeKey }) {
  const data = useMemo(() => {
    if (!candles || !candles.length) return [];
    const total = candles.length;
    let keep = 0;
    switch (rangeKey) {
      case "1D":
        keep = 1;
        break;
      case "5D":
        keep = 5;
        break;
      case "1M":
        keep = 22;
        break;
      case "6M":
        keep = 126;
        break;
      case "1Y":
        keep = 252;
        break;
      default:
        keep = 60;
    }
    if (keep >= total) return candles;
    return candles.slice(total - keep);
  }, [candles, rangeKey]);

  if (!data || data.length < 2) {
    return (
      <View style={styles.chartPlaceholder}>
        <Text style={styles.chartPlaceholderText}>Chart data unavailable</Text>
      </View>
    );
  }

  const prices = data.map((c) => c.close);
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const range = max - min || 1;
  const width = 100;
  const height = 40;

  let d = "";
  data.forEach((c, idx) => {
    const x = (idx / (data.length - 1)) * width;
    const y = height - ((c.close - min) / range) * height;
    d += `${idx === 0 ? "M" : "L"}${x},${y} `;
  });

  const first = prices[0];
  const last = prices[prices.length - 1];
  const isUp = last >= first;

  return (
    <View style={styles.chartContainer}>
      <Svg width="100%" height={height}>
        <Path
          d={d.trim()}
          stroke={isUp ? BRAND.accent : BRAND.red}
          strokeWidth={1.8}
          fill="none"
        />
      </Svg>
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
  } = route.params || {};

  const [symbol] = useState(initialSymbol);
  const [detail, setDetail] = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(true);

  const [rawGrokText, setRawGrokText] = useState("");
  const [grokUpdatedAt, setGrokUpdatedAt] = useState(null);
  const [loadingGrok, setLoadingGrok] = useState(true);

  const [refreshing, setRefreshing] = useState(false);
  const [chartRange, setChartRange] = useState("1M");

  const loadAll = useCallback(
    async (forceGrok = false) => {
      setLoadingDetail(true);
      const sd = await fetchStockDetail(symbol);
      setDetail(sd);
      setLoadingDetail(false);

      // Grok long-form essay for trade idea / key stats / final rec
      setLoadingGrok(true);
      const grok = await fetchGrokAnalysis(symbol, forceGrok);
      setRawGrokText(grok.text || "");
      setGrokUpdatedAt(grok.updatedAt || null);
      setLoadingGrok(false);
    },
    [symbol]
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
  const candles = detail?.candles?.candles || [];
  const bullbrain = detail?.bullbrain;
  // ---- SMART PATTERN (from /stockdetail) ----
const smartPattern = detail?.smartPattern;
const patternDates = detail?.patternDates || [];
const patternStats = detail?.patternStats;



  const technical = detail?.technical;
  const tickerNews = detail?.news || [];
  const structuredGrok = detail?.grok || {};
  const hybridSignal = detail?.hybridSignal;
  const hybridProbUp = detail?.hybridProbUp;
  const hybridScore = detail?.hybridScore;

  const hybridUpdatedTs = structuredGrok?.updatedAt
    ? new Date(structuredGrok.updatedAt).getTime()
    : null;

  // ---- Derived sections from Grok essay ----
  const grokSections = useMemo(
    () => parseStructuredSections(rawGrokText),
    [rawGrokText]
  );

  // Fallback prediction lines from essay if structured not present
  const predictionsFromEssay = useMemo(
    () => extractPredictionLines(grokSections.predictions || ""),
    [grokSections.predictions]
  );

  const shortTermOutlook =
    structuredGrok.short_term || predictionsFromEssay.shortTerm || "";
  const mediumTermOutlook =
    structuredGrok.medium_term || predictionsFromEssay.mediumTerm || "";
  const longTermOutlook =
    structuredGrok.long_term || predictionsFromEssay.longTerm || "";

  const hybridNarrative = useMemo(
    () => buildHybridNarrative(hybridSignal, technical, bullbrain),
    [hybridSignal, technical, bullbrain]
  );

  const hasTradeIdea =
    grokSections.tradeIdea &&
    grokSections.tradeIdea.toLowerCase() !== "none" &&
    grokSections.tradeIdea.trim().length > 0;

  return (
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
      <LinearGradient
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
              <View style={styles.metaCol}>
                <Text style={styles.headerMeta}>Prev Close</Text>
                <Text style={styles.headerMetaValue}>
                  {quote?.prevClose != null
                    ? `$${quote.prevClose.toFixed(2)}`
                    : "—"}
                </Text>
              </View>
            </View>

            {/* ROW 2: Open + Volume */}
            <View style={styles.headerMetaRow}>
              <View style={styles.metaCol}>
                <Text style={styles.headerMeta}>Open</Text>
                <Text style={styles.headerMetaValue}>
                  {quote?.open != null ? `$${quote.open.toFixed(2)}` : "—"}
                </Text>
              </View>
              <View style={styles.metaCol}>
                <Text style={styles.headerMeta}>Volume</Text>
                <Text style={styles.headerMetaValue}>
                  {quote?.volume != null
                    ? formatNumberShort(quote.volume)
                    : "N/A"}
                </Text>
              </View>
            </View>

            {detail?.asOf && (
              <Text style={styles.volumeDate}>
                As of{" "}
                {new Date(detail.asOf).toLocaleString(undefined, {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                  hour: "numeric",
                  minute: "2-digit",
                })}
              </Text>
            )}
          </>
        ) : (
          <Text style={{ color: BRAND.sub }}>Failed to load quote.</Text>
        )}
      </LinearGradient>

      {/* MINI CHART + TIMEFRAMES */}
      <View style={styles.card}>
        <View style={styles.sectionHeaderRow}>
          <View style={styles.sectionAccent} />
          <Text style={styles.sectionTitle}>Price Chart</Text>
          <View style={{ flex: 1 }} />
          <View style={styles.timeframeRow}>
            {["1D", "5D", "1M", "6M", "1Y"].map((tf) => (
              <TouchableOpacity
                key={tf}
                onPress={() => setChartRange(tf)}
                style={[
                  styles.timeframePill,
                  chartRange === tf && styles.timeframePillActive,
                ]}
              >
                <Text
                  style={[
                    styles.timeframeText,
                    chartRange === tf && styles.timeframeTextActive,
                  ]}
                >
                  {tf}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <MiniChart candles={candles} rangeKey={chartRange} />

        <View style={styles.chartFooterRow}>
          <Text style={styles.chartSourceText}></Text>
          <TouchableOpacity
          style={styles.chartButton}
          onPress={() => {
            navigation.navigate("FullChartScreen", {
              symbol: detail?.symbol,
              candles: detail?.candles?.candles || [],
              price: detail?.price || 0,
              name: detail?.companyName || detail?.symbol,
              // ✅ pass these so FullChartScreen has data
              quote: detail?.quote || null,
              features: detail?.features || null,
              technical: detail?.technical || null,
              bullbrain: detail?.bullbrain || null,
              hybridProbUp: detail?.hybridProbUp ?? null,
              hybridSignal: detail?.hybridSignal ?? null,
              hybridScore: detail?.hybridScore ?? null,
              grok: detail?.grok || null,
            });
          }}
        >
          <Text style={styles.chartButtonText}>View Full Chart</Text>
        </TouchableOpacity>
 </View>
</View>

      {/* AI HYBRID SIGNAL */}
      <View style={styles.card}>
        <View style={styles.sectionHeaderRow}>
          <View style={styles.sectionAccent} />
          <View style={{ flex: 1 }}>
            <Text style={styles.cardTitle}>AI Hybrid Signal</Text>
            <Text style={styles.cardSubText}>
              Powered by BullsignalsAI •{" "}
              {hybridUpdatedTs
                ? `Updated ${timeAgo(hybridUpdatedTs)}`
                : "Analyzing..."}
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
                { backgroundColor: getSignalColor(hybridSignal) },
              ]}
            >
              <Text style={styles.signalPillText}>
                {(hybridSignal || "NEUTRAL").toUpperCase()}
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.signalTagline} numberOfLines={2}>
                {structuredGrok.ai_signal ||
                  "Hybrid AI blends BullBrain and technicals for this view."}
              </Text>
            </View>
          </View>

          {/* Numbers row */}
          <View style={styles.hybridNumbersRow}>
            <View style={styles.hybridNumCol}>
              <Text style={styles.hybridLabel}>Confidence</Text>
              <Text style={styles.hybridValue}>
                {hybridScore != null ? formatPercent(hybridScore, 1) : "N/A"}
              </Text>
            </View>
            <View style={styles.hybridNumCol}>
              <Text style={styles.hybridLabel}>Chances of upside</Text>
              <Text style={styles.hybridValue}>
                {hybridProbUp != null
                  ? formatPercentFromProb(hybridProbUp, 1)
                  : "N/A"}
              </Text>
            </View>
            <View style={styles.hybridNumCol}>
              <Text style={styles.hybridLabel}>Model blend</Text>
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

          {/* Narrative */}
          <View style={styles.hybridNarrativeBox}>
            <Text style={styles.hybridNarrativeText}>{hybridNarrative}</Text>
          </View>
        </View>
      </View>

    {/* SMART PATTERN ALERT */}
      {smartPattern && (
          <SmartPatternCard
            patternData={{
              pattern: smartPattern?.pattern,
              headline: smartPattern?.headline,
              winRate: smartPattern?.winRate,
              occurrences: smartPattern?.occurrences ?? 0,
              samples: smartPattern?.samples ?? [],
              forwardReturns: smartPattern?.forwardReturns ?? {},
              dates: patternDates,
            }}
          />
        )}


      {/* OUTLOOK CARD: Short / Medium / Long */}
      {(shortTermOutlook || mediumTermOutlook || longTermOutlook) && (
        <View style={styles.card}>
          <View style={styles.sectionHeaderRow}>
            <View style={styles.sectionAccent} />
            <Text style={styles.sectionTitle}>Outlook</Text>
          </View>
          <View style={styles.outlookRow}>
            {shortTermOutlook ? (
              <View style={styles.outlookCol}>
                <Text style={styles.outlookLabel}>Short-term (1–6 wks)</Text>
                <Text style={styles.outlookText}>{shortTermOutlook}</Text>
              </View>
            ) : null}
            {mediumTermOutlook ? (
              <View style={styles.outlookCol}>
                <Text style={styles.outlookLabel}>Medium-term (6–12 mo)</Text>
                <Text style={styles.outlookText}>{mediumTermOutlook}</Text>
              </View>
            ) : null}
            {longTermOutlook ? (
              <View style={styles.outlookCol}>
                <Text style={styles.outlookLabel}>Long-term (1–3 yrs)</Text>
                <Text style={styles.outlookText}>{longTermOutlook}</Text>
              </View>
            ) : null}
          </View>
        </View>
      )}

      {/* TECHNICAL SNAPSHOT: Trend, Momentum, Volatility, Volume */}
      {technical && (
        <View style={styles.card}>
          <View style={styles.sectionHeaderRow}>
            <View style={styles.sectionAccent} />
            <Text style={styles.sectionTitle}>Technical Snapshot</Text>
          </View>
          <View style={styles.snapshotGrid}>
            {/* Trend */}
            <View style={styles.snapshotItem}>
              <Text style={styles.snapshotLabel}>Trend</Text>
              <Text style={styles.snapshotStatus}>
                {technical.trend?.summary || "N/A"}
              </Text>
              <Text style={styles.snapshotSubtext}>
                {technical.trend?.price_vs_sma20_pct != null ||
                technical.trend?.distance_from_20d_high != null
                  ? `Price is around ${
                      technical.trend?.price_vs_sma20_pct != null
                        ? Math.abs(
                            technical.trend.price_vs_sma20_pct
                          ).toFixed(1) +
                          "% " +
                          (technical.trend.price_vs_sma20_pct < 0
                            ? "below"
                            : "above") +
                          " its 20D average"
                        : ""
                    }${
                      technical.trend?.distance_from_20d_high != null
                        ? (technical.trend?.price_vs_sma20_pct != null
                            ? ", "
                            : "") +
                          `${Math.abs(
                            technical.trend.distance_from_20d_high
                          ).toFixed(1)}% off recent 20D high`
                        : ""
                    }.`
                  : "Short-term direction based on moving averages and recent highs/lows."}
              </Text>
            </View>

            {/* Momentum */}
            <View style={styles.snapshotItem}>
              <Text style={styles.snapshotLabel}>Momentum</Text>
              <Text style={styles.snapshotStatus}>
                {technical.momentum?.summary_rsi ||
                technical.momentum?.summary_macd
                  ? `${technical.momentum.summary_rsi || ""}${
                      technical.momentum.summary_rsi &&
                      technical.momentum.summary_macd
                        ? " • "
                        : ""
                    }${technical.momentum.summary_macd || ""}`.trim()
                  : "N/A"}
              </Text>
              <Text style={styles.snapshotSubtext}>
                {technical.momentum?.rsi14 != null
                  ? `RSI around ${technical.momentum.rsi14.toFixed(
                      1
                    )} with MACD and stochastic levels shaping short-term swings.`
                  : "Relative strength, MACD, and stochastics describe buying vs selling pressure."}
              </Text>
            </View>

            {/* Volatility */}
            <View style={styles.snapshotItem}>
              <Text style={styles.snapshotLabel}>Volatility</Text>
              <Text style={styles.snapshotStatus}>
                {technical.volatility?.summary || "N/A"}
              </Text>
              <Text style={styles.snapshotSubtext}>
                {technical.volatility?.atr14 != null
                  ? `ATR near ${technical.volatility.atr14.toFixed(
                      2
                    )} points highlights typical daily swing size.`
                  : "Measures how wide the average daily price range has been recently."}
              </Text>
            </View>

            {/* Volume */}
            <View style={styles.snapshotItem}>
              <Text style={styles.snapshotLabel}>Volume</Text>
              <Text style={styles.snapshotStatus}>
                {technical.volume?.summary || "N/A"}
              </Text>
              <Text style={styles.snapshotSubtext}>
                {technical.volume?.volume_vs_ma20_pct != null
                  ? `Volume is about ${Math.abs(
                      technical.volume.volume_vs_ma20_pct
                    ).toFixed(1)}% ${
                      technical.volume.volume_vs_ma20_pct > 0
                        ? "above"
                        : "below"
                    } its 20D average, reflecting ${
                      technical.volume.volume_vs_ma20_pct > 0
                        ? "active interest"
                        : "quieter trading"
                    }.`
                  : "Compares current trading activity to typical recent levels."}
              </Text>
            </View>
          </View>
        </View>
      )}

      {/* PRICE ACTION TODAY */}
      {technical?.candle && (
        <View style={styles.card}>
          <View style={styles.sectionHeaderRow}>
            <View style={styles.sectionAccent} />
            <Text style={styles.sectionTitle}>Price Action Today</Text>
          </View>
          <View style={{ marginTop: 4 }}>
            {(() => {
              const c = technical.candle;
              const bullets = [];

              if (c.intraday_range_pct != null) {
                bullets.push(
                  `Intraday range about ${c.intraday_range_pct.toFixed(
                    1
                  )}% from low to high.`
                );
              }
              if (c.gap_pct != null) {
                bullets.push(
                  `Opened with a ${Math.abs(c.gap_pct).toFixed(
                    1
                  )}% ${c.gap_pct >= 0 ? "upside" : "downside"} gap vs prior close.`
                );
              }
              if (c.body_pct != null) {
                bullets.push(
                  `Candle body is ${Math.abs(c.body_pct).toFixed(
                    1
                  )}% and ${
                    c.body_pct >= 0 ? "bullish (close above open)" : "bearish"
                  }.`
                );
              }

              if (c.upper_shadow_pct != null || c.lower_shadow_pct != null) {
                const wickParts = [];
                if (c.upper_shadow_pct != null) {
                  wickParts.push(
                    `upper wick near ${c.upper_shadow_pct.toFixed(1)}%`
                  );
                }
                if (c.lower_shadow_pct != null) {
                  wickParts.push(
                    `lower wick near ${c.lower_shadow_pct.toFixed(1)}%`
                  );
                }
                if (wickParts.length) {
                  bullets.push(
                    `Wicks show ${wickParts.join(
                      " and "
                    )}, highlighting intraday push–pull between buyers and sellers.`
                  );
                }
              }

              if (!bullets.length) {
                bullets.push(
                  "Shows how today’s open, high, low, and close compare and where buyers vs sellers were most active."
                );
              }

              return bullets.map((line, idx) => (
                <View key={`pa-${idx}`} style={styles.bulletRow}>
                  <Text style={styles.bulletDot}>•</Text>
                  <Text style={styles.bulletText}>{line}</Text>
                </View>
              ));
            })()}
          </View>
        </View>
      )}

      {/* EXEC SUMMARY */}
      {grokSections.execSummary && (
        <View style={styles.card}>
          <View style={styles.sectionHeaderRow}>
            <View style={styles.sectionAccent} />
            <Text style={styles.sectionTitle}>Executive Summary</Text>
          </View>
          <Text style={styles.sectionBody}>{grokSections.execSummary}</Text>
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
                <Text style={styles.sectionBody}>{grokSections.keyStats}</Text>
              )}
            </View>
          );
        })()}

      {/* TECHNICAL OUTLOOK (Grok narrative) */}
      {grokSections.tech && (
        <View style={styles.card}>
          <View style={styles.sectionHeaderRow}>
            <View style={styles.sectionAccent} />
            <Text style={styles.sectionTitle}>Technical Outlook</Text>
          </View>
          <Text style={styles.sectionBody}>{grokSections.tech}</Text>
        </View>
      )}

      {/* NEWS & MARKET SENTIMENT (ticker-specific) */}
      {(tickerNews.length > 0 || grokSections.sentiment) && (
        <View style={styles.card}>
          <View style={styles.sectionHeaderRow}>
            <View style={styles.sectionAccent} />
            <Text style={styles.sectionTitle}>News & Market Sentiment</Text>
          </View>

          {/* News headlines from /stockdetail */}
          {tickerNews.slice(0, 5).map((n, idx) => (
            <View key={`news-${idx}`} style={{ marginBottom: 6 }}>
              <Text style={styles.newsTitle}>{n.title}</Text>
              <Text style={styles.newsMeta}>
                {(n.source || "News") +
                  (n.pubDate ? ` • ${formatNewsTime(n.pubDate)}` : "")}
              </Text>
            </View>
          ))}

          {/* Grok sentiment bullets */}
          {grokSections.sentiment &&
            formatSentimentAsBullets(grokSections.sentiment).map(
              (line, idx) => (
                <View key={`sent-${idx}`} style={styles.bulletRow}>
                  <Text style={styles.bulletDot}>•</Text>
                  <Text style={styles.bulletText}>{line}</Text>
                </View>
              )
            )}
        </View>
      )}

      {/* RISKS & OPPORTUNITIES */}
      {grokSections.risks &&
        (() => {
          const { risks, opportunities } = splitRisksAndOpportunities(
            grokSections.risks
          );
          return (
            <View style={styles.card}>
              <View style={styles.sectionHeaderRow}>
                <View style={styles.sectionAccent} />
                <Text style={styles.sectionTitle}>Risks & Opportunities</Text>
              </View>

              {risks.length > 0 && (
                <>
                  <Text style={styles.subSectionLabelRisk}>Risks</Text>
                  {risks.map((s, idx) => (
                    <View key={`risk-${idx}`} style={styles.bulletRow}>
                      <Text style={styles.bulletDot}>•</Text>
                      <Text style={styles.bulletText}>{s}</Text>
                    </View>
                  ))}
                </>
              )}

              {opportunities.length > 0 && (
                <>
                  <Text style={styles.subSectionLabelOpportunity}>
                    Opportunities
                  </Text>
                  {opportunities.map((s, idx) => (
                    <View key={`opp-${idx}`} style={styles.bulletRow}>
                      <Text style={styles.bulletDot}>•</Text>
                      <Text style={styles.bulletText}>{s}</Text>
                    </View>
                  ))}
                </>
              )}
            </View>
          );
        })()}

      {/* TRADE IDEA (ticker specific) */}
      {hasTradeIdea && (
        <View style={styles.card}>
          <View style={styles.sectionHeaderRow}>
            <View style={styles.sectionAccent} />
            <Text style={styles.sectionTitle}>Trade Idea</Text>
          </View>
          <View style={styles.tradeBox}>
            <Text style={styles.sectionBody}>{grokSections.tradeIdea}</Text>
            <Text style={styles.tradeDisclaimer}>
              Not financial advice. Do your own research and manage risk.
            </Text>
          </View>
        </View>
      )}

      {/* FINAL RECOMMENDATION */}
      {grokSections.recommendation && (
        <View style={[styles.card, styles.finalCard]}>
          <View style={styles.sectionHeaderRow}>
            <View style={styles.sectionAccent} />
            <Text style={styles.sectionTitle}>Final Recommendation</Text>
          </View>
          <Text style={styles.sectionBody}>{grokSections.recommendation}</Text>
        </View>
      )}

      {/* RISK NOTE / FOOTER */}
      {structuredGrok.risk_note && (
        <View style={styles.card}>
          <Text style={styles.riskNoteText}>{structuredGrok.risk_note}</Text>
          <Text style={styles.riskNoteText}>
            This app is for educational purposes only and does not provide
            financial advice.
          </Text>
        </View>
      )}

      {/* Footer credit */}
      <View style={{ marginTop: 18, alignItems: "center", marginBottom: 30 }}>
        <Text style={{ color: BRAND.sub, fontSize: 12 }}>
          Powered by{" "}
          <Text style={{ color: BRAND.accent, fontWeight: "600" }}>
            BullSignalsAI
          </Text>
        </Text>
      </View>
    </ScrollView>
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
    borderRadius: 16,
    borderWidth: 1,
    borderColor: BRAND.border,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 8,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  symbol: { color: BRAND.text, fontSize: 26, fontWeight: "800" },
  name: { color: BRAND.sub, fontSize: 13, marginTop: 2 },
  priceBlock: { alignItems: "flex-end", maxWidth: "50%" },
  price: {
    color: BRAND.text,
    fontSize: 22,
    fontWeight: "700",
  },
  pct: { fontSize: 13, fontWeight: "600", marginTop: 2 },
  positive: { color: BRAND.accent },
  negative: { color: BRAND.red },

  headerMetaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 8,
  },
  headerMeta: { color: BRAND.sub, fontSize: 12 },
  headerMetaValue: { color: BRAND.text, fontWeight: "600" },

  metaCol: {
    flex: 1,
  },
  volumeDate: {
    color: BRAND.sub,
    fontSize: 11,
    textAlign: "right",
    marginTop: 4,
  },

  card: {
    backgroundColor: BRAND.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: BRAND.border,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginTop: 8,
  },
  cardTitle: { color: BRAND.text, fontSize: 16, fontWeight: "700" },
  cardSubText: { color: BRAND.sub, fontSize: 12, marginTop: 2 },

  sectionHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
  },
  sectionAccent: {
    width: 4,
    height: 18,
    borderRadius: 2,
    backgroundColor: BRAND.accent,
    marginRight: 8,
  },
  sectionTitle: {
    color: BRAND.accent,
    fontSize: 15,
    fontWeight: "700",
  },

  refreshBtn: {
    borderWidth: 1,
    borderColor: BRAND.border,
    borderRadius: 999,
    padding: 6,
  },

  // Chart
  timeframeRow: {
    flexDirection: "row",
    alignItems: "center",
    columnGap: 4,
  },
  timeframePill: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "transparent",
  },
  timeframePillActive: {
    borderColor: BRAND.accent,
    backgroundColor: "#022c22",
  },
  timeframeText: {
    color: BRAND.sub,
    fontSize: 10,
  },
  timeframeTextActive: {
    color: BRAND.accent,
    fontWeight: "600",
  },
  chartContainer: {
    marginTop: 6,
    height: 40,
  },
  chartPlaceholder: {
    marginTop: 10,
    marginBottom: 6,
    alignItems: "center",
    justifyContent: "center",
  },
  chartPlaceholderText: {
    color: BRAND.sub,
    fontSize: 12,
  },
  chartFooterRow: {
    marginTop: 6,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  chartSourceText: {
    color: BRAND.sub,
    fontSize: 11,
  },
  fullChartBtn: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: BRAND.accent,
  },
  fullChartBtnText: {
    color: BRAND.accent,
    fontSize: 12,
    fontWeight: "600",
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

  // Outlook
  outlookRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    columnGap: 8,
    marginTop: 4,
  },
  outlookCol: {
    flex: 1,
    minWidth: "48%",
    marginTop: 4,
  },
  outlookLabel: {
    color: BRAND.sub,
    fontSize: 11,
    marginBottom: 2,
  },
  outlookText: {
    color: BRAND.text,
    fontSize: 13,
    lineHeight: 18,
  },

  // Technical snapshot
  snapshotGrid: {
    marginTop: 4,
    flexDirection: "row",
    flexWrap: "wrap",
  },
  snapshotItem: {
    width: "50%",
    paddingRight: 6,
    paddingVertical: 6,
  },
  snapshotLabel: {
    color: BRAND.sub,
    fontSize: 11,
    marginBottom: 2,
  },
  snapshotStatus: {
    color: BRAND.text,
    fontSize: 13,
    fontWeight: "600",
    marginBottom: 2,
  },
  snapshotSubtext: {
    color: BRAND.sub,
    fontSize: 12,
    lineHeight: 17,
  },

  sectionBody: {
    color: BRAND.text,
    fontSize: 13.5,
    lineHeight: 19,
  },
  tradeBox: {
    borderWidth: 1,
    borderColor: BRAND.accent,
    borderRadius: 10,
    padding: 10,
    marginTop: 4,
  },
  tradeDisclaimer: {
    color: BRAND.sub,
    fontSize: 11,
    marginTop: 8,
    textAlign: "right",
  },

  subSectionLabelRisk: {
    color: BRAND.red,
    fontSize: 14,
    fontWeight: "700",
    marginTop: 8,
    marginBottom: 4,
  },
  subSectionLabelOpportunity: {
    color: BRAND.accent,
    fontSize: 14,
    fontWeight: "700",
    marginTop: 8,
    marginBottom: 4,
  },

  bulletRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 4,
  },
  bulletDot: {
    color: BRAND.accent,
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

  newsTitle: {
    color: BRAND.text,
    fontSize: 13.5,
    lineHeight: 18,
  },
  newsMeta: {
    color: BRAND.sub,
    fontSize: 11,
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
  chartButton: {
  marginTop: 10,
  paddingVertical: 10,
  borderRadius: 8,
  borderWidth: 1,
  borderColor: BRAND.border,
  alignItems: "center",
},
chartButtonText: {
  color: BRAND.accent,
  fontSize: 14,
  fontWeight: "700",
},
  // Smart Pattern Alert – Final Version
  noSignal: {
    alignItems: "center",
    paddingVertical: 32,
  },
  noSignalText: {
    color: BRAND.sub,
    fontSize: 15,
    fontWeight: "600",
    marginTop: 12,
    textAlign: "center",
  },
  noSignalSub: {
    color: "#475569",
    fontSize: 13,
    marginTop: 6,
    textAlign: "center",
  },
  alertContainer: {
    marginTop: 12,
    padding: 16,
    borderRadius: 16,
    borderWidth: 2,
  },
  alertBullish: {
    backgroundColor: "rgba(0, 227, 150, 0.12)",
    borderColor: BRAND.accent,
  },
  alertBearish: {
    backgroundColor: "rgba(239, 68, 68, 0.12)",
    borderColor: BRAND.red,
  },
  alertHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
  },
  alertTextContainer: {
    marginLeft: 14,
    flex: 1,
  },
  alertTitle: {
    color: BRAND.text,
    fontSize: 17,
    fontWeight: "800",
  },
  alertWinRate: {
    color: BRAND.sub,
    fontSize: 13,
    marginTop: 4,
  },
  bold: { fontWeight: "900", color: BRAND.text },
  alertDesc: {
    color: BRAND.text,
    fontSize: 14,
    lineHeight: 20,
    opacity: 0.95,
    marginTop: 8,
  },
  alertAction: {
    color: BRAND.accent,
    fontSize: 15,
    fontWeight: "700",
    marginTop: 12,
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

});
