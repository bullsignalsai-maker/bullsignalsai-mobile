// screens/MarketScreen.js
import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  StatusBar,
  TouchableOpacity,
} from "react-native";

import {
  getMarketPulse,
  getMarketOverview,
  getHotlist,
  getBearwatch,
} from "../services/MarketPulseService";

import LiveMarketStatus from "../components/LiveMarketStatus";

function timeAgoFromUtc(isoString) {
  if (!isoString || typeof isoString !== "string") return "Just now";

  const parsed = new Date(isoString);
  if (isNaN(parsed.getTime())) return "Just now";

  const diffMs = Date.now() - parsed.getTime();
  const diffSec = Math.floor(diffMs / 1000);

  if (diffSec < 30) return "Just now";
  if (diffSec < 60) return `${diffSec}s ago`;

  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin} min ago`;

  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr} hr ago`;

  const diffDay = Math.floor(diffHr / 24);
  return `${diffDay} day${diffDay > 1 ? "s" : ""} ago`;
}

/* ---------------------------------------------------------
   Market Hours (unchanged)
--------------------------------------------------------- */
function isMarketOpen() {
  const now = new Date();
  const est = new Date(
    now.toLocaleString("en-US", { timeZone: "America/New_York" })
  );
  const day = est.getDay();
  const hour = est.getHours();
  const minute = est.getMinutes();

  if (day === 0 || day === 6) return false;
  if (hour < 9 || (hour === 9 && minute < 30)) return false;
  if (hour >= 16) return false;
  return true;
}

export default function MarketScreen({ navigation }) {
  const [overview, setOverview] = useState(null);
  const [pulse, setPulse] = useState(null);

  const [news, setNews] = useState({
    today: [],
    yesterday: [],
    week: [],
    older: [],
  });

  const [hotlist, setHotlist] = useState([]);
  const [bearwatch, setBearwatch] = useState([]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState("");
  const [marketStatus, setMarketStatus] = useState(
    isMarketOpen() ? "Open" : "Closed"
  );

  /* ---------------------------------------------------------
     Market open badge refresh
  --------------------------------------------------------- */
  useEffect(() => {
    const interval = setInterval(() => {
      setMarketStatus(isMarketOpen() ? "Open" : "Closed");
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  /* ---------------------------------------------------------
     LOAD DATA (Firestore-first)
  --------------------------------------------------------- */
  const loadPulse = useCallback(async (silent = false) => {
    try {
      if (!silent) setLoading(true);

      const [pulseData, overviewData, hotData, bearData] =
        await Promise.all([
          getMarketPulse(),
          getMarketOverview(),
          getHotlist(),
          getBearwatch(),
        ]);

      if (!pulseData) throw new Error("No market pulse data");

      setPulse({
        highlights_grouped: pulseData.highlights_grouped || {
          bullish: [],
          neutral: [],
          bearish: [],
        },
      });

      setOverview(overviewData || {});
      setNews(pulseData.news_grouped || {});
      setHotlist(hotData?.hotlist || []);
      setBearwatch(bearData?.bearwatch || []);

          const updatedLabel = timeAgoFromUtc(
            pulseData?.updated_at || overviewData?.updated_at
            );
          setLastUpdated(updatedLabel);

      
    } catch (err) {
      console.warn("MarketScreen load error:", err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadPulse(false);
  }, [loadPulse]);

  useEffect(() => {
    const interval = setInterval(() => loadPulse(true), 45000);
    return () => clearInterval(interval);
  }, [loadPulse]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadPulse(true);
  };

  // ---------------------------------------------------------
// RENDER NEWS ITEM
// ---------------------------------------------------------
const renderNewsItem = (n, i) => {
  const catColor =
    n.category === "Earnings"
      ? "#00E396"
      : n.category === "Fed / Macro"
      ? "#D4A017"
      : n.category === "M&A"
      ? "#3B82F6"
      : n.category === "Tech / AI"
      ? "#8B5CF6"
      : "#9CA3AF";

  return (
    <TouchableOpacity
      key={i}
      style={styles.newsItem}
      onPress={() =>
        navigation.navigate("NewsDetailScreen", { item: n })
      }
    >
      <Text style={styles.newsTitle}>{n.title}</Text>

      {n.summary ? (
        <Text style={styles.newsSummary}>{n.summary}</Text>
      ) : null}

      <View style={styles.newsMetaRow}>
        {n.source ? (
          <Text style={styles.newsSource}>{n.source}</Text>
        ) : null}

        {n.category ? (
          <>
            <Text style={styles.newsDot}> • </Text>
            <Text style={[styles.newsCategory, { color: catColor }]}>
              {n.category}
            </Text>
          </>
        ) : null}

        {n.ticker ? (
          <>
            <Text style={styles.newsDot}> • </Text>
            <Text style={styles.newsTicker}>{n.ticker}</Text>
          </>
        ) : null}

        {(n.timeFormatted || n.dateFormatted) && (
          <>
            <Text style={styles.newsDot}> • </Text>
            <Text style={styles.newsTime}>
              {n.timeFormatted} — {n.dateFormatted}
            </Text>
          </>
        )}
      </View>
    </TouchableOpacity>
  );
};

  /* ---------------------------------------------------------
     LOADING STATE
  --------------------------------------------------------- */
  if (loading || !pulse || !overview) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#00E396" />
        <Text style={styles.loadingText}>Analyzing market pulse…</Text>
      </View>
    );
  }

  const { bullish, neutral, bearish } = pulse.highlights_grouped || {};

  /* ---------------------------------------------------------
     UI
  --------------------------------------------------------- */
  return (
    <View style={styles.wrapper}>
      <StatusBar backgroundColor="#000" barStyle="light-content" />

      <View style={styles.stickyHeader}>
        <Text style={styles.headerTitle}>Market Insights</Text>
        <Text style={styles.updatedTime}>Updated {lastUpdated} ET</Text>
      </View>

      <ScrollView
        style={styles.container}
        contentContainerStyle={{ paddingTop: 100, paddingBottom: 60 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#00E396"
          />
        }
      >

        {/* ————————— MARKET OVERVIEW ————————— */}
        <View style={styles.overviewBox}>
          <View style={styles.marketHeaderRow}>
            <Text style={styles.sectionTitle}>Market Overview</Text>
            <LiveMarketStatus marketStatus={marketStatus} />
          </View>

          {/* SP500 / Fear-Greed / VIX */}
          <View style={styles.metricGrid}>
            <View style={styles.metricCell}>
              <Text style={styles.metricLabel}>S&P 500</Text>
              <Text
                style={[
                  styles.metricValue,
                  {
                    color:
                      overview.sp500_change >= 0 ? "#00E396" : "#EF4444",
                  },
                ]}
              >
                {overview.sp500_change >= 0 ? "+" : ""}
                {overview.sp500_change?.toFixed(2)}%
              </Text>
              <Text style={styles.metricNote}>
                {overview.sp500_change >= 0 ? "Up today" : "Down today"}
              </Text>
            </View>

            <View style={styles.metricCell}>
              <Text style={styles.metricLabel}>Market Mood</Text>
              <Text style={[styles.metricValue, { color: "#D4A017" }]}>
                {overview.fearGreed?.label}
              </Text>
              <Text style={styles.metricNote}>
                Index: {overview.fearGreed?.value}
              </Text>
            </View>

            <View style={styles.metricCell}>
              <Text style={styles.metricLabel}>VIX</Text>
              <Text style={[styles.metricValue, { color: "#00E396" }]}>
                {overview.vix}
              </Text>
              <Text style={styles.metricNote}>
                {overview.vix < 15
                  ? "Low"
                  : overview.vix < 25
                  ? "Normal"
                  : "High"}
              </Text>
            </View>
          </View>

          <View style={styles.divider} />
          <Text style={styles.riskText}>
            Risk Level: {overview.risk_level}
          </Text>
        </View>

        {/* ————————— AI HOTLIST (BullBrain v2) ————————— */}
        <View style={styles.aiBox}>
          <Text style={styles.sectionTitle}>BullBrain Hotlist</Text>
          <Text style={styles.aiSubText}>
            Top AI-ranked watchlist BUY setups across the S&P 500.
          </Text>

          {hotlist.length === 0 ? (
            <Text style={styles.aiEmptyText}>
              No hotlist available yet. Pull to refresh or check back later.
            </Text>
          ) : (
            hotlist.slice(0, 5).map((item, idx) => {
              const upPct = (item.prob_up * 100).toFixed(1);
              const downPct = (item.prob_down * 100).toFixed(1);
              const confidence = (item.confidence ?? 0).toFixed(1);

              return (
                <View key={item.symbol + idx} style={styles.aiCard}>

                {/* Header row: symbol + tag + company name + probabilities */}
                <View style={styles.aiCardHeaderRow}>

                  {/* LEFT SIDE: Symbol + BUY tag + Company Name */}
                  <View style={styles.aiLeftBlock}>
                    <View style={{ flexDirection: "row", alignItems: "center" }}>
                      <Text style={styles.aiSymbol}>{item.symbol}</Text>

                      <View style={styles.aiTagBuy}>
                        <Text style={styles.aiTagText}>BUY</Text>
                      </View>
                    </View>

                    {/* Company name (wrap max 2 lines) */}
                    {item.company_name ? (
                      <Text
                        style={styles.aiCompanyText}
                        numberOfLines={2}
                        ellipsizeMode="tail"
                      >
                        {item.company_name}
                      </Text>
                    ) : null}
                  </View>

                  {/* RIGHT SIDE: Probabilities */}
                  <View style={styles.aiRightBlock}>
                    <Text style={styles.aiProbLine}>
                      ↑ {upPct}%   ↓ {downPct}%
                    </Text>
                    <Text style={styles.aiConf}>Confidence: {confidence}%</Text>
                  </View>

                </View>

                {/* Short explanation */}
                {item.explanation_short ? (
                  <Text style={styles.aiShortText}>{item.explanation_short}</Text>
                ) : null}

                {/* Risk explanation */}
                {item.explanation_risk ? (
                  <Text style={styles.aiRiskText}>{item.explanation_risk}</Text>
                ) : null}

              </View>


              );
            })
          )}
        </View>

        {/* ————————— BEARWATCH (BullBrain v2) ————————— */}
        <View style={styles.aiBox}>
          <Text style={styles.sectionTitle}>BearWatch Radar</Text>
          <Text style={styles.aiSubText}>
            AI-flagged downside risk zones — SELL / HOLD candidates.
          </Text>

          {bearwatch.length === 0 ? (
            <Text style={styles.aiEmptyText}>
              No BearWatch data yet. Pull to refresh or check back later.
            </Text>
          ) : (
            bearwatch.slice(0, 5).map((item, idx) => {
              const upPct = (item.prob_up * 100).toFixed(1);
              const downPct = (item.prob_down * 100).toFixed(1);
              const confidence = (item.confidence ?? 0).toFixed(1);

              const isSell = item.signal === "SELL";
              const tagStyle = isSell ? styles.aiTagSell : styles.aiTagHold;

              return (
               <View key={item.symbol + idx} style={styles.aiCard}>

                {/* Header row */}
                <View style={styles.aiCardHeaderRow}>

                  {/* LEFT SIDE: Symbol + SELL tag + Company Name */}
                  <View style={styles.aiLeftBlock}>
                    <View style={{ flexDirection: "row", alignItems: "center" }}>
                      <Text style={styles.aiSymbol}>{item.symbol}</Text>

                      <View style={tagStyle}>
                        <Text style={styles.aiTagText}>{item.signal}</Text>
                      </View>
                    </View>

                    {/* Company name (wrap max 2 lines) */}
                    {item.company_name ? (
                      <Text
                        style={styles.aiCompanyText}
                        numberOfLines={2}
                        ellipsizeMode="tail"
                      >
                        {item.company_name}
                      </Text>
                    ) : null}
                  </View>

                  {/* RIGHT SIDE: Probabilities */}
                  <View style={styles.aiRightBlock}>
                    <Text style={styles.aiProbLine}>
                      ↓ {downPct}%   ↑ {upPct}%
                    </Text>
                    <Text style={styles.aiConf}>Confidence: {confidence}%</Text>
                  </View>

                </View>

                {/* Short explanation */}
                {item.explanation_short ? (
                  <Text style={styles.aiShortText}>{item.explanation_short}</Text>
                ) : null}

                {/* Risk explanation */}
                {item.explanation_risk ? (
                  <Text style={styles.aiRiskText}>{item.explanation_risk}</Text>
                ) : null}

              </View>


              );
            })
          )}
        </View>

        {/* ————————— MARKET HIGHLIGHTS ————————— */}
        <View className="highlightsBox" style={styles.highlightsBox}>
          <Text style={styles.sectionTitle}>Market Highlights</Text>

          {/* BULLISH */}
          {bullish.length > 0 && (
            <>
              <Text style={styles.highlightGroupTitle}>
                📈 Bullish Momentum
              </Text>
              {bullish.map((h, i) => (
                <View key={i} style={styles.highlightItem}>
                  <Text
                    style={[styles.highlightText, { color: "#00E396" }]}
                  >
                    {h}
                  </Text>
                </View>
              ))}
            </>
          )}

          {/* NEUTRAL */}
          {neutral.length > 0 && (
            <>
              <Text style={styles.highlightGroupTitle}>
                ⚖️ Neutral Signals
              </Text>
              {neutral.map((h, i) => (
                <View key={i} style={styles.highlightItem}>
                  <Text
                    style={[styles.highlightText, { color: "#D4A017" }]}
                  >
                    {h}
                  </Text>
                </View>
              ))}
            </>
          )}

          {/* BEARISH */}
          {bearish.length > 0 && (
            <>
              <Text style={styles.highlightGroupTitle}>
                📉 Bearish Pressure
              </Text>
              {bearish.map((h, i) => (
                <View key={i} style={styles.highlightItem}>
                  <Text
                    style={[styles.highlightText, { color: "#EF4444" }]}
                  >
                    {h}
                  </Text>
                </View>
              ))}
            </>
          )}
        </View>

        {/* ————————— GROUPED MARKET NEWS ————————— */}
        <View style={styles.newsBox}>
          <Text style={styles.sectionTitle}>Market News</Text>

          <>
            {news.today?.length > 0 && (
              <>
                <Text style={styles.newsDayTitle}>Today</Text>
                {news.today.map(renderNewsItem)}
              </>
            )}

            {news.yesterday?.length > 0 && (
              <>
                <Text style={styles.newsDayTitle}>Yesterday</Text>
                {news.yesterday.map(renderNewsItem)}
              </>
            )}

            {news.week?.length > 0 && (
              <>
                <Text style={styles.newsDayTitle}>This Week</Text>
                {news.week.map(renderNewsItem)}
              </>
            )}

            {news.older?.length > 0 && (
              <>
                <Text style={styles.newsDayTitle}>Older</Text>
                {news.older.map(renderNewsItem)}
              </>
            )}
          </>
        </View>
      </ScrollView>
    </View>
  );
}

// ———————————————————————————
// STYLES
// ———————————————————————————
const styles = StyleSheet.create({
  wrapper: { flex: 1, backgroundColor: "#000" },
  container: { flex: 1, paddingHorizontal: 18 },

  stickyHeader: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: "#000",
    borderBottomWidth: 1,
    borderBottomColor: "#1F2937",
    paddingTop: 55,
    paddingBottom: 5,
    zIndex: 1000,
    alignItems: "center",
  },

  headerTitle: { color: "#00E396", fontSize: 22, fontWeight: "700" },
  updatedTime: { color: "#9CA3AF", fontSize: 12, marginTop: 3 },

  loadingContainer: {
    flex: 1,
    backgroundColor: "#000",
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: { color: "#9CA3AF", marginTop: 10 },

  sectionTitle: {
    color: "#00E396",
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 8,
  },

  overviewBox: {
    backgroundColor: "#111827",
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: "#1F2937",
    marginBottom: 12,
    marginTop: 8,
  },

  marketHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },

  metricGrid: { flexDirection: "row", justifyContent: "space-between" },
  metricCell: { flex: 1, alignItems: "center" },

  metricLabel: { color: "#9CA3AF", fontSize: 13, marginBottom: 4 },
  metricValue: { fontSize: 17, fontWeight: "700" },
  metricNote: { color: "#9CA3AF", fontSize: 12, marginTop: 2 },

  divider: { height: 1, backgroundColor: "#1F2937", marginVertical: 10 },
  riskText: {
    color: "#00E396",
    textAlign: "center",
    fontWeight: "600",
    fontSize: 15,
  },

  // AI section container
  aiBox: {
    backgroundColor: "#111827",
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: "#1F2937",
    marginBottom: 12,
  },
  aiSubText: {
    color: "#9CA3AF",
    fontSize: 12,
    marginBottom: 8,
  },
  aiEmptyText: {
    color: "#6B7280",
    fontSize: 12,
    fontStyle: "italic",
  },

  // AI cards
  aiCard: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#1F2937",
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 10,
    backgroundColor: "#020617",
  },
  aiCardHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  aiSymbol: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
    marginRight: 8,
  },
  aiTagBuy: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
    backgroundColor: "rgba(16, 185, 129, 0.15)",
    borderWidth: 1,
    borderColor: "#10B981",
  },
  aiTagSell: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
    backgroundColor: "rgba(248, 113, 113, 0.15)",
    borderWidth: 1,
    borderColor: "#F97373",
  },
  aiTagHold: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
    backgroundColor: "rgba(234, 179, 8, 0.15)",
    borderWidth: 1,
    borderColor: "#EAB308",
  },
  aiTagText: {
    color: "#E5E7EB",
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  aiProbBlock: {
    alignItems: "flex-end",
  },
  aiProbLine: {
    color: "#00E396",
    fontSize: 12,
    fontWeight: "600",
  },
  aiConf: {
    color: "#9CA3AF",
    fontSize: 11,
    marginTop: 2,
  },
  aiShortText: {
    color: "#E5E7EB",
    fontSize: 13,
    lineHeight: 18,
    marginTop: 4,
  },
  aiRiskText: {
    color: "#9CA3AF",
    fontSize: 12,
    lineHeight: 18,
    marginTop: 4,
  },

  highlightsBox: {
    backgroundColor: "#111827",
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: "#1F2937",
    marginBottom: 12,
  },

  highlightGroupTitle: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "700",
    marginTop: 10,
    marginBottom: 6,
  },

  highlightItem: {
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#1F2937",
  },

  highlightText: { fontSize: 14, color: "#9CA3AF", lineHeight: 20 },

  newsBox: {
    backgroundColor: "#111827",
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: "#1F2937",
    marginBottom: 20,
  },

  newsDayTitle: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "700",
    marginTop: 10,
    marginBottom: 6,
  },

  newsItem: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#1F2937",
  },

  newsTitle: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "700",
    marginBottom: 4,
  },
  newsSummary: { color: "#9CA3AF", fontSize: 13, lineHeight: 18 },

  newsMetaRow: { flexDirection: "row", alignItems: "center", marginTop: 4 },

  newsSource: { color: "#9CA3AF", fontSize: 10 },
  newsCategory: { fontSize: 12, fontWeight: "600" },
  newsTicker: { color: "#00E396", fontSize: 10, fontWeight: "700" },

  newsDot: { color: "#6B7280", marginHorizontal: 1 },
  newsTime: { color: "#6B7280", fontSize: 10 },

  aiLeftBlock: {
  flexShrink: 1,
  flexGrow: 1,
  maxWidth: "70%",   // ensures right block never gets pushed out
},

aiRightBlock: {
  flexShrink: 0,
  minWidth: 120,      // fixed safe space for probabilities
  alignItems: "flex-end",
  justifyContent: "center",
},

aiCompanyText: {
  fontSize: 12,
  color: "#6B7280",
  marginTop: 2,
  lineHeight: 16,
  flexShrink: 1,
  width: "100%",
},

});
