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
  Image,
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

import { getStockDetail } from "../services/stockDetailService";
import { getMarketPeriod } from "../services/watchlistService";
import AstraChat from "../components/AstraChat";
import AstraAnimatedIcon from "../components/AstraAnimatedIcon";
import { BRAND } from "../constants/theme";
import { TYPO } from "../constants/typography";
import {
  displayRating,
  signalColor,
  getAuthoritativeSignal,
} from "../utils/signalUtils";

// riskLevel/riskFlags only exist on alphaWatchItem (Home's AI Opportunity
// Watch card, passed via route.params when navigating from there) — a
// lookup, not a fallback default, so a stock opened any other way never
// shows a fabricated tier it was never actually assessed for.
const RISK_LEVEL_COLOR = {
  Controlled: BRAND.accent,
  Low: BRAND.accent,
  Moderate: BRAND.amber,
  Elevated: BRAND.amber,
  High: BRAND.red,
};

// getMarketPeriod (services/watchlistService.js) returns LIVE/PRE/AH/CLOSED
// from actual America/New_York wall-clock time — replaces a hardcoded
// "Market Open" label that never reflected real market state.
const MARKET_SESSION_LABEL = {
  LIVE: "Market Open",
  PRE: "Pre-Market",
  AH: "After Hours",
  CLOSED: "Market Closed",
};

const MARKET_SESSION_COLOR = {
  LIVE: BRAND.accent,
  PRE: BRAND.amber,
  AH: BRAND.amber,
  CLOSED: BRAND.muted,
};

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

function getPatternOneLiner(pattern) {
  const name = pattern?.name || "Current Pattern";

  const bias =
    pattern?.bias === "bull"
      ? "bullish"
      : pattern?.bias === "bear"
        ? "bearish"
        : "mixed";

  const edge =
    pattern?.edgeState === "POSITIVE_EDGE"
      ? "positive historical edge"
      : pattern?.edgeState === "NEGATIVE_EDGE"
        ? "negative historical edge"
        : "mixed historical edge";

  const sample =
    pattern?.sampleState === "LOW"
      ? "but sample size is limited"
      : "based on a measurable sample";

  return `${name} shows a ${bias} setup with ${edge}, ${sample}.`;
}

function formatNewsTime(pubDate) {
  if (!pubDate) return "";
  const ts = new Date(pubDate).getTime();
  return timeAgo(ts);
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
    alphaWatchItem,
  } = route.params || {};

  const [symbol] = useState(initialSymbol);
  const [detail, setDetail] = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(true);

  const [refreshing, setRefreshing] = useState(false);
  const [astraVisible, setAstraVisible] = useState(false);

  const loadAll = useCallback(
    async (forceGrok = false) => {
      setLoadingDetail(true);
      const sd = await getStockDetail(symbol, { fromUI: source === "ui" });

      setDetail(sd);
      setLoadingDetail(false);
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
  const marketPeriod = getMarketPeriod();
  const bullbrain = detail?.bullbrain;
  const patternInsight = detail?.patternInsight || null;
  // ---- SMART PATTERN (from /stockdetail) ----
  const technical = detail?.technical;
  const tickerNews = detail?.news || [];
  const structuredGrok = detail?.grok || {};
  const risksOpportunities =
    detail?.explanations?.groups?.risks_opportunities || null;

  const hybridSignal = detail?.hybridSignal;
  const displayIntel = detail?.displayIntelligence || null;

  const authoritativeSignal = getAuthoritativeSignal(detail);
  const hybridProbUp = detail?.hybridProbUp;
  const hybridScore = detail?.hybridScore;

  const finalAISignal =
    displayIntel?.displaySignal || displayIntel?.signal || authoritativeSignal;

  const finalAIConfidence =
    typeof displayIntel?.score === "number" ? displayIntel.score : hybridScore;

  const ratingSignal = finalAISignal;
  const ratingConfidence = finalAIConfidence;

  const finalAIReason =
    displayIntel?.headline ||
    displayIntel?.summary ||
    buildHybridSignalSummary({
      hybridSignal: ratingSignal,
      hybridProbUp,
      technical,
      bullbrain,
    });

  const aiReasonChips =
    Array.isArray(displayIntel?.whyNow) && displayIntel.whyNow.length > 0
      ? displayIntel.whyNow
      : detail?.ui?.decision?.reasons || [];

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

  return (
    <View style={{ flex: 1, backgroundColor: BRAND.bg }}>
      <ScrollView
        showsVerticalScrollIndicator={false}
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
        {/* PREMIUM COMPACT HERO HEADER */}
        <ExpoLinearGradient
          colors={["#050B12", "#07111F", "#020617"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.heroCard}
        >
          {loadingDetail ? (
            <ActivityIndicator color={BRAND.accent} />
          ) : quote ? (
            <>
              <View style={styles.heroMainRow}>
                <View style={styles.logoBox}>
                  {detail?.logoUrl ? (
                    <Image
                      source={{ uri: detail.logoUrl }}
                      style={styles.tickerLogo}
                      resizeMode="contain"
                    />
                  ) : (
                    <Text style={styles.logoText}>
                      {(quote?.symbol || symbol)?.slice(0, 1)}
                    </Text>
                  )}
                </View>

                <View style={{ flex: 1 }}>
                  <Text style={styles.heroSymbol}>
                    {quote?.symbol || symbol}
                  </Text>
                  <Text style={styles.heroName} numberOfLines={1}>
                    {quote?.name || initialName || symbol}
                  </Text>

                  <View style={styles.heroMetaPills}>
                    <Text style={styles.heroMetaText}>NASDAQ</Text>
                  </View>
                </View>

                <View
                  style={[
                    styles.marketStatusPill,
                    {
                      backgroundColor: `${MARKET_SESSION_COLOR[marketPeriod]}14`,
                      borderColor: `${MARKET_SESSION_COLOR[marketPeriod]}33`,
                    },
                  ]}
                >
                  <View
                    style={[
                      styles.liveDot,
                      { backgroundColor: MARKET_SESSION_COLOR[marketPeriod] },
                    ]}
                  />
                  <Text style={styles.marketStatusText}>
                    {MARKET_SESSION_LABEL[marketPeriod]}
                  </Text>
                </View>
              </View>

              <View style={styles.heroPriceRow}>
                <View>
                  <Text style={styles.heroPrice}>
                    {quote?.current != null
                      ? `$${quote.current.toFixed(2)}`
                      : "—"}
                  </Text>

                  <View style={styles.heroChangeRow}>
                    <Text
                      style={[
                        styles.heroChange,
                        quote?.changePct >= 0
                          ? styles.positive
                          : styles.negative,
                      ]}
                    >
                      {quote?.changePct != null
                        ? `${quote.changePct >= 0 ? "▲" : "▼"} ${quote.changePct.toFixed(2)}%`
                        : "—"}
                    </Text>

                    <Text style={styles.heroToday}>Today</Text>
                  </View>
                </View>

                <View style={styles.heroSideMetrics}>
                  <Text style={styles.heroSideMetric}>
                    Open{" "}
                    <Text style={styles.heroSideValue}>
                      {quote?.open != null ? quote.open.toFixed(2) : "—"}
                    </Text>
                  </Text>
                  <Text style={styles.heroSideMetric}>
                    High{" "}
                    <Text
                      style={[styles.heroSideValue, { color: BRAND.accent }]}
                    >
                      {quote?.high != null ? quote.high.toFixed(2) : "—"}
                    </Text>
                  </Text>
                  <Text style={styles.heroSideMetric}>
                    Low{" "}
                    <Text style={[styles.heroSideValue, { color: BRAND.red }]}>
                      {quote?.low != null ? quote.low.toFixed(2) : "—"}
                    </Text>
                  </Text>
                  <Text style={styles.heroSideMetric}>
                    Prev{" "}
                    <Text style={styles.heroSideValue}>
                      {quote?.prevClose != null
                        ? quote.prevClose.toFixed(2)
                        : "—"}
                    </Text>
                  </Text>
                </View>
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
                  logoUrl: detail?.logoUrl || null,
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

        {/* PREMIUM AI RATING */}
        <View style={styles.aiRatingCard}>
          <View style={styles.aiRatingHeader}>
            <View>
              <Text style={styles.aiRatingTitle}>AI Rating</Text>
              <Text style={styles.aiRatingSub}>
                Powered by Alphaclara •{" "}
                {hybridUpdatedTs
                  ? `Updated ${timeAgo(hybridUpdatedTs)}`
                  : "Live context"}
              </Text>
            </View>
          </View>

          <View style={styles.aiMainRow}>
            {/* LEFT SCORE CIRCLE */}
            <View style={styles.aiScoreWrap}>
              <View
                style={[
                  styles.aiScoreRing,
                  {
                    borderColor: signalColor(finalAISignal),
                    shadowColor: signalColor(finalAISignal),
                  },
                ]}
              >
                <Text style={styles.aiScoreNumber}>
                  {ratingConfidence != null
                    ? Math.round(ratingConfidence)
                    : "—"}
                </Text>
                <Text style={styles.aiScoreDenom}>/100</Text>
              </View>
              <Text style={styles.aiScoreLabel}>Confidence</Text>
            </View>

            {/* RIGHT CONTENT */}
            <View style={styles.aiRatingContent}>
              <View style={styles.aiSignalRow}>
                <Text
                  style={[
                    styles.aiSignalText,
                    { color: signalColor(finalAISignal) },
                  ]}
                  numberOfLines={2}
                  adjustsFontSizeToFit
                  minimumFontScale={0.82}
                >
                  {displayRating(finalAISignal)}
                </Text>

                {!!probBias && (
                  <View
                    style={[
                      styles.aiBiasPill,
                      {
                        backgroundColor:
                          probBias === "Bearish"
                            ? "rgba(239,68,68,0.15)"
                            : probBias === "Neutral"
                              ? "rgba(250,204,21,0.15)"
                              : "rgba(0,227,150,0.15)",
                        borderColor:
                          probBias === "Bearish"
                            ? "rgba(239,68,68,0.35)"
                            : probBias === "Neutral"
                              ? "rgba(250,204,21,0.35)"
                              : "rgba(0,227,150,0.35)",
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.aiBiasText,
                        {
                          color:
                            probBias === "Bearish"
                              ? BRAND.red
                              : probBias === "Neutral"
                                ? BRAND.amber
                                : BRAND.accent,
                        },
                      ]}
                    >
                      {probBias} Bias
                    </Text>
                  </View>
                )}
              </View>

              <View style={styles.aiProbabilityTop}>
                <Text style={styles.aiProbLabel}>Upside Probability</Text>
                <Text style={styles.aiProbValue}>
                  {probUp != null ? `${Math.round(probUp * 100)}%` : "—"}
                </Text>
              </View>

              <View style={styles.aiProbTrack}>
                <View
                  style={[
                    styles.aiProbFill,
                    {
                      width: `${probUp != null ? Math.round(probUp * 100) : 0}%`,
                      backgroundColor:
                        probBias === "Bearish"
                          ? BRAND.red
                          : probBias === "Neutral"
                            ? BRAND.amber
                            : BRAND.accent,
                    },
                  ]}
                />
              </View>

              <View style={styles.aiProbabilityBottom}>
                <Text style={styles.aiDownsideText}>
                  Downside {probDown != null ? Math.round(probDown * 100) : 0}%
                </Text>
              </View>
            </View>
          </View>

          {aiReasonChips.length > 0 && (
            <View style={styles.aiReasonChips}>
              {aiReasonChips.slice(0, 3).map((reason, idx) => (
                <View key={`ai-chip-${idx}`} style={styles.aiReasonChip}>
                  <Text style={styles.aiReasonChipText}>
                    {reason.replace(/([A-Z])/g, " $1").trim()}
                  </Text>
                </View>
              ))}
            </View>
          )}

          {!!alphaWatchItem &&
            (alphaWatchItem.riskLevel ||
              alphaWatchItem.riskFlags?.length > 0) && (
              <View style={styles.alphaWatchRiskNote}>
                <View style={styles.alphaWatchRiskHeader}>
                  <Ionicons
                    name="flag-outline"
                    size={13}
                    color={BRAND.sub}
                  />
                  <Text style={styles.alphaWatchRiskLabel} numberOfLines={1}>
                    {alphaWatchItem.setupLabel || "AI Opportunity Watch"}
                  </Text>
                  {!!alphaWatchItem.riskLevel && (
                    <View style={styles.alphaWatchRiskBadge}>
                      <View
                        style={[
                          styles.alphaWatchRiskDot,
                          {
                            backgroundColor:
                              RISK_LEVEL_COLOR[alphaWatchItem.riskLevel] ||
                              BRAND.sub,
                          },
                        ]}
                      />
                      <Text
                        style={[
                          styles.alphaWatchRiskBadgeText,
                          {
                            color:
                              RISK_LEVEL_COLOR[alphaWatchItem.riskLevel] ||
                              BRAND.sub,
                          },
                        ]}
                      >
                        {alphaWatchItem.riskLevel}
                      </Text>
                    </View>
                  )}
                </View>

                {alphaWatchItem.riskFlags?.length > 0 && (
                  <Text style={styles.alphaWatchRiskFlags}>
                    {alphaWatchItem.riskFlags.join(" • ")}
                  </Text>
                )}
              </View>
            )}

          <TouchableOpacity
            style={styles.aiDetailsButton}
            activeOpacity={0.85}
            onPress={() =>
              navigation.navigate("FullDecisionDetailScreen", {
                symbol: detail.symbol,
                companyName: detail.companyName,
                logoUrl: detail?.logoUrl || null,
                quote: detail.quote,
                hybridSignal: finalAISignal,
                hybridScore: finalAIConfidence,
                displayIntelligence: displayIntel,
                bullbrain: detail.bullbrain,
                technical: detail.technical,
                pattern: detail.pattern,
                isPremium: true,
              })
            }
          >
            <Text style={styles.aiDetailsButtonText}>Why This Rating?</Text>
            <Ionicons name="chevron-forward" size={17} color={BRAND.accent} />
          </TouchableOpacity>

          <Text style={styles.aiSmallDisclaimer}>
            Informational only. Not investment advice.
          </Text>
        </View>

        {/* PREMIUM PATTERN CONTEXT */}
        {patternInsight && (
          <View style={styles.patternPremiumCard}>
            <View style={styles.patternPremiumHeader}>
              <View>
                <Text style={styles.patternPremiumTitle}>Pattern Context</Text>
                <Text style={styles.patternPremiumSub}>
                  AI-detected market setup
                </Text>
              </View>

              <View
                style={[
                  styles.patternBiasPill,
                  {
                    backgroundColor:
                      detail?.smartPattern?.bias === "bear"
                        ? "rgba(239,68,68,0.14)"
                        : "rgba(0,227,150,0.14)",
                    borderColor:
                      detail?.smartPattern?.bias === "bear"
                        ? "rgba(239,68,68,0.35)"
                        : "rgba(0,227,150,0.35)",
                  },
                ]}
              >
                <Text
                  style={[
                    styles.patternBiasText,
                    {
                      color:
                        detail?.smartPattern?.bias === "bear"
                          ? BRAND.red
                          : BRAND.accent,
                    },
                  ]}
                >
                  {detail?.smartPattern?.bias === "bear"
                    ? "Bearish"
                    : "Bullish"}
                </Text>
              </View>
            </View>

            <View style={styles.patternMainRow}>
              <View style={styles.patternScoreBox}>
                <Text style={styles.patternScoreValue}>
                  {patternInsight.confidencePct != null
                    ? `${patternInsight.confidencePct}%`
                    : "—"}
                </Text>
                <Text style={styles.patternScoreLabel}>5D Win Rate</Text>
              </View>

              <View style={{ flex: 1 }}>
                <Text style={styles.patternName} numberOfLines={2}>
                  {patternInsight.pattern}
                </Text>

                <Text style={styles.patternShortText}>
                  {getPatternOneLiner(detail?.smartPattern)}
                </Text>
              </View>
            </View>

            {detail?.patternStats && (
              <View style={styles.patternStatsRow}>
                <View style={styles.patternStatItem}>
                  <Text style={styles.patternStatLabel}>Avg 5D</Text>
                  <Text
                    style={[
                      styles.patternStatValue,
                      {
                        color:
                          detail.patternStats.avg5d >= 0
                            ? BRAND.accent
                            : BRAND.red,
                      },
                    ]}
                  >
                    {detail.patternStats.avg5d != null
                      ? `${detail.patternStats.avg5d.toFixed(2)}%`
                      : "—"}
                  </Text>
                </View>

                <View style={styles.patternStatItem}>
                  <Text style={styles.patternStatLabel}>Best</Text>
                  <Text
                    style={[styles.patternStatValue, { color: BRAND.accent }]}
                  >
                    {detail.patternStats.best5d != null
                      ? `${detail.patternStats.best5d.toFixed(2)}%`
                      : "—"}
                  </Text>
                </View>

                <View style={styles.patternStatItem}>
                  <Text style={styles.patternStatLabel}>Worst</Text>
                  <Text style={[styles.patternStatValue, { color: BRAND.red }]}>
                    {detail.patternStats.worst5d != null
                      ? `${detail.patternStats.worst5d.toFixed(2)}%`
                      : "—"}
                  </Text>
                </View>
              </View>
            )}

            <TouchableOpacity
              style={styles.patternPremiumButton}
              activeOpacity={0.85}
              onPress={() =>
                navigation.navigate("FullPatternDetailScreen", {
                  symbol: detail.symbol,
                  companyName: detail.companyName,
                  logoUrl: detail?.logoUrl || null,
                  quote: detail.quote,
                  patternInsight: detail.patternInsight,
                  smartPattern: detail.smartPattern,
                  patternStats: detail.patternStats,
                  probabilityCone: detail.probabilityCone,
                  isPremium: true,
                })
              }
            >
              <Text style={styles.patternPremiumButtonText}>
                View Pattern Details
              </Text>
              <Ionicons name="chevron-forward" size={16} color={BRAND.accent} />
            </TouchableOpacity>
          </View>
        )}

        {/* PREMIUM TECHNICAL CONTEXT */}
        {detail?.technical && (
          <View style={styles.techPremiumCard}>
            <View style={styles.techPremiumHeader}>
              <View>
                <Text style={styles.techPremiumTitle}>Technical Context</Text>
                <Text style={styles.techPremiumSub}>
                  Trend, momentum, volatility, and volume
                </Text>
              </View>

              <View style={styles.techHealthBadge}>
                <Text style={styles.techHealthText}>
                  {detail.technical.trend?.label || "Mixed"}
                </Text>
              </View>
            </View>

            {!!detail.technical.summary && (
              <Text style={styles.techSummaryText} numberOfLines={6}>
                {detail.technical.summary}
              </Text>
            )}

            <View style={styles.techPremiumGrid}>
              {[
                {
                  label: "Trend",
                  value: detail.technical.trend?.label || "—",
                  sub:
                    detail.technical.trend?.priceVsSma20Pct != null
                      ? `${detail.technical.trend.priceVsSma20Pct.toFixed(1)}% vs SMA20`
                      : "Price structure",
                  tone: detail.technical.trend?.label
                    ?.toLowerCase()
                    .includes("up")
                    ? "bullish"
                    : detail.technical.trend?.label
                          ?.toLowerCase()
                          .includes("down")
                      ? "bearish"
                      : "neutral",
                },
                {
                  label: "Momentum",
                  value: detail.technical.momentum?.rsiLabel || "—",
                  sub:
                    detail.technical.momentum?.rsi != null
                      ? `RSI ${detail.technical.momentum.rsi.toFixed(1)}`
                      : "Momentum state",
                  tone: detail.technical.momentum?.rsiLabel
                    ?.toLowerCase()
                    .includes("overbought")
                    ? "warning"
                    : detail.technical.momentum?.macdLabel
                          ?.toLowerCase()
                          .includes("bull")
                      ? "bullish"
                      : "neutral",
                },
                {
                  label: "Volatility",
                  value: detail.technical.volatility?.label || "—",
                  sub:
                    detail.technical.volatility?.atr14 != null
                      ? `ATR ${detail.technical.volatility.atr14.toFixed(2)}`
                      : "Risk range",
                  tone: detail.technical.volatility?.label
                    ?.toLowerCase()
                    .includes("high")
                    ? "warning"
                    : "neutral",
                },
                {
                  label: "Volume",
                  value: detail.technical.volume?.label || "—",
                  sub:
                    detail.technical.volume?.volumeVsMa20Pct != null
                      ? `${detail.technical.volume.volumeVsMa20Pct.toFixed(1)}% vs avg`
                      : "Participation",
                  tone: detail.technical.volume?.label
                    ?.toLowerCase()
                    .includes("high")
                    ? "bullish"
                    : "neutral",
                },
              ].map((item, idx) => {
                const toneColor =
                  item.tone === "bearish"
                    ? BRAND.red
                    : item.tone === "warning"
                      ? BRAND.amber
                      : item.tone === "bullish"
                        ? BRAND.accent
                        : BRAND.sub;

                return (
                  <View key={`tech-${idx}`} style={styles.techMetricCard}>
                    <View style={styles.techMetricTop}>
                      <Text style={styles.techMetricLabel}>{item.label}</Text>
                      <View
                        style={[
                          styles.techMetricDot,
                          { backgroundColor: toneColor },
                        ]}
                      />
                    </View>

                    <Text
                      style={[styles.techMetricValue, { color: toneColor }]}
                    >
                      {item.value}
                    </Text>

                    <Text style={styles.techMetricSub} numberOfLines={1}>
                      {item.sub}
                    </Text>
                  </View>
                );
              })}
            </View>

            <TouchableOpacity
              style={styles.techPremiumButton}
              activeOpacity={0.85}
              onPress={() =>
                navigation.navigate("FullTechnicalDetailScreen", {
                  symbol: detail.symbol,
                  companyName: detail.companyName,
                  logoUrl: detail?.logoUrl || null,
                  quote: detail.quote,
                  technical: detail.technical,
                  featuresMeta: detail.featuresMeta,
                })
              }
            >
              <Text style={styles.techPremiumButtonText}>
                View Technical Details
              </Text>
              <Ionicons name="chevron-forward" size={16} color={BRAND.accent} />
            </TouchableOpacity>
          </View>
        )}
        {/* PREMIUM COMPACT MARKET OUTLOOK */}
        {detail?.outlook && (
          <View style={styles.outlookCompactCard}>
            <View style={styles.outlookCompactHeader}>
              <View>
                <Text style={styles.outlookTitle}>Market Outlook</Text>
                <Text style={styles.outlookSub}>AI directional assessment</Text>
              </View>

              <View style={styles.outlookBadge}>
                <Text style={styles.outlookBadgeText}>
                  {detail?.probability?.bias || probBias || "Neutral"}
                </Text>
              </View>
            </View>

            <View style={styles.outlookTimeline}>
              {[
                {
                  label: "Short",
                  text: detail.outlook.shortTerm?.summary,
                },
                {
                  label: "Medium",
                  text: detail.outlook.mediumTerm?.summary,
                },
                {
                  label: "Long",
                  text: detail.outlook.longTerm?.summary,
                },
              ].map((item, idx) => {
                const bias =
                  detail?.probability?.bias ||
                  probBias ||
                  "Neutral";

                const tone = bias?.toLowerCase().includes("bear")
                  ? "bearish"
                  : bias?.toLowerCase().includes("neutral") ||
                      bias?.toLowerCase().includes("hold")
                    ? "neutral"
                    : "bullish";

                const toneColor =
                  tone === "bearish"
                    ? BRAND.red
                    : tone === "neutral"
                      ? BRAND.amber
                      : BRAND.accent;

                return (
                  <View
                    key={`outlook-${idx}`}
                    style={styles.outlookTimelineRow}
                  >
                    <View style={styles.outlookLeftRail}>
                      <View
                        style={[
                          styles.outlookDot,
                          { backgroundColor: toneColor },
                        ]}
                      />
                      {idx !== 2 && <View style={styles.outlookLine} />}
                    </View>

                    <View style={styles.outlookTimelineContent}>
                      <View style={styles.outlookRowTop}>
                        <Text style={styles.outlookTimeLabel}>
                          {item.label}
                        </Text>
                        <Text
                          style={[
                            styles.outlookMiniSignal,
                            { color: toneColor },
                          ]}
                        >
                          {bias}
                        </Text>
                      </View>

                      <Text style={styles.outlookCompactText} numberOfLines={2}>
                        {item.text || "Outlook is still developing."}
                      </Text>
                    </View>
                  </View>
                );
              })}
            </View>
          </View>
        )}

        {/* PREMIUM MARKET NEWS */}
        {tickerNews.length > 0 && (
          <View style={styles.newsPremiumCard}>
            <View style={styles.newsPremiumHeader}>
              <View>
                <Text style={styles.newsPremiumTitle}>Market News</Text>
                <Text style={styles.newsPremiumSub}>
                  Latest headlines related to {detail?.symbol || symbol}
                </Text>
              </View>

              <View style={styles.newsCountPill}>
                <Text style={styles.newsCountText}>{tickerNews.length}</Text>
              </View>
            </View>

            {tickerNews.map((n, idx) => (
              <View
                key={`news-${idx}`}
                style={[
                  styles.newsPremiumItem,
                  idx === tickerNews.length - 1 && styles.newsPremiumItemLast,
                ]}
              >
                <View style={styles.newsSourceRow}>
                  <Text style={styles.newsSource}>
                    {n.source || "Market News"}
                  </Text>

                  {!!(n.pubDate || n.datetime) && (
                    <>
                      <View style={styles.newsDot} />
                      <Text style={styles.newsTime}>
                        {formatNewsTime(n.pubDate || n.datetime * 1000)}
                      </Text>
                    </>
                  )}
                </View>

                <Text style={styles.newsPremiumHeadline}>
                  {n.title || n.headline}
                </Text>

                {!!(n.summary || n.description) && (
                  <Text style={styles.newsPremiumSummary}>
                    {n.summary || n.description}
                  </Text>
                )}
              </View>
            ))}
          </View>
        )}
        {/* PREMIUM RISKS & OPPORTUNITIES */}
        {risksOpportunities && (
          <View style={styles.riskOppCard}>
            <View style={styles.riskOppHeader}>
              <View>
                <Text style={styles.riskOppTitle}>Risks & Opportunities</Text>
                <Text style={styles.riskOppSub}>
                  Key factors shaping this setup
                </Text>
              </View>
            </View>

            <View style={styles.riskOppGrid}>
              <View style={styles.riskPanel}>
                <View style={styles.riskOppPanelHeader}>
                  <Ionicons
                    name="warning-outline"
                    size={15}
                    color={BRAND.red}
                  />
                  <Text
                    style={[styles.riskOppPanelTitle, { color: BRAND.red }]}
                  >
                    Risks
                  </Text>
                </View>

                {(risksOpportunities.risks || [])
                  .slice(0, 3)
                  .map((item, idx) => (
                    <Text key={`risk-${idx}`} style={styles.riskOppText}>
                      • {item}
                    </Text>
                  ))}
              </View>

              <View style={styles.oppPanel}>
                <View style={styles.riskOppPanelHeader}>
                  <Ionicons
                    name="trending-up-outline"
                    size={15}
                    color={BRAND.accent}
                  />
                  <Text
                    style={[styles.riskOppPanelTitle, { color: BRAND.accent }]}
                  >
                    Opportunities
                  </Text>
                </View>

                {(risksOpportunities.opportunities || [])
                  .slice(0, 3)
                  .map((item, idx) => (
                    <Text key={`opp-${idx}`} style={styles.riskOppText}>
                      • {item}
                    </Text>
                  ))}
              </View>
            </View>
          </View>
        )}

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
const styles = StyleSheet.create({
  /* =========================
     BASE
  ========================= */
  container: {
    flex: 1,
    backgroundColor: BRAND.bg,
    paddingHorizontal: 16,
    paddingTop: 5,
  },

  positive: { color: BRAND.accent },
  negative: { color: BRAND.red },

  /* =========================
     COMPACT HERO QUOTE CARD
  ========================= */
  heroCard: {
    borderRadius: 20,
    borderWidth: 1.2,
    borderColor: "rgba(0,227,150,0.22)",
    paddingHorizontal: 12,
    paddingTop: 9,
    paddingBottom: 9,
    marginBottom: 1,

    shadowColor: BRAND.accent,
    shadowOpacity: 0.09,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },

  heroMainRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },

  logoBox: {
    width: 40,
    height: 40,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 9,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
  },

  tickerLogo: {
    width: 29,
    height: 29,
    borderRadius: 14.5,
  },

  logoText: {
    color: BRAND.text,
    fontSize: 19,
    fontFamily: TYPO.fontFamily.extrabold,
  },

  heroSymbol: {
    color: BRAND.text,
    fontSize: 20.5,
    fontFamily: TYPO.fontFamily.extrabold,
    letterSpacing: -0.35,
  },

  heroName: {
    color: BRAND.sub,
    fontSize: 11.5,
    fontFamily: TYPO.fontFamily.bold,
    marginTop: 0,
  },

  heroMetaPills: {
    display: "none",
  },

  heroMetaText: {
    color: BRAND.muted,
    fontSize: 10.5,
    fontFamily: TYPO.fontFamily.bold,
  },

  marketStatusPill: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: "rgba(0,227,150,0.08)",
    borderWidth: 1,
    borderColor: "rgba(0,227,150,0.20)",
  },

  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: BRAND.accent,
    marginRight: 6,
  },

  marketStatusText: {
    color: BRAND.text,
    fontSize: 10.2,
    fontFamily: TYPO.fontFamily.bold,
  },

  heroPriceRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
  },

  heroPrice: {
    color: BRAND.text,
    fontSize: 30,
    fontFamily: TYPO.fontFamily.extrabold,
    letterSpacing: -1,
  },

  heroChangeRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 0,
  },

  heroChange: {
    fontSize: 13.5,
    fontFamily: TYPO.fontFamily.extrabold,
    marginRight: 6,
  },

  heroToday: {
    color: BRAND.sub,
    fontSize: 11.2,
    fontFamily: TYPO.fontFamily.bold,
  },

  heroSideMetrics: {
    minWidth: 84,
    paddingLeft: 8,
    borderLeftWidth: 1,
    borderLeftColor: "rgba(255,255,255,0.07)",
    marginTop: 0,
  },

  heroSideMetric: {
    color: BRAND.muted,
    fontSize: 9.8,
    fontFamily: TYPO.fontFamily.bold,
    marginBottom: 2,
  },

  heroSideValue: {
    color: BRAND.text,
    fontFamily: TYPO.fontFamily.extrabold,
  },

  /* =========================
     PRICE SNAPSHOT CARD
  ========================= */
  card: {
    backgroundColor: "#070D15",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(59,130,246,0.18)",
    paddingHorizontal: 11,
    paddingVertical: 8,
    marginTop: 7,
  },

  sectionHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 2,
  },

  sectionAccent: {
    width: 3,
    height: 15,
    borderRadius: 999,
    backgroundColor: "rgba(59,130,246,0.75)",
    marginRight: 8,
  },

  sectionTitle: {
    color: BRAND.text,
    fontSize: 14.5,
    fontFamily: TYPO.fontFamily.extrabold,
    letterSpacing: -0.15,
  },

  cardSubText: {
    color: BRAND.muted,
    fontSize: 10.8,
    marginTop: 1,
    fontFamily: TYPO.fontFamily.medium,
  },

  chartMiniButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "rgba(0,227,150,0.10)",
    borderWidth: 1,
    borderColor: "rgba(0,227,150,0.24)",
  },

  chartMiniButtonText: {
    color: BRAND.text,
    fontSize: 11.2,
    fontFamily: TYPO.fontFamily.bold,
    marginRight: 2,
  },

  sparklineWrap: {
    marginTop: 5,
    paddingHorizontal: 2,
    alignItems: "center",
  },

  sparklineMeta: {
    marginTop: 3,
    width: "100%",
    flexDirection: "row",
    justifyContent: "space-between",
  },

  sparklineMetaText: {
    color: BRAND.sub,
    fontSize: 10,
    opacity: 0.85,
  },

  sparklineSourceText: {
    color: BRAND.muted,
    fontSize: 9.5,
    fontWeight: "700",
    marginTop: 3,
    textAlign: "center",
  },

  sparklineEmpty: {
    paddingVertical: 14,
    alignItems: "center",
  },

  sparklineEmptyText: {
    color: BRAND.muted,
    fontSize: 11.5,
    fontWeight: "700",
  },

  /* =========================
     AI RATING CARD
  ========================= */
  aiRatingCard: {
    marginTop: 8,
    borderRadius: 22,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: "#061018",
    borderWidth: 1,
    borderColor: "rgba(0,227,150,0.20)",
    shadowColor: BRAND.accent,
    shadowOpacity: 0.12,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },

  aiRatingHeader: {
    marginBottom: 8,
  },

  aiRatingTitle: {
    color: BRAND.text,
    fontSize: 16.5,
    fontFamily: TYPO.fontFamily.extrabold,
    letterSpacing: -0.25,
  },

  aiRatingSub: {
    color: BRAND.sub,
    fontSize: 11,
    fontFamily: TYPO.fontFamily.medium,
    marginTop: 2,
  },

  aiRefreshBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
  },

  aiMainRow: {
    flexDirection: "row",
    alignItems: "center",
  },

  aiScoreWrap: {
    width: 100,
    alignItems: "center",
    justifyContent: "center",
    paddingRight: 10,
    marginRight: 12,
    borderRightWidth: 1,
    borderRightColor: "rgba(255,255,255,0.08)",
  },

  aiScoreRing: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 6,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.035)",
    shadowOpacity: 0.28,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 0 },
  },

  aiScoreNumber: {
    color: BRAND.text,
    fontSize: 20,
    fontFamily: TYPO.fontFamily.extrabold,
    letterSpacing: -0.6,
  },

  aiScoreDenom: {
    color: BRAND.sub,
    fontSize: 10,
    fontFamily: TYPO.fontFamily.bold,
    marginTop: -3,
  },

  aiScoreLabel: {
    color: BRAND.sub,
    fontSize: 11,
    fontFamily: TYPO.fontFamily.bold,
    marginTop: 7,
  },

  aiRatingContent: {
    flex: 1,
  },

  aiSignalRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    flexWrap: "wrap",
    gap: 7,
    marginBottom: 10,
  },

  aiSignalText: {
    fontSize: 15.5,
    lineHeight: 20,
    fontFamily: TYPO.fontFamily.extrabold,
    letterSpacing: -0.35,
    textTransform: "uppercase",
    flexShrink: 1,
    maxWidth: "100%",
  },

  aiBiasPill: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
  },

  aiBiasText: {
    fontSize: 10,
    fontFamily: TYPO.fontFamily.extrabold,
  },

  aiProbabilityTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 6,
  },

  aiProbLabel: {
    color: BRAND.sub,
    fontSize: 11.5,
    fontFamily: TYPO.fontFamily.bold,
  },

  aiProbValue: {
    color: BRAND.accent,
    fontSize: 13.5,
    fontFamily: TYPO.fontFamily.extrabold,
  },

  aiProbTrack: {
    height: 7,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.09)",
    overflow: "hidden",
  },

  aiProbFill: {
    height: "100%",
    borderRadius: 999,
  },

  aiProbabilityBottom: {
    alignItems: "flex-end",
    marginTop: 5,
  },

  aiDownsideText: {
    color: BRAND.red,
    fontSize: 11,
    fontFamily: TYPO.fontFamily.bold,
  },

  aiReasonText: {
    color: BRAND.sub,
    fontSize: 12.5,
    lineHeight: 18,
    fontFamily: TYPO.fontFamily.medium,
    marginTop: 12,
  },

  aiReasonChips: {
    marginTop: 10,
    gap: 7,
  },

  aiReasonChip: {
    width: "100%",
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 13,
    backgroundColor: "rgba(255,255,255,0.055)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.09)",
  },

  aiReasonChipText: {
    color: BRAND.text,
    fontSize: 11.5,
    lineHeight: 17,
    fontFamily: TYPO.fontFamily.medium,
  },

  aiDetailsButton: {
    marginTop: 13,
    minHeight: 44,
    borderRadius: 15,
    paddingHorizontal: 14,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "rgba(0,227,150,0.10)",
    borderWidth: 1,
    borderColor: "rgba(0,227,150,0.30)",
  },

  aiDetailsButtonText: {
    color: BRAND.text,
    fontSize: 13,
    fontFamily: TYPO.fontFamily.extrabold,
  },

  aiSmallDisclaimer: {
    color: BRAND.muted,
    fontSize: 10,
    fontFamily: TYPO.fontFamily.bold,
    marginTop: 8,
    textAlign: "center",
  },

  alphaWatchRiskNote: {
    marginTop: 10,
    borderRadius: 13,
    paddingHorizontal: 12,
    paddingVertical: 9,
    backgroundColor: "rgba(255,255,255,0.055)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.09)",
  },

  alphaWatchRiskHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },

  alphaWatchRiskLabel: {
    flex: 1,
    color: BRAND.sub,
    fontSize: 11,
    fontFamily: TYPO.fontFamily.bold,
  },

  alphaWatchRiskBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },

  alphaWatchRiskDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },

  alphaWatchRiskBadgeText: {
    fontSize: 11.5,
    fontFamily: TYPO.fontFamily.extrabold,
  },

  alphaWatchRiskFlags: {
    color: BRAND.text,
    fontSize: 11,
    lineHeight: 15,
    fontFamily: TYPO.fontFamily.medium,
    marginTop: 6,
  },

  /* =========================
     PATTERN CARD
  ========================= */
  patternPremiumCard: {
    marginTop: 8,
    borderRadius: 22,
    padding: 13,
    backgroundColor: "#080D14",
    borderWidth: 1,
    borderColor: "rgba(99,102,241,0.25)",
    shadowColor: "#6366F1",
    shadowOpacity: 0.1,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 7 },
    elevation: 4,
  },

  patternPremiumHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 11,
  },

  patternPremiumTitle: {
    color: BRAND.text,
    fontSize: 16.5,
    fontFamily: TYPO.fontFamily.extrabold,
    letterSpacing: -0.2,
  },

  patternPremiumSub: {
    color: BRAND.sub,
    fontSize: 11,
    fontFamily: TYPO.fontFamily.medium,
    marginTop: 2,
  },

  patternBiasPill: {
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
  },

  patternBiasText: {
    fontSize: 10.5,
    fontFamily: TYPO.fontFamily.extrabold,
  },

  patternMainRow: {
    flexDirection: "row",
    alignItems: "center",
  },

  patternScoreBox: {
    width: 74,
    height: 74,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
    backgroundColor: "rgba(255,255,255,0.045)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
  },

  patternScoreValue: {
    color: BRAND.text,
    fontSize: 21,
    fontFamily: TYPO.fontFamily.extrabold,
    letterSpacing: -0.5,
  },

  patternScoreLabel: {
    color: BRAND.muted,
    fontSize: 9.5,
    fontFamily: TYPO.fontFamily.bold,
    marginTop: 3,
  },

  patternName: {
    color: BRAND.text,
    fontSize: 15.5,
    fontFamily: TYPO.fontFamily.extrabold,
    marginBottom: 4,
  },

  patternShortText: {
    color: BRAND.sub,
    fontSize: 12.4,
    lineHeight: 17,
    fontFamily: TYPO.fontFamily.medium,
    marginTop: 1,
  },

  patternStatsRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 12,
  },

  patternStatItem: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 13,
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },

  patternStatLabel: {
    color: BRAND.muted,
    fontSize: 10,
    fontFamily: TYPO.fontFamily.bold,
    marginBottom: 3,
  },

  patternStatValue: {
    color: BRAND.text,
    fontSize: 12.5,
    fontFamily: TYPO.fontFamily.extrabold,
  },

  patternPremiumButton: {
    marginTop: 12,
    minHeight: 44,
    borderRadius: 15,
    paddingHorizontal: 14,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "rgba(0,227,150,0.10)",
    borderWidth: 1,
    borderColor: "rgba(0,227,150,0.30)",
  },

  patternPremiumButtonText: {
    color: BRAND.text,
    fontSize: 13,
    fontFamily: TYPO.fontFamily.extrabold,
  },

  /* =========================
     TECH CARD
  ========================= */
  techPremiumCard: {
    marginTop: 8,
    borderRadius: 22,
    padding: 13,
    backgroundColor: "#070D15",
    borderWidth: 1,
    borderColor: "rgba(59,130,246,0.22)",
    shadowColor: "#3B82F6",
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },

  techPremiumHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 9,
  },

  techPremiumTitle: {
    color: BRAND.text,
    fontSize: 16.5,
    fontFamily: TYPO.fontFamily.extrabold,
    letterSpacing: -0.2,
  },

  techPremiumSub: {
    color: BRAND.sub,
    fontSize: 11,
    fontFamily: TYPO.fontFamily.medium,
    marginTop: 2,
  },

  techHealthBadge: {
    maxWidth: 130,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
  },

  techHealthText: {
    color: BRAND.text,
    fontSize: 10.5,
    fontFamily: TYPO.fontFamily.extrabold,
  },

  techSummaryText: {
    color: BRAND.sub,
    fontSize: 12.2,
    lineHeight: 16.5,
    fontFamily: TYPO.fontFamily.medium,
    marginBottom: 10,
  },

  techPremiumGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },

  techMetricCard: {
    width: "48%",
    borderRadius: 15,
    padding: 9,
    backgroundColor: "rgba(255,255,255,0.045)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },

  techMetricTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 6,
  },

  techMetricLabel: {
    color: BRAND.muted,
    fontSize: 10,
    fontFamily: TYPO.fontFamily.extrabold,
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },

  techMetricDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },

  techMetricValue: {
    fontSize: 14,
    fontFamily: TYPO.fontFamily.extrabold,
    marginBottom: 3,
  },

  techMetricSub: {
    color: BRAND.sub,
    fontSize: 10.7,
    fontFamily: TYPO.fontFamily.bold,
  },

  techPremiumButton: {
    marginTop: 12,
    minHeight: 44,
    borderRadius: 15,
    paddingHorizontal: 14,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "rgba(0,227,150,0.10)",
    borderWidth: 1,
    borderColor: "rgba(0,227,150,0.30)",
  },

  techPremiumButtonText: {
    color: BRAND.text,
    fontSize: 13,
    fontFamily: TYPO.fontFamily.extrabold,
  },

  /* =========================
     OUTLOOK CARD
  ========================= */
  outlookCompactCard: {
    marginTop: 8,
    borderRadius: 22,
    padding: 13,
    backgroundColor: "#070D15",
    borderWidth: 1,
    borderColor: "rgba(245,158,11,0.22)",
    shadowColor: "#F59E0B",
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },

  outlookCompactHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },

  outlookTitle: {
    color: BRAND.text,
    fontSize: 16.5,
    fontFamily: TYPO.fontFamily.extrabold,
    letterSpacing: -0.2,
  },

  outlookSub: {
    color: BRAND.sub,
    fontSize: 11,
    fontFamily: TYPO.fontFamily.medium,
    marginTop: 2,
  },

  outlookBadge: {
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
  },

  outlookBadgeText: {
    color: BRAND.text,
    fontSize: 10.5,
    fontFamily: TYPO.fontFamily.extrabold,
  },

  outlookTimelineRow: {
    flexDirection: "row",
    minHeight: 48,
  },

  outlookLeftRail: {
    width: 18,
    alignItems: "center",
  },

  outlookDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginTop: 5,
  },

  outlookLine: {
    width: 1,
    flex: 1,
    backgroundColor: "rgba(255,255,255,0.10)",
    marginTop: 4,
  },

  outlookTimelineContent: {
    flex: 1,
    paddingBottom: 10,
  },

  outlookRowTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 2,
  },

  outlookTimeLabel: {
    color: BRAND.text,
    fontSize: 12.7,
    fontFamily: TYPO.fontFamily.extrabold,
  },

  outlookMiniSignal: {
    fontSize: 10.7,
    fontFamily: TYPO.fontFamily.extrabold,
  },

  outlookCompactText: {
    color: BRAND.sub,
    fontSize: 12,
    lineHeight: 16.5,
    fontFamily: TYPO.fontFamily.medium,
  },

  /* =========================
     NEWS CARD
  ========================= */
  newsPremiumCard: {
    marginTop: 8,
    borderRadius: 22,
    padding: 13,
    backgroundColor: "#070D15",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.09)",
  },

  newsPremiumHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 9,
  },

  newsPremiumTitle: {
    color: BRAND.text,
    fontSize: 16.5,
    fontFamily: TYPO.fontFamily.extrabold,
    letterSpacing: -0.2,
  },

  newsPremiumSub: {
    color: BRAND.sub,
    fontSize: 11,
    fontFamily: TYPO.fontFamily.medium,
    marginTop: 2,
  },

  newsCountPill: {
    minWidth: 27,
    height: 27,
    paddingHorizontal: 8,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
  },

  newsCountText: {
    color: BRAND.text,
    fontSize: 11.5,
    fontFamily: TYPO.fontFamily.extrabold,
  },

  newsPremiumItem: {
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.08)",
  },

  newsPremiumItemLast: {
    borderBottomWidth: 0,
    paddingBottom: 0,
  },

  newsSourceRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
  },

  newsSource: {
    color: BRAND.accent,
    fontSize: 10.5,
    fontFamily: TYPO.fontFamily.extrabold,
    textTransform: "uppercase",
    letterSpacing: 0.35,
  },

  newsDot: {
    width: 3,
    height: 3,
    borderRadius: 2,
    backgroundColor: BRAND.muted,
    marginHorizontal: 7,
  },

  newsTime: {
    color: BRAND.muted,
    fontSize: 10.5,
    fontFamily: TYPO.fontFamily.bold,
  },

  newsPremiumHeadline: {
    color: BRAND.text,
    fontSize: 13.2,
    lineHeight: 17,
    fontFamily: TYPO.fontFamily.extrabold,
  },

  newsPremiumSummary: {
    color: BRAND.sub,
    fontSize: 12,
    lineHeight: 16.5,
    fontFamily: TYPO.fontFamily.medium,
    marginTop: 4,
  },

  /* =========================
     RISKS & OPPORTUNITIES
  ========================= */
  riskOppCard: {
    marginTop: 8,
    borderRadius: 22,
    padding: 13,
    backgroundColor: "#070D15",
    borderWidth: 1,
    borderColor: "rgba(0,227,150,0.18)",
    shadowColor: BRAND.accent,
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },

  riskOppHeader: {
    marginBottom: 10,
  },

  riskOppTitle: {
    color: BRAND.text,
    fontSize: 16.5,
    fontFamily: TYPO.fontFamily.extrabold,
    letterSpacing: -0.2,
  },

  riskOppSub: {
    color: BRAND.sub,
    fontSize: 11,
    fontFamily: TYPO.fontFamily.medium,
    marginTop: 2,
  },

  riskOppGrid: {
    flexDirection: "row",
    gap: 8,
  },

  riskPanel: {
    flex: 1,
    borderRadius: 15,
    padding: 9,
    backgroundColor: "rgba(239,68,68,0.07)",
    borderWidth: 1,
    borderColor: "rgba(239,68,68,0.20)",
  },

  oppPanel: {
    flex: 1,
    borderRadius: 15,
    padding: 9,
    backgroundColor: "rgba(0,227,150,0.07)",
    borderWidth: 1,
    borderColor: "rgba(0,227,150,0.20)",
  },

  riskOppPanelHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 7,
  },

  riskOppPanelTitle: {
    fontSize: 12,
    fontFamily: TYPO.fontFamily.extrabold,
    marginLeft: 6,
  },

  riskOppText: {
    color: BRAND.text,
    fontSize: 11.7,
    lineHeight: 16.5,
    fontFamily: TYPO.fontFamily.medium,
    marginBottom: 5,
  },

  /* =========================
     FOOTER / FAB
  ========================= */
  footerWrap: {
    alignItems: "center",
    marginTop: 16,
    paddingHorizontal: 12,
  },

  powered: {
    color: BRAND.sub,
    fontSize: 12,
    marginBottom: 7,
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
});
