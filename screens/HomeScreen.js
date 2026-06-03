// screens/HomeScreen.js
import React, { useRef, useState, useEffect } from "react";
import { useFocusEffect } from "@react-navigation/native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { LinearGradient } from "expo-linear-gradient";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Pressable,
  Animated,
  RefreshControl,
  Image,
  Modal,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Svg, {
  Path,
  Circle,
  Defs,
  Stop,
  LinearGradient as SvgLinearGradient,
} from "react-native-svg";
import * as Haptics from "expo-haptics";
import {
  getHomeScreen,
  getHomeMovers,
  getVerifiedAlpha,
} from "../services/HomeService";
import { BRAND } from "../constants/theme";
import { TYPO } from "../constants/typography";
import MoveLabel from "../components/MoveLabel";
import {
  displayRating,
  getAuthoritativeSignal,
  signalColor,
} from "../utils/signalUtils";
const LOGO = require("../assets/alpha-transparent.png");

const getSignal = (item) => getAuthoritativeSignal(item);

const getConfidence = (item) =>
  typeof item?.bullbrain?.confidence === "number"
    ? item.bullbrain.confidence
    : typeof item?.confidence === "number"
      ? item.confidence
      : 0;

const getSummary = (item) =>
  item?.watchlistSummary ||
  item?.grokSummary ||
  (typeof item?.summary === "string" ? item.summary : item?.summary?.primary);

const hasDisplayQuote = (item) =>
  item &&
  item.price != null &&
  item.changePct != null &&
  Number.isFinite(Number(item.price)) &&
  Number.isFinite(Number(item.changePct));

const isPositiveQuote = (item) =>
  hasDisplayQuote(item) && Number(item.changePct) > 0;
function getMarketSession(ts) {
  if (!ts) return null;

  const d = new Date(ts);
  const h = d.getHours();
  const m = d.getMinutes();

  if (h < 9 || (h === 9 && m < 30)) return "PRE";
  if (h >= 16) return "AH";
  return "LIVE";
}
const getItemSession = (item) =>
  getMarketSession(
    item?.quote_updated_at ||
      item?.lastUpdated ||
      item?.updated_at ||
      item?.computed_at,
  );

const getDisplaySession = (item, marketPhase) => {
  if (marketPhase === "OPEN") return "LIVE";
  if (marketPhase === "PREMARKET") return "PRE";
  return "AH";
};

const getDisplaySessionSuffix = (item, marketPhase) => {
  const session = getDisplaySession(item, marketPhase);
  return session ? ` ${session}` : "";
};

const getDisplaySessionColor = (item, marketPhase) => {
  const session = getDisplaySession(item, marketPhase);

  if (session === "LIVE") return BRAND.accent;
  if (session === "PRE") return BRAND.amber;
  return BRAND.sub;
};

const compactSummary = (text, max = 92) => {
  const clean = String(text || "")
    .replace(/\s+/g, " ")
    .trim();

  if (!clean) return "AI-ranked market intelligence opportunity.";
  if (clean.length <= max) return clean;

  return `${clean.slice(0, max).trim()}…`;
};

const getDisplayPriceSessionStyle = (item, marketPhase) => {
  const isLive = getDisplaySession(item, marketPhase) === "LIVE";

  return {
    color: isLive ? PREMIUM.textSoft : BRAND.sub,
    opacity: isLive ? 1 : 0.78,
  };
};

const getDisplayMoveSessionStyle = (item, marketPhase, isUp) => {
  const isLive = getDisplaySession(item, marketPhase) === "LIVE";

  return {
    color: isLive ? (isUp ? BRAND.accent : BRAND.red) : BRAND.sub,
    opacity: isLive ? 1 : 0.78,
  };
};

const getPriceSessionStyle = (item, marketPhase) => {
  const isLive = getDisplaySession(item, marketPhase) === "LIVE";

  return {
    color: isLive ? PREMIUM.textSoft : BRAND.sub,
    opacity: isLive ? 1 : 0.78,
  };
};
const getMoveSessionStyle = (item, marketPhase, isUp) => {
  const isLive = getDisplaySession(item, marketPhase) === "LIVE";

  return {
    color: isLive ? (isUp ? BRAND.accent : BRAND.red) : BRAND.sub,
    opacity: isLive ? 1 : 0.78,
  };
};
const getShortAlphaReason = (item) => {
  if (item?.primaryCatalystFirst) return item.primaryCatalystFirst;

  const text = String(item?.reason || item?.summary || "").trim();
  if (!text) return "Market momentum";

  return text
    .replace(`${item.symbol} gaining traction as`, "")
    .replace(`${item.symbol} pulling back as`, "")
    .replace("on continued AI momentum:", "")
    .replace("following analyst upgrade on", "")
    .trim();
};

function HeroMiniChart({ changePct = 0 }) {
  const isUp = Number(changePct || 0) >= 0;
  const stroke = isUp ? BRAND.accent : BRAND.red;
  const gradientId = isUp ? "heroGradUp" : "heroGradDown";

  const linePath = isUp
    ? "M4 54 L15 45 L24 47 L34 34 L45 37 L56 25 L67 29 L80 16 L94 18 L108 8 L114 6"
    : "M4 8 L16 18 L28 15 L40 29 L52 25 L65 38 L78 34 L92 46 L106 43 L116 52";

  const areaPath = isUp
    ? `${linePath} L116 56 L4 56 Z`
    : `${linePath} L116 56 L4 56 Z`;

  const endX = isUp ? 114 : 116;
  const endY = isUp ? 6 : 52;

  return (
    <View style={styles.heroChartWrap}>
      <Svg
        width="90"
        height="40"
        viewBox="0 0 122 60"
        style={{ marginTop: -10 }}
      >
        <Defs>
          <SvgLinearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0%" stopColor={stroke} stopOpacity="0.13" />
            <Stop offset="55%" stopColor={stroke} stopOpacity="0.035" />
            <Stop offset="100%" stopColor={stroke} stopOpacity="0" />
          </SvgLinearGradient>
        </Defs>

        <Path d={areaPath} fill={`url(#${gradientId})`} />

        <Path
          d={linePath}
          fill="none"
          stroke={stroke}
          strokeWidth="14"
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity={0.07}
        />

        <Path
          d={linePath}
          fill="none"
          stroke={stroke}
          strokeWidth="8"
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity={0.1}
        />

        <Path
          d={linePath}
          fill="none"
          stroke={stroke}
          strokeWidth="3.6"
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity={0.76}
        />

        <Path
          d={linePath}
          fill="none"
          stroke="#FFFFFF"
          strokeWidth="1.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity={0.28}
        />

        <Circle cx={endX} cy={endY} r="14" fill={stroke} opacity={0.12} />
        <Circle cx={endX} cy={endY} r="8" fill={stroke} opacity={0.22} />
        <Circle cx={endX} cy={endY} r="4.8" fill={stroke} />
      </Svg>
    </View>
  );
}
export default function HomeScreen({ navigation }) {
  const scrollRef = useRef(null);

  const [home, setHome] = useState(null);
  const [topMovers, setTopMovers] = useState([]);
  const [verifiedAlpha, setVerifiedAlpha] = useState(null);
  // 🔥 price flash animation per symbol
  const priceFlash = useRef({}).current;

  const REFRESH_INTERVAL_MS = 5000;
  const [refreshing, setRefreshing] = useState(false);
  const [showGuide, setShowGuide] = useState(false);
  const [guideStep, setGuideStep] = useState(0);

  const screenFade = useRef(new Animated.Value(0)).current;

  const heroScale = useRef(new Animated.Value(1)).current;
  const loadingPulse = useRef(new Animated.Value(0.35)).current;
  const marketPulse = useRef(new Animated.Value(0.7)).current;

  const flashPricesForItems = (items = []) => {
    items.forEach((it) => {
      const symbol = String(it?.symbol || "").toUpperCase();
      const price = Number(it?.price ?? it?.quote?.price);

      if (!symbol || !Number.isFinite(price)) return;

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

        let moversData = [];
        let verifiedData = null;

        setHome(data);

        try {
          moversData = await getHomeMovers();
          setTopMovers(moversData.slice(0, 5));
        } catch {
          setTopMovers([]);
        }

        try {
          verifiedData = await getVerifiedAlpha();
          setVerifiedAlpha(verifiedData);
        } catch {
          setVerifiedAlpha(null);
        }

        flashPricesForItems([
          ...(data.signals || []),
          ...(moversData || []),
          ...(verifiedData?.opportunities || []),
        ]);
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
  useEffect(() => {
    const checkGuide = async () => {
      try {
        const seen = await AsyncStorage.getItem("homeGuideSeen");

        if (!seen) {
          setTimeout(() => {
            setShowGuide(true);
          }, 1200);
        }
      } catch {}
    };

    checkGuide();
  }, []);
  useEffect(() => {
    if (home) {
      Animated.timing(screenFade, {
        toValue: 1,
        duration: 450,
        useNativeDriver: true,
      }).start();
    }
  }, [home]);
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(loadingPulse, {
          toValue: 1,
          duration: 850,
          useNativeDriver: true,
        }),
        Animated.timing(loadingPulse, {
          toValue: 0.35,
          duration: 850,
          useNativeDriver: true,
        }),
      ]),
    ).start();
  }, []);
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(marketPulse, {
          toValue: 1,
          duration: 900,
          useNativeDriver: true,
        }),
        Animated.timing(marketPulse, {
          toValue: 0.55,
          duration: 900,
          useNativeDriver: true,
        }),
      ]),
    ).start();
  }, []);
  /* ---------------------------------------------------------
Pull To Refresh
--------------------------------------------------------- */
  const onRefresh = async () => {
    if (refreshing) return;

    setRefreshing(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    const data = await getHomeScreen();

    if (data) {
      let moversData = [];
      let verifiedData = null;

      setHome(data);

      try {
        moversData = await getHomeMovers();
        setTopMovers(moversData.slice(0, 5));
      } catch {
        setTopMovers([]);
      }

      try {
        verifiedData = await getVerifiedAlpha();
        setVerifiedAlpha(verifiedData);
      } catch {
        setVerifiedAlpha(null);
      }

      flashPricesForItems([
        ...(data.signals || []),
        ...(moversData || []),
        ...(verifiedData?.opportunities || []),
      ]);
    }

    setRefreshing(false);
  };

  if (!home) {
    return (
      <View style={styles.loadingContainer}>
        <Animated.Image
          source={LOGO}
          style={[
            styles.loadingLogoLarge,
            {
              opacity: loadingPulse,
              transform: [
                {
                  scale: loadingPulse.interpolate({
                    inputRange: [0.35, 1],
                    outputRange: [0.94, 1.04],
                  }),
                },
              ],
            },
          ]}
          resizeMode="contain"
        />
      </View>
    );
  }

  const { header, signals } = home;
  const marketPhase = getMarketPhaseET();

  const hasAISetups = (verifiedAlpha?.opportunities || []).length > 0;

  const marketStatusLabel =
    marketPhase === "PREMARKET"
      ? "Premarket"
      : marketPhase === "OPEN"
        ? "Market Open"
        : "Market Closed";

  const marketMoodLabel =
    marketPhase === "PREMARKET"
      ? `${verifiedAlpha?.opportunities?.length || 0} AI Setups`
      : header.marketMood || "Overview";

  const alphaWatchItems = home?.alphaWatch?.items || [];

  const verifiedOpportunities = verifiedAlpha?.opportunities || [];

  const verifiedPositiveAlpha = verifiedOpportunities.filter(isPositiveQuote);
  const internalPositiveAlpha = alphaWatchItems.filter(isPositiveQuote);
  const signalPositiveAlpha = (signals || [])
    .filter(isPositiveQuote)
    .map((item) => ({
      ...item,
      setupLabel: item.setupLabel || "AI-ranked market setup",
      reason:
        getSummary(item) || "Supported by Alphaclara market intelligence.",
      score: item.score || item.confidence || getConfidence(item) || 0,
    }));

  const getPureAlphaScore = (item) =>
    Number(
      item?.score ??
        item?.confidence ??
        item?.bullbrain?.confidence ??
        item?.opportunityScore ??
        0,
    );

  const getOpportunityScore = (item) =>
    Number(
      item?.opportunityScore ??
        item?.score ??
        item?.confidence ??
        item?.bullbrain?.confidence ??
        0,
    );

  const combinedPositiveAlpha = [
    ...verifiedPositiveAlpha,
    ...internalPositiveAlpha,
    ...signalPositiveAlpha,
  ];

  const seenAlphaSymbols = new Set();

  const rankedPositiveAlpha = combinedPositiveAlpha
    .filter((item) => {
      const symbol = String(item.symbol || "").toUpperCase();
      if (!symbol || seenAlphaSymbols.has(symbol)) return false;
      seenAlphaSymbols.add(symbol);
      return true;
    })
    .sort((a, b) => getPureAlphaScore(b) - getPureAlphaScore(a));

  const heroItem = rankedPositiveAlpha[0] || null;

  const primaryAlphaCards = rankedPositiveAlpha.filter(
    (item) => item.symbol !== heroItem?.symbol,
  );

  const alphaCarousel = primaryAlphaCards
    .sort((a, b) => getOpportunityScore(b) - getOpportunityScore(a))
    .slice(0, 5)
    .map((item, index) => ({
      ...item,
      rank: index + 2,
      score: getOpportunityScore(item),
    }));

  const apiMovers = topMovers.filter(hasDisplayQuote);

  const internalMovers = (signals || [])
    .filter(hasDisplayQuote)
    .filter(
      (item) =>
        Math.abs(Number(item.changePct || 0)) >= 2.5 &&
        !apiMovers.some(
          (m) =>
            String(m.symbol || "").toUpperCase() ===
            String(item.symbol || "").toUpperCase(),
        ),
    )
    .sort(
      (a, b) =>
        Math.abs(Number(b.changePct || 0)) - Math.abs(Number(a.changePct || 0)),
    );

  const displayMovers =
    apiMovers.length > 0 ? apiMovers.slice(0, 5) : internalMovers.slice(0, 5);
  const usedHomeSymbols = new Set(
    [
      heroItem?.symbol,
      ...alphaCarousel.map((x) => x.symbol),
      ...displayMovers.map((x) => x.symbol),
    ].filter(Boolean),
  );

  const coreSignalCards = (signals || [])
    .filter(hasDisplayQuote)
    .filter((item) => !usedHomeSymbols.has(item.symbol))
    .slice(0, 7);

  const hasVerifiedHero =
    heroItem && verifiedPositiveAlpha.some((x) => x.symbol === heroItem.symbol);

  const heroWhyNow =
    heroItem?.reason ||
    heroItem?.whyNow?.[0] ||
    getSummary(heroItem) ||
    "AI-ranked opportunity with strong market context.";
  const rawHeroCatalysts =
    heroItem?.primaryCatalysts ||
    heroItem?.primary_catalysts ||
    heroItem?.catalysts ||
    heroItem?.primaryCatalyst ||
    null;

  const heroCatalystText = Array.isArray(rawHeroCatalysts)
    ? rawHeroCatalysts.join(" • ")
    : typeof rawHeroCatalysts === "string"
      ? rawHeroCatalysts.replace(/,/g, " • ")
      : "";

  const shouldShowHeroCatalysts =
    hasVerifiedHero && heroCatalystText.trim().length > 0;

  const GUIDE_STEPS = [
    {
      icon: "compass-outline",
      title: "Welcome to Alphaclara",
      text: "AI-powered market intelligence designed to surface clearer opportunities, faster.",
    },
    {
      icon: "analytics-outline",
      title: "Top Alpha Opportunity",
      text: "Our strongest AI-ranked opportunity right now.",
    },
    {
      icon: "swap-horizontal-outline",
      title: "Setups & Movers",
      text: "Swipe through AI Alpha Setups and today’s fastest moving stocks without digging through noise.",
    },
    {
      icon: "pulse-outline",
      title: "AI Ranked Ideas",
      text: "Explore stocks ranked by Alphaclara’s intelligence engine with signal, confidence, and reasoning.",
    },
    {
      icon: "rocket-outline",
      title: "You’re Ready",
      text: "Tap any card to open full AI analysis, charts, patterns, and market insight.",
    },
  ];
  function getMarketPhaseET() {
    const now = new Date();

    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: "America/New_York",
      hour: "numeric",
      minute: "numeric",
      hour12: false,
      weekday: "short",
    }).formatToParts(now);

    const hour = Number(parts.find((p) => p.type === "hour")?.value || 0);
    const minute = Number(parts.find((p) => p.type === "minute")?.value || 0);
    const weekday = parts.find((p) => p.type === "weekday")?.value;

    const isWeekend = weekday === "Sat" || weekday === "Sun";
    const totalMinutes = hour * 60 + minute;

    if (isWeekend) return "CLOSED";
    if (totalMinutes < 9 * 60 + 30) return "PREMARKET";
    if (totalMinutes >= 16 * 60) return "CLOSED";

    return "OPEN";
  }

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

  const completeGuide = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    // close immediately
    setShowGuide(false);
    setGuideStep(0);

    // save after UI closes
    AsyncStorage.setItem("homeGuideSeen", "true").catch(() => {});
  };

  const handleGuideNext = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    if (guideStep >= GUIDE_STEPS.length - 1) {
      await completeGuide();
    } else {
      setGuideStep((p) => p + 1);
    }
  };

  return (
    <Animated.View style={[styles.container, { opacity: screenFade }]}>
      <LinearGradient
        pointerEvents="none"
        colors={[
          "rgba(255,255,255,0.024)",
          "rgba(255,255,255,0.010)",
          "rgba(0,0,0,0)",
        ]}
        start={{ x: 0.1, y: 0 }}
        end={{ x: 1, y: 0.8 }}
        style={styles.screenAtmosphere}
      />
      {/* HEADER */}
      <View style={styles.header}>
        <View style={styles.headerBrandRow}>
          <Image source={LOGO} style={styles.logo} resizeMode="contain" />
          <Text style={styles.titleBrand}>Alphaclara</Text>
        </View>

        <Text style={styles.subtitle}>Market Intelligence</Text>

        <TouchableOpacity
          activeOpacity={0.85}
          style={styles.marketPill}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            setGuideStep(0);
            setShowGuide(true);
          }}
        >
          <Animated.View
            style={[
              styles.marketDot,
              {
                opacity: marketPulse,
                transform: [
                  {
                    scale: marketPulse.interpolate({
                      inputRange: [0.55, 1],
                      outputRange: [0.92, 1.08],
                    }),
                  },
                ],
              },
              {
                backgroundColor:
                  hasAISetups && marketPhase === "PREMARKET"
                    ? BRAND.amber
                    : String(header.marketStatus || "")
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
            {marketMoodLabel
              ? `${marketStatusLabel} · ${marketMoodLabel}`
              : marketStatusLabel}
          </Text>

          <Text style={styles.marketGuideHint}>Guide</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
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
        {/* AI OPPORTUNITY WATCH / TOP ALPHA IDEA */}
        {heroItem && (
          <View style={styles.heroWrap}>
            <Animated.View style={{ transform: [{ scale: heroScale }] }}>
              <TouchableOpacity
                style={styles.heroCard}
                activeOpacity={0.92}
                onPressIn={() => {
                  Animated.spring(heroScale, {
                    toValue: 0.985,
                    useNativeDriver: true,
                  }).start();
                }}
                onPressOut={() => {
                  Animated.spring(heroScale, {
                    toValue: 1,
                    friction: 7,
                    tension: 55,
                    useNativeDriver: true,
                  }).start();
                }}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  navigation.navigate("StockDetailScreen", {
                    symbol: heroItem.symbol,
                    name:
                      heroItem.companyName || heroItem.name || heroItem.symbol,
                    source: "ui",
                    alphaWatchItem: heroItem,
                  });
                }}
              >
                <LinearGradient
                  colors={[
                    "rgba(0,227,150,0.08)",
                    "rgba(0,227,150,0.02)",
                    "rgba(0,0,0,0)",
                  ]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.heroGraphAtmosphere}
                />
                <View style={styles.heroTopRow}>
                  <View style={styles.heroBadge}>
                    <Ionicons
                      name="shield-checkmark"
                      size={14}
                      color={BRAND.sub}
                    />
                    <Text style={styles.heroBadgeText}>
                      {hasVerifiedHero
                        ? "Verified Alpha Opportunity"
                        : "Top Alpha Opportunity"}
                    </Text>
                  </View>

                  <Text style={styles.heroConfidence}>
                    Score{" "}
                    {Math.round(
                      heroItem.score || heroItem.opportunityScore || 0,
                    )}
                  </Text>
                </View>

                <View style={styles.heroMainRow}>
                  <View style={styles.heroLeftBlock}>
                    <View style={styles.heroSymbolRow}>
                      {heroItem.logoUrl && (
                        <Image
                          source={{ uri: heroItem.logoUrl }}
                          style={styles.heroTickerLogo}
                          resizeMode="contain"
                        />
                      )}
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

                    <View style={styles.heroSignalRow}>
                      <View
                        style={[
                          styles.signalBadge,
                          {
                            backgroundColor: signalColor(getSignal(heroItem)),
                          },
                        ]}
                      >
                        <Text style={styles.signalText}>
                          {displayRating(getSignal(heroItem))}
                        </Text>
                      </View>

                      <View style={styles.heroSignalGraphWrap}>
                        <HeroMiniChart changePct={heroItem.changePct} />
                      </View>
                    </View>
                  </View>

                  <View style={styles.heroPriceBlock}>
                    <Animated.Text
                      style={[
                        styles.heroPrice,
                        getPriceSessionStyle(heroItem, marketPhase),
                        {
                          backgroundColor: getPriceFlashBg(
                            heroItem.symbol,
                            heroItem.changePct,
                          ),
                          paddingHorizontal: 6,
                          borderRadius: 8,
                        },
                      ]}
                    >
                      {heroItem.price != null
                        ? `$${Number(heroItem.price).toFixed(2)}`
                        : "--"}
                    </Animated.Text>

                    <Text
                      style={[
                        styles.heroChange,
                        {
                          color:
                            Number(heroItem.changePct || 0) >= 0
                              ? BRAND.accent
                              : BRAND.red,
                        },
                      ]}
                    >
                      {Number(heroItem.changePct || 0) >= 0 ? "▲" : "▼"}{" "}
                      {Math.abs(Number(heroItem.changePct || 0)).toFixed(2)}%
                      {getDisplaySessionSuffix(heroItem, marketPhase)}
                    </Text>
                  </View>
                </View>

                {shouldShowHeroCatalysts ? (
                  <View style={styles.heroCatalystWrap}>
                    <Text style={styles.heroCatalystText} numberOfLines={1}>
                      <Text style={styles.heroCatalystInlineLabel}>
                        Catalysts:
                      </Text>{" "}
                      {heroCatalystText}
                    </Text>
                  </View>
                ) : (
                  <View style={styles.heroWhyRow}>
                    <Ionicons
                      name="sparkles-outline"
                      size={14}
                      color={BRAND.sub}
                    />

                    <Text style={styles.heroWhyLabel}>WHY NOW</Text>

                    <Text style={styles.heroWhyText} numberOfLines={3}>
                      {heroWhyNow}
                    </Text>
                  </View>
                )}

                <View style={styles.heroFooterRow}>
                  <View style={styles.heroVerifiedRow}>
                    <Ionicons
                      name="shield-checkmark-outline"
                      size={14}
                      color={BRAND.sub}
                    />
                    <Text style={styles.heroVerifiedText}>
                      Verified by Alphaclara AI
                    </Text>
                  </View>

                  <Text style={styles.heroCta}>See AI analysis →</Text>
                </View>
              </TouchableOpacity>
            </Animated.View>
          </View>
        )}

        {/* AI SETUPS ROW */}
        {alphaCarousel.length > 0 && (
          <View style={styles.homeSectionWrap}>
            <View style={styles.homeSectionHeader}>
              <View>
                <Text style={styles.sectionTitle}>AI Setups</Text>
                <Text style={styles.sectionSubtitle}>
                  Verified alpha opportunities ranked by market intelligence
                </Text>
              </View>
              <TouchableOpacity
                activeOpacity={0.75}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  navigation.navigate("MomentumMovers");
                }}
              ></TouchableOpacity>
            </View>

            <ScrollView
              ref={scrollRef}
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.alphaCarouselStrip}
            >
              {alphaCarousel.map((item, index) => {
                return (
                  <TouchableOpacity
                    key={`alpha-${item.symbol}-${item.rank || index}`}
                    style={styles.alphaMiniCard}
                    activeOpacity={0.92}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      navigation.navigate("StockDetailScreen", {
                        symbol: item.symbol,
                        name: item.companyName || item.symbol,
                        source: "ui",
                        alphaWatchItem: item,
                      });
                    }}
                  >
                    <View
                      pointerEvents="none"
                      style={styles.alphaAmbientGlow}
                    />
                    <View style={styles.alphaMiniTop}>
                      <View style={styles.alphaMiniLeft}>
                        <Text style={styles.alphaRank}>#{item.rank}</Text>

                        {item.logoUrl && (
                          <Image
                            source={{ uri: item.logoUrl }}
                            style={styles.alphaTickerLogo}
                            resizeMode="contain"
                          />
                        )}

                        <Text style={styles.alphaSymbol} numberOfLines={1}>
                          {item.symbol}
                        </Text>

                        <Ionicons
                          name={
                            (item.changePct || 0) >= 0
                              ? "trending-up-outline"
                              : "trending-down-outline"
                          }
                          size={13}
                          color={
                            (item.changePct || 0) >= 0
                              ? BRAND.accent
                              : BRAND.red
                          }
                        />
                      </View>

                      <Text style={styles.alphaScore} numberOfLines={1}>
                        {" "}
                        {Math.round(item.opportunityScore || item.score || 0)}
                      </Text>
                    </View>

                    <View style={styles.alphaPriceInline}>
                      <Animated.Text
                        style={[
                          styles.alphaMiniPrice,
                          getPriceSessionStyle(item, marketPhase),
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
                        {item.price != null
                          ? `$${Number(item.price).toFixed(2)}`
                          : "--"}
                      </Animated.Text>

                      <Text
                        style={[
                          styles.alphaMove,
                          getMoveSessionStyle(
                            item,
                            marketPhase,
                            Number(item.changePct || 0) >= 0,
                          ),
                        ]}
                      >
                        {item.changePct != null
                          ? `${Number(item.changePct) >= 0 ? "+" : ""}${Number(item.changePct).toFixed(2)}%${getDisplaySessionSuffix(item, marketPhase)}`
                          : "--"}
                      </Text>
                    </View>

                    <View style={styles.alphaMetaRow}>
                      <Text style={styles.alphaReason} numberOfLines={3}>
                        {getShortAlphaReason(item)}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        )}

        {/* MOVERS ROW */}
        {displayMovers.length > 0 && (
          <View style={styles.homeSectionWrap}>
            <View style={styles.homeSectionHeader}>
              <View>
                <Text style={styles.sectionTitle}>Market Movers</Text>
                <Text style={styles.sectionSubtitle}>
                  Fast-moving stocks verified by Alphaclara
                </Text>
              </View>

              <TouchableOpacity
                activeOpacity={0.75}
                onPress={() => navigation.navigate("MarketMoversScreen")}
              >
                <Text style={styles.sectionMeta}>More ›</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.moversPremiumCard}>
              {displayMovers.slice(0, 5).map((m, i) => {
                const symbol = String(m.symbol || "").toUpperCase();
                const companyName =
                  m.companyName || m.company || m.name || symbol;
                const price = m.price ?? m.quote?.price ?? null;
                const changePct = m.changePct ?? m.quote?.changePct ?? null;
                const isUp = Number(changePct || 0) >= 0;

                return (
                  <TouchableOpacity
                    key={`premium-mover-${symbol}-${i}`}
                    activeOpacity={0.78}
                    style={[
                      styles.moverPremiumRow,
                      i !== displayMovers.slice(0, 5).length - 1 &&
                        styles.moverPremiumDivider,
                    ]}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      navigation.navigate("StockDetailScreen", {
                        symbol,
                        name: companyName,
                        source: "ui",
                      });
                    }}
                  >
                    <View style={styles.moverSymbolCircle}>
                      {m.logoUrl ? (
                        <Image
                          source={{ uri: m.logoUrl }}
                          style={styles.tickerLogoImage}
                          resizeMode="contain"
                        />
                      ) : (
                        <Text style={styles.moverSymbolCircleText}>
                          {symbol.slice(0, 4)}
                        </Text>
                      )}
                    </View>

                    <View style={styles.moverPremiumMiddle}>
                      <View style={styles.moverPremiumTitleRow}>
                        <Text style={styles.moverPremiumSymbol}>{symbol}</Text>

                        <View style={styles.moverPremiumTrendBadge}>
                          <Ionicons
                            name={
                              isUp
                                ? "trending-up-outline"
                                : "trending-down-outline"
                            }
                            size={12}
                            color={isUp ? BRAND.accent : BRAND.red}
                          />
                          <Text
                            style={[
                              styles.moverPremiumTrendText,
                              { color: isUp ? BRAND.accent : BRAND.red },
                            ]}
                            numberOfLines={1}
                          >
                            {isUp ? "Exploding" : "Pulling back"}
                          </Text>
                        </View>
                      </View>

                      <Text style={styles.moverPremiumReason} numberOfLines={2}>
                        {compactSummary(
                          m.primaryCatalystFirst ||
                            m.reason ||
                            m.oneLiner ||
                            "Market momentum",
                          72,
                        )}
                      </Text>
                    </View>

                    <View style={styles.moverPremiumRight}>
                      <Animated.Text
                        style={[
                          styles.moverPremiumPrice,
                          getDisplayPriceSessionStyle(m, marketPhase),
                          {
                            backgroundColor: getPriceFlashBg(symbol, changePct),
                            paddingHorizontal: 5,
                            borderRadius: 7,
                          },
                        ]}
                      >
                        {price != null ? `$${Number(price).toFixed(2)}` : "--"}
                      </Animated.Text>

                      <Text
                        style={[
                          styles.moverPremiumMove,
                          getDisplayMoveSessionStyle(m, marketPhase, isUp),
                        ]}
                      >
                        {changePct != null
                          ? `${Number(changePct) >= 0 ? "▲ " : "▼ "}${Math.abs(
                              Number(changePct),
                            ).toFixed(2)}%`
                          : "--"}
                      </Text>
                      <View style={styles.homeSessionRow}>
                        <Animated.View
                          style={[
                            styles.homeSessionDot,
                            {
                              backgroundColor: getDisplaySessionColor(
                                m,
                                marketPhase,
                              ),
                              opacity:
                                getDisplaySession(m, marketPhase) === "LIVE"
                                  ? marketPulse
                                  : 0.75,
                              transform: [
                                {
                                  scale:
                                    getDisplaySession(m, marketPhase) === "LIVE"
                                      ? marketPulse.interpolate({
                                          inputRange: [0.55, 1],
                                          outputRange: [0.92, 1.12],
                                        })
                                      : 1,
                                },
                              ],
                            },
                          ]}
                        />
                        <Text style={styles.homeSessionText}>
                          {getDisplaySession(m, marketPhase)}
                        </Text>
                      </View>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
            <LinearGradient
              pointerEvents="none"
              colors={[
                "rgba(0,227,150,0.075)",
                "rgba(0,227,150,0.018)",
                "rgba(0,0,0,0)",
              ]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.sectionGlow}
            />
          </View>
        )}

        {/* CORE SIGNALS */}
        {coreSignalCards.length > 0 && (
          <View style={styles.homeSectionWrap}>
            <View style={styles.homeSectionHeader}>
              <View>
                <Text style={styles.sectionEyebrow}>ALPHACLARA AI</Text>
                <Text style={styles.sectionTitle}>Core Signals</Text>
                <Text style={styles.sectionSubtitle}>
                  Additional AI-ranked names with signal, confidence, and market
                  context
                </Text>
              </View>
            </View>

            <View style={styles.corePremiumShell}>
              {coreSignalCards.map((item, index) => {
                const isUp = Number(item.changePct || 0) >= 0;
                const signal = getSignal(item);
                const ratingColor = signalColor(signal);

                return (
                  <TouchableOpacity
                    key={`core-${item.symbol}`}
                    activeOpacity={0.78}
                    style={[
                      styles.corePremiumRow,
                      index !== coreSignalCards.length - 1 &&
                        styles.corePremiumDivider,
                    ]}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      navigation.navigate("StockDetailScreen", {
                        symbol: item.symbol,
                        name: item.companyName || item.symbol,
                        source: "ui",
                      });
                    }}
                  >
                    <View style={styles.coreLogoCircle}>
                      {item.logoUrl ? (
                        <Image
                          source={{ uri: item.logoUrl }}
                          style={styles.tickerLogoImage}
                          resizeMode="contain"
                        />
                      ) : (
                        <Text style={styles.coreLogoText}>
                          {String(item.symbol || "").slice(0, 4)}
                        </Text>
                      )}
                    </View>

                    <View style={styles.corePremiumBody}>
                      <View style={styles.corePremiumTopLine}>
                        <Text style={styles.corePremiumSymbol}>
                          {item.symbol}
                        </Text>

                        <View
                          style={[
                            styles.coreSignalMiniBadge,
                            { backgroundColor: ratingColor },
                          ]}
                        >
                          <Text style={styles.coreSignalMiniText}>
                            {displayRating(signal)}
                          </Text>
                        </View>

                        <Text style={styles.corePremiumConfidence}>
                          {Math.round(getConfidence(item))}%
                        </Text>
                      </View>

                      <Text style={styles.corePremiumCompany} numberOfLines={1}>
                        {item.companyName || item.symbol}
                      </Text>

                      <Text style={styles.corePremiumSummary} numberOfLines={2}>
                        {compactSummary(getSummary(item), 88)}
                      </Text>
                    </View>

                    <View style={styles.corePremiumRight}>
                      <Animated.Text
                        style={[
                          styles.corePremiumPrice,
                          getPriceSessionStyle(item, marketPhase),
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
                        {item.price != null
                          ? `$${Number(item.price).toFixed(2)}`
                          : "--"}
                      </Animated.Text>

                      <Text
                        style={[
                          styles.corePremiumMove,
                          getMoveSessionStyle(item, marketPhase, isUp),
                        ]}
                      >
                        {item.changePct != null
                          ? `${Number(item.changePct) >= 0 ? "+" : ""}${Number(
                              item.changePct,
                            ).toFixed(2)}%`
                          : "--"}
                      </Text>
                      <View style={styles.homeSessionRow}>
                        <Animated.View
                          style={[
                            styles.homeSessionDot,
                            {
                              backgroundColor: getDisplaySessionColor(
                                item,
                                marketPhase,
                              ),
                              opacity:
                                getDisplaySession(item, marketPhase) === "LIVE"
                                  ? marketPulse
                                  : 0.75,
                              transform: [
                                {
                                  scale:
                                    getDisplaySession(item, marketPhase) ===
                                    "LIVE"
                                      ? marketPulse.interpolate({
                                          inputRange: [0.55, 1],
                                          outputRange: [0.92, 1.12],
                                        })
                                      : 1,
                                },
                              ],
                            },
                          ]}
                        />
                        <Text style={styles.homeSessionText}>
                          {getDisplaySession(item, marketPhase)}
                        </Text>
                      </View>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
            <LinearGradient
              pointerEvents="none"
              colors={[
                "rgba(212,166,58,0.080)",
                "rgba(212,166,58,0.018)",
                "rgba(0,0,0,0)",
              ]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.sectionGlow}
            />
          </View>
        )}
        {/* FOOTER */}
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
      <Modal visible={showGuide} transparent animationType="fade">
        <View style={styles.guideOverlay}>
          <View style={styles.guideCard}>
            <View style={styles.guideIconWrap}>
              <Ionicons
                name={GUIDE_STEPS[guideStep].icon}
                size={26}
                color={BRAND.amber}
              />
            </View>

            <View style={styles.progressContainer}>
              {GUIDE_STEPS.map((_, i) => (
                <View
                  key={`guide-dot-${i}`}
                  style={[
                    styles.guideDot,
                    i === guideStep && styles.guideDotActive,
                  ]}
                />
              ))}
            </View>

            <Text style={styles.guideStepLabel}>
              {guideStep + 1} of {GUIDE_STEPS.length}
            </Text>

            <Text style={styles.guideTitle}>
              {GUIDE_STEPS[guideStep].title}
            </Text>

            <Text style={styles.guideText}>{GUIDE_STEPS[guideStep].text}</Text>

            <View style={styles.guideButtons}>
              <Pressable
                onPressIn={completeGuide}
                hitSlop={16}
                style={styles.guideSkipBtn}
              >
                <Text style={styles.guideSkip}>Skip Tour</Text>
              </Pressable>

              <TouchableOpacity
                style={styles.guideNextBtn}
                onPress={handleGuideNext}
                activeOpacity={0.85}
              >
                <Text style={styles.guideNextText}>
                  {guideStep >= GUIDE_STEPS.length - 1 ? "Find Alpha" : "Next"}
                </Text>
                <Ionicons
                  name={
                    guideStep >= GUIDE_STEPS.length - 1
                      ? "rocket-outline"
                      : "arrow-forward-outline"
                  }
                  size={15}
                  color="#000"
                />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </Animated.View>
  );
}
const ACCENT_GOLD = "#D4A63A";
const ACCENT_GOLD_SOFT = "rgba(212,166,58,0.14)";
const ACCENT_GOLD_BORDER = "rgba(212,166,58,0.30)";
const PREMIUM = {
  cardSoft: "#0B1220",

  border: "rgba(255,255,255,0.065)",
  borderSoft: "rgba(255,255,255,0.055)",
  borderStrong: "rgba(255,255,255,0.095)",

  glass: "rgba(255,255,255,0.038)",
  glassStrong: "rgba(255,255,255,0.055)",

  softGlow: "rgba(255,255,255,0.020)",
  neutralGlow: "rgba(255,255,255,0.014)",

  textSoft: "rgba(255,255,255,0.92)",
  textMuted: "rgba(255,255,255,0.56)",

  shadow: "#000000",
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BRAND.bg,
  },

  screenAtmosphere: {
    position: "absolute",
    top: -150,
    left: -100,
    right: -100,
    height: 360,
    borderRadius: 300,
    zIndex: 0,
    opacity: 0.28,
  },

  headerGreeting: {
    color: BRAND.muted,
    fontSize: 12.5,
    fontFamily: TYPO.fontFamily.semibold,
    marginBottom: 3,
  },

  profileButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "#111827",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.14)",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 60,
    elevation: 60,
  },
  marketPillWrap: {
    paddingHorizontal: 18,
    marginBottom: 13,
  },

  marketGuideHint: {
    color: ACCENT_GOLD,
    fontSize: 10.5,
    marginLeft: 8,
    paddingLeft: 8,
    borderLeftWidth: 1,
    borderLeftColor: "rgba(255,255,255,0.10)",
    fontFamily: TYPO.fontFamily.bold,
  },
  marketDot: {
    width: 7.5,
    height: 7.5,
    borderRadius: 999,
    marginRight: 7,
  },

  marketText: {
    color: BRAND.sub,
    fontSize: 11.2,
    fontFamily: TYPO.fontFamily.semibold,
    letterSpacing: 0.22,
  },

  /* ==================== OLD GREETING SAFE ==================== */

  greetingText: {
    color: PREMIUM.textSoft,
    fontSize: 23,
    letterSpacing: -0.7,
    fontFamily: TYPO.fontFamily.extrabold,
  },

  greetingSubtext: {
    color: BRAND.muted,
    fontSize: 12,
    marginTop: 3,
    fontFamily: TYPO.fontFamily.medium,
  },

  /* ==================== SECTIONS ==================== */
  homeSectionWrap: {
    marginBottom: 2,
  },

  homeSectionHeader: {
    marginHorizontal: 12,
    marginBottom: 4,
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
  },

  sectionTitle: {
    color: PREMIUM.textSoft,
    fontSize: 17,
    fontFamily: TYPO.fontFamily.extrabold,
    letterSpacing: -0.35,
  },

  sectionSubtitle: {
    color: BRAND.muted,
    fontSize: 11.2,
    marginTop: 2,
    fontFamily: TYPO.fontFamily.medium,
  },

  sectionMeta: {
    color: ACCENT_GOLD,
    fontSize: 10.6,
    fontFamily: TYPO.fontFamily.semibold,
  },

  /* ==================== AI SETUPS CARDS ==================== */
  alphaCarouselStrip: {
    paddingHorizontal: 6,
    paddingBottom: 8,
  },

  alphaMiniCard: {
    width: 190,
    minHeight: 108,
    backgroundColor: BRAND.card,
    borderRadius: 23,
    padding: 12,
    marginRight: 5,
    borderWidth: 1,
    borderColor: "rgba(0,227,150,0.22)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 14,
    elevation: 7,
    overflow: "hidden",
  },

  alphaAmbientGlow: {
    position: "absolute",
    right: -70,
    top: -80,
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: PREMIUM.softGlow,
  },

  alphaMiniTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 5,
  },

  alphaMiniLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flexShrink: 1,
  },

  alphaRank: {
    color: BRAND.muted,
    fontSize: 12.6,
    fontFamily: TYPO.fontFamily.extrabold,
  },

  alphaSymbol: {
    color: PREMIUM.textSoft,
    fontSize: 17.5,
    fontFamily: TYPO.fontFamily.extrabold,
    letterSpacing: -0.35,
  },

  alphaScore: {
    color: BRAND.sub,
    fontSize: 10.4,
    fontFamily: TYPO.fontFamily.bold,
    borderWidth: 1,
    borderColor: PREMIUM.border,
    backgroundColor: PREMIUM.glass,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    overflow: "hidden",
  },

  alphaPriceInline: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    marginTop: 4,
    marginBottom: 3,
  },
  alphaMiniPrice: {
    color: PREMIUM.textSoft,
    fontSize: 14.5,
    fontFamily: TYPO.fontFamily.extrabold,
    fontVariant: ["tabular-nums"],
  },

  alphaMove: {
    fontSize: 11.2,
    marginTop: 3,
    fontFamily: TYPO.fontFamily.extrabold,
    fontVariant: ["tabular-nums"],
  },

  alphaMetaRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginTop: 2,
  },
  alphaReason: {
    flex: 1,
    color: BRAND.sub,
    fontSize: 10.6,
    lineHeight: 12.5,
    marginLeft: 0,
    fontFamily: TYPO.fontFamily.medium,
  },

  /* ==================== CORE SIGNALS ==================== */
  coreSignalList: {
    marginHorizontal: 6,
    gap: 5,
  },

  coreSignalCard: {
    backgroundColor: BRAND.card,
    borderRadius: 21,
    paddingHorizontal: 15,
    paddingVertical: 12.5,
    borderWidth: 1,
    borderColor: PREMIUM.border,
  },

  coreSignalTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  coreSignalLeft: {
    flex: 1,
    paddingRight: 10,
  },

  coreSymbol: {
    color: PREMIUM.textSoft,
    fontSize: 15.3,
    fontFamily: TYPO.fontFamily.bold,
  },

  coreName: {
    color: BRAND.muted,
    fontSize: 11,
    marginTop: 2,
    fontFamily: TYPO.fontFamily.medium,
  },

  coreBadgeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },

  coreSignalBadge: {
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },

  coreSignalBadgeText: {
    color: "#000",
    fontSize: 10,
    fontFamily: TYPO.fontFamily.bold,
  },

  coreConfidence: {
    color: BRAND.muted,
    fontSize: 10.5,
    fontFamily: TYPO.fontFamily.semibold,
  },

  corePriceRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 8,
  },

  corePrice: {
    color: PREMIUM.textSoft,
    fontSize: 14.5,
    fontFamily: TYPO.fontFamily.extrabold,
    fontVariant: ["tabular-nums"],
  },

  coreMove: {
    fontSize: 11.2,
    fontFamily: TYPO.fontFamily.bold,
    fontVariant: ["tabular-nums"],
  },

  coreSummary: {
    color: BRAND.sub,
    fontSize: 11,
    lineHeight: 15,
    marginTop: 7,
    fontFamily: TYPO.fontFamily.medium,
  },

  /* ==================== FOOTER ==================== */
  footerWrap: {
    marginTop: 26,
    marginBottom: 38,
    paddingHorizontal: 24,
    alignItems: "center",
  },

  footerText: {
    color: BRAND.sub,
    fontSize: 12.2,
    marginBottom: 8,
    fontFamily: TYPO.fontFamily.medium,
  },

  footerBrand: {
    color: PREMIUM.textSoft,
    fontFamily: TYPO.fontFamily.brand,
  },

  disclaimer: {
    color: BRAND.muted,
    fontSize: 10.3,
    lineHeight: 15.3,
    textAlign: "center",
    fontFamily: TYPO.fontFamily.regular,
  },

  /* ==================== LOADING ==================== */
  loadingContainer: {
    flex: 1,
    backgroundColor: BRAND.bg,
    alignItems: "center",
    justifyContent: "center",
  },

  loadingLogoLarge: {
    width: 124,
    height: 124,
    opacity: 0.98,
  },

  /* ==================== GUIDE MODAL ==================== */
  guideOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.84)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
    zIndex: 999,
  },

  guideCard: {
    width: "100%",
    maxWidth: 400,
    backgroundColor: BRAND.card,
    borderRadius: 32,
    padding: 28,
    borderWidth: 1,
    borderColor: PREMIUM.borderStrong,
  },

  guideIconWrap: {
    width: 54,
    height: 54,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
    backgroundColor: PREMIUM.glassStrong,
    borderWidth: 1,
    borderColor: PREMIUM.borderStrong,
    marginBottom: 16,
  },

  progressContainer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 7,
    marginBottom: 14,
  },

  guideDot: {
    width: 7,
    height: 7,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.18)",
  },

  guideDotActive: {
    width: 22,
    backgroundColor: BRAND.amber,
  },

  guideStepLabel: {
    color: BRAND.muted,
    fontSize: 10.5,
    textAlign: "center",
    marginBottom: 8,
    fontFamily: TYPO.fontFamily.bold,
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },

  guideTitle: {
    color: PREMIUM.textSoft,
    fontSize: 23,
    lineHeight: 29,
    textAlign: "center",
    marginBottom: 10,
    fontFamily: TYPO.fontFamily.extrabold,
    letterSpacing: -0.4,
  },

  guideText: {
    color: BRAND.sub,
    fontSize: 14,
    lineHeight: 22,
    textAlign: "center",
    fontFamily: TYPO.fontFamily.medium,
  },

  guideButtons: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 26,
  },

  guideSkipBtn: {
    paddingHorizontal: 10,
    paddingVertical: 10,
    marginLeft: -10,
  },

  guideSkip: {
    color: BRAND.muted,
    fontSize: 13.5,
    fontFamily: TYPO.fontFamily.semibold,
  },

  guideNextBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: PREMIUM.textSoft,
    paddingHorizontal: 18,
    paddingVertical: 11,
    borderRadius: 999,
  },

  guideNextText: {
    color: "#000",
    fontSize: 14,
    fontFamily: TYPO.fontFamily.bold,
  },

  /* ==================== HERO ==================== */
  signalBadge: {
    alignSelf: "flex-start",
    borderRadius: 999,
    paddingHorizontal: 13,
    paddingVertical: 6,
    minWidth: 78,
    alignItems: "center",
    justifyContent: "center",
  },

  signalText: {
    color: "#000",
    fontSize: 10.6,
    fontFamily: TYPO.fontFamily.extrabold,
    letterSpacing: 0.45,
    textTransform: "uppercase",
  },

  heroWrap: {
    position: "relative",
    marginHorizontal: 6,
    marginBottom: 8,
  },

  heroCard: {
    backgroundColor: "#07111F",
    borderRadius: 26,
    paddingHorizontal: 14,
    paddingTop: 9,
    paddingBottom: 6,
    borderWidth: 1.5,
    borderColor: "rgba(0,227,150,0.42)",
    shadowColor: "#00E396",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 26,
    elevation: 14,
    overflow: "hidden",
  },

  heroGraphAtmosphere: {
    position: "absolute",
    right: -90,
    top: -100,
    width: 200,
    height: 200,
    borderRadius: 100,
    opacity: 0.22,
  },

  heroTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 4,
  },

  heroBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: PREMIUM.glass,
    borderWidth: 1,
    borderColor: "rgba(0,227,150,0.22)",
  },

  heroBadgeText: {
    color: BRAND.sub,
    fontSize: 10,
    fontFamily: TYPO.fontFamily.extrabold,
    textTransform: "uppercase",
    letterSpacing: 0.7,
  },

  heroConfidence: {
    color: BRAND.sub,
    fontSize: 10.8,
    fontFamily: TYPO.fontFamily.bold,
    backgroundColor: PREMIUM.glass,
    borderWidth: 1,
    borderColor: "rgba(0,227,150,0.22)",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    overflow: "hidden",
  },

  heroMainRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: 2,
  },

  heroLeftBlock: {
    flex: 1,
    paddingRight: 10,
  },

  heroSymbolRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
  },

  heroSymbol: {
    color: PREMIUM.textSoft,
    fontSize: 24,
    fontFamily: TYPO.fontFamily.extrabold,
    letterSpacing: -0.8,
  },

  heroMoveLabel: {
    marginLeft: 10,
    fontSize: 11,
    fontFamily: TYPO.fontFamily.semibold,
    fontStyle: "italic",
  },

  heroName: {
    color: BRAND.sub,
    fontSize: 11.8,
    marginTop: 1,
    fontFamily: TYPO.fontFamily.medium,
  },

  heroPriceBlock: {
    alignItems: "flex-end",
    justifyContent: "flex-start",
    paddingTop: 2,
    minWidth: 120,
  },

  heroPrice: {
    color: PREMIUM.textSoft,
    fontSize: 23.5,
    fontFamily: TYPO.fontFamily.extrabold,
    fontVariant: ["tabular-nums"],
  },

  heroChange: {
    fontSize: 12.8,
    marginTop: 3,
    fontFamily: TYPO.fontFamily.bold,
    fontVariant: ["tabular-nums"],
  },

  heroSignalRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 2,
  },
  heroSignalGraphWrap: {
    flex: 1,
    alignItems: "flex-start",
    justifyContent: "center",
    marginLeft: 8,
  },

  heroInsightGrid: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: PREMIUM.glass,
    borderWidth: 1,
    borderColor: PREMIUM.border,
    borderRadius: 21,
    paddingHorizontal: 11,
    paddingVertical: 10,
    marginTop: -2,
  },

  heroInsightItem: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },

  heroInsightDivider: {
    width: 1,
    height: 28,
    backgroundColor: PREMIUM.border,
    marginHorizontal: 7,
  },

  heroInsightTitle: {
    color: PREMIUM.textSoft,
    fontSize: 10.6,
    fontFamily: TYPO.fontFamily.bold,
  },

  heroInsightSub: {
    color: BRAND.muted,
    fontSize: 9.8,
    marginTop: 2,
    fontFamily: TYPO.fontFamily.medium,
  },

  heroWhyRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginTop: 5,
    paddingBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: PREMIUM.border,
  },

  heroWhyLabel: {
    color: BRAND.sub,
    fontSize: 10.4,
    marginLeft: 6,
    marginRight: 8,
    fontFamily: TYPO.fontFamily.bold,
    letterSpacing: 0.5,
  },

  heroWhyText: {
    flex: 1,
    color: PREMIUM.textSoft,
    fontSize: 10.8,
    lineHeight: 14,
    fontFamily: TYPO.fontFamily.semibold,
  },

  heroCatalystWrap: {
    marginTop: 5,
    paddingTop: 0,
    paddingBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: PREMIUM.border,
  },

  heroCatalystText: {
    color: PREMIUM.textSoft,
    fontSize: 11.7,
    lineHeight: 17.5,
    fontFamily: TYPO.fontFamily.semibold,
  },
  heroCatalystInlineLabel: {
    color: BRAND.sub,
    fontFamily: TYPO.fontFamily.bold,
  },

  heroFooterRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 5,
  },

  heroVerifiedRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    flex: 1,
  },

  heroVerifiedText: {
    color: BRAND.muted,
    fontSize: 10.4,
    fontFamily: TYPO.fontFamily.medium,
  },

  heroCta: {
    color: ACCENT_GOLD,
    fontSize: 12.2,
    fontFamily: TYPO.fontFamily.semibold,
    letterSpacing: 0.2,
  },

  heroChartWrap: {
    width: 102,
    height: 24,
    marginTop: 0,
    alignItems: "center",
    justifyContent: "center",
    opacity: 0.95,
    transform: [{ translateX: -10 }],
  },
  header: {
    paddingTop: 52,
    paddingHorizontal: 16,
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
    marginRight: 8,
  },

  titleBrand: {
    color: PREMIUM.textSoft,
    fontSize: 29,
    fontFamily: TYPO.fontFamily.brand,
    letterSpacing: -1.05,
  },

  subtitle: {
    color: BRAND.sub,
    fontSize: 11.5,
    marginTop: 2,
    fontFamily: TYPO.fontFamily.medium,
    letterSpacing: 0.4,
  },

  marketPill: {
    marginTop: 6,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: PREMIUM.glass,
    borderWidth: 1,
    borderColor: PREMIUM.border,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },

  coreSignalMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    marginTop: 7,
  },

  corePriceRight: {
    alignItems: "flex-end",
    justifyContent: "center",
  },
  moversPremiumCard: {
    marginHorizontal: 6,
    backgroundColor: PREMIUM.cardSoft,
    borderRadius: 26,
    borderWidth: 1,
    borderColor: "rgba(212,166,58,0.25)",
    overflow: "hidden",
    position: "relative",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.1,
    shadowRadius: 18,
    elevation: 8,
  },

  moverPremiumRow: {
    minHeight: 68,
    paddingHorizontal: 14,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
  },

  moverPremiumDivider: {
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.065)",
  },

  moverSymbolCircle: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: "rgba(255,255,255,0.045)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.07)",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },

  moverSymbolCircleText: {
    color: PREMIUM.textSoft,
    fontSize: 13,
    fontFamily: TYPO.fontFamily.extrabold,
    letterSpacing: -0.2,
  },

  moverPremiumMiddle: {
    flex: 1,
    paddingRight: 10,
  },

  moverPremiumTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    marginBottom: 4,
  },

  moverPremiumSymbol: {
    color: PREMIUM.textSoft,
    fontSize: 16.5,
    fontFamily: TYPO.fontFamily.extrabold,
    letterSpacing: -0.45,
  },

  moverPremiumTrendBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },

  moverPremiumTrendText: {
    fontSize: 10.5,
    fontFamily: TYPO.fontFamily.bold,
  },

  moverPremiumReason: {
    color: BRAND.sub,
    fontSize: 11.4,
    lineHeight: 13.5,
    fontFamily: TYPO.fontFamily.medium,
  },

  moverPremiumRight: {
    width: 92,
    alignItems: "flex-end",
  },

  moverPremiumPrice: {
    color: PREMIUM.textSoft,
    fontSize: 15.5,
    fontFamily: TYPO.fontFamily.extrabold,
    fontVariant: ["tabular-nums"],
  },

  moverPremiumMove: {
    marginTop: 4,
    fontSize: 11.5,
    fontFamily: TYPO.fontFamily.bold,
    fontVariant: ["tabular-nums"],
  },
  corePremiumShell: {
    marginHorizontal: 6,
    backgroundColor: PREMIUM.cardSoft,
    borderRadius: 26,
    borderWidth: 1,
    borderColor: "rgba(59,130,246,0.22)",
    overflow: "hidden",
    position: "relative",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.1,
    shadowRadius: 18,
    elevation: 7,
  },
  corePremiumRow: {
    minHeight: 72,
    paddingHorizontal: 14,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
  },

  corePremiumDivider: {
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.06)",
  },

  coreLogoCircle: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: "rgba(255,255,255,0.045)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.07)",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },

  coreLogoText: {
    color: PREMIUM.textSoft,
    fontSize: 12.5,
    fontFamily: TYPO.fontFamily.extrabold,
    letterSpacing: -0.25,
  },

  corePremiumBody: {
    flex: 1,
    paddingRight: 10,
  },

  corePremiumTopLine: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
  },

  corePremiumSymbol: {
    color: PREMIUM.textSoft,
    fontSize: 18,
    fontFamily: TYPO.fontFamily.extrabold,
    letterSpacing: -0.45,
    marginRight: 7,
  },

  coreSignalMiniBadge: {
    borderRadius: 999,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },

  coreSignalMiniText: {
    color: "#000",
    fontSize: 9.5,
    fontFamily: TYPO.fontFamily.extrabold,
  },

  corePremiumConfidence: {
    color: BRAND.muted,
    fontSize: 10.5,
    marginLeft: 7,
    fontFamily: TYPO.fontFamily.semibold,
  },

  corePremiumCompany: {
    color: BRAND.sub,
    fontSize: 11.4,
    marginBottom: 2,
    fontFamily: TYPO.fontFamily.medium,
  },

  corePremiumSummary: {
    color: "rgba(255,255,255,0.84)",
    fontSize: 11.2,
    lineHeight: 13.8,
    fontFamily: TYPO.fontFamily.medium,
  },

  corePremiumRight: {
    width: 92,
    alignItems: "flex-end",
  },

  corePremiumPrice: {
    color: PREMIUM.textSoft,
    fontSize: 15.8,
    fontFamily: TYPO.fontFamily.extrabold,
    fontVariant: ["tabular-nums"],
  },

  corePremiumMove: {
    marginTop: 4,
    fontSize: 11.4,
    fontFamily: TYPO.fontFamily.bold,
    fontVariant: ["tabular-nums"],
  },
  sectionGlow: {
    position: "absolute",
    top: -70,
    right: -70,
    width: 160,
    height: 160,
    borderRadius: 120,
    opacity: 0.72,
  },

  homeSessionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    marginTop: 4,
  },

  homeSessionDot: {
    width: 6,
    height: 6,
    borderRadius: 999,
    marginRight: 4,
  },

  homeSessionText: {
    color: BRAND.muted,
    fontSize: 9.5,
    fontFamily: TYPO.fontFamily.bold,
    letterSpacing: 0.35,
  },
  tickerLogoImage: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  heroTickerLogo: {
    width: 28,
    height: 28,
    borderRadius: 14,
    marginRight: 8,
  },

  alphaTickerLogo: {
    width: 22,
    height: 22,
    borderRadius: 11,
  },
});
