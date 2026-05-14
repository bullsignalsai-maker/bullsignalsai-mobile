// screens/HomeScreen.js
import React, { useRef, useState } from "react";
import { useFocusEffect } from "@react-navigation/native";

import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Animated,
  RefreshControl,
  Image,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { getHomeScreen } from "../services/HomeService";
import { getMarketMovers } from "../services/MarketPulseService";
import { BRAND } from "../constants/theme";
import { TYPO } from "../constants/typography";
import MoveLabel from "../components/MoveLabel";
const LOGO = require("../assets/alpha-transparent.png");
// % formatter (market style)

const displayRating = (signal) => {
  if (signal === "BUY") return "Bullish";
  if (signal === "SELL") return "Bearish";
  return "Neutral";
};

// --- Helper: human-readable timestamps
function timeAgo(isoString) {
  if (!isoString) return "Recently";
  const diffMs = Date.now() - new Date(isoString).getTime();
  const mins = Math.floor(diffMs / 60000);
  const hrs = Math.floor(mins / 60);
  const days = Math.floor(hrs / 24);
  if (mins < 1) return "Just now";
  if (mins < 60) return `Updated ${mins}m ago`;
  if (hrs < 24) return `Updated ${hrs}h ago`;
  return `Updated ${days}d ago`;
}

function formatPatternLabel(pattern, winRate) {
  if (!pattern) return null;

  if (typeof winRate === "number") {
    return `${pattern} · ${Math.round(winRate * 100)}%`;
  }

  return pattern;
}

// Session label from timestamp (RESTORE — DO NOT CHANGE)
function getMarketSession(ts) {
  if (!ts) return null;
  const d = new Date(ts);
  const h = d.getHours();

  if (h < 9 || (h === 9 && d.getMinutes() < 30)) return "PRE";
  if (h >= 16) return "AH";
  return "LIVE";
}
const getSignal = (item) => item?.bullbrain?.signal || item?.signal || "HOLD";

const getConfidence = (item) =>
  typeof item?.bullbrain?.confidence === "number"
    ? item.bullbrain.confidence
    : typeof item?.confidence === "number"
      ? item.confidence
      : 0;

const getTopSignal = (signals = []) => {
  if (!signals.length) return null;

  const rising = signals.filter(
    (s) =>
      typeof s.changePct === "number" &&
      s.changePct > 0 &&
      getSignal(s) !== "SELL",
  );

  const pool = rising.length ? rising : signals;

  return [...pool].sort((a, b) => {
    const moveDiff = Math.abs(b.changePct || 0) - Math.abs(a.changePct || 0);
    if (moveDiff !== 0) return moveDiff;

    return getConfidence(b) - getConfidence(a);
  })[0];
};

const getSummary = (item) =>
  item?.watchlistSummary ||
  item?.grokSummary ||
  (typeof item?.summary === "string" ? item.summary : item?.summary?.primary);

const getPatternName = (item) => item?.pattern?.name || item?.pattern;

const getPatternWinRate = (item) =>
  item?.pattern?.winRate || item?.patternWinRate;
export default function HomeScreen({ navigation }) {
  const [home, setHome] = useState(null);
  const [topMovers, setTopMovers] = useState([]);
  // 🔥 price flash animation per symbol
  const priceFlash = useRef({}).current;
  const REFRESH_INTERVAL_MS = 30000;
  const [refreshing, setRefreshing] = useState(false);
  /* ---------------------------------------------------------
    Load + Auto Refresh (5s)
 --------------------------------------------------------- */
  useFocusEffect(
    React.useCallback(() => {
      let active = true;

      const load = async () => {
        if (!active) return;

        const data = await getHomeScreen();
        if (!data) return;

        setHome(data);
        try {
          const moversData = await getMarketMovers();
          setTopMovers((moversData?.gainers || []).slice(0, 5));
        } catch {
          setTopMovers([]);
        }

        // 🔥 trigger price flash

        (data.signals || []).forEach((it) => {
          // ✅ ensure animation exists
          if (!priceFlash[it.symbol]) {
            priceFlash[it.symbol] = new Animated.Value(0);
          }

          // ✅ don't skip — price updates should flash even if needsRefresh flips
          priceFlash[it.symbol].setValue(1);
          Animated.timing(priceFlash[it.symbol], {
            toValue: 0,
            duration: 900,
            useNativeDriver: false,
          }).start();
        });
      };

      // initial load
      load();

      // auto refresh
      const interval = setInterval(load, REFRESH_INTERVAL_MS);

      // cleanup when screen loses focus
      return () => {
        active = false;
        clearInterval(interval);
      };
    }, []),
  );

  /* ---------------------------------------------------------
    Pull To Refresh
 --------------------------------------------------------- */
  const onRefresh = async () => {
    if (refreshing) return;

    setRefreshing(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    const data = await getHomeScreen();
    if (data) {
      setHome(data);
      try {
        const moversData = await getMarketMovers();
        setTopMovers((moversData?.gainers || []).slice(0, 5));
      } catch {
        setTopMovers([]);
      }

      (data.signals || []).forEach((it) => {
        if (!priceFlash[it.symbol]) {
          priceFlash[it.symbol] = new Animated.Value(0);
        }

        priceFlash[it.symbol].setValue(1);
        Animated.timing(priceFlash[it.symbol], {
          toValue: 0,
          duration: 900,
          useNativeDriver: false,
        }).start();
      });
    }

    setRefreshing(false);
  };

  if (!home) {
    return (
      <View style={styles.container}>
        <Text style={{ color: BRAND.sub, textAlign: "center", marginTop: 100 }}>
          Loading market intelligence…
        </Text>
      </View>
    );
  }

  const { header, carousel, signals } = home;
  const topSignal =
    topMovers?.length > 0
      ? {
          symbol: topMovers[0].symbol,
          companyName: topMovers[0].company || topMovers[0].symbol,
          price: topMovers[0].price,
          change: topMovers[0].change,
          changePct: topMovers[0].changePct,
          signal: "BUY",
          confidence: Math.round(
            Math.min(95, 70 + Math.abs(topMovers[0].changePct || 0)),
          ),
          summary: `${topMovers[0].symbol} is one of today’s strongest rising movers, gaining ${Math.abs(topMovers[0].changePct || 0).toFixed(2)}%.`,
          pattern: topMovers[0].pattern,
        }
      : getTopSignal(signals || []);
  const remainingSignals = (signals || []).filter(
    (s) => s.symbol !== topSignal?.symbol,
  );
  const pulseItems = (topMovers || []).slice(0, 5).map((m) => ({
    id: m.symbol,
    icon: "trending-up-outline",
    title: m.symbol,
    symbol: m.symbol,
    companyName: m.company || m.symbol,
    price: m.price,
    change: m.change,
    changePct: m.changePct,
    value: `$${Number(m.price || 0).toFixed(2)} · +${Math.abs(
      m.changePct || 0,
    ).toFixed(2)}%\n${m.company || "Rising mover"}`,
  }));

  return (
    <View style={styles.container}>
      {/* HEADER */}
      <View style={styles.header}>
        <View style={styles.headerBrandRow}>
          <Image source={LOGO} style={styles.logo} resizeMode="contain" />
          <Text style={styles.titleBrand}>Alphaclara</Text>
        </View>

        <Text style={styles.subtitle}>Market Intelligence</Text>

        <View style={styles.marketPill}>
          <View
            style={[
              styles.marketDot,
              {
                backgroundColor: String(header.marketStatus || "")
                  .toLowerCase()
                  .includes("positive")
                  ? BRAND.accent
                  : String(header.marketStatus || "")
                        .toLowerCase()
                        .includes("negative")
                    ? BRAND.red
                    : BRAND.amber,
              },
            ]}
          />
          <Text style={styles.marketText}>
            {header.marketStatus || "Market"} ·{" "}
            {header.marketMood || "Overview"}
          </Text>
        </View>
      </View>

      {/* TOP ALPHA IDEA */}
      {topSignal && (
        <TouchableOpacity
          style={styles.heroCard}
          activeOpacity={0.88}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            navigation.navigate("StockDetailScreen", {
              symbol: topSignal.symbol,
              name: topSignal.companyName || topSignal.name || topSignal.symbol,
              source: "ui",
            });
          }}
        >
          <View style={styles.heroTopRow}>
            <View style={styles.heroBadge}>
              <Ionicons
                name="trending-up-outline"
                size={15}
                color={BRAND.accent}
              />
              <Text style={styles.heroBadgeText}>Top Alpha Idea</Text>
            </View>

            <Text style={styles.heroConfidence}>
              {Math.round(getConfidence(topSignal))}% confidence
            </Text>
          </View>

          <View style={styles.heroMainRow}>
            <View style={{ flex: 1, paddingRight: 10 }}>
              <View style={styles.heroSymbolRow}>
                <Text style={styles.heroSymbol}>{topSignal.symbol}</Text>
                <MoveLabel
                  changePct={topSignal.changePct}
                  price={topSignal.price}
                  style={styles.heroMoveLabel}
                />
              </View>

              <Text style={styles.heroName} numberOfLines={1}>
                {topSignal.companyName || topSignal.name || topSignal.symbol}
              </Text>
            </View>

            <View style={styles.heroPriceBlock}>
              <Animated.Text
                style={[
                  styles.heroPrice,
                  {
                    backgroundColor: priceFlash[topSignal.symbol]?.interpolate({
                      inputRange: [0, 1],
                      outputRange: [
                        "transparent",
                        (topSignal.changePct || 0) >= 0
                          ? "rgba(0,227,150,0.24)"
                          : "rgba(239,68,68,0.24)",
                      ],
                    }),
                  },
                ]}
              >
                {topSignal.price != null
                  ? `$${topSignal.price.toFixed(2)}`
                  : "--"}
              </Animated.Text>

              <Text
                style={[
                  styles.heroChange,
                  {
                    color:
                      (topSignal.changePct || 0) >= 0
                        ? BRAND.accent
                        : BRAND.red,
                  },
                ]}
              >
                {(topSignal.changePct || 0) >= 0 ? "▲" : "▼"}{" "}
                {Math.abs(topSignal.changePct || 0).toFixed(2)}%
              </Text>
            </View>
          </View>

          <View style={styles.heroSignalRow}>
            <View
              style={[
                styles.signalBadge,
                {
                  backgroundColor:
                    getSignal(topSignal) === "BUY"
                      ? BRAND.accent
                      : getSignal(topSignal) === "SELL"
                        ? BRAND.red
                        : BRAND.amber,
                },
              ]}
            >
              <Text style={styles.signalText}>
                {displayRating(getSignal(topSignal))}
              </Text>
            </View>

            {!!getPatternName(topSignal) && (
              <View style={styles.heroPatternPill}>
                <Text style={styles.heroPatternText} numberOfLines={1}>
                  {formatPatternLabel(
                    getPatternName(topSignal),
                    getPatternWinRate(topSignal),
                  )}
                </Text>
              </View>
            )}
          </View>

          {!!getSummary(topSignal) && (
            <Text style={styles.heroSummary} numberOfLines={2}>
              {getSummary(topSignal)}
            </Text>
          )}

          <Text style={styles.heroCta}>View full analysis →</Text>
        </TouchableOpacity>
      )}

      {/* MARKET PULSE */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.pulseScroll}
        contentContainerStyle={styles.pulseStrip}
      >
        {pulseItems.map((c, i) => (
          <TouchableOpacity
            key={`${c.id || c.title}-${i}`}
            style={styles.pulseChip}
            activeOpacity={0.85}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              navigation.navigate("StockDetailScreen", {
                symbol: c.symbol,
                name: c.companyName || c.symbol,
                source: "home_movers",
              });
            }}
          >
            <View style={styles.pulseChipHeader}>
              <Ionicons name={c.icon} size={13} color={BRAND.accent} />
              <Text style={styles.pulseTitle} numberOfLines={1}>
                {c.title}
              </Text>
            </View>
            <Text style={styles.pulseValue} numberOfLines={2}>
              {c.value}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* MAIN LIST */}
      <ScrollView
        scrollEventThrottle={16}
        keyboardShouldPersistTaps="handled" // ✅ REQUIRED
        refreshControl={
          <RefreshControl
            tintColor={BRAND.accent}
            colors={[BRAND.accent]}
            refreshing={refreshing}
            onRefresh={onRefresh}
          />
        }
        contentContainerStyle={{ paddingBottom: 50 }}
      >
        <View style={styles.listIntroRow}>
          <Ionicons name="pulse-outline" size={12} color={BRAND.muted} />
          <Text style={styles.listHelper}>
            AI-ranked market ideas from Alphaclara’s tracked universe
          </Text>
        </View>
        {remainingSignals.map((item, idx) => {
          const session = getMarketSession(item.lastUpdated);
          const isLive = session === "LIVE";

          const isUp =
            typeof item.changePct === "number" ? item.changePct >= 0 : true;

          const signalColor =
            item.signal === "BUY"
              ? BRAND.accent
              : item.signal === "SELL"
                ? BRAND.red
                : BRAND.amber;

          // ensure animation value exists per symbol
          if (!priceFlash[item.symbol]) {
            priceFlash[item.symbol] = new Animated.Value(0);
          }

          return (
            <TouchableOpacity
              key={item.symbol}
              activeOpacity={0.85}
              delayPressIn={0}
              style={styles.card}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                navigation.navigate("StockDetailScreen", {
                  symbol: item.symbol,
                  name: item.name || item.symbol,
                  source: "ui", // 👈 intent flag
                });
              }}
            >
              <View style={styles.cardHeader}>
                {/* LEFT */}
                <View style={{ flex: 1 }}>
                  <View style={styles.symbolRow}>
                    <Text style={styles.symbol}>{item.symbol}</Text>

                    <MoveLabel
                      changePct={item.changePct}
                      price={item.price}
                      style={styles.moveLabelInline}
                    />
                  </View>

                  <Text style={styles.name}>{item.companyName}</Text>
                </View>

                {/* RIGHT */}
                <View style={{ alignItems: "flex-end" }}>
                  {/* PRICE */}
                  <Animated.Text
                    style={[
                      styles.price,
                      {
                        color: isLive
                          ? isUp
                            ? BRAND.accent
                            : BRAND.red
                          : BRAND.sub,

                        backgroundColor: priceFlash[item.symbol]?.interpolate({
                          inputRange: [0, 1],
                          outputRange: [
                            "transparent",
                            isUp
                              ? "rgba(0,227,150,0.30)"
                              : "rgba(255,69,96,0.30)",
                          ],
                        }),
                        paddingHorizontal: 6,
                        borderRadius: 6,
                      },
                    ]}
                  >
                    {item.price != null ? `$${item.price.toFixed(2)}` : "--"}
                  </Animated.Text>

                  {/* CHANGE + % */}
                  {(() => {
                    const session = getMarketSession(item.lastUpdated);
                    const isLive = session === "LIVE";

                    const change =
                      typeof item.change === "number" ? item.change : null;
                    const pct =
                      typeof item.changePct === "number"
                        ? item.changePct
                        : null;

                    if (change == null || pct == null) {
                      return (
                        <Text style={[styles.changePct, { color: BRAND.sub }]}>
                          -- {session || ""}
                        </Text>
                      );
                    }

                    const isUp = pct >= 0;

                    return (
                      <Text
                        style={[
                          styles.changePct,
                          {
                            color: isLive
                              ? isUp
                                ? BRAND.accent
                                : BRAND.red
                              : BRAND.sub,
                            opacity: isLive ? 1 : 0.75,
                          },
                        ]}
                      >
                        {isUp ? "▲" : "▼"} ${Math.abs(change).toFixed(2)} (
                        {isUp ? "+" : "-"}
                        {Math.abs(pct).toFixed(2)}%) {session}
                      </Text>
                    );
                  })()}
                </View>
              </View>

              <View style={styles.signalRow}>
                <View
                  style={[styles.signalBadge, { backgroundColor: signalColor }]}
                >
                  <Text style={styles.signalText}>
                    {displayRating(item.signal)}
                  </Text>
                </View>

                <Text style={[styles.confInline, { color: signalColor }]}>
                  {item.confidence}% confidence
                </Text>
              </View>

              <View style={styles.cardDivider} />

              <Text style={styles.summary} numberOfLines={4}>
                {item.grokSummary ||
                  (typeof item.summary === "string"
                    ? item.summary
                    : item.summary?.primary)}
              </Text>

              {item.pattern && (
                <View style={styles.patternRow}>
                  <Text style={styles.patternLabel}>Pattern</Text>
                  <Text style={styles.patternValue}>
                    {formatPatternLabel(item.pattern, item.patternWinRate)}
                  </Text>
                </View>
              )}

              <View style={styles.cardFooterRow}>
                <Text style={styles.lastUpdated}>
                  {timeAgo(item.lastUpdated)}
                </Text>
                <Text style={styles.tapHint}>Tap for details</Text>
              </View>
            </TouchableOpacity>
          );
        })}
        <View style={styles.footerWrap}>
          <Text style={styles.footerText}>
            Powered by <Text style={styles.footerBrand}>Alphaclara</Text>
          </Text>

          <Text style={styles.disclaimer}>
            Market data, AI ratings, patterns, and insights are provided for
            informational and educational purposes only and are not financial,
            investment, trading, or tax advice.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

/* === Styles UNCHANGED === */
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BRAND.bg },

  header: {
    paddingTop: 54,
    paddingHorizontal: 14,
    alignItems: "center",
    marginBottom: 8,
  },
  headerBrandRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  logo: { width: 28, height: 28, marginRight: 7 },
  titleBrand: {
    color: BRAND.text,
    fontSize: 28,
    fontFamily: TYPO.fontFamily.brand,
    letterSpacing: -0.9,
  },
  subtitle: {
    color: BRAND.sub,
    fontSize: 12,
    marginTop: 2,
    marginBottom: 1,
    fontFamily: TYPO.fontFamily.medium,
  },
  marketPill: {
    marginTop: 3,
    marginBottom: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: BRAND.card2,
    borderWidth: 1,
    borderColor: BRAND.softBorder,
    borderRadius: 999,
    paddingHorizontal: 11,
    paddingVertical: 5,
  },
  marketDot: { width: 7, height: 7, borderRadius: 999, marginRight: 6 },
  marketText: {
    color: BRAND.sub,
    fontSize: 11.5,
    fontFamily: TYPO.fontFamily.bold,
  },

  heroCard: {
    backgroundColor: BRAND.card,
    borderRadius: 20,
    paddingHorizontal: 13,
    paddingTop: 8,
    paddingBottom: 9,
    marginHorizontal: 10,
    marginBottom: 5,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.09)",
  },
  heroTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 2,
  },
  heroBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: BRAND.card2,
    borderWidth: 1,
    borderColor: BRAND.softBorder,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  heroBadgeText: {
    color: BRAND.text,
    fontSize: 11,
    fontFamily: TYPO.fontFamily.bold,
    textTransform: "uppercase",
    letterSpacing: 0.35,
  },
  heroConfidence: {
    color: BRAND.sub,
    fontSize: 11.5,
    fontFamily: TYPO.fontFamily.bold,
  },
  heroMainRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  heroSymbolRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
  },
  heroSymbol: {
    color: BRAND.text,
    fontSize: 23,
    fontFamily: TYPO.fontFamily.extrabold,
    letterSpacing: -0.3,
  },
  heroMoveLabel: {
    marginLeft: 8,
    fontSize: 11,
    fontFamily: TYPO.fontFamily.semibold,
    fontStyle: "italic",
  },
  heroName: {
    color: BRAND.sub,
    fontSize: 12.5,
    marginTop: 2,
    fontFamily: TYPO.fontFamily.medium,
  },
  heroPriceBlock: { alignItems: "flex-end", minWidth: 96 },
  heroPrice: {
    color: BRAND.text,
    fontSize: 21,
    fontFamily: TYPO.fontFamily.extrabold,
    fontVariant: ["tabular-nums"],
    paddingHorizontal: 6,
    borderRadius: 8,
  },
  heroChange: {
    fontSize: 12,
    marginTop: 2,
    fontFamily: TYPO.fontFamily.bold,
    fontVariant: ["tabular-nums"],
  },
  heroSignalRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 5,
    gap: 8,
  },
  heroPatternPill: {
    flex: 1,
    backgroundColor: BRAND.card2,
    borderWidth: 1,
    borderColor: BRAND.softBorder,
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  heroPatternText: {
    color: BRAND.sub,
    fontSize: 10.5,
    fontFamily: TYPO.fontFamily.semibold,
  },
  heroSummary: {
    color: BRAND.sub,
    fontSize: 12,
    lineHeight: 16,
    marginTop: 5,
    fontFamily: TYPO.fontFamily.medium,
  },
  heroCta: {
    color: BRAND.text,
    fontSize: 11.5,
    marginTop: 2,
    textAlign: "right",
    fontFamily: TYPO.fontFamily.bold,
  },
  pulseScroll: {
    height: 112,
    marginBottom: 6,
  },

  pulseStrip: {
    paddingHorizontal: 10,
    paddingBottom: 10,
  },

  pulseChip: {
    width: 119,
    backgroundColor: BRAND.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    paddingHorizontal: 11,
    paddingTop: 7,
    paddingBottom: 16,
    marginRight: 8,
  },
  pulseChipHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginBottom: 3,
  },

  pulseTitle: {
    color: BRAND.text,
    fontSize: 11,
    fontFamily: TYPO.fontFamily.bold,
    flex: 1,
  },

  pulseValue: {
    color: BRAND.sub,
    fontSize: 10.2,
    lineHeight: 13,
    fontFamily: TYPO.fontFamily.semibold,
    paddingBottom: 2,
  },
  listIntroRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: -3,
    marginBottom: 6,
    gap: 5,
  },
  listHelper: {
    color: BRAND.muted,
    fontSize: 10.5,
    textAlign: "center",
    fontFamily: TYPO.fontFamily.semibold,
  },

  card: {
    backgroundColor: BRAND.card,
    borderRadius: 18,
    padding: 12,
    marginHorizontal: 10,
    marginBottom: 9,
    borderWidth: 1,
    borderColor: BRAND.border,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  symbolRow: { flexDirection: "row", alignItems: "center", flexWrap: "wrap" },
  symbol: {
    color: BRAND.text,
    fontSize: 17,
    fontFamily: TYPO.fontFamily.bold,
  },
  name: {
    color: BRAND.sub,
    fontSize: 12,
    marginTop: 2,
    fontFamily: TYPO.fontFamily.medium,
  },
  moveLabelInline: {
    marginLeft: 7,
    marginTop: 0,
    fontSize: 10.5,
    fontFamily: TYPO.fontFamily.semibold,
    fontStyle: "italic",
    letterSpacing: -0.15,
  },
  price: {
    color: BRAND.text,
    fontSize: 18,
    fontFamily: TYPO.fontFamily.extrabold,
    fontVariant: ["tabular-nums"],
  },
  changePct: {
    fontSize: 12,
    fontFamily: TYPO.fontFamily.semibold,
    fontVariant: ["tabular-nums"],
  },
  signalRow: { flexDirection: "row", alignItems: "center", marginTop: 6 },
  signalBadge: {
    borderRadius: 999,
    paddingVertical: 4,
    paddingHorizontal: 10,
    marginRight: 8,
  },
  signalText: {
    color: "#000",
    fontSize: 11.5,
    fontFamily: TYPO.fontFamily.bold,
  },
  confInline: {
    fontSize: 12,
    fontFamily: TYPO.fontFamily.bold,
  },
  cardDivider: {
    height: 1,
    backgroundColor: BRAND.border,
    marginTop: 5,
    marginBottom: 5,
    opacity: 0.65,
  },
  summary: {
    color: BRAND.sub,
    fontSize: 12.5,
    lineHeight: 17,
    fontFamily: TYPO.fontFamily.medium,
  },
  patternRow: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    marginTop: 5,
    paddingVertical: 4,
    paddingHorizontal: 9,
    borderRadius: 999,
    backgroundColor: BRAND.card2,
    borderWidth: 1,
    borderColor: BRAND.border,
  },
  patternLabel: {
    color: BRAND.muted,
    fontSize: 10,
    marginRight: 6,
    textTransform: "uppercase",
    fontFamily: TYPO.fontFamily.bold,
  },
  patternValue: {
    color: BRAND.sub,
    fontSize: 10.5,
    fontFamily: TYPO.fontFamily.semibold,
  },
  cardFooterRow: {
    marginTop: 4,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  lastUpdated: {
    color: BRAND.muted,
    fontSize: 10.5,
    opacity: 0.85,
    fontFamily: TYPO.fontFamily.semibold,
  },
  tapHint: {
    color: BRAND.muted,
    fontSize: 10.5,
    fontFamily: TYPO.fontFamily.semibold,
  },

  footerWrap: {
    marginTop: 24,
    marginBottom: 30,
    paddingHorizontal: 22,
    alignItems: "center",
  },
  footerText: {
    color: BRAND.sub,
    fontSize: 12,
    marginBottom: 8,
    fontFamily: TYPO.fontFamily.medium,
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
});
