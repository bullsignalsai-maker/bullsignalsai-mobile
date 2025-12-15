// screens/InsightsScreen.js
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

import { getAIPulseData } from "../services/AIEngine";
import { getMarketNews } from "../services/newsData";
import {
  saveToFirestoreCache,
  getFromFirestoreCache,
} from "../firebaseConfig";

import LiveMarketStatus from "../components/LiveMarketStatus";

// —————————————————————————————————————
// ACCURATE U.S. MARKET HOURS DETECTION
// —————————————————————————————————————
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

export default function InsightsScreen({ navigation }) {
  const [insights, setInsights] = useState(null);
  const [news, setNews] = useState([]); 
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState("");
  const [marketStatus, setMarketStatus] = useState(
    isMarketOpen() ? "Open" : "Closed"
  );

  // Update market status every minute
  useEffect(() => {
    const interval = setInterval(() => {
      setMarketStatus(isMarketOpen() ? "Open" : "Closed");
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  // ========== LOAD INSIGHTS + NEWS ==========
  const loadInsights = useCallback(async (force = false) => {
    try {
      if (!force) setLoading(true);

      const data = await getAIPulseData(false, force);
      setInsights(data);

      const now = new Date().toLocaleTimeString("en-US", {
        timeZone: "America/New_York",
        hour: "2-digit",
        minute: "2-digit",
      });
      setLastUpdated(now);

      await saveToFirestoreCache("market_pulse", data);

      // Load market news
      try {
        const fetchedNews = await getMarketNews(force);
        setNews(fetchedNews || []);
      } catch (err) {
        console.warn("⚠️ News load failed:", err.message);
      }
    } catch (err) {
      console.warn("Insights load failed:", err.message);

      const fallback = await getFromFirestoreCache("market_pulse");
      if (fallback) {
        setInsights(fallback);
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    loadInsights(false);
  }, [loadInsights]);

  // Auto-refresh every 60 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      loadInsights(true);
    }, 30000);
    return () => clearInterval(interval);
  }, [loadInsights]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadInsights(true);
  };

  // LOADING VIEW
  if (loading || !insights) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator color="#00E396" size="large" />
        <Text style={styles.loadingText}>Analyzing live market pulse...</Text>
      </View>
    );
  }

  // UNPACK DATA
  const { mood, risk_level, ai_digest, highlights = [], sector_insights = [] } =
    insights;

  const fearGreed = mood?.fearGreed || { value: 50 };
  const vix = mood?.vix ?? 15;
  const spChange = mood?.sp500_change ?? 0;

  const spColor = spChange >= 0 ? "#00E396" : "#EF4444";
  const vixColor =
    vix < 15 ? "#00E396" : vix > 20 ? "#EF4444" : "#D4A017";
  const fgColor =
    fearGreed.value > 60
      ? "#00E396"
      : fearGreed.value < 30
      ? "#EF4444"
      : "#D4A017";

  const displayedHighlights = highlights
    .slice(0, Math.min(highlights.length, 10))
    .sort(() => 0.5 - Math.random());

  // MAIN UI
  return (
    <View style={styles.wrapper}>
      <StatusBar backgroundColor="#000" barStyle="light-content" />

      {/* Sticky Header */}
      <View style={styles.stickyHeader}>
        <Text style={styles.headerTitle}>Market Insights</Text>
        {lastUpdated ? (
          <Text style={styles.updatedTime}>Updated {lastUpdated} ET</Text>
        ) : null}
      </View>

      <ScrollView
        style={styles.container}
        contentContainerStyle={{ paddingTop: 100, paddingBottom: 60 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#00E396"
            colors={["#00E396"]}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* MARKET OVERVIEW */}
        <View style={styles.overviewBox}>
          <View style={styles.marketHeaderRow}>
            <Text style={styles.sectionTitle}>Market Overview</Text>
            <LiveMarketStatus marketStatus={marketStatus} />
          </View>

          <View style={styles.metricGrid}>
            {/* SP500 */}
            <View style={styles.metricCell}>
              <Text style={styles.metricLabel}>S&P 500</Text>
              <Text style={[styles.metricValue, { color: spColor }]}>
                {spChange >= 0 ? "+" : ""}
                {spChange.toFixed(2)}%
              </Text>
              <Text style={styles.metricNote}>
                {spChange >= 0 ? "Up today" : "Down today"}
              </Text>
            </View>

            {/* MOOD */}
            <View style={styles.metricCell}>
              <Text style={styles.metricLabel}>Market Mood</Text>
              <Text style={[styles.metricValue, { color: fgColor }]}>
                {fearGreed.value <= 25
                  ? "Extreme Fear"
                  : fearGreed.value <= 45
                  ? "Fear"
                  : fearGreed.value <= 55
                  ? "Neutral"
                  : fearGreed.value <= 75
                  ? "Greed"
                  : "Extreme Greed"}
              </Text>
              <Text style={styles.metricNote}>
                Index: {fearGreed.value}
              </Text>
            </View>

            {/* VIX */}
            <View style={styles.metricCell}>
              <Text style={styles.metricLabel}>Volatility (VIX)</Text>
              <Text style={[styles.metricValue, { color: vixColor }]}>
                {vix.toFixed(2)}
              </Text>
              <Text style={styles.metricNote}>
                {vix < 15
                  ? "Low"
                  : vix < 20
                  ? "Normal"
                  : vix < 30
                  ? "Elevated"
                  : "High"}
              </Text>
            </View>
          </View>

          <View style={styles.divider} />
          <Text style={[styles.riskText, { color: "#00E396" }]}>
            Risk Level: {risk_level}
          </Text>
        </View>

        {/* AI DAILY DIGEST */}
        <View style={styles.digestBox}>
          <Text style={styles.sectionTitle}>AI Daily Digest</Text>
          <Text style={styles.digestText}>{ai_digest}</Text>
        </View>

        {/* SECTOR INSIGHTS */}
        <View style={styles.sectorBox}>
          <Text style={styles.sectionTitle}>Sector Pulse</Text>
          {sector_insights.length === 0 ? (
            <Text style={styles.highlightText}>
              No sector insights available.
            </Text>
          ) : (
            sector_insights.map((s, i) => (
              <Text key={i} style={styles.highlightText}>
                • {s.title} — {s.summary}
              </Text>
            ))
          )}
        </View>

        {/* MARKET HIGHLIGHTS */}
        <View style={styles.highlightsBox}>
          <Text style={styles.sectionTitle}>Market Highlights</Text>

          {displayedHighlights.length === 0 ? (
            <Text style={styles.highlightText}>
              No highlights available.
            </Text>
          ) : (
            displayedHighlights.map((h, i) => {
              const color = h.includes("up") || h.includes("rise")
                ? "#00E396"
                : h.includes("down") || h.includes("fall")
                ? "#EF4444"
                : "#9CA3AF";

              return (
                <View key={i} style={styles.highlightItem}>
                  <Text style={[styles.highlightText, { color }]}>
                    {h}
                  </Text>
                </View>
              );
            })
          )}
        </View>

        {/* ----------------- MARKET NEWS (Improved) ----------------- */}
        <View style={styles.newsBox}>
          <Text style={styles.sectionTitle}>Market News</Text>

          {news.length === 0 ? (
            <Text style={styles.newsMeta}>No market news available.</Text>
          ) : (
            news.slice(0, 20).map((n, i) => {
              const catColor =
                n.category === "Earnings" ? "#00E396" :
                n.category === "Fed / Macro" ? "#D4A017" :
                n.category === "M&A" ? "#3B82F6" :
                n.category === "Tech / AI" ? "#8B5CF6" :
                "#9CA3AF";

              return (
                <TouchableOpacity
                  key={i}
                  style={styles.newsItem}
                  onPress={() =>
                    navigation.navigate("NewsDetailScreen", { item: n })
                  }
                >
                  <Text style={styles.newsTitle}>{n.title}</Text>
                  <Text style={styles.newsSummary}>{n.summary}</Text>

                  <View style={styles.newsMetaRow}>
                    <Text style={styles.newsSource}>{n.source}</Text>

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

                    <Text style={styles.newsDot}> • </Text>
                    <Text style={styles.newsTime}>
                      {new Date(n.pubDate).toLocaleTimeString("en-US", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })
          )}
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
    borderBottomColor: "#1F2937",
    borderBottomWidth: 1,
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

  loadingText: { color: "#9CA3AF", marginTop: 10, fontSize: 15 },

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
    marginBottom: 8,
    borderColor: "#1F2937",
    borderWidth: 1,
    marginTop: 8,
  },

  marketHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },

  metricGrid: { flexDirection: "row", justifyContent: "space-between" },
  metricCell: { flex: 1, alignItems: "center" },

  metricLabel: { color: "#9CA3AF", fontSize: 13, marginBottom: 4 },
  metricValue: { fontSize: 17, fontWeight: "700" },
  metricNote: { color: "#9CA3AF", fontSize: 12, marginTop: 2 },

  divider: { height: 1, backgroundColor: "#1F2937", marginVertical: 10 },

  riskText: { textAlign: "center", fontWeight: "600", fontSize: 15 },

  digestBox: {
    backgroundColor: "#111827",
    borderRadius: 14,
    padding: 16,
    marginBottom: 8,
    borderColor: "#1F2937",
    borderWidth: 1,
  },

  digestText: { color: "#DDD", fontSize: 15, lineHeight: 22 },

  sectorBox: {
    backgroundColor: "#111827",
    borderRadius: 14,
    padding: 16,
    marginBottom: 8,
    borderColor: "#1F2937",
    borderWidth: 1,
  },

  highlightsBox: {
    backgroundColor: "#111827",
    borderRadius: 14,
    padding: 16,
    borderColor: "#1F2937",
    borderWidth: 1,
    marginBottom: 12,
  },

  highlightItem: {
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#1F2937",
  },

  highlightText: { fontSize: 14, lineHeight: 20, color: "#9CA3AF" },

  // NEWS STYLES
  newsBox: {
    backgroundColor: "#111827",
    borderRadius: 14,
    padding: 16,
    borderColor: "#1F2937",
    borderWidth: 1,
    marginBottom: 12,
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

  newsSummary: {
    color: "#9CA3AF",
    fontSize: 13,
    lineHeight: 18,
  },

  newsMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 4,
  },

  newsSource: {
    color: "#9CA3AF",
    fontSize: 12,
  },

  newsCategory: {
    fontSize: 12,
    fontWeight: "600",
  },

  newsTicker: {
    color: "#00E396",
    fontSize: 12,
    fontWeight: "700",
  },

  newsDot: {
    color: "#6B7280",
    marginHorizontal: 3,
    fontSize: 12,
  },

  newsTime: {
    color: "#6B7280",
    fontSize: 12,
  },
});
