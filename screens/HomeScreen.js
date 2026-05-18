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
import { getHomeScreen, getHomeMovers } from "../services/HomeService";
import { BRAND } from "../constants/theme";
import { TYPO } from "../constants/typography";
import MoveLabel from "../components/MoveLabel";
import {
  displayRating,
  signalColor,
  getAuthoritativeSignal,
} from "../utils/signalUtils";
const LOGO = require("../assets/alpha-transparent.png");

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
const getSignal = (item) => getAuthoritativeSignal(item);

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
          const moversData = await getHomeMovers();
          setTopMovers(moversData.slice(0, 5));
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
        const moversData = await getHomeMovers();
        setTopMovers(moversData.slice(0, 5));
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
      <View style={styles.loadingContainer}>
        <Image
          source={LOGO}
          style={styles.loadingLogoLarge}
          resizeMode="contain"
        />
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
          signal:
            topMovers[0].signal || topMovers[0].authoritativeSignal || "BUY",
          confidence: Math.round(
            Math.min(95, 70 + Math.abs(topMovers[0].changePct || 0)),
          ),
          summary: `${topMovers[0].symbol} is one of today’s strongest rising movers, gaining ${Math.abs(topMovers[0].changePct || 0).toFixed(2)}%.`,
          pattern: topMovers[0].pattern,
        }
      : getTopSignal(signals || []);
  const alphaWatchItems = home?.alphaWatch?.items || [];
  const alphaHero = alphaWatchItems[0] || null;
  const alphaCarousel = alphaWatchItems.slice(1, 5);
  const hasAlphaWatch = alphaWatchItems.length > 0;

  const heroItem = hasAlphaWatch ? alphaHero : topSignal;
  const remainingSignals = (signals || []).filter(
    (s) => s.symbol !== heroItem?.symbol,
  );
  const pulseItems = (topMovers || [])
    .filter((m) => m?.symbol)
    .slice(0, 5)
    .map((m) => {
      const symbol = String(m.symbol || "").toUpperCase();
      const companyName = m.companyName || m.company || m.name || symbol;
      const price = m.price ?? m.quote?.price ?? null;
      const change = m.change ?? m.quote?.change ?? null;
      const changePct = m.changePct ?? m.quote?.changePct ?? null;

      return {
        id: symbol,
        icon: "trending-up-outline",
        title: symbol,
        symbol,
        companyName,
        price,
        change,
        changePct,
        value:
          price != null
            ? `$${Number(price).toFixed(2)} · ${
                changePct != null
                  ? `${changePct >= 0 ? "+" : ""}${Number(changePct).toFixed(2)}%`
                  : "--"
              }\n${companyName}`
            : `${companyName}\nMarket mover`,
      };
    });
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

      {/* AI OPPORTUNITY WATCH / TOP ALPHA IDEA */}
      {heroItem && (
        <TouchableOpacity
          style={styles.heroCard}
          activeOpacity={0.88}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            navigation.navigate("StockDetailScreen", {
              symbol: heroItem.symbol,
              name: heroItem.companyName || heroItem.name || heroItem.symbol,
              source: hasAlphaWatch ? "alpha_watch" : "ui",
              alphaWatchItem: hasAlphaWatch ? heroItem : null,
            });
          }}
        >
          <View style={styles.heroTopRow}>
            <View style={styles.heroBadge}>
              <Ionicons
                name={
                  hasAlphaWatch ? "analytics-outline" : "trending-up-outline"
                }
                size={15}
                color={BRAND.accent}
              />
              <Text style={styles.heroBadgeText}>
                {hasAlphaWatch ? "Top Alpha Opportunity" : "Top Market Mover"}
              </Text>
            </View>

            <Text style={styles.heroConfidence}>
              {hasAlphaWatch
                ? `Score ${Math.round(heroItem.score || 0)}`
                : `${Math.round(getConfidence(heroItem))}% confidence`}
            </Text>
          </View>

          <View style={styles.heroMainRow}>
            <View style={{ flex: 1, paddingRight: 10 }}>
              <View style={styles.heroSymbolRow}>
                <Text style={styles.heroSymbol}>{heroItem.symbol}</Text>
                <MoveLabel
                  changePct={heroItem.changePct}
                  price={heroItem.price}
                  style={styles.heroMoveLabel}
                />
              </View>

              <Text style={styles.heroName} numberOfLines={1}>
                {heroItem.companyName || heroItem.name || heroItem.symbol}
              </Text>
            </View>

            <View style={styles.heroPriceBlock}>
              <Animated.Text
                style={[
                  styles.heroPrice,
                  {
                    backgroundColor: priceFlash[heroItem.symbol]?.interpolate({
                      inputRange: [0, 1],
                      outputRange: [
                        "transparent",
                        (heroItem.changePct || 0) >= 0
                          ? "rgba(0,227,150,0.24)"
                          : "rgba(239,68,68,0.24)",
                      ],
                    }),
                  },
                ]}
              >
                {heroItem.price != null
                  ? `$${heroItem.price.toFixed(2)}`
                  : "--"}
              </Animated.Text>

              <Text
                style={[
                  styles.heroChange,
                  {
                    color:
                      (heroItem.changePct || 0) >= 0 ? BRAND.accent : BRAND.red,
                  },
                ]}
              >
                {(heroItem.changePct || 0) >= 0 ? "▲" : "▼"}{" "}
                {Math.abs(heroItem.changePct || 0).toFixed(2)}%
              </Text>
            </View>
          </View>

          <View style={styles.heroSignalRow}>
            <View
              style={[
                styles.signalBadge,
                {
                  backgroundColor:
                    getSignal(heroItem) === "BUY"
                      ? BRAND.accent
                      : getSignal(heroItem) === "SELL"
                        ? BRAND.red
                        : BRAND.amber,
                },
              ]}
            >
              <Text style={styles.signalText}>
                {displayRating(getSignal(heroItem))}
              </Text>
            </View>
          </View>

          {hasAlphaWatch && heroItem.setupLabel && (
            <Text style={styles.heroSetupLine} numberOfLines={1}>
              {heroItem.setupLabel}
            </Text>
          )}

          {!!(hasAlphaWatch ? heroItem.reason : getSummary(heroItem)) && (
            <Text style={styles.heroSummary} numberOfLines={2}>
              {hasAlphaWatch ? heroItem.reason : getSummary(heroItem)}
            </Text>
          )}

          <Text style={styles.heroCta}>See AI analysis →</Text>
        </TouchableOpacity>
      )}
      {alphaCarousel.length > 0 && (
        <View style={styles.alphaCarouselWrap}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>More Alpha Setups</Text>
            <Text style={styles.sectionMeta}>{alphaCarousel.length} more</Text>
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.alphaCarouselStrip}
          >
            {alphaCarousel.map((item) => (
              <TouchableOpacity
                key={`alpha-${item.symbol}`}
                style={styles.alphaMiniCard}
                activeOpacity={0.86}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  navigation.navigate("StockDetailScreen", {
                    symbol: item.symbol,
                    name: item.companyName || item.symbol,
                    source: "alpha_watch",
                    alphaWatchItem: item,
                  });
                }}
              >
                <View style={styles.alphaMiniTop}>
                  <View style={styles.alphaMiniLeft}>
                    <Text style={styles.alphaRank}>#{item.rank}</Text>

                    <Ionicons
                      name={
                        (item.changePct || 0) >= 0
                          ? "trending-up-outline"
                          : "trending-down-outline"
                      }
                      size={13}
                      color={
                        (item.changePct || 0) >= 0 ? BRAND.accent : BRAND.red
                      }
                    />

                    <Text style={styles.alphaSymbol}>{item.symbol}</Text>
                  </View>

                  <Text style={styles.alphaScore}>
                    Score {Math.round(item.score || 0)}
                  </Text>
                </View>

                <View style={styles.alphaPriceInlineRow}>
                  <Text style={styles.alphaMiniPrice}>
                    {item.price != null
                      ? `$${Number(item.price).toFixed(2)}`
                      : "--"}
                  </Text>

                  <Text
                    style={[
                      styles.alphaMove,
                      {
                        color:
                          (item.changePct || 0) >= 0 ? BRAND.accent : BRAND.red,
                      },
                    ]}
                  >
                    {item.changePct != null
                      ? `${Number(item.changePct) >= 0 ? "+" : ""}${Number(item.changePct).toFixed(2)}%`
                      : "--"}
                  </Text>
                </View>

                <Text style={styles.alphaSetup} numberOfLines={1}>
                  {item.setupLabel}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}
      {/* MARKET MOVERS */}
      {topMovers.length > 0 && (
        <View style={styles.moversWrap}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>Market Movers</Text>
            <Text style={styles.sectionMeta}>Rising now</Text>
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.moversStrip}
          >
            {topMovers.slice(0, 5).map((m, i) => {
              const symbol = String(m.symbol || "").toUpperCase();
              const companyName =
                m.companyName || m.company || m.name || symbol;
              const price = m.price ?? m.quote?.price ?? null;
              const changePct = m.changePct ?? m.quote?.changePct ?? null;

              return (
                <TouchableOpacity
                  key={`mover-${symbol}-${i}`}
                  style={styles.moverCard}
                  activeOpacity={0.85}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    navigation.navigate("StockDetailScreen", {
                      symbol,
                      name: companyName,
                      source: "home_movers",
                    });
                  }}
                >
                  <View style={styles.moverTopRow}>
                    <Ionicons
                      name="trending-up-outline"
                      size={13}
                      color={BRAND.accent}
                    />
                    <Text style={styles.moverSymbol}>{symbol}</Text>
                  </View>

                  <View style={styles.moverPriceRow}>
                    <Text style={styles.moverPrice}>
                      {price != null ? `$${Number(price).toFixed(2)}` : "--"}
                    </Text>

                    <Text
                      style={[
                        styles.moverChange,
                        {
                          color:
                            Number(changePct || 0) >= 0
                              ? BRAND.accent
                              : BRAND.red,
                        },
                      ]}
                    >
                      {changePct != null
                        ? `${Number(changePct) >= 0 ? "+" : ""}${Number(changePct).toFixed(2)}%`
                        : "--"}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      )}
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

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BRAND.bg },

  header: {
    paddingTop: 50,
    paddingHorizontal: 14,
    alignItems: "center",
    marginBottom: 5,
  },
  headerBrandRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  logo: { width: 27, height: 27, marginRight: 7 },
  titleBrand: {
    color: BRAND.text,
    fontSize: 27,
    fontFamily: TYPO.fontFamily.brand,
    letterSpacing: -0.9,
  },
  subtitle: {
    color: BRAND.sub,
    fontSize: 11.5,
    marginTop: 1,
    marginBottom: 1,
    fontFamily: TYPO.fontFamily.medium,
  },
  marketPill: {
    marginTop: 2,
    marginBottom: 0,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: BRAND.card2,
    borderWidth: 1,
    borderColor: BRAND.softBorder,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  marketDot: { width: 7, height: 7, borderRadius: 999, marginRight: 6 },
  marketText: {
    color: BRAND.sub,
    fontSize: 11,
    fontFamily: TYPO.fontFamily.bold,
  },

  heroCard: {
    backgroundColor: BRAND.card,
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingTop: 13,
    paddingBottom: 13,
    marginHorizontal: 10,
    marginBottom: 7,
    borderWidth: 1,
    borderColor: "rgba(0,227,150,0.14)",

    shadowColor: BRAND.accent,
    shadowOpacity: 0.08,
    shadowRadius: 14,
    shadowOffset: {
      width: 0,
      height: 0,
    },
    elevation: 3,
  },

  heroTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 4,
  },
  heroBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(0,227,150,0.08)",
    borderWidth: 1,
    borderColor: "rgba(0,227,150,0.18)",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  heroBadgeText: {
    color: BRAND.text,
    fontSize: 10.5,
    fontFamily: TYPO.fontFamily.bold,
    textTransform: "uppercase",
    letterSpacing: 0.45,
  },
  heroConfidence: {
    color: BRAND.muted,
    fontSize: 10,
    fontFamily: TYPO.fontFamily.semibold,
    marginTop: 2,
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
    fontSize: 24,
    fontFamily: TYPO.fontFamily.extrabold,
    letterSpacing: -0.4,
  },
  heroMoveLabel: {
    marginLeft: 8,
    fontSize: 10.5,
    fontFamily: TYPO.fontFamily.semibold,
    fontStyle: "italic",
  },
  heroName: {
    color: BRAND.sub,
    fontSize: 12,
    marginTop: 1,
    fontFamily: TYPO.fontFamily.medium,
  },
  heroPriceBlock: { alignItems: "flex-end", minWidth: 94 },
  heroPrice: {
    color: BRAND.text,
    fontSize: 21,
    fontFamily: TYPO.fontFamily.extrabold,
    fontVariant: ["tabular-nums"],
    paddingHorizontal: 6,
    borderRadius: 8,
  },
  heroChange: {
    fontSize: 11.5,
    marginTop: 1,
    fontFamily: TYPO.fontFamily.bold,
    fontVariant: ["tabular-nums"],
  },
  heroSignalRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 5,
  },
  heroPatternPill: {
    flex: 1,
    backgroundColor: BRAND.card2,
    borderWidth: 1,
    borderColor: BRAND.softBorder,
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 3,
  },
  heroPatternText: {
    color: BRAND.sub,
    fontSize: 10.3,
    fontFamily: TYPO.fontFamily.semibold,
  },
  heroSummary: {
    color: BRAND.sub,
    fontSize: 11.7,
    lineHeight: 16,
    marginTop: 3,
    fontFamily: TYPO.fontFamily.medium,
  },

  heroCta: {
    color: BRAND.accent,
    fontSize: 11.5,
    marginTop: 5,
    textAlign: "right",
    fontFamily: TYPO.fontFamily.bold,
  },

  alphaCarouselWrap: {
    marginTop: 2,
    marginBottom: 6,
  },
  sectionHeaderRow: {
    marginHorizontal: 12,
    marginBottom: 3,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  sectionTitle: {
    color: BRAND.text,
    fontSize: 12.5,
    fontFamily: TYPO.fontFamily.bold,
  },
  sectionMeta: {
    color: BRAND.muted,
    fontSize: 10,
    fontFamily: TYPO.fontFamily.semibold,
  },
  alphaCarouselStrip: {
    paddingHorizontal: 10,
    paddingBottom: 1,
  },
  alphaMiniCard: {
    width: 190,
    minHeight: 82,
    backgroundColor: "rgba(0,227,150,0.045)",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(0,227,150,0.14)",
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginRight: 8,
  },
  alphaMiniTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 3,
  },
  alphaRank: {
    color: BRAND.accent,
    fontSize: 10,
    fontFamily: TYPO.fontFamily.bold,
  },
  alphaScore: {
    color: BRAND.text,
    fontSize: 9.8,
    fontFamily: TYPO.fontFamily.semibold,
    opacity: 0.9,
  },
  alphaSymbol: {
    color: BRAND.text,
    fontSize: 12.5,
    fontFamily: TYPO.fontFamily.bold,
  },

  alphaMiniPrice: {
    color: BRAND.text,
    fontSize: 15,
    fontFamily: TYPO.fontFamily.extrabold,
    fontVariant: ["tabular-nums"],
  },
  alphaMove: {
    fontSize: 11,
    fontFamily: TYPO.fontFamily.bold,
    fontVariant: ["tabular-nums"],
  },
  alphaSetup: {
    color: BRAND.sub,
    fontSize: 9.8,
    marginTop: 3,
    fontFamily: TYPO.fontFamily.semibold,
  },
  moversWrap: {
    marginTop: 4,
    marginBottom: 4,
  },
  moversStrip: {
    paddingHorizontal: 10,
    paddingBottom: 3,
  },
  moverCard: {
    minHeight: 43,
    backgroundColor: BRAND.card,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    paddingHorizontal: 9,
    paddingVertical: 6,
    marginRight: 8,
  },
  moverTopRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginBottom: 2,
  },
  moverSymbol: {
    color: BRAND.text,
    fontSize: 12.5,
    fontFamily: TYPO.fontFamily.bold,
  },
  moverPrice: {
    color: BRAND.text,
    fontSize: 14,
    fontFamily: TYPO.fontFamily.extrabold,
    fontVariant: ["tabular-nums"],
  },
  moverChange: {
    color: BRAND.accent,
    fontSize: 10.5,
    marginTop: 0,
    fontFamily: TYPO.fontFamily.bold,
    fontVariant: ["tabular-nums"],
  },
  moverCompany: {
    color: BRAND.sub,
    fontSize: 9.5,
    marginTop: 1,
    fontFamily: TYPO.fontFamily.medium,
  },

  listIntroRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 4,
    marginBottom: 6,
    gap: 5,
  },
  listHelper: {
    color: BRAND.muted,
    fontSize: 10.2,
    textAlign: "center",
    fontFamily: TYPO.fontFamily.semibold,
  },

  card: {
    backgroundColor: BRAND.card,
    borderRadius: 17,
    padding: 11,
    marginHorizontal: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.07)",
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  symbolRow: { flexDirection: "row", alignItems: "center", flexWrap: "wrap" },
  symbol: {
    color: BRAND.text,
    fontSize: 16.5,
    fontFamily: TYPO.fontFamily.bold,
  },
  name: {
    color: BRAND.sub,
    fontSize: 11.5,
    marginTop: 1,
    fontFamily: TYPO.fontFamily.medium,
  },
  moveLabelInline: {
    marginLeft: 7,
    marginTop: 0,
    fontSize: 10.2,
    fontFamily: TYPO.fontFamily.semibold,
    fontStyle: "italic",
    letterSpacing: -0.15,
  },
  price: {
    color: BRAND.text,
    fontSize: 17,
    fontFamily: TYPO.fontFamily.extrabold,
    fontVariant: ["tabular-nums"],
  },
  changePct: {
    fontSize: 11.5,
    fontFamily: TYPO.fontFamily.semibold,
    fontVariant: ["tabular-nums"],
  },
  signalRow: { flexDirection: "row", alignItems: "center", marginTop: 5 },
  signalBadge: {
    borderRadius: 999,
    paddingVertical: 3.5,
    paddingHorizontal: 9,
    marginRight: 8,
  },
  signalText: {
    color: "#000",
    fontSize: 11,
    fontFamily: TYPO.fontFamily.bold,
  },
  confInline: {
    fontSize: 11.5,
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
    fontSize: 12,
    lineHeight: 16,
    fontFamily: TYPO.fontFamily.medium,
  },
  patternRow: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    marginTop: 4,
    paddingVertical: 3.5,
    paddingHorizontal: 8,
    borderRadius: 999,
    backgroundColor: BRAND.card2,
    borderWidth: 1,
    borderColor: BRAND.border,
  },
  patternLabel: {
    color: BRAND.muted,
    fontSize: 9.6,
    marginRight: 6,
    textTransform: "uppercase",
    fontFamily: TYPO.fontFamily.bold,
  },
  patternValue: {
    color: BRAND.sub,
    fontSize: 10.2,
    fontFamily: TYPO.fontFamily.semibold,
  },
  cardFooterRow: {
    marginTop: 3,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  lastUpdated: {
    color: BRAND.muted,
    fontSize: 10,
    opacity: 0.85,
    fontFamily: TYPO.fontFamily.semibold,
  },
  tapHint: {
    color: BRAND.muted,
    fontSize: 10,
    fontFamily: TYPO.fontFamily.semibold,
  },

  footerWrap: {
    marginTop: 18,
    marginBottom: 26,
    paddingHorizontal: 22,
    alignItems: "center",
  },
  footerText: {
    color: BRAND.sub,
    fontSize: 12,
    marginBottom: 7,
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
    fontSize: 10.7,
    lineHeight: 15,
    textAlign: "center",
    fontFamily: TYPO.fontFamily.regular,
  },

  alphaPriceInlineRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 2,
  },
  moverPriceRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 2,
  },
  alphaMiniLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    flexShrink: 1,
  },
  heroSetupLine: {
    color: BRAND.text,
    fontSize: 10.8,
    marginTop: 6,
    marginBottom: 1,
    fontFamily: TYPO.fontFamily.semibold,
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: BRAND.bg,
    alignItems: "center",
    justifyContent: "center",
  },

  loadingLogoLarge: {
    width: 100,
    height: 100,
    opacity: 0.96,
  },
});
