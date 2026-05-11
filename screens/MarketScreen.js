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
} from "react-native";

import * as Haptics from "expo-haptics";

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
      next > prev ? "rgba(0,227,150,0.10)" : "rgba(239,68,68,0.10)",
  };
}

function getCarouselItems(carousel, id) {
  return carousel.find((c) => c.id === id)?.items || [];
}

/* ---------------------------------------------------------
   Screen
--------------------------------------------------------- */
export default function MarketScreen({ navigation }) {
  const [overview, setOverview] = useState(null);
  const [carousel, setCarousel] = useState([]);
  const [movers, setMovers] = useState({ gainers: [], losers: [] });

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
        Promise.allSettled([getMarketMovers(), getMarketNews()]).then(
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
    }, 45000);

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
        <Text style={styles.colSymbol} numberOfLines={1}>
          {label}
        </Text>

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
            source: "market_movers",
          });
        }}
      >
        <View style={styles.moverTopRow}>
          <Text style={styles.moverSymbol}>{m.symbol}</Text>
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
        <Text style={styles.headerTitle}>Market</Text>
        <Text style={styles.updatedTime}>Updated {lastUpdated} ET</Text>
      </View>

      <ScrollView
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
            <View>
              <Text style={styles.cardEyebrow}>Market Snapshot</Text>
              <Text style={styles.marketStatusText}>
                {overview?.marketStatus || "Market"} ·{" "}
                {overview?.marketMood || "Overview"}
              </Text>
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

          <Text style={styles.sectionSubtle}>US Market</Text>
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

          <Text style={styles.sectionSubtle}>Crypto</Text>
          {cryptoItems.map((item) => renderMarketRow(item, item.label))}

          <Text style={styles.sectionSubtle}>Commodities (ETFs)</Text>
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

          <View style={styles.chipRow}>
            <View style={styles.infoChip}>
              <Text style={styles.infoChipLabel}>Fear & Greed</Text>
              <Text style={styles.infoChipValue}>
                {overview?.fearGreed?.value ?? "—"}{" "}
                {overview?.fearGreed?.label
                  ? `(${overview.fearGreed.label})`
                  : ""}
              </Text>
            </View>

            <View style={styles.infoChip}>
              <Text style={styles.infoChipLabel}>Risk</Text>
              <Text style={styles.infoChipValue}>
                {deriveRiskLevel(overview?.fearGreed)}
              </Text>
            </View>
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
            {movers.gainers.slice(0, 6).map((m) => renderMoverCard(m, "up"))}
          </View>
        )}

        <Text style={[styles.moversSubTitle, { marginTop: 14 }]}>
          Dropping Fast
        </Text>

        {movers.losers.length === 0 ? (
          <Text style={styles.mutedNote}>Loading movers…</Text>
        ) : (
          <View style={styles.moverGrid}>
            {movers.losers.slice(0, 6).map((m) => renderMoverCard(m, "down"))}
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
          <Text style={styles.sectionTitle}>Market News</Text>

          {news.length === 0 ? (
            <Text style={styles.mutedNote}>Loading market news…</Text>
          ) : (
            [
              { key: "today", label: "Today" },
              { key: "yesterday", label: "Yesterday" },
              { key: "week", label: "Last 7 Days" },
              { key: "older", label: "Older" },
            ].map(({ key, label }) => {
              const items = groupedNews[key];
              if (!items || items.length === 0) return null;

              return (
                <View key={key} style={styles.newsGroup}>
                  <Text style={styles.newsGroupTitle}>{label}</Text>

                  {items.map((n, i) => (
                    <TouchableOpacity
                      key={`${key}-${i}`}
                      style={styles.newsItem}
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
                    </TouchableOpacity>
                  ))}
                </View>
              );
            })
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

      <TouchableOpacity
        style={styles.astraFab}
        activeOpacity={0.85}
        onPress={() => setAstraVisible(true)}
      >
        <AstraAnimatedIcon size={40} />
      </TouchableOpacity>

      <AstraChat
        visible={astraVisible}
        onClose={() => setAstraVisible(false)}
        portfolioData={astraMarketContext}
      />
    </View>
  );
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
    paddingHorizontal: 10,
  },

  scrollContent: {
    paddingTop: 118,
    paddingBottom: 70,
  },

  stickyHeader: {
    position: "absolute",
    top: 0,
    width: "100%",
    backgroundColor: BRAND.bg,
    paddingTop: 55,
    paddingBottom: 8,
    alignItems: "center",
    zIndex: 1000,
    pointerEvents: "box-none",
  },

  headerTitle: {
    color: BRAND.text,
    fontSize: 26,
    fontFamily: TYPO.fontFamily.extrabold,
    letterSpacing: -0.3,
  },

  updatedTime: {
    color: BRAND.sub,
    fontSize: 12,
    marginTop: 2,
    fontFamily: TYPO.fontFamily.medium,
  },

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
  },

  overviewCard: {
    backgroundColor: BRAND.card,
    borderRadius: 22,
    padding: 14,
    borderWidth: 1,
    borderColor: BRAND.border,
    marginBottom: 16,
    marginHorizontal: -4,
  },

  overviewTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 12,
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

  livePillText: {
    color: BRAND.green,
    fontSize: 11,
    fontFamily: TYPO.fontFamily.bold,
  },

  livePillText: {
    color: BRAND.green,
    fontSize: 11,
    fontWeight: "900",
  },

  tableHeader: {
    flexDirection: "row",
    paddingVertical: 7,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderTopColor: BRAND.softBorder,
    borderBottomColor: BRAND.softBorder,
    marginBottom: 6,
  },

  tableRow: {
    flexDirection: "row",
    paddingVertical: 7,
    paddingHorizontal: 2,
    alignItems: "center",
    borderRadius: 10,
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
    marginTop: 10,
    marginBottom: 4,
    color: BRAND.muted,
    fontSize: 11,
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },

  chipRow: {
    flexDirection: "row",
    columnGap: 10,
    marginTop: 14,
  },

  infoChip: {
    flex: 1,
    backgroundColor: BRAND.card2,
    borderWidth: 1,
    borderColor: BRAND.softBorder,
    borderRadius: 14,
    padding: 10,
  },

  infoChipLabel: {
    color: BRAND.muted,
    fontSize: 10.5,
    fontWeight: "800",
    marginBottom: 3,
  },

  infoChipValue: {
    color: BRAND.text,
    fontSize: 12,
    fontWeight: "900",
  },

  sectionHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },

  sectionTitle: {
    color: BRAND.text,
    fontSize: 17,
    fontFamily: TYPO.fontFamily.extrabold,
    letterSpacing: -0.2,
  },

  viewAll: {
    color: BRAND.text,
    fontSize: 13,
    fontFamily: TYPO.fontFamily.semibold,
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
    backgroundColor: BRAND.card2,
    borderWidth: 1,
    borderColor: BRAND.softBorder,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    overflow: "hidden",
  },

  moverGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    rowGap: 10,
  },

  moverCard: {
    width: "48%",
    backgroundColor: BRAND.card2,
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
  },

  moverUp: {
    borderColor: "rgba(0,227,150,0.45)",
    backgroundColor: "rgba(0,227,150,0.07)",
  },

  moverDown: {
    borderColor: "rgba(239,68,68,0.45)",
    backgroundColor: "rgba(239,68,68,0.07)",
  },

  moverTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
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

  trendBadge: {
    color: BRAND.blue,
    fontSize: 11,
    fontWeight: "700",
    marginTop: 6,
  },

  patternBadge: {
    marginTop: 5,
    fontSize: 10.5,
    color: BRAND.amber,
    fontWeight: "800",
  },

  highlightsBox: {
    backgroundColor: BRAND.card,
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: BRAND.border,
    marginBottom: 14,
    marginTop: 14,
    marginHorizontal: -4,
  },

  highlightItem: {
    color: BRAND.text,
    fontSize: 13,
    lineHeight: 20,
    marginTop: 6,
  },

  newsBox: {
    backgroundColor: BRAND.card,
    borderRadius: 22,
    padding: 16,
    borderWidth: 1,
    borderColor: BRAND.border,
    marginTop: 18,
    marginHorizontal: -4,
  },

  newsGroup: {
    marginTop: 10,
  },

  newsGroupTitle: {
    color: BRAND.muted,
    fontSize: 11,
    fontWeight: "900",
    marginBottom: 6,
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },

  newsItem: {
    paddingVertical: 11,
    borderBottomWidth: 1,
    borderBottomColor: BRAND.softBorder,
    backgroundColor: "transparent",
  },

  newsTitle: {
    color: BRAND.text,
    fontFamily: TYPO.fontFamily.bold,
    fontSize: 13,
    lineHeight: 18,
  },

  newsSummary: {
    color: BRAND.sub,
    marginTop: 5,
    fontSize: 12,
    lineHeight: 17,
    fontFamily: TYPO.fontFamily.regular,
  },

  newsMeta: {
    color: BRAND.muted,
    fontSize: 11,
    marginTop: 5,
    fontFamily: TYPO.fontFamily.semibold,
  },
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
  },

  footerBrand: {
    color: BRAND.text,
    fontWeight: "600",
  },

  disclaimer: {
    color: BRAND.muted,
    fontSize: 11,
    lineHeight: 16,
    textAlign: "center",
  },

  astraFab: {
    position: "absolute",
    left: 18,
    bottom: 28,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: BRAND.card2,
    borderWidth: 1,
    borderColor: BRAND.border,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 999,
    elevation: 10,
  },
  livePillLive: {
    backgroundColor: "rgba(0,227,150,0.10)",
    borderColor: "rgba(0,227,150,0.28)",
  },

  livePillClosed: {
    backgroundColor: "rgba(107,114,128,0.10)",
    borderColor: "rgba(107,114,128,0.35)",
  },

  livePillTextLive: {
    color: BRAND.green,
  },

  livePillTextClosed: {
    color: BRAND.muted,
  },
  moverMoveLabel: {
    fontSize: 10.5,
    fontFamily: TYPO.fontFamily.semibold,
    fontStyle: "italic",
    letterSpacing: -0.15,
    marginTop: 5,
  },
});
