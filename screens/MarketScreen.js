// screens/MarketScreen.js
import React, { useEffect, useState, useCallback, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  StatusBar,
  TouchableOpacity,
  Alert,
  Linking,
  Animated,
  Image,
  Modal,
} from "react-native";
import Svg, {
  Path,
  Circle,
  Line,
  Defs,
  Stop,
  LinearGradient as SvgLinearGradient,
} from "react-native-svg";
import * as Haptics from "expo-haptics";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import {
  getMarketOverview,
  getMarketMovers,
  getMarketNews,
} from "../services/MarketPulseService";

import AstraChat from "../components/AstraChat";
import AstraAnimatedIcon from "../components/AstraAnimatedIcon";
import MoveLabel from "../components/MoveLabel";
import { BRAND } from "../constants/theme";
import { TYPO } from "../constants/typography";
import { useResetScrollOnTabPress } from "../hooks/useResetScrollOnTabPress";

/* ---------------------------------------------------------
   Utils
--------------------------------------------------------- */
function timeAgoFromUtc(iso) {
  if (!iso) return "Just now";

  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "Just now";

  const diff = Math.floor((Date.now() - d.getTime()) / 1000);

  if (diff < 60) return "Just now";
  if (diff < 3600) return `${Math.floor(diff / 60)} min ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} hr ago`;
  return `${Math.floor(diff / 86400)} day ago`;
}

function groupNewsByDate(news = []) {
  const now = new Date();

  const startOfToday = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
  );

  const startOfYesterday = new Date(startOfToday);
  startOfYesterday.setDate(startOfYesterday.getDate() - 1);

  const startOfWeek = new Date(startOfToday);
  startOfWeek.setDate(startOfWeek.getDate() - 7);

  const groups = {
    today: [],
    yesterday: [],
    week: [],
    older: [],
  };

  news.forEach((n) => {
    const d = new Date(n.pubDate);
    if (Number.isNaN(d.getTime())) return;

    if (d >= startOfToday) groups.today.push(n);
    else if (d >= startOfYesterday) groups.yesterday.push(n);
    else if (d >= startOfWeek) groups.week.push(n);
    else groups.older.push(n);
  });

  return groups;
}

function deriveRiskLevel(fg) {
  const v = fg?.value;
  if (v == null) return "—";
  if (v <= 30) return "High";
  if (v <= 60) return "Moderate";
  return "Low";
}

// Same copy as HomeScreen.js's FEAR_INDEX_INFO — reused verbatim so the
// concept reads consistently across screens rather than two slightly
// different explanations of the same gauge.
const FEAR_INDEX_INFO = {
  title: "Fear & Greed Index",
  text: "A 0–100 gauge of overall market sentiment, built from volatility, momentum, and trading behavior across the market. Low readings mean fear is dominating (investors selling, risk-off); high readings mean greed is dominating (investors buying, risk-on). Around 50 is neutral.",
};

// Market Risk is directly derived from the Fear & Greed value above via
// deriveRiskLevel() — not an independent risk model — so the copy says
// that plainly instead of implying a separate calculation.
const MARKET_RISK_INFO = {
  title: "Market Risk",
  text: "A quick-read risk level derived from the Fear & Greed value above — Low when sentiment is calm or greedy, Moderate in between, High when fear is elevated. It's a simplified view of the same sentiment data, not a separate volatility or macro risk model.",
};

function formatPrice(v) {
  if (typeof v !== "number" || Number.isNaN(v)) return "—";
  if (v >= 1000)
    return v.toLocaleString(undefined, { maximumFractionDigits: 0 });
  if (v >= 1) return v.toFixed(2);
  return v.toFixed(4);
}

function formatSignedChange(v) {
  if (typeof v !== "number" || Number.isNaN(v)) return "—";
  return Math.abs(v).toFixed(2);
}

function tickerFromLabel(label) {
  if (!label) return "";

  const s = String(label);
  const m = s.match(/\(([^)]+)\)/);

  return (m?.[1] || s).trim().toUpperCase();
}

function priceFlashStyle(prev, next) {
  if (typeof prev !== "number" || typeof next !== "number") return {};
  if (prev === next) return {};

  return {
    backgroundColor:
      next > prev ? "rgba(0,227,150,0.16)" : "rgba(239,68,68,0.16)",
    borderWidth: 1,
    borderColor: next > prev ? "rgba(0,227,150,0.28)" : "rgba(239,68,68,0.28)",
  };
}

function getCarouselItems(carousel, id) {
  return carousel.find((c) => c.id === id)?.items || [];
}

/* ---------------------------------------------------------
   Screen
--------------------------------------------------------- */
export default function MarketScreen({ navigation }) {
  const pageScrollRef = useRef(null);

  useResetScrollOnTabPress(navigation, () =>
    pageScrollRef.current?.scrollTo({ y: 0, animated: true }),
  );

  const [overview, setOverview] = useState(null);
  const [carousel, setCarousel] = useState([]);
  const [movers, setMovers] = useState({ gainers: [], losers: [] });
  const [infoModal, setInfoModal] = useState(null);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [lastUpdated, setLastUpdated] = useState("");
  const [news, setNews] = useState([]);
  const [highlights, setHighlights] = useState([]);
  const [astraVisible, setAstraVisible] = useState(false);

  const priceCacheRef = useRef({});
  const prevPriceCacheRef = useRef({});

  const loadData = useCallback(
    async (silent = false) => {
      try {
        if (refreshing) return;

        if (!silent && !overview) setLoading(true);

        // 1) Load overview first so Market tab opens fast
        const overviewData = await getMarketOverview();

        if (overviewData?.market) {
          prevPriceCacheRef.current = { ...priceCacheRef.current };

          const nextCarousel = overviewData.carousel || [];

          setOverview(overviewData.market || {});
          setCarousel(nextCarousel);
          setLastUpdated(timeAgoFromUtc(overviewData.market?.updated_at));

          nextCarousel.forEach((card) => {
            if (!card?.items) return;

            card.items.forEach((it) => {
              const key = tickerFromLabel(it.label);
              const price = it?.quote?.price;

              if (typeof price === "number" && key) {
                priceCacheRef.current[key] = price;
              }
            });
          });
        }

        // 2) Stop full-page loader once overview is ready
        setLoading(false);

        // 3) Load slower sections in background
        Promise.allSettled([getMarketMovers("preview"), getMarketNews()]).then(
          ([moversResult, newsResult]) => {
            if (moversResult.status === "fulfilled") {
              setMovers(moversResult.value || { gainers: [], losers: [] });
            } else {
              console.warn("Market movers error:", moversResult.reason);
            }

            if (newsResult.status === "fulfilled") {
              const newsData = newsResult.value;
              setNews(Array.isArray(newsData?.news) ? newsData.news : []);
            } else {
              console.warn("Market news error:", newsResult.reason);
            }

            setHighlights([]);
          },
        );
      } catch (e) {
        console.warn("MarketScreen error:", e?.message || e);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [refreshing, overview],
  );

  useEffect(() => {
    loadData(false);

    const interval = setInterval(() => {
      loadData(true);
    }, 30000);

    return () => clearInterval(interval);
  }, [loadData]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData(true);
    setRefreshing(false);
  };

  if (loading && !overview) {
    return (
      <View style={styles.loadingContainer}>
        <StatusBar barStyle="light-content" backgroundColor={BRAND.bg} />
        <ActivityIndicator size="large" color={BRAND.green} />
        <Text style={styles.loadingText}>Loading latest market data…</Text>
      </View>
    );
  }

  const groupedNews = groupNewsByDate(news);
  const todayNews = groupedNews.today || [];

  const usMarketItems = getCarouselItems(carousel, "us_market");
  const cryptoItems = getCarouselItems(carousel, "crypto").filter((i) =>
    ["BTC", "ETH", "SOL", "XRP"].includes(i.label),
  );
  const commodityItems = getCarouselItems(carousel, "commodities");

  const astraMarketContext = {
    contextType: "market",
    total_value: 0,
    total_gain: 0,
    today_gain: 0,
    positions: [],
  };

  const renderMarketRow = (item, labelOverride) => {
    const q = item.quote || {};

    if (q.price == null || q.changePct == null) return null;

    const ticker = tickerFromLabel(item.label);
    const price = q.price;
    const up = q.changePct >= 0;
    const prevPrice = prevPriceCacheRef.current[ticker];

    const label = labelOverride || item.label;

    const rawChange =
      typeof q.change === "number" ? q.change : price * (q.changePct / 100);
    return (
      <View
        key={ticker || label}
        style={[styles.tableRow, priceFlashStyle(prevPrice, price)]}
      >
        <View style={styles.assetCell}>
          {item.logoUrl ? (
            <Image
              source={{ uri: item.logoUrl }}
              style={styles.assetLogo}
              resizeMode="contain"
            />
          ) : null}

          <Text style={styles.assetLabel} numberOfLines={1}>
            {label}
          </Text>
        </View>

        <Text style={styles.colPrice}>${formatPrice(price)}</Text>

        <Text
          style={[styles.colChange, { color: up ? BRAND.green : BRAND.red }]}
        >
          {up ? "▲" : "▼"} {formatSignedChange(rawChange)}
        </Text>

        <Text style={[styles.colPct, { color: up ? BRAND.green : BRAND.red }]}>
          {Math.abs(q.changePct).toFixed(2)}%
        </Text>
      </View>
    );
  };

  const renderMoverCard = (m, type) => {
    const isUp = Number(m.change) >= 0;

    return (
      <TouchableOpacity
        key={m.symbol}
        activeOpacity={0.86}
        style={[
          styles.moverCard,
          type === "up" ? styles.moverUp : styles.moverDown,
        ]}
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          navigation.navigate("StockDetailScreen", {
            symbol: m.symbol,
            name: m.company || m.symbol,
            source: "ui",
          });
        }}
      >
        <View style={styles.moverTopRow}>
          <View style={styles.moverSymbolRow}>
            {m.logoUrl ? (
              <Image
                source={{ uri: m.logoUrl }}
                style={styles.moverLogo}
                resizeMode="contain"
              />
            ) : null}

            <Text style={styles.moverSymbol}>{m.symbol}</Text>
          </View>
          <Text style={styles.moverPrice}>
            {typeof m.price === "number" ? `$${m.price.toFixed(2)}` : "—"}
          </Text>
        </View>

        <Text
          style={[
            styles.moverChange,
            { color: isUp ? BRAND.green : BRAND.red },
          ]}
          numberOfLines={1}
        >
          {isUp ? "▲" : "▼"} {formatSignedChange(m.change)} (
          {Math.abs(Number(m.changePct || 0)).toFixed(2)}%)
        </Text>
        <MoveLabel
          changePct={Number(m.changePct)}
          price={Number(m.price)}
          style={styles.moverMoveLabel}
        />
        {!!m.trendLabel && (
          <Text style={styles.trendBadge} numberOfLines={1}>
            {m.trendLabel}
          </Text>
        )}

        {!!m.pattern && (
          <Text style={styles.patternBadge} numberOfLines={1}>
            {typeof m.pattern === "string" ? m.pattern : m.pattern?.name}
          </Text>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.wrapper}>
      <StatusBar barStyle="light-content" backgroundColor={BRAND.bg} />

      <View style={styles.stickyHeader}>
        <View style={styles.headerTopRow}>
          <View>
            <Text style={styles.headerTitle}>Market</Text>

            <View style={styles.updatedInline}>
              <View style={styles.marketHeaderDot} />
              <Text style={styles.updatedTime}>Updated {lastUpdated}</Text>
            </View>
          </View>
        </View>
      </View>

      <ScrollView
        ref={pageScrollRef}
        showsVerticalScrollIndicator={false}
        style={styles.container}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={BRAND.green}
          />
        }
      >
        {/* MARKET SNAPSHOT */}
        <View style={styles.overviewCard}>
          <View style={styles.overviewTopRow}>
            <View style={styles.snapshotHeroLeft}>
              <View style={styles.snapshotBadgeRow}>
                <View
                  style={[
                    styles.marketLiveDot,
                    overview?.marketStatus === "Market Closed" && {
                      backgroundColor: "#6B7280",
                    },
                  ]}
                />

                <Text style={styles.cardEyebrow}>MARKET SNAPSHOT</Text>
              </View>

              <View style={styles.snapshotTitleRow}>
                <Text style={styles.marketStatusText}>
                  {overview?.marketStatus || "Market Open"}
                </Text>

                <View
                  style={[
                    styles.marketMoodPill,
                    overview?.marketMood?.toLowerCase() === "bullish" && {
                      backgroundColor: "rgba(0,227,150,0.14)",
                      borderColor: "rgba(0,227,150,0.32)",
                    },
                    overview?.marketMood?.toLowerCase() === "bearish" && {
                      backgroundColor: "rgba(239,68,68,0.14)",
                      borderColor: "rgba(239,68,68,0.30)",
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.marketMoodText,
                      overview?.marketMood?.toLowerCase() === "bullish" && {
                        color: BRAND.green,
                      },
                      overview?.marketMood?.toLowerCase() === "bearish" && {
                        color: "#F87171",
                      },
                    ]}
                  >
                    {overview?.marketMood || "Neutral"}
                  </Text>
                </View>
              </View>
            </View>

            <View
              style={[
                styles.livePill,
                overview?.marketStatus === "Market Closed"
                  ? styles.livePillClosed
                  : styles.livePillLive,
              ]}
            >
              <Text
                style={[
                  styles.livePillText,
                  overview?.marketStatus === "Market Closed"
                    ? styles.livePillTextClosed
                    : styles.livePillTextLive,
                ]}
              >
                {overview?.marketStatus === "Market Closed" ? "Closed" : "Live"}
              </Text>
            </View>
          </View>

          <View style={styles.tableHeader}>
            <Text style={styles.colSymbol}>Asset</Text>
            <Text style={styles.colPrice}>Price</Text>
            <Text style={styles.colChange}>Change</Text>
            <Text style={styles.colPct}>% Chg</Text>
          </View>

          <Text style={styles.sectionSubtle}>🇺🇸 US Market</Text>
          {usMarketItems.map((item) => {
            const ticker = tickerFromLabel(item.label);
            const symbolLabel =
              ticker === "SPY"
                ? "S&P 500 (SPY)"
                : ticker === "QQQ"
                  ? "Nasdaq (QQQ)"
                  : item.label;

            return renderMarketRow(item, symbolLabel);
          })}

          <Text style={styles.sectionSubtle}>₿ Crypto</Text>
          {cryptoItems.map((item) => renderMarketRow(item, item.label))}

          <Text style={styles.sectionSubtle}>🟡 Commodities (ETFs)</Text>
          {commodityItems.map((item) => {
            const symbol = tickerFromLabel(item.label);

            const label =
              symbol === "GLD"
                ? "Gold (GLD)"
                : symbol === "USO"
                  ? "Oil (USO)"
                  : symbol === "SLV"
                    ? "Silver (SLV)"
                    : item.label;

            return renderMarketRow(item, label);
          })}

          {/* MARKET HEALTH ROW - Updated to match mockup */}
          <View style={styles.marketHealthRow}>
            {/* FEAR & GREED INDEX */}
            <LinearGradient
              colors={["rgba(0,227,150,0.08)", "rgba(17,24,39,0.94)"]}
              style={styles.healthCard}
            >
              <View style={styles.healthHeaderRow}>
                <Text style={styles.healthTitle}>FEAR & GREED INDEX</Text>
                <TouchableOpacity
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  onPress={() => setInfoModal(FEAR_INDEX_INFO)}
                >
                  <Ionicons
                    name="information-circle-outline"
                    size={15}
                    color={BRAND.muted}
                  />
                </TouchableOpacity>
              </View>

              <View style={styles.gaugeArea}>
                <FearGreedGauge value={overview?.fearGreed?.value ?? 50} />

                <Text style={styles.gaugeValue}>
                  {overview?.fearGreed?.value ?? "—"}
                </Text>
                <Text style={styles.gaugeLabel}>
                  {String(
                    overview?.fearGreed?.label || "NEUTRAL",
                  ).toUpperCase()}
                </Text>
              </View>

              <Text style={styles.healthFooter}>
                Previous Close: {overview?.fearGreed?.previousClose ?? 49}
              </Text>
            </LinearGradient>

            {/* MARKET RISK */}
            <LinearGradient
              colors={["rgba(250,204,21,0.08)", "rgba(17,24,39,0.94)"]}
              style={[styles.healthCard, styles.riskCard]}
            >
              <View style={styles.healthHeaderRow}>
                <Text style={styles.healthTitle}>MARKET RISK</Text>
                <TouchableOpacity
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  onPress={() => setInfoModal(MARKET_RISK_INFO)}
                >
                  <Ionicons
                    name="information-circle-outline"
                    size={15}
                    color={BRAND.muted}
                  />
                </TouchableOpacity>
              </View>

              <MarketRiskGauge
                riskLevel={deriveRiskLevel(overview?.fearGreed)}
              />

              <Text
                style={[
                  styles.riskValue,
                  deriveRiskLevel(overview?.fearGreed) === "Low" && {
                    color: "#22C55E",
                  },
                  deriveRiskLevel(overview?.fearGreed) === "Moderate" && {
                    color: "#FACC15",
                  },
                  deriveRiskLevel(overview?.fearGreed) === "High" && {
                    color: "#F87171",
                  },
                ]}
              >
                {deriveRiskLevel(overview?.fearGreed)}
              </Text>

              <Text style={styles.riskSubText}>Stay alert. Manage risk.</Text>
            </LinearGradient>
          </View>
        </View>

        {/* MARKET MOVERS */}
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>Market Movers</Text>

          <TouchableOpacity
            activeOpacity={0.75}
            onPress={() => navigation.navigate("MarketMoversScreen")}
          >
            <Text style={styles.viewAll}>View all →</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.moversSubTitle}>Rising Fast</Text>

        {movers.gainers.length === 0 ? (
          <Text style={styles.mutedNote}>Loading movers…</Text>
        ) : (
          <View style={styles.moverGrid}>
            {movers.gainers.slice(0, 4).map((m) => renderMoverCard(m, "up"))}
          </View>
        )}

        <Text style={[styles.moversSubTitle, { marginTop: 14 }]}>
          Dropping Fast
        </Text>

        {movers.losers.length === 0 ? (
          <Text style={styles.mutedNote}>Loading movers…</Text>
        ) : (
          <View style={styles.moverGrid}>
            {movers.losers.slice(0, 4).map((m) => renderMoverCard(m, "down"))}
          </View>
        )}

        {/* MARKET HIGHLIGHTS */}
        {Array.isArray(highlights) && highlights.length > 0 && (
          <View style={styles.highlightsBox}>
            <Text style={styles.sectionTitle}>Market Highlights</Text>

            {highlights.map((h, i) => (
              <Text key={i} style={styles.highlightItem}>
                • {h}
              </Text>
            ))}
          </View>
        )}

        {/* MARKET NEWS */}
        <View style={styles.newsBox}>
          <View style={styles.newsHeaderRow}>
            <View>
              <Text style={styles.newsMainTitle}>Market News</Text>
              <Text style={styles.newsSubTitle}>
                Today’s top market updates
              </Text>
            </View>

            <TouchableOpacity
              activeOpacity={0.75}
              onPress={() => navigation.navigate("MarketNewsScreen")}
            >
              <Text style={styles.newsViewAll}>View all →</Text>
            </TouchableOpacity>
          </View>

          {todayNews.length === 0 ? (
            <Text style={styles.mutedNote}>No market news for today yet.</Text>
          ) : (
            todayNews.map((n, i) => (
              <TouchableOpacity
                key={`today-news-${i}`}
                style={styles.premiumNewsItem}
                activeOpacity={0.85}
                onPress={() => {
                  if (!n.link) return;

                  Alert.alert(
                    "Open External Link",
                    "You are leaving Alphaclara to view this market news article.",
                    [
                      { text: "Cancel", style: "cancel" },
                      {
                        text: "Continue",
                        onPress: () => Linking.openURL(n.link),
                      },
                    ],
                  );
                }}
              >
                <View style={styles.newsAccentLine} />

                <View style={styles.newsContent}>
                  {i === 0 && (
                    <View style={styles.topStoryPill}>
                      <Text style={styles.topStoryText}>TOP STORY</Text>
                    </View>
                  )}

                  <Text style={styles.newsTitle} numberOfLines={2}>
                    {n.title}
                  </Text>

                  {!!n.summary && (
                    <Text style={styles.newsSummary} numberOfLines={2}>
                      {n.summary}
                    </Text>
                  )}

                  <Text style={styles.newsMeta}>
                    {n.source} · {timeAgoFromUtc(n.pubDate)} ↗
                  </Text>
                </View>
              </TouchableOpacity>
            ))
          )}
        </View>

        {/* FOOTER */}
        <View style={styles.footerWrap}>
          <Text style={styles.footerText}>
            Powered by <Text style={styles.footerBrand}>Alphaclara</Text>
          </Text>

          <Text style={styles.disclaimer}>
            Market data, news, trends, and AI-powered insights are provided for
            informational and educational purposes only and are not financial,
            investment, trading, or tax advice.
          </Text>
        </View>
      </ScrollView>

      <Animated.View style={styles.astraWrap}>
        <TouchableOpacity
          style={styles.astraFab}
          activeOpacity={0.85}
          onPress={() => setAstraVisible(true)}
        >
          <AstraAnimatedIcon size={52} />
        </TouchableOpacity>
      </Animated.View>

      <AstraChat
        visible={astraVisible}
        onClose={() => setAstraVisible(false)}
        portfolioData={astraMarketContext}
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
  /* =============================================
   PREMIUM PROFESSIONAL FEAR & GREED GAUGE
   (High-end Stock Market Style)
============================================= */
  function FearGreedGauge({ value = 50 }) {
    const v = Math.max(0, Math.min(100, value));

    const cx = 81;
    const cy = 82;
    const r = 58;

    const angle = Math.PI * (1 - v / 100);

    const nx = cx + r * Math.cos(angle);
    const ny = cy - r * Math.sin(angle);

    const ticks = Array.from({ length: 11 }, (_, i) => {
      const a = Math.PI * (1 - i / 10);

      const r1 = r + 3;
      const r2 = r + (i % 5 === 0 ? 10 : 6);

      return {
        x1: cx + r1 * Math.cos(a),
        y1: cy - r1 * Math.sin(a),
        x2: cx + r2 * Math.cos(a),
        y2: cy - r2 * Math.sin(a),
        major: i % 5 === 0,
      };
    });

    return (
      <Svg width={162} height={100} viewBox="0 0 162 100">
        {/* background track */}
        <Path
          d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
          fill="none"
          stroke="rgba(148,163,184,0.12)"
          strokeWidth="9"
          strokeLinecap="round"
        />

        {/* colored arc */}
        <Path
          d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
          fill="none"
          stroke="url(#fearGradient)"
          strokeWidth="6"
          strokeLinecap="round"
        />

        <Defs>
          <SvgLinearGradient
            id="fearGradient"
            x1="0%"
            y1="0%"
            x2="100%"
            y2="0%"
          >
            <Stop offset="0%" stopColor="#EF4444" />
            <Stop offset="45%" stopColor="#FACC15" />
            <Stop offset="100%" stopColor="#22C55E" />
          </SvgLinearGradient>
        </Defs>

        {/* ticks */}
        {ticks.map((t, i) => (
          <Line
            key={i}
            x1={t.x1}
            y1={t.y1}
            x2={t.x2}
            y2={t.y2}
            stroke="rgba(255,255,255,0.25)"
            strokeWidth={t.major ? 1.1 : 0.6}
          />
        ))}

        {/* needle */}
        <Line
          x1={cx}
          y1={cy}
          x2={nx}
          y2={ny}
          stroke="#FFFFFF"
          strokeWidth="2"
          strokeLinecap="round"
        />

        {/* center */}
        <Circle
          cx={cx}
          cy={cy}
          r="6.5"
          fill="#0F172A"
          stroke="#FFFFFF"
          strokeWidth="1.5"
        />

        {/* glow dot */}
        <Circle cx={nx} cy={ny} r="4" fill="#FFFFFF" />
      </Svg>
    );
  }
  /* =============================================
   MARKET RISK GAUGE (Horizontal Bar)
============================================= */
  function MarketRiskGauge({ riskLevel = "Moderate" }) {
    const normalized = riskLevel.toLowerCase();

    // LOW = green side
    // MODERATE = yellow middle
    // HIGH = red side
    const riskPosition =
      normalized === "low" ? 1 : normalized === "moderate" ? 5 : 8;

    return (
      <View style={styles.riskBarsRow}>
        {Array.from({ length: 10 }).map((_, i) => {
          const isGreen = i < 3;
          const isYellow = i >= 3 && i < 7;
          const isRed = i >= 7;

          return (
            <View
              key={i}
              style={[
                styles.riskBar,

                isGreen && {
                  backgroundColor: "#22C55E",
                },

                isYellow && {
                  backgroundColor: "#FACC15",
                },

                isRed && {
                  backgroundColor: "#F87171",
                },

                i === riskPosition && [
                  styles.riskBarActive,

                  isGreen && {
                    borderColor: "#22C55E",
                    shadowColor: "#22C55E",
                  },

                  isYellow && {
                    borderColor: "#FACC15",
                    shadowColor: "#FACC15",
                  },

                  isRed && {
                    borderColor: "#F87171",
                    shadowColor: "#F87171",
                  },
                ],
              ]}
            />
          );
        })}
      </View>
    );
  }
}

/* ---------------------------------------------------------
   Styles
--------------------------------------------------------- */
const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
    backgroundColor: BRAND.bg,
  },

  container: {
    flex: 1,
    paddingHorizontal: 12,
  },

  scrollContent: {
    paddingTop: 116,
    paddingBottom: 170,
  },

  /* HEADER */
  stickyHeader: {
    position: "absolute",
    top: 0,
    width: "100%",
    backgroundColor: BRAND.bg,
    paddingTop: 52,
    paddingHorizontal: 18,
    paddingBottom: 14,
    zIndex: 1000,
  },

  headerTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  headerTitle: {
    color: BRAND.text,
    fontSize: 25,
    fontFamily: TYPO.fontFamily.extrabold,
    letterSpacing: -0.55,
  },

  headerTitleAccent: {
    color: BRAND.green,
  },

  updatedInline: {
    marginTop: 7,
    flexDirection: "row",
    alignItems: "center",
  },

  updatedTime: {
    color: BRAND.sub,
    fontSize: 12,
    fontFamily: TYPO.fontFamily.semibold,
  },

  marketHeaderDot: {
    width: 7,
    height: 7,
    borderRadius: 999,
    backgroundColor: BRAND.green,
    marginRight: 8,
  },

  headerIconBtn: {
    width: 42,
    height: 42,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(17,24,39,0.78)",
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.22)",
  },

  /* LOADING */
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: BRAND.bg,
  },

  loadingText: {
    color: BRAND.sub,
    marginTop: 8,
    fontSize: 13,
    fontFamily: TYPO.fontFamily.semibold,
  },

  /* MARKET PULSE STRIP */
  marketPulseStrip: {
    minHeight: 56,
    borderRadius: 22,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(0,227,150,0.22)",
    marginBottom: 8,
  },

  pulseIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,227,150,0.10)",
    borderWidth: 1,
    borderColor: "rgba(0,227,150,0.32)",
    marginRight: 12,
  },

  pulseText: {
    color: BRAND.text,
    fontSize: 14,
    fontFamily: TYPO.fontFamily.bold,
  },

  pulseDivider: {
    width: 1,
    height: 24,
    backgroundColor: "rgba(148,163,184,0.25)",
    marginHorizontal: 14,
  },

  /* MARKET SNAPSHOT */
  overviewCard: {
    backgroundColor: "rgba(17,24,39,0.88)",
    borderRadius: 24,
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 11,
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.22)",
    marginBottom: 18,
  },

  overviewTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },

  cardEyebrow: {
    color: BRAND.muted,
    fontSize: 11,
    fontFamily: TYPO.fontFamily.bold,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 4,
  },

  marketStatusText: {
    color: BRAND.text,
    fontSize: 15,
    fontFamily: TYPO.fontFamily.bold,
  },

  livePill: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },

  livePillLive: {
    backgroundColor: "rgba(0,227,150,0.10)",
    borderColor: "rgba(0,227,150,0.28)",
  },

  livePillClosed: {
    backgroundColor: "rgba(107,114,128,0.10)",
    borderColor: "rgba(107,114,128,0.35)",
  },

  livePillText: {
    fontSize: 11,
    fontFamily: TYPO.fontFamily.bold,
  },

  livePillTextLive: {
    color: BRAND.green,
  },

  livePillTextClosed: {
    color: BRAND.muted,
  },

  tableHeader: {
    flexDirection: "row",
    paddingVertical: 7,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderTopColor: "rgba(148,163,184,0.14)",
    borderBottomColor: "rgba(148,163,184,0.14)",
    marginBottom: 3,
  },

  tableRow: {
    flexDirection: "row",
    paddingVertical: 6,
    paddingHorizontal: 6,
    alignItems: "center",
    borderRadius: 12,
  },

  colSymbol: {
    width: "33%",
    color: BRAND.text,
    fontSize: 12.5,
    fontFamily: TYPO.fontFamily.bold,
  },

  colPrice: {
    width: "22%",
    textAlign: "right",
    color: BRAND.text,
    fontSize: 12.5,
    fontFamily: TYPO.fontFamily.semibold,
    fontVariant: ["tabular-nums"],
  },

  colChange: {
    width: "22%",
    textAlign: "right",
    color: BRAND.text,
    fontSize: 12.5,
    fontFamily: TYPO.fontFamily.bold,
    fontVariant: ["tabular-nums"],
  },

  colPct: {
    width: "23%",
    textAlign: "right",
    color: BRAND.text,
    fontSize: 12.5,
    fontFamily: TYPO.fontFamily.bold,
    fontVariant: ["tabular-nums"],
  },

  sectionSubtle: {
    marginTop: 6,
    marginBottom: 1,
    color: BRAND.muted,
    fontSize: 11,
    fontFamily: TYPO.fontFamily.extrabold,
    textTransform: "uppercase",
    letterSpacing: 0.45,
  },
  marketHealthRow: {
    flexDirection: "row",
    columnGap: 8,
    marginTop: 10,
  },

  healthCard: {
    flex: 1,
    minHeight: 88,
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingTop: 5,
    paddingBottom: 5,
    borderWidth: 1,
    borderColor: "rgba(0,227,150,0.28)",
    backgroundColor: "rgba(8,13,23,0.96)",
    overflow: "hidden",
  },

  healthHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 2,
  },

  healthTitle: {
    color: BRAND.text,
    fontSize: 9,
    fontFamily: TYPO.fontFamily.extrabold,
    textTransform: "uppercase",
    letterSpacing: 0.55,
  },

  gaugeLabel: {
    position: "absolute",
    top: 42,
    color: "#FACC15",
    fontSize: 5,
    fontFamily: TYPO.fontFamily.extrabold,
    letterSpacing: 0.7,
  },

  healthFooter: {
    color: BRAND.muted,
    fontSize: 8.8,
    fontFamily: TYPO.fontFamily.semibold,
    textAlign: "center",
    marginTop: -1,
  },

  riskBarsRow: {
    flexDirection: "row",
    alignItems: "center",
    columnGap: 3,
    marginTop: 18,
    marginBottom: 9,
  },

  riskBar: {
    flex: 1,
    height: 5,
    borderRadius: 999,
    backgroundColor: "rgba(148,163,184,0.16)",
  },

  riskBarActive: {
    height: 12,
    marginTop: -3,
    borderWidth: 1.2,
    borderColor: "#FFFFFF",
  },

  riskValue: {
    color: "#FACC15",
    fontSize: 15,
    fontFamily: TYPO.fontFamily.extrabold,
    textTransform: "uppercase",
    textAlign: "center",
    letterSpacing: -0.25,
  },

  riskSubText: {
    color: BRAND.muted,
    fontSize: 9.5,
    fontFamily: TYPO.fontFamily.semibold,
    marginTop: 2,
    textAlign: "center",
  },
  /* SECTIONS */
  sectionHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },

  sectionTitle: {
    color: BRAND.text,
    fontSize: 18,
    fontFamily: TYPO.fontFamily.extrabold,
    letterSpacing: -0.25,
  },

  viewAll: {
    color: BRAND.green,
    fontSize: 13,
    fontFamily: TYPO.fontFamily.bold,
  },

  moversSubTitle: {
    color: BRAND.sub,
    fontSize: 12,
    fontFamily: TYPO.fontFamily.bold,
    marginBottom: 7,
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },

  mutedNote: {
    color: BRAND.muted,
    fontSize: 12,
    marginBottom: 10,
    backgroundColor: "rgba(17,24,39,0.78)",
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.16)",
    borderRadius: 14,
    paddingVertical: 11,
    paddingHorizontal: 12,
    overflow: "hidden",
    fontFamily: TYPO.fontFamily.semibold,
  },

  /* MOVERS */
  moverGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    rowGap: 10,
  },

  moverCard: {
    width: "48%",
    borderRadius: 18,
    padding: 12,
    borderWidth: 1,
  },

  moverUp: {
    borderColor: "rgba(0,227,150,0.36)",
    backgroundColor: "rgba(0,227,150,0.07)",
  },

  moverDown: {
    borderColor: "rgba(239,68,68,0.34)",
    backgroundColor: "rgba(239,68,68,0.07)",
  },

  moverTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 7,
  },

  moverSymbol: {
    color: BRAND.text,
    fontFamily: TYPO.fontFamily.extrabold,
    fontSize: 14,
  },

  moverPrice: {
    color: BRAND.sub,
    fontSize: 12,
    fontFamily: TYPO.fontFamily.semibold,
    fontVariant: ["tabular-nums"],
  },

  moverChange: {
    fontSize: 13,
    fontFamily: TYPO.fontFamily.bold,
    fontVariant: ["tabular-nums"],
  },

  moverMoveLabel: {
    fontSize: 10.5,
    fontFamily: TYPO.fontFamily.semibold,
    fontStyle: "italic",
    letterSpacing: -0.15,
    marginTop: 5,
  },

  trendBadge: {
    color: BRAND.blue,
    fontSize: 11,
    fontFamily: TYPO.fontFamily.bold,
    marginTop: 6,
  },

  patternBadge: {
    marginTop: 5,
    fontSize: 10.5,
    color: BRAND.amber,
    fontFamily: TYPO.fontFamily.bold,
  },

  /* HIGHLIGHTS */
  highlightsBox: {
    backgroundColor: "rgba(17,24,39,0.88)",
    borderRadius: 22,
    padding: 16,
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.22)",
    marginBottom: 14,
    marginTop: 14,
  },

  highlightItem: {
    color: BRAND.text,
    fontSize: 13,
    lineHeight: 20,
    marginTop: 6,
    fontFamily: TYPO.fontFamily.regular,
  },

  /* MARKET NEWS */
  newsBox: {
    backgroundColor: "rgba(17,24,39,0.9)",
    borderRadius: 24,
    padding: 16,
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.22)",
    marginTop: 18,
  },

  newsHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },

  newsMainTitle: {
    color: BRAND.text,
    fontSize: 19,
    fontFamily: TYPO.fontFamily.extrabold,
    letterSpacing: -0.25,
  },

  newsSubTitle: {
    color: BRAND.muted,
    fontSize: 11.5,
    fontFamily: TYPO.fontFamily.semibold,
    marginTop: 3,
  },

  newsViewAll: {
    color: BRAND.green,
    fontSize: 13,
    fontFamily: TYPO.fontFamily.bold,
  },

  premiumNewsItem: {
    flexDirection: "row",
    paddingVertical: 14,
    paddingRight: 4,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(148,163,184,0.12)",
  },

  newsAccentLine: {
    width: 3,
    borderRadius: 99,
    backgroundColor: "rgba(0,227,150,0.75)",
    marginRight: 12,
  },

  newsContent: {
    flex: 1,
  },

  topStoryPill: {
    alignSelf: "flex-start",
    backgroundColor: "rgba(0,227,150,0.14)",
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginBottom: 6,
  },

  topStoryText: {
    color: BRAND.green,
    fontSize: 9.5,
    fontFamily: TYPO.fontFamily.extrabold,
    letterSpacing: 0.3,
  },

  newsTitle: {
    color: BRAND.text,
    fontFamily: TYPO.fontFamily.bold,
    fontSize: 14,
    lineHeight: 19,
  },

  newsSummary: {
    color: BRAND.sub,
    marginTop: 5,
    fontSize: 12,
    lineHeight: 18,
    fontFamily: TYPO.fontFamily.regular,
  },

  newsMeta: {
    color: BRAND.muted,
    fontSize: 11.5,
    marginTop: 7,
    fontFamily: TYPO.fontFamily.semibold,
  },

  /* AI INSIGHT */
  aiInsightCard: {
    marginTop: 18,
    borderRadius: 22,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(0,227,150,0.07)",
    borderWidth: 1,
    borderColor: "rgba(0,227,150,0.22)",
  },

  aiIconBox: {
    width: 54,
    height: 54,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,227,150,0.12)",
    marginRight: 13,
  },

  aiInsightTitle: {
    color: BRAND.green,
    fontSize: 15,
    fontFamily: TYPO.fontFamily.extrabold,
    marginBottom: 3,
  },

  aiInsightText: {
    color: BRAND.sub,
    fontSize: 12,
    lineHeight: 17,
    fontFamily: TYPO.fontFamily.regular,
  },

  aiInsightButton: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(0,227,150,0.28)",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginLeft: 10,
  },

  aiInsightButtonText: {
    color: BRAND.green,
    fontSize: 13,
    fontFamily: TYPO.fontFamily.bold,
    marginRight: 5,
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

  /* ASTRA */
  astraWrap: {
    position: "absolute",
    left: 20,
    bottom: 25,
    zIndex: 50,
  },

  astraFab: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: "transparent",
    borderWidth: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  gaugeArea: {
    alignItems: "center",
    justifyContent: "center",
    marginTop: -12,
    height: 95,
  },

  gaugeValue: {
    position: "absolute",
    top: 34,
    color: BRAND.text,
    fontSize: 25,
    fontFamily: TYPO.fontFamily.extrabold,
    letterSpacing: -0.8,
  },

  gaugeLabel: {
    position: "absolute",
    top: 66,
    color: "#FACC15",
    fontSize: 10.5,
    fontFamily: TYPO.fontFamily.extrabold,
    letterSpacing: 1,
  },

  healthFooter: {
    color: BRAND.muted,
    fontSize: 9.5,
    fontFamily: TYPO.fontFamily.semibold,
    textAlign: "center",
    marginTop: 1,
  },

  riskBarsRow: {
    flexDirection: "row",
    alignItems: "center",
    columnGap: 3,
    marginTop: 24,
    marginBottom: 13,
  },

  riskBar: {
    flex: 1,
    height: 6,
    borderRadius: 999,
    backgroundColor: "rgba(148,163,184,0.16)",
  },

  riskBarActive: {
    height: 14,
    marginTop: -4,
    borderWidth: 1.4,
    borderColor: "#FFFFFF",
  },

  riskValue: {
    color: "#FACC15",
    fontSize: 17,
    fontFamily: TYPO.fontFamily.extrabold,
    textTransform: "uppercase",
    textAlign: "center",
    letterSpacing: -0.3,
  },

  riskSubText: {
    color: BRAND.muted,
    fontSize: 10,
    fontFamily: TYPO.fontFamily.semibold,
    marginTop: 3,
    textAlign: "center",
  },
  snapshotHeroLeft: {
    flex: 1,
  },

  snapshotBadgeRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 6,
  },

  marketLiveDot: {
    width: 7,
    height: 7,
    borderRadius: 999,
    backgroundColor: BRAND.green,
    marginRight: 7,

    shadowColor: BRAND.green,
    shadowOpacity: 0.9,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 0 },
  },

  snapshotTitleRow: {
    flexDirection: "row",
    alignItems: "center",
  },

  marketMoodPill: {
    marginLeft: 10,
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.18)",
    backgroundColor: "rgba(148,163,184,0.10)",
  },

  marketMoodText: {
    color: BRAND.text,
    fontSize: 10.5,
    fontFamily: TYPO.fontFamily.extrabold,
    letterSpacing: 0.35,
  },

  marketStatusText: {
    color: BRAND.text,
    fontSize: 18,
    fontFamily: TYPO.fontFamily.extrabold,
    letterSpacing: -0.45,
  },
  assetCell: {
    width: "33%",
    flexDirection: "row",
    alignItems: "center",
  },

  assetLogo: {
    width: 18,
    height: 18,
    borderRadius: 9,
    marginRight: 6,
  },

  assetLabel: {
    flex: 1,
    color: BRAND.text,
    fontSize: 12.5,
    fontFamily: TYPO.fontFamily.bold,
  },
  moverSymbolRow: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },

  moverLogo: {
    width: 20,
    height: 20,
    borderRadius: 10,
    marginRight: 6,
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
