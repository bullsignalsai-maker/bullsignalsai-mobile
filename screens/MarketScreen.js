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
  Animated,
} from "react-native";

import {
  getMarketOverview,
  getMarketMovers,
  getMarketNews,
} from "../services/MarketPulseService";
import { Linking } from "react-native";
import * as Haptics from "expo-haptics";
import { Ionicons } from "@expo/vector-icons";
import AstraChat from "../components/AstraChat";
import AstraAnimatedIcon from "../components/AstraAnimatedIcon";
/* ---------------------------------------------------------
   Utils
--------------------------------------------------------- */
function timeAgoFromUtc(iso) {
  if (!iso) return "Just now";
  const d = new Date(iso);
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
    now.getDate()
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
    if (isNaN(d)) return;

    if (d >= startOfToday) {
      groups.today.push(n);
    } else if (d >= startOfYesterday) {
      groups.yesterday.push(n);
    } else if (d >= startOfWeek) {
      groups.week.push(n);
    } else {
      groups.older.push(n);
    }
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
  if (typeof v !== "number") return "—";
  return v >= 1000 ? v.toLocaleString() : v.toFixed(2);
}


function getQuoteNumber(q, key) {
  if (!q || typeof q !== "object") return null;
  const v = q[key];
  return typeof v === "number" ? v : null;
}

function priceFlashStyle(prev, next) {
  if (typeof prev !== "number" || typeof next !== "number") return {};
  if (prev === next) return {};
  return {
    backgroundColor:
      next > prev
        ? "rgba(16,185,129,0.12)"
        : "rgba(239,68,68,0.12)",
  };
}
// ✅ 0) Add this helper near your Utils (top of file)
function tickerFromLabel(label) {
  if (!label) return "";
  const s = String(label);
  const m = s.match(/\(([^)]+)\)/); // "Gold (GLD)" -> "GLD"
  return (m?.[1] || s).trim().toUpperCase(); // "BTC" stays "BTC"
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
  const priceCacheRef = useRef({});
  const prevPriceCacheRef = useRef({});
  const [astraVisible, setAstraVisible] = useState(false);

      const loadData = useCallback(async (silent = false) => {
      try {
        if (refreshing) return;

        if (!silent) setLoading(true);

        const [overviewData, moversData, newsData] = await Promise.all([
          getMarketOverview(),
          getMarketMovers(),
          getMarketNews(),
        ]);
        if (!overviewData || !newsData) return;

          // 1️⃣ snapshot previous prices BEFORE updating
          prevPriceCacheRef.current = { ...priceCacheRef.current };

          setOverview(overviewData.market || {});
          setCarousel(overviewData.carousel || []);

        // ✅ 2) Inside loadData(), AFTER you do: setCarousel(overviewData.carousel || []);
          // put this EXACTLY there (same indentation level as setCarousel)

          const nextCarousel = overviewData.carousel || [];

          // cache current prices by SYMBOL KEY (SPY/QQQ/GLD/BTC/etc)
          nextCarousel.forEach((card) => {
            if (!card?.items) return;

            card.items.forEach((it) => {
              // Use ticker in parentheses if present; else label itself (BTC/ETH/etc)
              const key = tickerFromLabel(it.label);

              const price = it?.quote?.price;
              if (typeof price === "number" && key) {
                priceCacheRef.current[key] = price;
              }
            });
          });

        setMovers(moversData || { gainers: [], losers: [] });
        setHighlights([]); // backend highlights not wired yet
        setNews(Array.isArray(newsData.news) ? newsData.news : []);

        setLastUpdated(timeAgoFromUtc(overviewData.market?.updated_at));


        console.warn("MarketScreen error:", e.message);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    }, []);


      useEffect(() => {
        loadData(false);
        const i = setInterval(() => loadData(true), 45000);
        return () => clearInterval(i);
      }, [loadData]);
      const onRefresh = async () => {
        setRefreshing(true);
        await loadData(true);
        setRefreshing(false);
      };


      if (loading || !overview) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#00E396" />
        <Text style={styles.loadingText}>Analyzing market pulse…</Text>
      </View>
    );
  }
  const groupedNews = groupNewsByDate(news);
  const astraMarketContext = {
    contextType: "market",
    total_value: 0,
    total_gain: 0,
    today_gain: 0,
    positions: [],
  };
  return (
    <View style={styles.wrapper}>
      <StatusBar barStyle="light-content" backgroundColor="#000" />

      <View style={styles.stickyHeader}>
        <Text style={styles.headerTitle}>Market</Text>
        <Text style={styles.updatedTime}>Updated {lastUpdated} ET</Text>
      </View>
      <ScrollView
        style={styles.container}
        contentContainerStyle={{ paddingTop: 118, paddingBottom: 60 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#00E396"
          />
        }
      >

       
        {/* MARKET OVERVIEW — MARKETWATCH STYLE */}
          <View style={styles.overviewCard}>

            {/* HEADER */}
            <Text style={styles.marketStatusText}>
              {overview.marketStatus} • {overview.marketMood}
            </Text>

            {/* TABLE HEADER */}
            <View style={styles.tableHeader}>
              <Text style={[styles.colSymbol]}> </Text>
              <Text style={styles.colPrice}>Price</Text>
              <Text style={styles.colChange}>Change</Text>
              <Text style={styles.colPct}>% Chg</Text>
            </View>

            {/* ===== US MARKET ===== */}
            {carousel.find(c => c.id === "us_market")?.items?.map(item => {
              const q = item.quote || {};
              if (q.price == null || q.changePct == null) return null;

              const price = q.price;
              const up = q.changePct >= 0;

              const ticker = tickerFromLabel(item.label); // SPY / QQQ
              const symbolLabel =
                ticker === "SPY" ? "S&P 500 (SPY)" : "Nasdaq (QQQ)";

              const prevPrice = prevPriceCacheRef.current[ticker];


              return (
                <View
                  key={ticker}
                  style={[
                    styles.tableRow,
                    priceFlashStyle(prevPrice, price),
                  ]}
                >
                  <Text style={styles.colSymbol}>{symbolLabel}</Text>

                  <Text style={styles.colPrice}>
                    ${formatPrice(price)}
                  </Text>

                  <Text style={[styles.colChange, { color: up ? "#00E396" : "#EF4444" }]}>
                    {up ? "▲" : "▼"} {Math.abs(q.change).toFixed(2)}
                  </Text>

                  <Text style={[styles.colPct, { color: up ? "#00E396" : "#EF4444" }]}>
                    {Math.abs(q.changePct).toFixed(2)}%
                  </Text>
                </View>
              );
            })}


            {/* ===== CRYPTO ===== */}
            {carousel.find(c => c.id === "crypto")?.items
              ?.filter(i => ["BTC", "ETH", "SOL", "XRP"].includes(i.label))
              .map(item => {
                const q = item.quote || {};
                if (q.price == null || q.changePct == null) return null;

                const price = q.price;
                const up = q.changePct >= 0;

                const symbol = item.label; // BTC / ETH / SOL / XRP
                const prevPrice = prevPriceCacheRef.current[symbol];

                return (
                  <View
                    key={symbol}
                    style={[
                      styles.tableRow,
                      priceFlashStyle(prevPrice, price),
                    ]}
                  >
                    <Text style={styles.colSymbol}>{symbol}</Text>

                    <Text style={styles.colPrice}>
                      ${formatPrice(price)}
                    </Text>

                    <Text style={[styles.colChange, { color: up ? "#00E396" : "#EF4444" }]}>
                      {up ? "▲" : "▼"} {Math.abs(price * q.changePct / 100).toFixed(2)}
                    </Text>

                    <Text style={[styles.colPct, { color: up ? "#00E396" : "#EF4444" }]}>
                      {Math.abs(q.changePct).toFixed(2)}%
                    </Text>
                  </View>
                );
              })}


            {/* ===== COMMODITIES (ETFs) ===== */}
            <Text style={styles.sectionSubtle}>Commodities (ETFs)</Text>

            {carousel.find(c => c.id === "commodities")?.items?.map(item => {
              const q = item.quote || {};
              if (q.price == null || q.changePct == null) return null;

              const price = q.price;
              const up = q.changePct >= 0;

              const symbol = tickerFromLabel(item.label); // GLD / USO / SLV
              const prevPrice = prevPriceCacheRef.current[symbol];

              return (
                <View
                  key={symbol}
                  style={[
                    styles.tableRow,
                    priceFlashStyle(prevPrice, price),
                  ]}
                >
                  <Text style={styles.colSymbol}>
                    {symbol === "GLD" ? "Gold (GLD)" :
                    symbol === "USO" ? "Oil (USO)" :
                    "Silver (SLV)"}
                  </Text>

                  <Text style={styles.colPrice}>
                    ${formatPrice(price)}
                  </Text>

                  <Text style={[styles.colChange, { color: up ? "#00E396" : "#EF4444" }]}>
                    {up ? "▲" : "▼"} {Math.abs(q.change).toFixed(2)}
                  </Text>

                  <Text style={[styles.colPct, { color: up ? "#00E396" : "#EF4444" }]}>
                    {Math.abs(q.changePct).toFixed(2)}%
                  </Text>
                </View>
              );
            })}


            {/* FOOTER */}
            <View style={styles.overviewFooterRow}>
              <Text style={styles.overviewMeta}>
                Fear & Greed{" "}
                <Text style={styles.overviewMetaValue}>
                  {overview.fearGreed?.value} ({overview.fearGreed?.label})
                </Text>
              </Text>

              <Text style={styles.overviewMeta}>
                Risk{" "}
                <Text style={styles.overviewMetaValue}>
                  {deriveRiskLevel(overview.fearGreed)}
                </Text>
              </Text>
            </View>

          </View>


        {/* MARKET MOVERS */}
          <View style={styles.moversHeaderRow}>
            <Text style={styles.sectionTitle}>Market Movers</Text>

            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => navigation.navigate("MarketMoversScreen")}
            >
              <Text style={styles.viewAll}>View all →</Text>
            </TouchableOpacity>
          </View>

          {/* GAINERS */}
          <Text style={styles.moversSubTitle}>Top Gainers</Text>
          <View style={styles.moverGrid}>
            {movers.gainers.slice(0, 6).map((m) => {
              const isUp = m.change >= 0;

              return (
                <TouchableOpacity
                  key={m.symbol}
                  activeOpacity={0.85}
                  style={[styles.moverCard, styles.moverUp]}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    navigation.navigate("StockDetailScreen", {
                      symbol: m.symbol,
                      name: m.company || m.symbol,
                      source: "market_movers",
                    });
                  }}
                >
                  {/* TOP ROW */}
                  <View style={styles.moverTopRow}>
                    <Text style={styles.moverSymbol}>{m.symbol}</Text>
                    <Text style={styles.moverPrice}>
                      ${m.price?.toFixed(2) ?? "—"}
                    </Text>
                  </View>

                  {/* CHANGE ROW */}
                  <View style={styles.moverMidRow}>
                    <Text
                      style={[
                        styles.moverChange,
                        { color: isUp ? "#00E396" : "#EF4444" },
                      ]}
                    >
                      {isUp ? "▲" : "▼"}{" "}
                      {Math.abs(m.change).toFixed(2)} (
                      {Math.abs(m.changePct).toFixed(2)}%)
                    </Text>

                    {m.trendLabel && (
                      <Text style={styles.trendBadge}>{m.trendLabel}</Text>
                    )}
                  </View>

                  {m.pattern && (
                    <Text style={styles.patternBadge}>{m.pattern}</Text>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>

          {/* LOSERS */}
          <Text style={[styles.moversSubTitle, { marginTop: 14 }]}>
            Top Losers
          </Text>
          <View style={styles.moverGrid}>
            {movers.losers.slice(0, 6).map((m) => {
              const isUp = m.change >= 0;

              return (
                <TouchableOpacity
                  key={m.symbol}
                  activeOpacity={0.85}
                  style={[styles.moverCard, styles.moverDown]}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    navigation.navigate("StockDetailScreen", {
                      symbol: m.symbol,
                      name: m.company || m.symbol,
                      source: "market_movers",
                    });
                  }}
                >
                  {/* TOP ROW */}
                  <View style={styles.moverTopRow}>
                    <Text style={styles.moverSymbol}>{m.symbol}</Text>
                    <Text style={styles.moverPrice}>
                      ${m.price?.toFixed(2) ?? "—"}
                    </Text>
                  </View>

                  {/* CHANGE ROW */}
                  <View style={styles.moverMidRow}>
                    <Text
                      style={[
                        styles.moverChange,
                        { color: isUp ? "#00E396" : "#EF4444" },
                      ]}
                    >
                      {isUp ? "▲" : "▼"}{" "}
                      {Math.abs(m.change).toFixed(2)} (
                      {Math.abs(m.changePct).toFixed(2)}%)
                    </Text>

                    {m.trendLabel && (
                      <Text style={styles.trendBadge}>{m.trendLabel}</Text>
                    )}
                  </View>

                  {m.pattern && (
                    <Text style={styles.patternBadge}>{m.pattern}</Text>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>


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

            {[
              { key: "today", label: "Today" },
              { key: "yesterday", label: "Yesterday" },
              { key: "week", label: "Last 7 Days" },
              { key: "older", label: "Older" },
            ].map(({ key, label }) => {
              const items = groupedNews[key];
              if (!items || items.length === 0) return null;

              return (
                <View key={key} style={{ marginTop: 10 }}>
                  <Text style={styles.newsGroupTitle}>{label}</Text>

                  {items.map((n, i) => (
                    <TouchableOpacity
                      key={`${key}-${i}`}
                      style={styles.newsItem}
                      activeOpacity={0.85}
                      onPress={() => n.link && Linking.openURL(n.link)}
                    >
                      <Text style={styles.newsTitle}>{n.title}</Text>

                      {n.summary ? (
                        <Text style={styles.newsSummary} numberOfLines={2}>
                          {n.summary}
                        </Text>
                      ) : null}

                      <Text style={styles.newsMeta}>
                        {n.source} · {timeAgoFromUtc(n.pubDate)} ↗
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              );
            })}
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
  wrapper: { flex: 1, backgroundColor: "#000" },
  container: { flex: 1, paddingHorizontal: 10 },

  stickyHeader: {
  position: "absolute",
  top: 0,
  width: "100%",
  backgroundColor: "#000",
  paddingTop: 55,
  paddingBottom: 6,
  borderBottomWidth: 0,
  borderBottomColor: "#1F2937",
  alignItems: "center",
  zIndex: 1000,
  pointerEvents: "box-none", // ✅ keep
},
  headerTitle: { color: "#00E396", fontSize: 22, fontWeight: "700" },
  updatedTime: { color: "#9CA3AF", fontSize: 12 },

  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#000",
  },
  loadingText: { color: "#9CA3AF", marginTop: 8 },

  sectionTitle: {
    color: "#00E396",
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 8,
  },

  marketHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },

  overviewRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 8,
  },

  overviewMetric: { flex: 1, alignItems: "center" },
  overviewLabel: { color: "#9CA3AF", fontSize: 12 },
  overviewValue: { fontSize: 18, fontWeight: "700" },

  divider: {
    height: 1,
    backgroundColor: "#1F2937",
    marginVertical: 10,
  },

  marketRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },

  marketMeta: { color: "#9CA3AF", fontSize: 13 },
  metaValue: { color: "#fff", fontWeight: "700" },

  moversCard: {
  backgroundColor: "#0B1220",
  borderRadius: 18,
  padding: 16,
  borderWidth: 1,
  borderColor: "#1F2937",
  marginBottom: 14,
  marginHorizontal: -4,

  // ✅ ADD THESE
  zIndex: 20,
  elevation: 20,
},


  moversSubTitle: {
    color: "#E5E7EB",
    fontSize: 13,
    fontWeight: "700",
    marginBottom: 6,
  },

  moverStrip: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    rowGap: 8,
  },

  moverPill: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderWidth: 1,
    minWidth: "48%",
  },

  moverPillUp: {
    backgroundColor: "rgba(16,185,129,0.08)",
    borderColor: "#10B981",
  },

  moverPillDown: {
    backgroundColor: "rgba(239,68,68,0.08)",
    borderColor: "#EF4444",
  },

  moverSymbol: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 13,
    marginRight: 6,
  },

  moverPctUp: {
    color: "#00E396",
    fontWeight: "700",
    fontSize: 12,
  },

  moverPctDown: {
    color: "#EF4444",
    fontWeight: "700",
    fontSize: 12,
  },

  highlightsBox: {
    backgroundColor: "#111827",
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: "#1F2937",
    marginBottom: 12,
    marginHorizontal: -4,
  },

  highlightUp: { color: "#00E396", marginTop: 4 },
  highlightNeutral: { color: "#D4A017", marginTop: 4 },
  highlightDown: { color: "#EF4444", marginTop: 4 },

  newsBox: {
  backgroundColor: "#111827",
  borderRadius: 18,
  padding: 16,
  borderWidth: 1,
  borderColor: "#1F2937",
  marginHorizontal: -4,

  // ✅ ADD THESE
  zIndex: 20,
  elevation: 20,
},


  newsItem: {
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#1F2937",
  },

  newsTitle: { color: "#fff", fontWeight: "700" },
  newsSummary: { color: "#9CA3AF", marginTop: 4 },
  

overviewMetricCompact: {
  flex: 1,
  alignItems: "center",
},

overviewFooter: {
  marginTop: 6,
  flexDirection: "row",
  justifyContent: "space-between",
},
moverGrid: {
  flexDirection: "row",
  flexWrap: "wrap",
  justifyContent: "space-between",
  rowGap: 10,
},

moverCard: {
  width: "48%",
  backgroundColor: "#020617",
  borderRadius: 14,
  padding: 12,
  borderWidth: 1,
},

moverUp: {
  borderColor: "#10B981",
  backgroundColor: "rgba(16,185,129,0.08)",
},

moverDown: {
  borderColor: "#EF4444",
  backgroundColor: "rgba(239,68,68,0.08)",
},

moverTopRow: {
  flexDirection: "row",
  justifyContent: "space-between",
  marginBottom: 6,
},

moverMidRow: {
  flexDirection: "row",
  justifyContent: "space-between",
  alignItems: "center",
},

moverSymbol: {
  color: "#FFFFFF",
  fontWeight: "700",
  fontSize: 14,
},

moverPrice: {
  color: "#9CA3AF",
  fontSize: 12,
},

moverPctUp: {
  color: "#00E396",
  fontWeight: "700",
  fontSize: 13,
},

moverPctDown: {
  color: "#EF4444",
  fontWeight: "700",
  fontSize: 13,
},

trendBadge: {
  color: "#93C5FD",
  fontSize: 11,
  fontWeight: "600",
},

patternBadge: {
  marginTop: 6,
  fontSize: 11,
  color: "#FACC15",
  fontWeight: "600",
},
moversHeaderRow: {
  flexDirection: "row",
  justifyContent: "space-between",
  alignItems: "center",
  marginBottom: 6,
},

viewAll: {
  color: "#60A5FA",
  fontSize: 13,
  fontWeight: "700",
},
newsMeta: {
  color: "#6B7280",
  fontSize: 11,
  marginTop: 4,
},
highlightItem: {
  color: "#E5E7EB",
  fontSize: 13,
  lineHeight: 20,
  marginTop: 6,
},
marketStatusText: {
  color: "#E5E7EB",
  fontSize: 15,
  fontWeight: "700",
  marginBottom: 10,
},

snapshotTitle: {
  color: "#D1D5DB",
  fontSize: 12,
  fontWeight: "600",
  marginBottom: 6,
},

snapshotLabel: {
  color: "#9CA3AF",
  fontSize: 12,
},

snapshotValue: {
  fontSize: 15,
  fontWeight: "700",
},

sentimentText: {
  color: "#9CA3AF",
  fontSize: 13,
},

sentimentValue: {
  color: "#FFFFFF",
  fontWeight: "700",
},
overviewCard: {
  backgroundColor: "#0B1220",
  borderRadius: 18,
  padding: 12,
  borderWidth: 1,
  borderColor: "#1F2937",
  marginBottom: 14,
  marginHorizontal: -4,
},

marketStatusLine: {
  color: "#9CA3AF",
  fontSize: 13,
  marginBottom: 8,
},

overviewRow: {
  paddingRight: 12,
  marginBottom: 6,
},

overviewFooterRow: {
  flexDirection: "row",
  justifyContent: "space-between",
  marginTop: 6,
},

overviewMeta: {
  color: "#9CA3AF",
  fontSize: 12,
},

overviewMetaValue: {
  color: "#FFFFFF",
  fontWeight: "700",
},
fadeLeft: {
  position: "absolute",
  left: 0,
  top: 52,
  bottom: 0,
  width: 16,
  backgroundColor: "rgba(11,18,32,0.9)",
},

fadeRight: {
  position: "absolute",
  right: 0,
  top: 52,
  bottom: 0,
  width: 16,
  backgroundColor: "rgba(11,18,32,0.9)",
},


overviewHeaderRow: {
  flexDirection: "column",   // ✅ stack vertically
  alignItems: "flex-start",
  marginBottom: 8,
},

newsItem: {
  paddingVertical: 10,
  borderBottomWidth: 1,
  borderBottomColor: "#1F2937",
  backgroundColor: "transparent", // ✅ important
},

newsGroupTitle: {
  color: "#9CA3AF",
  fontSize: 12,
  fontWeight: "700",
  marginBottom: 6,
},

moverChange: {
  fontSize: 13,
  fontWeight: "700",
},
tableHeader: {
  flexDirection: "row",
  paddingVertical: 6,
  borderBottomWidth: 1,
  borderBottomColor: "#374151",
  marginBottom: 4,
},

tableRow: {
  flexDirection: "row",
  paddingVertical: 6,
  alignItems: "center",
},

colSymbol: {
  width: "32%",
  color: "#E5E7EB",
  fontSize: 13,
  fontWeight: "700",
},

colPrice: {
  width: "22%",
  textAlign: "right",
  color: "#FFFFFF",
  fontSize: 13,
  fontWeight: "600",
},

colChange: {
  width: "22%",
  textAlign: "right",
  fontSize: 13,
  fontWeight: "600",
  color: "#FFFFFF", // ✅ base color (arrow overrides)
},

colPct: {
  width: "24%",
  textAlign: "right",
  fontSize: 13,
  fontWeight: "700",
  color: "#FFFFFF", // ✅ base color
},
sectionSubtle: {
  marginTop: 10,
  marginBottom: 4,
  color: "#9CA3AF",
  fontSize: 12,
  fontWeight: "600",
},
astraFab: {
  position: "absolute",
  left: 18,
  bottom: 28,
  width: 40,
  height: 40,
  borderRadius: 20,
  backgroundColor: "#020617",
  borderWidth: 1,
  borderColor: "#1F2937",
  alignItems: "center",
  justifyContent: "center",
  zIndex: 999,
  elevation: 10,
},
});
