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
  Dimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { getHomeScreen } from "../services/HomeService";
import { BRAND } from "../constants/theme";
import { TYPO } from "../constants/typography";
import MoveLabel from "../components/MoveLabel";
const LOGO = require("../assets/alpha-transparent.png");
const SCREEN_WIDTH = Dimensions.get("window").width;
const CAROUSEL_CARD_WIDTH = SCREEN_WIDTH - 40;
const CAROUSEL_GAP = 12;
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

function renderColoredSegments(value, styles, BRAND) {
  if (!value) return null;

  const segments = value.split(" · ");

  return (
    <View style={styles.segmentWrap}>
      {segments.map((seg, idx) => {
        const isUp = seg.includes("▲") || seg.includes("+");
        const isDown = seg.includes("▼") || seg.includes("-");

        return (
          <Text
            key={idx}
            style={[
              styles.segmentText,
              isUp && { color: BRAND.accent },
              isDown && { color: BRAND.red },
            ]}
          >
            {seg}
            {idx < segments.length - 1 ? " · " : ""}
          </Text>
        );
      })}
    </View>
  );
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

export default function HomeScreen({ navigation }) {
  const [home, setHome] = useState(null);
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

      {/* FEATURE CARDS */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.carousel}
        contentContainerStyle={styles.carouselContent}
        snapToInterval={CAROUSEL_CARD_WIDTH + CAROUSEL_GAP}
        decelerationRate="fast"
        snapToAlignment="start"
        disableIntervalMomentum
      >
        {carousel.map((c, i) => (
          <View key={i} style={styles.featureCard}>
            <View style={styles.featureHeader}>
              <Ionicons
                name={c.icon}
                size={18}
                color={BRAND.accent}
                style={{ marginRight: 6 }}
              />
              <Text style={styles.featureTitle} numberOfLines={1}>
                {c.title}
              </Text>
            </View>

            {c.id === "sectors" ? (
              <View style={styles.sectorWrap}>
                {c.value
                  .split(/\s*·\s*|\n/)
                  .filter(Boolean)
                  .map((seg, idx) => {
                    const isUp = seg.includes("▲");
                    const isDown = seg.includes("▼");

                    return (
                      <Text
                        key={idx}
                        style={[
                          styles.sectorText,
                          isUp && { color: BRAND.accent },
                          isDown && { color: BRAND.red },
                        ]}
                      >
                        {seg}
                        {idx <
                        c.value.split(/\s*·\s*|\n/).filter(Boolean).length - 1
                          ? " · "
                          : ""}
                      </Text>
                    );
                  })}
              </View>
            ) : (
              renderColoredSegments(c.value, styles, BRAND)
            )}
          </View>
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
          <Ionicons name="sparkles-outline" size={13} color={BRAND.muted} />
          <Text style={styles.listHelper}>
            AI-ranked market ideas from Alphaclara’s tracked universe
          </Text>
        </View>
        {signals.map((item, idx) => {
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

  logo: {
    width: 28,
    height: 28,
    marginRight: 7,
  },

  titleBrand: {
    color: BRAND.text,
    fontSize: 28,
    fontFamily: TYPO.fontFamily.brand,
    letterSpacing: -0.9,
  },

  subtitle: {
    color: BRAND.sub,
    fontSize: 12,
    marginTop: 4,
    fontFamily: TYPO.fontFamily.medium,
  },

  marketPill: {
    marginTop: 5,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: BRAND.card2,
    borderWidth: 1,
    borderColor: BRAND.softBorder,
    borderRadius: 999,
    paddingHorizontal: 11,
    paddingVertical: 6,
  },

  marketDot: {
    width: 7,
    height: 7,
    borderRadius: 999,
    marginRight: 6,
  },

  marketText: {
    color: BRAND.sub,
    fontSize: 11.5,
    fontFamily: TYPO.fontFamily.bold,
  },

  carousel: {
    marginTop: -2,
    marginBottom: 8,
  },

  carouselContent: {
    paddingLeft: 14,
    paddingRight: 14,
    paddingBottom: 10,
  },

  featureCard: {
    backgroundColor: BRAND.card,
    borderRadius: 16,
    padding: 12,
    width: CAROUSEL_CARD_WIDTH,
    minHeight: 86,
    marginRight: CAROUSEL_GAP,
    borderWidth: 1,
    borderColor: BRAND.border,
    justifyContent: "center",
    marginBottom: 30,
  },

  featureHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 3,
  },

  featureTitle: {
    color: BRAND.text,
    fontSize: 13.5,
    fontFamily: TYPO.fontFamily.extrabold,
  },

  segmentWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
  },

  segmentText: {
    fontSize: 11.5,
    color: BRAND.sub,
    lineHeight: 16,
    fontFamily: TYPO.fontFamily.semibold,
  },

  sectorWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
  },

  sectorText: {
    fontSize: 11.5,
    color: BRAND.sub,
    lineHeight: 16,
    fontFamily: TYPO.fontFamily.semibold,
  },

  listIntroRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
    marginBottom: 8,
    gap: 5,
  },

  listHelper: {
    color: BRAND.muted,
    fontSize: 11,
    textAlign: "center",
    fontFamily: TYPO.fontFamily.semibold,
  },

  card: {
    backgroundColor: BRAND.card,
    borderRadius: 18,
    padding: 12,
    marginHorizontal: 10,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: BRAND.border,
  },

  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },

  symbolRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
  },

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

  signalRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 6,
  },

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
    marginTop: 6,
    marginBottom: 6,
    opacity: 0.65,
  },

  summary: {
    color: BRAND.sub,
    fontSize: 12.5,
    lineHeight: 18,
    fontFamily: TYPO.fontFamily.medium,
  },

  patternRow: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    marginTop: 6,
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
    marginTop: 5,
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
