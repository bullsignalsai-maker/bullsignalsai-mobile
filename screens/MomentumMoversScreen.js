// screens/MomentumMoversScreen.js
import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useRef,
} from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  ActivityIndicator,
  RefreshControl,
  Image,
  Animated,
  Modal,
} from "react-native";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import AstraChat from "../components/AstraChat";
import AstraAnimatedIcon from "../components/AstraAnimatedIcon";

import Svg, {
  Circle,
  Path,
  Text as SvgText,
  Defs,
  LinearGradient as SvgLG,
  Stop,
} from "react-native-svg";

import {
  getMarketMomentum,
  refreshMarketMomentum,
} from "../services/MomentumService";
import { BRAND } from "../constants/theme";
import { TYPO } from "../constants/typography";
import { useResetScrollOnTabPress } from "../hooks/useResetScrollOnTabPress";

const AMBER_TAGS = new Set(["AI Conviction", "Sector Strength"]);

// riskLevel only exists on aiSetups/topAISetup items (backend-computed from
// riskFlags). confirmedMomentum/continuousMovers items never carry it — so
// this is intentionally a lookup, not a fallback default, to avoid showing
// a fabricated tier for a stock the backend never actually risk-assessed.
const RISK_LEVEL_COLOR = {
  Controlled: BRAND.green,
  Low: BRAND.green,
  Moderate: BRAND.amber,
  Elevated: BRAND.amber,
  High: BRAND.red,
};

const MOMENTUM_SCORE_INFO = {
  MARKET: {
    title: "Market Momentum",
    text: "This gauge reflects the breadth of momentum across the whole market right now — how many stocks are showing sustained continuation, how many are pulling back, and how strong the average move is. It's not any single stock's score, and it's scaled to top out around 95 rather than a clean 100.",
  },
  STOCK: {
    title: "Momentum Score",
    text: "An AI-generated 0–100 score for this stock, built from recent price action, trend persistence, and volume behavior. The exact mix is tailored to the list it appears in (Movers, AI Setups, Confirmed Momentum), so scores aren't directly comparable across sections — read it as how strong and sustained this stock's move looks, not an absolute ranking.",
  },
  TIER: {
    title: "Momentum Score & Tiers",
    text: "An AI-generated 0–100 score built from recent price action, trend persistence, and volume behavior. ELITE, STRONG, and EMERGING are display tiers on top of that score — ELITE is 85+, STRONG is 70–84, EMERGING is below 70 — meant for a quick scan, not a separately verified rating.",
  },
};

/* ---------------- Mini sparkline ---------------- */
function MiniSparkline({
  color = BRAND.green,
  bearish = false,
  values = [],
  w = 100,
  h = 32,
}) {
  const nums = Array.isArray(values)
    ? values.map(Number).filter(Number.isFinite)
    : [];

  let path = bearish
    ? "M2 10 C12 14, 22 12, 32 18 S52 22, 62 20 S82 26, 96 28"
    : "M2 24 C12 18, 20 22, 30 15 S48 20, 58 12 S76 15, 96 5";

  if (nums.length >= 2) {
    const min = Math.min(...nums);
    const max = Math.max(...nums);
    const range = max - min || 1;
    path = nums
      .map((v, i) => {
        const x = 2 + (i * (w - 4)) / (nums.length - 1);
        const y = h - 4 - ((v - min) / range) * (h - 8);
        return `${i === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`;
      })
      .join(" ");
  }

  return (
    <Svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
      <Path
        d={path}
        stroke={color}
        strokeWidth={2}
        fill="none"
        strokeLinecap="round"
      />
    </Svg>
  );
}

function estimateDollarMove(price, netMovePct) {
  const p = Number(price);
  const pct = Number(netMovePct);

  if (!Number.isFinite(p) || !Number.isFinite(pct) || pct === -100) {
    return null;
  }

  const startPrice = p / (1 + pct / 100);
  return p - startPrice;
}

/* ---------------- Market momentum ring ---------------- */
function MomentumRing({ score = 0 }) {
  const radius = 48;
  const C = 2 * Math.PI * radius;
  const progress = Math.min(1, Math.max(0, score / 100));
  const dash = C * progress;

  return (
    <View style={styles.ringWrap}>
      <Svg width={100} height={100} viewBox="0 0 136 136">
        <Circle
          cx="68"
          cy="68"
          r={radius}
          stroke="rgba(0,227,150,0.14)"
          strokeWidth="11"
          fill="transparent"
        />
        <Circle
          cx="68"
          cy="68"
          r={radius}
          stroke={BRAND.green}
          strokeWidth="11"
          fill="transparent"
          strokeDasharray={`${dash} ${C - dash}`}
          strokeLinecap="round"
          rotation="-90"
          origin="68,68"
        />
      </Svg>
      <View style={styles.ringText}>
        <Text style={styles.ringLabel}>MARKET</Text>
        <Text style={styles.ringLabel}>MOMENTUM</Text>
        <Text style={styles.ringValue}>{Math.round(score)}</Text>
        <Text style={styles.ringTotal}>/100</Text>
      </View>
    </View>
  );
}

const normalizeMoverForClara = (raw) => {
  const item = raw || {};
  const catalysts = Array.isArray(item.primaryCatalysts)
    ? item.primaryCatalysts
    : item.primaryCatalysts
      ? [item.primaryCatalysts]
      : item.primary_catalysts
        ? [item.primary_catalysts]
        : [];

  const reason =
    item.reason ||
    item.summary ||
    item.oneLiner ||
    item.executiveSummaryShort ||
    item.primaryCatalyst ||
    item.primary_catalyst ||
    catalysts[0] ||
    item.momentumLabel ||
    item.moverQuality ||
    item.riskLevel ||
    "Momentum detected across recent snapshots";

  return {
    ...item,
    symbol: item.symbol,
    companyName: item.companyName || item.company || item.name || item.symbol,
    reason,
    primaryCatalysts: catalysts,
    momentumScore:
      item.momentumScore ??
      item.avgAlphaScore ??
      item.opportunityScore ??
      item.alphaScore ??
      0,
    appearances:
      item.appearances ??
      item.dailyMoverAppearances ??
      item.sessions ??
      item.sessionCount ??
      0,
    lookbackSnapshots: item.lookbackSnapshots,
    netMovePct: item.netMovePct ?? item.changePct ?? item.avgMovePct ?? null,
    changePct: item.changePct ?? item.netMovePct ?? null,
    riskLevel:
      item.riskLevel || item.risk_level || item.momentumLabel || "Momentum",
  };
};
/* ============================================================ */
export default function MomentumMoversScreen({ navigation }) {
  const [selected, setSelected] = useState("All");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [astraVisible, setAstraVisible] = useState(false);
  const [selectedMover, setSelectedMover] = useState(null);
  const [infoModal, setInfoModal] = useState(null);
  const priceFlash = useRef({}).current;
  const lastPrices = useRef({}).current;
  const pageScrollRef = useRef(null);

  useResetScrollOnTabPress(navigation, () =>
    pageScrollRef.current?.scrollTo({ y: 0, animated: true }),
  );
  const flashPricesForItems = (items = []) => {
    items.forEach((it) => {
      const symbol = String(it?.symbol || "").toUpperCase();
      const price = Number(it?.price);

      if (!symbol || !Number.isFinite(price)) return;

      const previousPrice = lastPrices[symbol];

      lastPrices[symbol] = price;

      if (
        previousPrice === undefined ||
        !Number.isFinite(previousPrice) ||
        Math.abs(price - previousPrice) < 0.005
      ) {
        return;
      }

      if (!priceFlash[symbol]) {
        priceFlash[symbol] = new Animated.Value(0);
      }

      priceFlash[symbol].setValue(1);

      Animated.timing(priceFlash[symbol], {
        toValue: 0,
        duration: 900,
        useNativeDriver: false,
      }).start();
    });
  };
  const getPriceFlashBg = (symbol, changePct = 0) => {
    const key = String(symbol || "").toUpperCase();

    if (!priceFlash[key]) {
      priceFlash[key] = new Animated.Value(0);
    }

    return priceFlash[key].interpolate({
      inputRange: [0, 1],
      outputRange: [
        "transparent",
        Number(changePct || 0) >= 0
          ? "rgba(0,227,150,0.30)"
          : "rgba(255,69,96,0.30)",
      ],
    });
  };
  const loadMomentum = useCallback(async () => {
    const result = await getMarketMomentum();

    if (result) {
      flashPricesForItems([
        ...(result.aiSetups || []),
        ...(result.continuousMovers || []),
        ...(result.pullbackWatch || []),
        ...(result.confirmedMomentum || []),
        ...(result.topAISetup ? [result.topAISetup] : []),
      ]);
    }

    setData(result);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadMomentum();
  }, [loadMomentum]);
  useEffect(() => {
    const timer = setInterval(() => {
      loadMomentum();
    }, 30000);

    return () => clearInterval(timer);
  }, [loadMomentum]);
  const onRefresh = useCallback(async () => {
    setRefreshing(true);

    try {
      const result = await refreshMarketMomentum();

      flashPricesForItems([
        ...(result.aiSetups || []),
        ...(result.continuousMovers || []),
        ...(result.pullbackWatch || []),
        ...(result.confirmedMomentum || []),
        ...(result.topAISetup ? [result.topAISetup] : []),
      ]);

      setData(result);
    } catch (e) {
      console.warn("[Momentum] Pull refresh failed:", e?.message);
    } finally {
      setRefreshing(false);
    }
  }, []);

  const pulse = data?.pulse || {};
  const topAISetup = data?.topAISetup;
  const confirmed = data?.confirmedMomentum || [];
  const movers = data?.continuousMovers || [];
  const aiSetups = data?.aiSetups || [];
  const pullbacks = data?.pullbackWatch || [];
  const [showAllMovers, setShowAllMovers] = useState(false);
  const visibleMovers = useMemo(() => {
    if (selected === "Strongest") {
      return [...movers].sort(
        (a, b) =>
          Number(b.momentumScore || 0) - Number(a.momentumScore || 0) ||
          Number(b.netMovePct || 0) - Number(a.netMovePct || 0),
      );
    }

    if (selected === "3+ Sessions") {
      return [...movers]
        .filter((x) => Number(x.appearances || 0) >= 3)
        .sort(
          (a, b) =>
            Number(b.appearances || 0) - Number(a.appearances || 0) ||
            Number(b.netMovePct || 0) - Number(a.netMovePct || 0),
        );
    }

    if (selected === "Biggest Move") {
      return [...movers].sort(
        (a, b) =>
          Math.abs(Number(b.netMovePct || 0)) -
          Math.abs(Number(a.netMovePct || 0)),
      );
    }

    if (selected === "Pullbacks") {
      return [...pullbacks].sort(
        (a, b) =>
          Math.abs(Number(b.netMovePct || 0)) -
          Math.abs(Number(a.netMovePct || 0)),
      );
    }

    return movers;
  }, [selected, movers, pullbacks]);

  const leader = confirmed[0] || movers[0] || topAISetup;

  const normalizedSelectedMover = normalizeMoverForClara(
    selectedMover || leader || null,
  );

  const claraMomentumContext = {
    contextType: "momentum_movers",
    selectedMover: normalizedSelectedMover,
    movers: visibleMovers.slice(0, 12).map(normalizeMoverForClara),
    aiSetups: aiSetups.slice(0, 8).map(normalizeMoverForClara),
    pullbacks: pullbacks.slice(0, 8).map(normalizeMoverForClara),
    pulse,
    updatedAt: data?.updatedAt,
    lookbackSnapshots: data?.lookbackSnapshots,
  };
  const filters = useMemo(
    () => ["All", "Strongest", "3+ Sessions", "Biggest Move", "Pullbacks"],
    [],
  );

  if (loading) {
    return (
      <View
        style={[
          styles.screen,
          { alignItems: "center", justifyContent: "center" },
        ]}
      >
        <ActivityIndicator color={BRAND.green} size="large" />
        <Text style={{ color: BRAND.text, marginTop: 14, fontWeight: "800" }}>
          Loading momentum intelligence
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <StatusBar barStyle="light-content" />
      <View style={styles.stickyHeader}>
        <Text style={styles.title}>Momentum</Text>
        <Text style={styles.subtitle}>
          Real-time detection of sustained institutional momentum
        </Text>
      </View>
      <ScrollView
        ref={pageScrollRef}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={BRAND.green}
            colors={[BRAND.green]}
            progressBackgroundColor="#111827"
            progressViewOffset={70}
          />
        }
      >
        {refreshing && (
          <View style={styles.refreshBanner}>
            <ActivityIndicator size="small" color={BRAND.green} />
            <Text style={styles.refreshBannerText}>
              Refreshing momentum memory…
            </Text>
          </View>
        )}

        {/* ---------- Market Momentum Pulse ---------- */}
        <LinearGradient
          colors={[
            "rgba(17,24,39,0.96)",
            "rgba(8,12,18,0.98)",
            "rgba(0,0,0,0.98)",
          ]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.pulseCard}
        >
          <View style={styles.pulseLeft}>
            <View style={styles.pulseHeader}>
              <View style={styles.pulseHeaderTitleRow}>
                <Text style={styles.sectionCaps}>MARKET MOMENTUM PULSE</Text>
                <TouchableOpacity
                  onPress={() => setInfoModal(MOMENTUM_SCORE_INFO.MARKET)}
                  style={styles.infoBtn}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons
                    name="help-circle-outline"
                    size={15}
                    color={BRAND.sub}
                  />
                </TouchableOpacity>
              </View>
              <MaterialCommunityIcons
                name="pulse"
                size={22}
                color={BRAND.green}
              />
            </View>

            <Text style={styles.pulseMain}>
              <Text style={{ color: BRAND.green }}>
                {pulse.positiveContinuation ?? 0}
              </Text>
              {"  "}
              <Text style={styles.pulseMainSub}>
                stocks showing strong continuation
              </Text>
            </Text>

            <View style={styles.pulseStats}>
              <View style={styles.statBlock}>
                <Ionicons name="trending-up" size={18} color={BRAND.green} />
                <View>
                  <Text style={styles.statLabel}>Avg Momentum</Text>
                  <Text style={styles.statValue}>
                    +{Number(pulse.avgUpsideMovePct || 0).toFixed(1)}%
                  </Text>
                </View>
              </View>

              <View style={styles.statBlock}>
                <Ionicons
                  name="pie-chart-outline"
                  size={18}
                  color={BRAND.green}
                />
                <View>
                  <Text style={styles.statLabel}>Top Sector</Text>
                  <Text style={styles.statValue}>
                    {pulse.topTheme || "Mixed"}
                  </Text>
                </View>
              </View>

              <View style={styles.statBlock}>
                <MaterialCommunityIcons
                  name="broadcast"
                  size={18}
                  color={BRAND.green}
                />
                <View>
                  <Text style={styles.statLabel}>Market Bias</Text>
                  <Text style={styles.statValue}>
                    {pulse.marketBias || "Bullish"}
                  </Text>
                </View>
              </View>
            </View>
          </View>

          <MomentumRing score={pulse.momentumScore || 0} />
        </LinearGradient>

        {/* ---------- Leader Card ---------- */}
        {!leader && (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>
              Momentum intelligence is preparing
            </Text>
            <Text style={styles.emptySub}>
              Alphaclara is waiting for enough market and AI opportunity data.
            </Text>
          </View>
        )}

        {!!leader && (
          <LinearGradient
            colors={[
              "rgba(17,24,39,0.96)",
              "rgba(8,12,18,0.98)",
              "rgba(0,0,0,0.98)",
            ]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.leaderCard}
          >
            <View style={styles.leaderTag}>
              <Text style={styles.leaderTagText}>TOP MOMENTUM LEADER</Text>
            </View>

            <View style={styles.leaderMain}>
              <View style={styles.leaderInfo}>
                <View style={styles.leaderSymbolRow}>
                  <View style={styles.bigLogo}>
                    {leader?.logoUrl ? (
                      <Image
                        source={{ uri: leader.logoUrl }}
                        style={styles.bigLogoImage}
                        resizeMode="contain"
                      />
                    ) : (
                      <Text style={styles.bigLogoText}>
                        {leader?.symbol?.slice(0, 1) || "N"}
                      </Text>
                    )}
                  </View>
                  <View>
                    <Text style={styles.leaderSymbol}>
                      {leader?.symbol || "--"}
                    </Text>
                    <Text style={styles.leaderName}>
                      {leader?.companyName || "Momentum leader"}
                    </Text>
                  </View>
                </View>

                <Text style={styles.leaderPrice}>
                  ${Number(leader?.price || 0).toFixed(2)}
                  {"  "}
                  <Text style={styles.leaderChange}>
                    {Number(leader?.change || 0) >= 0 ? "+" : ""}
                    {Number(leader?.change || 0).toFixed(2)} (
                    {Number(leader?.changePct || 0) >= 0 ? "+" : ""}
                    {Number(leader?.changePct || 0).toFixed(2)}%)
                  </Text>
                </Text>
              </View>

              <View style={styles.leaderRealChart}>
                <Text style={styles.leaderChartLabel}>12-session momentum</Text>
                <MiniSparkline
                  color={BRAND.green}
                  values={leader?.sparkline}
                  w={118}
                  h={42}
                />
              </View>
            </View>

            <View style={styles.leaderMetrics}>
              <View style={styles.metricBox}>
                <Text style={styles.metricLabel}>Appeared in movers</Text>
                <Text style={styles.metricValue}>
                  <Text style={{ color: BRAND.green }}>
                    {leader?.dailyMoverAppearances || leader?.appearances || 0}
                  </Text>{" "}
                  of{" "}
                  <Text style={{ color: BRAND.green }}>
                    {leader?.lookbackSnapshots || data?.lookbackSnapshots || 12}
                  </Text>{" "}
                  sessions
                </Text>
              </View>

              <View style={styles.metricDivider} />

              <View style={styles.metricBox}>
                <View style={styles.metricLabelRow}>
                  <Text style={styles.metricLabel}>Momentum Score</Text>
                  <TouchableOpacity
                    onPress={() => setInfoModal(MOMENTUM_SCORE_INFO.STOCK)}
                    style={styles.infoBtn}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Ionicons
                      name="help-circle-outline"
                      size={13}
                      color={BRAND.sub}
                    />
                  </TouchableOpacity>
                </View>
                <Text style={styles.metricValueGreen}>
                  {Math.round(leader?.momentumScore || 92)}/100
                </Text>
              </View>

              <View style={styles.metricDivider} />

              <View style={styles.metricBox}>
                <Text style={styles.metricLabel}>Risk / Quality</Text>
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 5,
                    marginTop: 3,
                  }}
                >
                  <View
                    style={[
                      styles.dotGreen,
                      {
                        backgroundColor:
                          RISK_LEVEL_COLOR[leader?.riskLevel] || BRAND.sub,
                      },
                    ]}
                  />
                  <Text
                    style={[
                      styles.metricValueGreen,
                      {
                        color: RISK_LEVEL_COLOR[leader?.riskLevel] || BRAND.sub,
                      },
                    ]}
                  >
                    {leader?.riskLevel || "Not assessed"}
                  </Text>
                </View>
              </View>
            </View>

            <View style={styles.aiNote}>
              <MaterialCommunityIcons
                name="creation"
                size={18}
                color={BRAND.green}
              />
              <Text style={styles.aiNoteText}>
                {leader?.reason ||
                  "AI detects strong institutional continuation with sustained volume expansion."}
              </Text>
            </View>
          </LinearGradient>
        )}

        {/* ---------- Momentum Movers ---------- */}
        <View style={styles.sectionHeader}>
          <View style={styles.sectionTitleRow}>
            <Ionicons name="trending-up" size={18} color={BRAND.green} />
            <View>
              <Text style={styles.sectionTitle}>MOMENTUM MOVERS</Text>
              <Text style={styles.sectionSub}>
                Memory-ranked continuation • {data?.lookbackSnapshots || 12}{" "}
                snapshots
              </Text>
            </View>
          </View>
          <TouchableOpacity
            style={styles.viewAll}
            onPress={() => setShowAllMovers((v) => !v)}
          >
            <Text style={styles.viewAllText}>
              {showAllMovers ? "Show Less" : "View All"}
            </Text>
            <Ionicons
              name={showAllMovers ? "chevron-up" : "arrow-forward"}
              size={16}
              color={BRAND.green}
            />
          </TouchableOpacity>
        </View>
        {/* ---------- Filters ---------- */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filters}
        >
          {filters.map((f) => {
            const active = selected === f;
            return (
              <TouchableOpacity
                key={f}
                onPress={() => {
                  setSelected(f);
                  setShowAllMovers(false);
                }}
                style={[styles.filterPill, active && styles.filterPillActive]}
                activeOpacity={0.85}
              >
                <Text
                  style={[styles.filterText, active && styles.filterTextActive]}
                >
                  {f}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
        <View style={styles.moversTableCard}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.tableScrollContent}
          >
            <View>
              {/* Table Header */}
              <View style={styles.tableHeaderRow}>
                <Text style={[styles.tableHeaderText, styles.tableColStock]}>
                  STOCK
                </Text>
                <Text style={[styles.tableHeaderText, styles.tableColPrice]}>
                  PRICE
                </Text>
                <Text style={[styles.tableHeaderText, styles.tableColMove]}>
                  NET MOVE
                </Text>
                <Text style={[styles.tableHeaderText, styles.tableColAppear]}>
                  SESSIONS
                </Text>
                <View
                  style={[
                    styles.tableColScore,
                    { flexDirection: "row", alignItems: "center", gap: 2 },
                  ]}
                >
                  <Text style={styles.tableHeaderText}>SCORE</Text>
                  <TouchableOpacity
                    onPress={() => setInfoModal(MOMENTUM_SCORE_INFO.STOCK)}
                    style={styles.infoBtn}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Ionicons
                      name="help-circle-outline"
                      size={12}
                      color={BRAND.sub}
                    />
                  </TouchableOpacity>
                </View>
                <Text style={[styles.tableHeaderText, styles.tableColSpark]}>
                  TREND
                </Text>
                <Text style={[styles.tableHeaderText, styles.tableColTag]}>
                  SETUP
                </Text>
              </View>

              {/* Table Rows */}
              {(showAllMovers ? visibleMovers : visibleMovers.slice(0, 8)).map(
                (item) => {
                  const tagText =
                    item.momentumLabel ||
                    item.moverQuality ||
                    item.riskLevel ||
                    "Momentum";
                  const amber = AMBER_TAGS.has(tagText);

                  return (
                    <TouchableOpacity
                      key={item.symbol}
                      activeOpacity={0.85}
                      style={styles.tableRow}
                      onPress={() => {
                        setSelectedMover(item);
                        setAstraVisible(true);
                      }}
                    >
                      {/* Stock */}
                      <View style={[styles.tableColStock, styles.cell]}>
                        <View style={styles.stockCell}>
                          <View style={styles.logoSmall}>
                            {item.logoUrl ? (
                              <Image
                                source={{ uri: item.logoUrl }}
                                style={styles.logoSmallImage}
                                resizeMode="contain"
                              />
                            ) : (
                              <Text style={styles.logoSmallText}>
                                {item.symbol?.slice(0, 1)}
                              </Text>
                            )}
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.stockSymbol}>
                              {item.symbol}
                            </Text>
                            <Text style={styles.stockName} numberOfLines={2}>
                              {item.companyName || item.sector || ""}
                            </Text>
                          </View>
                        </View>
                      </View>

                      {/* Price */}
                      <View style={[styles.tableColPrice, styles.cell]}>
                        <Animated.Text
                          style={[
                            styles.rowPrice,
                            {
                              backgroundColor: getPriceFlashBg(
                                item.symbol,
                                item.changePct,
                              ),
                              paddingHorizontal: 5,
                              borderRadius: 7,
                            },
                          ]}
                        >
                          {item.price
                            ? `$${Number(item.price).toFixed(2)}`
                            : "--"}
                        </Animated.Text>
                        <Text style={styles.rowGreen}>
                          {item.changePct != null
                            ? `${Number(item.changePct) >= 0 ? "+" : ""}${Number(item.changePct).toFixed(2)}%`
                            : ""}
                        </Text>
                      </View>

                      {/* 5D Net */}
                      <View style={[styles.tableColMove, styles.cell]}>
                        <Text style={styles.netMoveText}>
                          {item.netMovePct != null
                            ? `${Number(item.netMovePct) >= 0 ? "+" : ""}${Number(item.netMovePct).toFixed(1)}%`
                            : `${Number(item.avgMovePct || 0).toFixed(1)}%`}
                        </Text>

                        <Text style={styles.netDollarText}>
                          {(() => {
                            const dollarMove = estimateDollarMove(
                              item.price,
                              item.netMovePct,
                            );
                            if (dollarMove == null) return "Net move";
                            return `${dollarMove >= 0 ? "+" : "-"}$${Math.abs(dollarMove).toFixed(2)}`;
                          })()}
                        </Text>
                      </View>

                      {/* Sessions */}
                      <View style={[styles.tableColAppear, styles.cell]}>
                        <Text style={styles.appearMain}>
                          <Text style={{ color: BRAND.green }}>
                            {item.positiveSessions ?? "–"}↑
                          </Text>{" "}
                          <Text style={{ color: BRAND.red }}>
                            {item.negativeSessions ?? "–"}↓
                          </Text>
                        </Text>
                        <Text style={styles.appearLabel}>
                          {item.appearances || 0}/
                          {item.lookbackSnapshots ||
                            data?.lookbackSnapshots ||
                            12}
                        </Text>
                      </View>

                      {/* Score */}
                      <View style={[styles.tableColScore, styles.cell]}>
                        <View
                          style={[
                            styles.scoreBadge,
                            amber && styles.scoreBadgeAmber,
                          ]}
                        >
                          <Text
                            style={[
                              styles.scoreText,
                              amber && styles.scoreTextAmber,
                            ]}
                          >
                            {Math.round(
                              item.momentumScore || item.avgAlphaScore || 0,
                            )}
                          </Text>
                        </View>
                      </View>

                      {/* Sparkline */}
                      <View style={[styles.tableColSpark, styles.cell]}>
                        <MiniSparkline
                          color={amber ? BRAND.amber : BRAND.green}
                          values={item.sparkline}
                          w={68}
                          h={26}
                        />
                      </View>

                      {/* SETUP Column - FIXED */}
                      <View style={[styles.tableColTag, styles.cell]}>
                        <View
                          style={[styles.tableTag, amber && styles.tagAmber]}
                        >
                          <Text
                            style={[
                              styles.tableTagText,
                              amber && styles.tagTextAmber,
                            ]}
                            numberOfLines={2}
                            ellipsizeMode="tail"
                          >
                            {tagText}
                          </Text>
                        </View>
                      </View>
                    </TouchableOpacity>
                  );
                },
              )}
            </View>
          </ScrollView>
        </View>

        {/* ---------- AI OPPORTUNITY MEMORY ---------- */}
        <View style={[styles.sectionHeader, { marginTop: 28 }]}>
          <View style={styles.sectionTitleRow}>
            <View style={styles.sectionIconWrap}>
              <MaterialCommunityIcons
                name="creation"
                size={16}
                color={BRAND.amber}
              />
            </View>
            <View style={{ flex: 1 }}>
              <View style={styles.sectionTitleLine}>
                <Text style={styles.sectionTitle}>AI SETUPS</Text>
                <View style={styles.sectionLiveDot}>
                  <View style={styles.sectionLiveDotInner} />
                  <Text style={styles.sectionLiveText}>LIVE</Text>
                </View>
              </View>
              <Text style={styles.sectionSub}>
                Internal AI-ranked opportunities with momentum confirmation
              </Text>
            </View>
          </View>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          decelerationRate="fast"
          snapToInterval={262}
          snapToAlignment="start"
          contentContainerStyle={styles.alphaMemoryScroll}
        >
          {aiSetups.slice(0, 10).map((item, idx) => {
            const score = Math.round(
              item.momentumScore ||
                item.opportunityScore ||
                item.alphaScore ||
                0,
            );
            const confidence = Math.round(item.confidence || 0);
            const conviction = Math.min(100, Math.max(8, score));
            const tier =
              score >= 85 ? "ELITE" : score >= 70 ? "STRONG" : "EMERGING";

            return (
              <TouchableOpacity
                key={item.symbol}
                activeOpacity={0.9}
                style={styles.alphaCard}
              >
                {/* Base background */}
                <LinearGradient
                  colors={["#10151E", "#0A0E15"]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={StyleSheet.absoluteFill}
                />

                {/* Top-right amber glow */}
                <LinearGradient
                  colors={["rgba(254,176,25,0.18)", "transparent"]}
                  start={{ x: 1, y: 0 }}
                  end={{ x: 0, y: 1 }}
                  style={styles.alphaGlow}
                />

                {/* Left accent rail */}
                <LinearGradient
                  colors={["#FEB019", "rgba(254,176,25,0)"]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 0, y: 1 }}
                  style={styles.alphaRail}
                />

                {/* Header */}
                <View style={styles.alphaTopRow}>
                  <View style={styles.alphaLogoWrap}>
                    <LinearGradient
                      colors={[
                        "rgba(254,176,25,0.28)",
                        "rgba(254,176,25,0.08)",
                      ]}
                      style={StyleSheet.absoluteFill}
                    />
                    {item.logoUrl ? (
                      <Image
                        source={{ uri: item.logoUrl }}
                        style={styles.alphaLogoImage}
                        resizeMode="contain"
                      />
                    ) : (
                      <Text style={styles.alphaLogoText}>
                        {item.symbol?.slice(0, 1)}
                      </Text>
                    )}
                  </View>

                  <View style={{ flex: 1, minWidth: 0 }}>
                    <View style={styles.alphaSymbolRow}>
                      <Text style={styles.alphaSymbol} numberOfLines={1}>
                        {item.symbol}
                      </Text>
                      <View style={styles.alphaTierPill}>
                        <Text style={styles.alphaTierText}>{tier}</Text>
                      </View>
                      <TouchableOpacity
                        onPress={() => setInfoModal(MOMENTUM_SCORE_INFO.TIER)}
                        style={styles.infoBtn}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      >
                        <Ionicons
                          name="help-circle-outline"
                          size={13}
                          color={BRAND.sub}
                        />
                      </TouchableOpacity>
                    </View>
                    <Text style={styles.alphaSector} numberOfLines={1}>
                      {item.sector || item.companyName || "AI Opportunity"}
                    </Text>
                  </View>

                  <View style={styles.alphaScoreBadge}>
                    <Text style={styles.alphaScoreLabel}>AI</Text>
                    <Text style={styles.alphaScoreText}>{score}</Text>
                  </View>
                </View>

                {/* Conviction bar */}
                <View style={styles.alphaBarTrack}>
                  <LinearGradient
                    colors={["#FEB019", "#FF8A00"]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={[styles.alphaBarFill, { width: `${conviction}%` }]}
                  />
                </View>

                {/* Metrics */}
                <View style={styles.alphaMetricsRow}>
                  <View style={styles.alphaMetric}>
                    <Animated.Text
                      style={[
                        styles.alphaMetricValue,
                        {
                          backgroundColor: getPriceFlashBg(
                            item.symbol,
                            item.changePct,
                          ),
                          paddingHorizontal: 4,
                          borderRadius: 6,
                        },
                      ]}
                    >
                      {item.price ? `$${Number(item.price).toFixed(2)}` : "--"}
                    </Animated.Text>
                    <Text style={styles.alphaMetricLabel}>Price</Text>
                  </View>
                  <View style={styles.alphaDivider} />
                  <View style={styles.alphaMetric}>
                    <Text style={styles.alphaMetricValue}>
                      {item.changePct != null
                        ? `${Number(item.changePct) >= 0 ? "+" : ""}${Number(item.changePct).toFixed(1)}%`
                        : "--"}
                    </Text>
                    <Text style={styles.alphaMetricLabel}>Move</Text>
                  </View>
                  <View style={styles.alphaDivider} />
                  <View style={styles.alphaMetric}>
                    <Text
                      style={[styles.alphaMetricValue, { color: BRAND.amber }]}
                    >
                      {confidence}%
                    </Text>
                    <Text style={styles.alphaMetricLabel}>Confidence</Text>
                  </View>
                </View>

                {/* Footer reason + tag */}
                <View style={styles.alphaFooter}>
                  <Text style={styles.alphaReason} numberOfLines={4}>
                    {item.reason ||
                      item.primaryCatalysts?.[0] ||
                      "Repeated AI opportunity signal across sessions"}
                  </Text>
                  <View style={styles.alphaTagRow}>
                    <View style={styles.alphaTag}>
                      <View style={styles.alphaTagDot} />
                      <Text style={styles.alphaTagText} numberOfLines={1}>
                        {item.setupLabel || item.riskLevel || "AI Setup"}
                      </Text>
                    </View>
                  </View>
                </View>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* ---------- PULLBACK WATCH - Premium Horizontal Cards ---------- */}
        <View style={[styles.sectionHeader, { marginTop: 6 }]}>
          <View style={styles.sectionTitleRow}>
            <Ionicons name="trending-down" size={20} color={BRAND.red} />
            <View>
              <Text style={styles.sectionTitle}>PULLBACK WATCH</Text>
              <Text style={styles.sectionSub}>
                Repeated downside momentum detected
              </Text>
            </View>
          </View>
          <TouchableOpacity style={styles.viewAll}>
            <Text style={[styles.viewAllText, { color: BRAND.red }]}>
              View All
            </Text>
            <Ionicons name="arrow-forward" size={16} color={BRAND.red} />
          </TouchableOpacity>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.pullbackScroll}
        >
          {pullbacks.map((item) => (
            <TouchableOpacity
              key={item.symbol}
              activeOpacity={0.86}
              style={styles.pullCard}
            >
              <LinearGradient
                colors={["rgba(255,69,96,0.22)", "rgba(15,8,10,0.98)"]}
                style={StyleSheet.absoluteFill}
              />

              <View style={styles.pullTopRow}>
                <View style={styles.pullLogo}>
                  {item.logoUrl ? (
                    <Image
                      source={{ uri: item.logoUrl }}
                      style={styles.pullLogoImage}
                      resizeMode="contain"
                    />
                  ) : (
                    <Text style={styles.pullLogoText}>
                      {item.symbol?.slice(0, 1)}
                    </Text>
                  )}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.pullSymbol}>{item.symbol}</Text>
                  <Text style={styles.pullName} numberOfLines={1}>
                    {item.companyName || item.symbol}
                  </Text>
                </View>
              </View>

              <View style={styles.pullMid}>
                <View>
                  <Animated.Text
                    style={[
                      styles.pullPrice,
                      {
                        backgroundColor: getPriceFlashBg(
                          item.symbol,
                          item.changePct,
                        ),
                        paddingHorizontal: 5,
                        borderRadius: 6,
                      },
                    ]}
                  >
                    {item.price ? `$${Number(item.price).toFixed(2)}` : "--"}
                  </Animated.Text>
                  <Text style={styles.pullChange}>
                    {item.netMovePct != null
                      ? `${Number(item.netMovePct).toFixed(2)}%`
                      : `${Number(item.changePct || 0).toFixed(2)}%`}
                  </Text>
                </View>
                <View style={styles.pullDivider} />
                <View>
                  <Text style={styles.pullAppear}>
                    {item.appearances}/
                    {item.lookbackSnapshots || data?.lookbackSnapshots || 12}
                  </Text>
                  <Text style={styles.pullAppearLabel}>Appearances</Text>
                </View>
              </View>

              <MiniSparkline
                color={BRAND.red}
                bearish
                values={item.sparkline}
                w={186}
                h={30}
              />

              <View style={styles.redTag}>
                <Text style={styles.redTagText}>
                  {item.momentumLabel || "Pullback Watch"}
                </Text>
              </View>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* FOOTER */}
        <View style={styles.footerWrap}>
          <Text style={styles.footerText}>
            Powered by <Text style={styles.footerBrand}>Alphaclara</Text>
          </Text>

          <Text style={styles.disclaimer}>
            Momentum Movers, AI Setups, Pullback Watch, scores, and trend
            insights are generated by Alphaclara’s AI intelligence engine using
            market momentum, volatility, price action, and pattern analysis.
            Informational and educational use only — not financial, investment,
            trading, or tax advice.
          </Text>
        </View>
      </ScrollView>

      <TouchableOpacity
        style={styles.astraWrap}
        activeOpacity={0.9}
        onPress={() => {
          setSelectedMover(leader || visibleMovers[0] || null);
          setAstraVisible(true);
        }}
      >
        <AstraAnimatedIcon size={52} />
      </TouchableOpacity>

      <AstraChat
        visible={astraVisible}
        onClose={() => setAstraVisible(false)}
        portfolioData={claraMomentumContext}
      />

      {infoModal && (
        <Modal transparent animationType="fade" visible>
          <View style={styles.modalOverlay}>
            <View style={styles.infoModalCard}>
              <View style={styles.infoModalHeader}>
                <Text style={styles.infoModalTitle}>{infoModal.title}</Text>
                <TouchableOpacity onPress={() => setInfoModal(null)}>
                  <Ionicons name="close" size={20} color={BRAND.sub} />
                </TouchableOpacity>
              </View>
              <Text style={styles.infoModalText}>{infoModal.text}</Text>
            </View>
          </View>
        </Modal>
      )}
    </View>
  );
}
const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: BRAND.bg,
  },

  content: {
    paddingTop: 110,
    paddingHorizontal: 8,
    paddingBottom: 34,
  },

  /* Header */
  stickyHeader: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 100,
    backgroundColor: BRAND.bg,

    paddingTop: 58,
    paddingHorizontal: 16,
    paddingBottom: 12,

    borderBottomWidth: 1,
    borderBottomColor: BRAND.softBorder,
  },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 8,
  },

  backBtn: {
    width: 34,
    height: 34,
    justifyContent: "center",
    marginRight: 10,
  },

  headerText: {
    flex: 1,
  },

  title: {
    color: BRAND.text,
    fontSize: 26,
    fontWeight: "900",
    letterSpacing: -1.0,
    marginBottom: 4,
  },

  subtitle: {
    color: BRAND.sub,
    fontSize: 12,
    lineHeight: 18,
    fontWeight: "600",
  },

  /* Pulse */
  pulseCard: {
    borderRadius: 18,
    borderWidth: 1.2,
    borderColor: "rgba(0,227,150,0.26)",
    padding: 10,
    minHeight: 104,
    flexDirection: "row",
    overflow: "hidden",
    marginBottom: 10,
    shadowColor: BRAND.green,
    shadowOpacity: 0.1,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  pulseLeft: {
    flex: 1,
    paddingRight: 8,
  },
  pulseHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    marginBottom: 7,
  },

  pulseHeaderTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },

  infoBtn: { paddingHorizontal: 3, paddingVertical: 2 },

  sectionCaps: {
    color: BRAND.text,
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 0.5,
  },

  pulseMain: {
    color: BRAND.text,
    fontSize: 15,
    fontWeight: "900",
    letterSpacing: -0.3,
    marginBottom: 7,
  },
  pulseMainSub: {
    fontSize: 12,
    fontWeight: "700",
    color: "#E5E7EB",
  },

  pulseStats: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 10,
    rowGap: 6,
  },

  statBlock: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    minWidth: 95,
  },

  statLabel: {
    color: "#C8CDD6",
    fontSize: 10.5,
    fontWeight: "600",
  },

  statValue: {
    color: BRAND.green,
    fontSize: 12,
    fontWeight: "900",
    marginTop: 1,
  },

  ringWrap: {
    width: 78,
    height: 78,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 4,
  },

  ringText: {
    position: "absolute",
    alignItems: "center",
  },

  ringLabel: {
    color: BRAND.text,
    fontSize: 6.8,
    fontWeight: "900",
  },

  ringValue: {
    color: BRAND.text,
    fontSize: 19,
    fontWeight: "900",
    marginTop: 1,
  },

  ringTotal: {
    color: BRAND.sub,
    fontSize: 8.5,
    fontWeight: "800",
  },

  /* Filters */
  filters: {
    gap: 8,
    paddingTop: 10,
    paddingBottom: 10,
  },

  filterPill: {
    paddingHorizontal: 16,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.16)",
    backgroundColor: "rgba(17,24,39,0.62)",
    justifyContent: "center",
    alignItems: "center",
  },

  filterPillActive: {
    backgroundColor: "rgba(0,227,150,0.18)",
    borderColor: BRAND.green,
    shadowColor: BRAND.green,
    shadowOpacity: 0.35,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 0 },
  },

  filterText: {
    color: BRAND.text,
    fontSize: 13,
    fontWeight: "800",
  },

  filterTextActive: {
    color: BRAND.green,
  },

  /* Leader card */
  leaderCard: {
    borderRadius: 18,
    borderWidth: 1.2,
    borderColor: "rgba(0,227,150,0.24)",
    padding: 11,
    overflow: "hidden",
    marginBottom: 10,
    shadowColor: BRAND.green,
    shadowOpacity: 0.1,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },

  leaderTag: {
    alignSelf: "flex-start",
    backgroundColor: "rgba(0,227,150,0.14)",
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 9,
    marginBottom: 7,
  },

  leaderTagText: {
    color: BRAND.text,
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 0.4,
  },

  leaderMain: {
    flexDirection: "row",
    alignItems: "center",
  },

  leaderInfo: {
    flex: 1,
  },

  leaderSymbolRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },

  bigLogo: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
  },

  bigLogoText: {
    color: "#07110A",
    fontSize: 22,
    fontWeight: "900",
  },

  leaderSymbol: {
    color: BRAND.text,
    fontSize: 20,
    fontWeight: "900",
    letterSpacing: -0.5,
  },

  leaderName: {
    color: BRAND.sub,
    fontSize: 12,
    fontWeight: "700",
    marginTop: 1,
    maxWidth: 160,
  },

  leaderPrice: {
    color: BRAND.text,
    fontSize: 18,
    fontWeight: "900",
    marginTop: 7,
  },
  leaderChange: {
    color: BRAND.green,
    fontSize: 12,
    fontWeight: "900",
  },

  leaderMetrics: {
    marginTop: 7,
    flexDirection: "row",
    alignItems: "center",
  },

  metricBox: {
    flex: 1,
  },

  metricDivider: {
    width: 1,
    height: 36,
    backgroundColor: "rgba(255,255,255,0.12)",
    marginHorizontal: 10,
  },

  metricLabel: {
    color: BRAND.sub,
    fontSize: 11,
    fontWeight: "700",
  },

  metricLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },

  metricValue: {
    color: BRAND.text,
    fontSize: 13,
    fontWeight: "900",
    marginTop: 3,
  },

  metricValueGreen: {
    color: BRAND.green,
    fontSize: 13,
    fontWeight: "900",
  },

  dotGreen: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: BRAND.green,
  },

  aiNote: {
    marginTop: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(0,227,150,0.12)",
    backgroundColor: "rgba(17,24,39,0.72)",
    padding: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },

  aiNoteText: {
    flex: 1,
    color: "#D1D5DB",
    fontSize: 12.5,
    lineHeight: 17,
    fontWeight: "700",
  },

  /* Section header */
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },

  sectionTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },

  sectionTitle: {
    color: BRAND.text,
    fontSize: 12.5,
    fontWeight: "900",
    letterSpacing: 0.5,
  },

  sectionSub: {
    color: BRAND.sub,
    fontSize: 10.5,
    fontWeight: "700",
    marginTop: 1,
  },

  viewAll: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },

  viewAllText: {
    color: BRAND.green,
    fontSize: 13,
    fontWeight: "900",
  },

  /* Momentum Movers Table */
  moversTableCard: {
    backgroundColor: BRAND.card2,
    borderRadius: 18,
    borderWidth: 1.4,
    borderColor: "rgba(0,227,150,0.26)",
    overflow: "hidden",
    marginTop: 2,
    marginBottom: -14,

    shadowColor: BRAND.green,
    shadowOpacity: 0.1,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },

  tableScrollContent: {
    paddingBottom: 12,
  },

  tableHeaderRow: {
    flexDirection: "row",
    backgroundColor: "rgba(17,24,39,0.98)",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.12)",
    paddingVertical: 11,
    paddingHorizontal: 10,
  },

  tableHeaderText: {
    color: BRAND.sub,
    fontSize: 11.5,
    fontWeight: "800",
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },

  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.07)",
    paddingVertical: 13,
    paddingHorizontal: 10,
    minHeight: 72,
  },

  cell: {
    justifyContent: "center",
    paddingHorizontal: 4,
  },

  tableColStock: {
    width: 178,
  },

  tableColPrice: {
    width: 96,
  },

  tableColMove: {
    width: 78,
  },

  tableColAppear: {
    width: 96,
  },

  tableColScore: {
    width: 64,
    alignItems: "center",
  },

  tableColSpark: {
    width: 80,
    alignItems: "center",
  },

  tableColTag: {
    width: 138,
  },

  stockCell: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },

  logoSmall: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(0,227,150,0.12)",
    borderWidth: 1,
    borderColor: "rgba(0,227,150,0.35)",
    alignItems: "center",
    justifyContent: "center",
  },

  logoSmallText: {
    color: BRAND.green,
    fontSize: 14,
    fontWeight: "900",
  },

  stockSymbol: {
    color: BRAND.text,
    fontSize: 15,
    fontWeight: "900",
    letterSpacing: -0.3,
  },

  stockName: {
    color: BRAND.sub,
    fontSize: 11.5,
    fontWeight: "600",
    lineHeight: 14,
  },

  rowPrice: {
    color: BRAND.text,
    fontSize: 13.4,
    fontWeight: "900",
    includeFontPadding: false,
    flexShrink: 0,
  },

  rowGreen: {
    color: BRAND.green,
    fontSize: 12,
    fontWeight: "800",
    marginTop: 2,
  },

  netMoveText: {
    color: BRAND.green,
    fontSize: 14,
    fontWeight: "900",
  },

  netDollarText: {
    color: "#D1D5DB",
    fontSize: 10,
    fontWeight: "800",
    marginTop: 1,
  },

  appearMain: {
    fontSize: 13.5,
    fontWeight: "900",
    marginBottom: 2,
  },

  appearLabel: {
    color: BRAND.sub,
    fontSize: 10.5,
    fontWeight: "600",
  },

  scoreBadge: {
    minWidth: 36,
    height: 26,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(0,227,150,0.7)",
    backgroundColor: "rgba(0,227,150,0.1)",
    alignItems: "center",
    justifyContent: "center",
  },

  scoreBadgeAmber: {
    borderColor: "rgba(254,176,25,0.8)",
    backgroundColor: "rgba(254,176,25,0.1)",
  },

  scoreText: {
    color: BRAND.green,
    fontSize: 12.5,
    fontWeight: "900",
  },

  scoreTextAmber: {
    color: BRAND.amber,
  },

  tableTag: {
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: "rgba(0,227,150,0.15)",
    minHeight: 32,
    justifyContent: "center",
  },

  tagAmber: {
    backgroundColor: "rgba(254,176,25,0.15)",
  },

  tableTagText: {
    color: BRAND.green,
    fontSize: 10.8,
    fontWeight: "800",
    textAlign: "center",
  },
  tagTextAmber: {
    color: BRAND.amber,
  },
  /* AI Opportunity Memory */
  sectionIconWrap: {
    width: 30,
    height: 30,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(254,176,25,0.12)",
    borderWidth: 1,
    borderColor: "rgba(254,176,25,0.25)",
  },

  sectionTitleLine: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },

  sectionLiveDot: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
    backgroundColor: "rgba(254,176,25,0.10)",
    borderWidth: 1,
    borderColor: "rgba(254,176,25,0.28)",
  },

  sectionLiveDotInner: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: BRAND.amber,
  },

  sectionLiveText: {
    color: BRAND.amber,
    fontSize: 8.5,
    fontWeight: "900",
    letterSpacing: 1,
  },

  alphaMemoryScroll: {
    gap: 12,
    paddingTop: 12,
    paddingBottom: 8,
    paddingRight: 18,
  },

  alphaCard: {
    width: 262,
    height: 215, // was 192
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(254,176,25,0.18)",
    overflow: "hidden",
    padding: 13, // was 14
    paddingLeft: 16,
    backgroundColor: "#0B0F16",
    shadowColor: "#FEB019",
    shadowOpacity: 0.12,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },

  alphaGlow: {
    position: "absolute",
    top: 0,
    right: 0,
    width: 160,
    height: 160,
    borderTopRightRadius: 20,
  },

  alphaRail: {
    position: "absolute",
    left: 0,
    top: 14,
    bottom: 14,
    width: 2.5,
    borderRadius: 2,
  },

  alphaTopRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 10,
  },

  alphaLogoWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(254,176,25,0.35)",
  },

  alphaLogoText: {
    color: BRAND.amber,
    fontSize: 18,
    fontWeight: "900",
    letterSpacing: 0.5,
  },

  alphaSymbolRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },

  alphaSymbol: {
    color: BRAND.text,
    fontSize: 16.5,
    fontWeight: "900",
    letterSpacing: 0.3,
  },

  alphaTierPill: {
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 5,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
  },

  alphaTierText: {
    color: "#CBD5E1",
    fontSize: 8.5,
    fontWeight: "900",
    letterSpacing: 0.8,
  },

  alphaSector: {
    color: BRAND.sub,
    fontSize: 10.5,
    fontWeight: "700",
    marginTop: 2,
  },

  alphaScoreBadge: {
    minWidth: 44,
    height: 40,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: "rgba(254,176,25,0.55)",
    backgroundColor: "rgba(254,176,25,0.10)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 6,
  },

  alphaScoreLabel: {
    color: "rgba(254,176,25,0.75)",
    fontSize: 7.5,
    fontWeight: "900",
    letterSpacing: 1,
    marginTop: -1,
  },

  alphaScoreText: {
    color: BRAND.amber,
    fontSize: 15,
    fontWeight: "900",
    lineHeight: 17,
  },

  alphaBarTrack: {
    height: 4,
    borderRadius: 4,
    backgroundColor: "rgba(255,255,255,0.06)",
    overflow: "hidden",
    marginBottom: 10,
  },

  alphaBarFill: {
    height: "100%",
    borderRadius: 4,
  },

  alphaMetricsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },

  alphaMetric: {
    flex: 1,
    alignItems: "center",
  },

  alphaMetricValue: {
    color: BRAND.text,
    fontSize: 13,
    fontWeight: "900",
    numberOfLines: 1,
  },

  alphaMetricLabel: {
    color: BRAND.sub,
    fontSize: 9.5,
    fontWeight: "700",
    marginTop: 2,
    letterSpacing: 0.2,
  },

  alphaDivider: {
    width: 1,
    height: 28,
    backgroundColor: "rgba(255,255,255,0.08)",
    marginHorizontal: 6,
  },

  alphaFooter: {
    marginTop: 4,
  },

  alphaReason: {
    color: "#E5E7EB",
    fontSize: 11.2,
    lineHeight: 14.4,
    fontWeight: "600",
    marginBottom: 6,
  },

  alphaTagRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  alphaTag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: "rgba(254,176,25,0.12)",
    borderWidth: 1,
    borderColor: "rgba(254,176,25,0.25)",
  },

  alphaTagDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: BRAND.amber,
  },

  alphaTagText: {
    color: BRAND.amber,
    fontSize: 9.8,
    fontWeight: "900",
    letterSpacing: 0.4,
  },

  /* Pullback Watch */
  pullbackScroll: {
    gap: 12,
    paddingTop: 8,
    paddingBottom: 22,
    paddingHorizontal: 2,
  },

  pullCard: {
    width: 220,
    height: 170,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(255,69,96,0.22)",
    overflow: "hidden",
    padding: 12,
    backgroundColor: "#0F0A0B",
    shadowColor: "#FF4560",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.14,
    shadowRadius: 12,
    elevation: 5,
  },

  pullTopRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 8,
  },

  pullLogo: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "rgba(255,69,96,0.22)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255,69,96,0.35)",
  },

  pullLogoText: {
    color: "#FF9BA8",
    fontSize: 18,
    fontWeight: "900",
  },

  pullSymbol: {
    color: BRAND.text,
    fontSize: 16,
    fontWeight: "900",
  },

  pullName: {
    color: BRAND.sub,
    fontSize: 10.5,
    fontWeight: "700",
    marginTop: 1,
  },

  pullMid: {
    marginTop: 2,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 7,
  },

  pullPrice: {
    color: BRAND.text,
    fontSize: 15,
    fontWeight: "900",
  },

  pullChange: {
    color: BRAND.red,
    fontSize: 12,
    fontWeight: "900",
    marginTop: 2,
  },

  pullDivider: {
    width: 1,
    height: 32,
    backgroundColor: "rgba(255,255,255,0.12)",
  },

  pullAppear: {
    color: BRAND.text,
    fontSize: 15,
    fontWeight: "900",
  },

  pullAppearLabel: {
    color: BRAND.sub,
    fontSize: 10,
    fontWeight: "700",
  },

  redTag: {
    alignSelf: "flex-start",
    backgroundColor: "rgba(255,69,96,0.16)",
    borderRadius: 10,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: "rgba(255,69,96,0.3)",
    marginTop: 2,
    maxWidth: "100%",
  },

  redTagText: {
    color: "#FF9BA8",
    fontSize: 9.5,
    fontWeight: "900",
  },

  /* Empty */
  emptyCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    backgroundColor: "rgba(17,24,39,0.72)",
    padding: 16,
    marginBottom: 18,
  },

  emptyTitle: {
    color: BRAND.text,
    fontSize: 15,
    fontWeight: "900",
  },

  emptySub: {
    color: BRAND.sub,
    fontSize: 12,
    lineHeight: 17,
    marginTop: 5,
    fontWeight: "700",
  },
  /* FOOTER */
  footerWrap: {
    marginTop: 28,
    marginBottom: 30,
    paddingHorizontal: 18,
    alignItems: "center",
  },

  footerText: {
    color: BRAND.sub,
    fontSize: 12,
    marginBottom: 8,
    fontFamily: TYPO.fontFamily.semibold,
  },

  footerBrand: {
    color: BRAND.text,
    fontSize: 13.5,
    fontFamily: TYPO.fontFamily.brand,
    letterSpacing: -0.45,
  },

  disclaimer: {
    color: BRAND.muted,
    fontSize: 11,
    lineHeight: 16,
    textAlign: "center",
    fontFamily: TYPO.fontFamily.regular,
  },
  refreshBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    alignSelf: "center",
    marginBottom: 10,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: "rgba(0,227,150,0.10)",
    borderWidth: 1,
    borderColor: "rgba(0,227,150,0.22)",
  },

  refreshBannerText: {
    color: BRAND.green,
    fontSize: 11.5,
    fontWeight: "800",
  },
  bigLogoImage: {
    width: 26,
    height: 26,
  },

  logoSmallImage: {
    width: 22,
    height: 22,
  },

  alphaLogoImage: {
    width: 26,
    height: 26,
  },

  pullLogoImage: {
    width: 26,
    height: 26,
  },

  astraWrap: {
    position: "absolute",
    left: 20,
    bottom: 25,
    zIndex: 50,
  },
  leaderRealChart: {
    width: 126,
    height: 62,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 14,
    backgroundColor: "rgba(0,227,150,0.06)",
    borderWidth: 1,
    borderColor: "rgba(0,227,150,0.14)",
  },

  leaderChartLabel: {
    color: BRAND.sub,
    fontSize: 9,
    fontWeight: "800",
    marginBottom: 3,
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.68)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },

  infoModalCard: {
    width: "100%",
    backgroundColor: BRAND.card,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: BRAND.border,
    padding: 16,
  },

  infoModalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },

  infoModalTitle: {
    color: BRAND.text,
    fontSize: 16,
    fontFamily: TYPO.fontFamily.extrabold,
  },

  infoModalText: {
    color: BRAND.sub,
    fontSize: 13.5,
    lineHeight: 20,
    fontFamily: TYPO.fontFamily.regular,
  },
});
