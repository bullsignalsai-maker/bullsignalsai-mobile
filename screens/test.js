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

import { getMarketPulse } from "../services/MarketPulseService";
import LiveMarketStatus from "../components/LiveMarketStatus";

// —————————————————————————————————————
// U.S. MARKET HOURS
// —————————————————————————————————————
function isMarketOpen() {
  const now = new Date();
  const est = new Date(now.toLocaleString("en-US", { timeZone: "America/New_York" }));
  const day = est.getDay();
  const hour = est.getHours();
  const minute = est.getMinutes();

  if (day === 0 || day === 6) return false;
  if (hour < 9 || (hour === 9 && minute < 30)) return false;
  if (hour >= 16) return false;
  return true;
}

export default function MarketScreen({ navigation }) {
  const [pulse, setPulse] = useState(null);
  const [news, setNews] = useState({
    today: [],
    yesterday: [],
    week: [],
    older: [],
  });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState("");
  const [marketStatus, setMarketStatus] = useState(isMarketOpen() ? "Open" : "Closed");

  // Update Open/Closed badge every minute
  useEffect(() => {
    const interval = setInterval(() => {
      setMarketStatus(isMarketOpen() ? "Open" : "Closed");
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  // ————————————————————————————————————
  // FETCH MARKET PULSE + NEWS
  // ————————————————————————————————————
  const loadPulse = useCallback(async (silent = false) => {
    try {
      if (!silent) setLoading(true);

      const data = await getMarketPulse();
      if (!data) throw new Error("No market pulse data");

      // MARKET OVERVIEW + HIGHLIGHTS
      setPulse({
        overview: data.market_overview || {},
        highlights_grouped: data.highlights_grouped || {
          bullish: [],
          neutral: [],
          bearish: [],
        },
      });

      // NEWS (grouped in backend)
      setNews(
        data.news_grouped || {
          today: [],
          yesterday: [],
          week: [],
          older: [],
        }
      );

      // UPDATED TIME (UTC → ET)
      const updatedIso = data.updated_at || new Date().toISOString();
      const updatedEt = new Date(
        new Date(updatedIso).toLocaleString("en-US", { timeZone: "America/New_York" })
      );

      const formatted = updatedEt.toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
      });

      setLastUpdated(formatted);
    } catch (err) {
      console.warn("Pulse load error:", err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadPulse(false);
  }, [loadPulse]);

  // Auto refresh every 45 sec
  useEffect(() => {
    const interval = setInterval(() => {
      loadPulse(true);
    }, 45000);
    return () => clearInterval(interval);
  }, [loadPulse]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadPulse(true);
  };

  // ————————————————————————————————————
  // RENDER NEWS ITEM
  // ————————————————————————————————————
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
        onPress={() => navigation.navigate("NewsDetailScreen", { item: n })}
      >
        <Text style={styles.newsTitle}>{n.title}</Text>
        <Text style={styles.newsSummary}>{n.summary}</Text>

        <View style={styles.newsMetaRow}>
          <Text style={styles.newsSource}>{n.source}</Text>

          {n.category ? (
            <>
              <Text style={styles.newsDot}> • </Text>
              <Text style={[styles.newsCategory, { color: catColor }]}>{n.category}</Text>
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
  };

  // LOADING VIEW
  if (loading || !pulse) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator color="#00E396" size="large" />
        <Text style={styles.loadingText}>Analyzing market pulse...</Text>
      </View>
    );
  }

  // SAFE extracting backend data
  const overview = pulse.overview || {};
  const highlights = pulse.highlights_grouped || {
    bullish: [],
    neutral: [],
    bearish: [],
  };

  const { bullish, neutral, bearish } = highlights;

  // ————————————————————————————
  // MAIN UI
  // ————————————————————————————
  return (
    <View style={styles.wrapper}>
      <StatusBar backgroundColor="#000" barStyle="light-content" />

      {/* Sticky Header */}
      <View style={styles.stickyHeader}>
        <Text style={styles.headerTitle}>Market Insights</Text>
        <Text style={styles.updatedTime}>Updated {lastUpdated} ET</Text>
      </View>

      <ScrollView
        style={styles.container}
        contentContainerStyle={{ paddingTop: 100, paddingBottom: 60 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#00E396" />}
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
                  { color: overview.sp500_change >= 0 ? "#00E396" : "#EF4444" },
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
              <Text style={styles.metricNote}>Index: {overview.fearGreed?.value}</Text>
            </View>

            <View style={styles.metricCell}>
              <Text style={styles.metricLabel}>VIX</Text>
              <Text style={[styles.metricValue, { color: "#00E396" }]}>{overview.vix}</Text>
              <Text style={styles.metricNote}>
                {overview.vix < 15 ? "Low" : overview.vix < 25 ? "Normal" : "High"}
              </Text>
            </View>
          </View>

          <View style={styles.divider} />
          <Text style={styles.riskText}>Risk Level: {overview.risk_level}</Text>
        </View>

        {/* ————————— MARKET HIGHLIGHTS ————————— */}
        <View style={styles.highlightsBox}>
          <Text style={styles.sectionTitle}>Market Highlights</Text>

          {/* BULLISH */}
          {bullish.length > 0 && (
            <>
              <Text style={styles.highlightGroupTitle}>📈 Bullish Momentum</Text>
              {bullish.map((h, i) => (
                <View key={i} style={styles.highlightItem}>
                  <Text style={[styles.highlightText, { color: "#00E396" }]}>{h}</Text>
                </View>
              ))}
            </>
          )}

          {/* NEUTRAL */}
          {neutral.length > 0 && (
            <>
              <Text style={styles.highlightGroupTitle}>⚖️ Neutral Signals</Text>
              {neutral.map((h, i) => (
                <View key={i} style={styles.highlightItem}>
                  <Text style={[styles.highlightText, { color: "#D4A017" }]}>{h}</Text>
                </View>
              ))}
            </>
          )}

          {/* BEARISH */}
          {bearish.length > 0 && (
            <>
              <Text style={styles.highlightGroupTitle}>📉 Bearish Pressure</Text>
              {bearish.map((h, i) => (
                <View key={i} style={styles.highlightItem}>
                  <Text style={[styles.highlightText, { color: "#EF4444" }]}>{h}</Text>
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

  sectionTitle: { color: "#00E396", fontSize: 16, fontWeight: "600", marginBottom: 8 },

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
  riskText: { color: "#00E396", textAlign: "center", fontWeight: "600", fontSize: 15 },

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

  newsTitle: { color: "#fff", fontSize: 15, fontWeight: "700", marginBottom: 4 },
  newsSummary: { color: "#9CA3AF", fontSize: 13, lineHeight: 18 },

  newsMetaRow: { flexDirection: "row", alignItems: "center", marginTop: 4 },

  newsSource: { color: "#9CA3AF", fontSize: 12 },
  newsCategory: { fontSize: 12, fontWeight: "600" },
  newsTicker: { color: "#00E396", fontSize: 12, fontWeight: "700" },

  newsDot: { color: "#6B7280", marginHorizontal: 3 },
  newsTime: { color: "#6B7280", fontSize: 12 },
});
