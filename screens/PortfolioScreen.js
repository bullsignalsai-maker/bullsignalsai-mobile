// screens/PortfolioScreen.js
import React, { useEffect, useState, useCallback, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  Alert,
  Animated,
} from "react-native";

import { Ionicons } from "@expo/vector-icons";
import { getBatchPrices } from "../services/marketData";
import { Swipeable } from "react-native-gesture-handler";
import { auth, getPortfolio, deletePosition } from "../firebaseConfig";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Pressable } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { API_BASE_URL } from "../config/apiKeys";

// ✅ Astra chatbot component (new)
import AstraChat from "../components/AstraChat";

export default function PortfolioScreen({ navigation }) {
  const [portfolio, setPortfolio] = useState([]);
  const [prices, setPrices] = useState({});
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

  // SORT
  const [menuVisible, setMenuVisible] = useState(false);
  const [sortMode, setSortMode] = useState("gain"); // default: highest gain

  // User profile for header name
  const [userProfile, setUserProfile] = useState({
    firstName: "",
    lastName: "",
  });

  // Per-symbol AI insight
  // aiState[symbol] = { expanded, loading, error, ai: {...}, text: "" }
  const [aiState, setAiState] = useState({});

  // ✅ Astra visibility only (logic is now inside AstraChat component)
  const [astraVisible, setAstraVisible] = useState(false);

  const swipeRefs = useRef({});

  const fullName = `${userProfile.firstName} ${userProfile.lastName}`.trim();
  const headerName = fullName.length ? fullName : "Your";
  const [pulseAnim] = useState(new Animated.Value(1));


  // ----------------------------------------------------
  // DELETE POSITION
  // ----------------------------------------------------
  const handleDelete = async (symbol) => {
    const userId = auth.currentUser?.uid;
    if (!userId) return;

    Alert.alert("Delete Position", `Remove ${symbol} from your portfolio?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          await deletePosition(userId, symbol);

          setPortfolio((prev) =>
            prev.filter((p) => p.symbol.toUpperCase() !== symbol.toUpperCase())
          );

          setPrices((prev) => {
            const copy = { ...prev };
            delete copy[symbol];
            return copy;
          });

          console.log("🗑️ Deleted position:", symbol);
        },
      },
    ]);
  };

  // ----------------------------------------------------
  // LOAD USER PROFILE
  // ----------------------------------------------------
  const loadUserProfile = async () => {
    try {
      const email = await AsyncStorage.getItem("userToken");
      if (!email) return;

      const profile =
        JSON.parse(await AsyncStorage.getItem("profile_" + email)) || {};

      setUserProfile({
        firstName: profile.firstName || "",
        lastName: profile.lastName || "",
      });

      console.log("👤 Loaded profile for portfolio:", profile);
    } catch (err) {
      console.warn("Profile load error:", err);
    }
  };

  // ----------------------------------------------------
  // LOAD PORTFOLIO FROM FIREBASE
  // ----------------------------------------------------
  const loadPortfolio = useCallback(async () => {
    try {
      const userId = auth.currentUser?.uid;
      if (!userId) return;

      let list = await getPortfolio(userId);
      list = list.filter((p) => p.symbol && p.symbol.trim() !== "");

      setPortfolio(list);

      if (list.length > 0) {
        const symbols = list.map((x) => x.symbol).join(",");
        const live = await getBatchPrices(symbols);
        setPrices(live || {});
      }
    } catch (err) {
      console.warn("loadPortfolio error:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadPortfolio();
    loadUserProfile();
  }, []);

  // AUTO REFRESH PRICES
  useEffect(() => {
    if (!portfolio.length) return;

    const interval = setInterval(async () => {
      try {
        const symbols = portfolio.map((x) => x.symbol).join(",");
        const live = await getBatchPrices(symbols);
        if (live) setPrices(live);
      } catch (e) {
        console.warn("Auto-refresh error:", e);
      }
    }, 20000);

    return () => clearInterval(interval);
  }, [portfolio]);

  // Close swipe rows when returning to screen
  useFocusEffect(
    useCallback(() => {
      Object.values(swipeRefs.current).forEach((ref) => ref?.close());
    }, [])
  );

  const onRefresh = () => {
    setRefreshing(true);
    loadPortfolio();
  };

  
  // ----------------------------------------------------
  // CALCULATIONS
  // ----------------------------------------------------
  let totalValue = 0;
  let totalCost = 0;
  let todayGain = 0;

  const enriched = portfolio.map((pos) => {
    const live = prices[pos.symbol] || {};

    const price = live.price ?? live.c ?? pos.avgCost ?? 0;
    const prev = live.prevClose ?? live.pc ?? pos.avgCost ?? 0;

    const currValue = pos.shares * price;
    const cost = pos.shares * pos.avgCost;
    const gain = currValue - cost;
    const gainPct = cost > 0 ? (gain / cost) * 100 : 0;
    const today = pos.shares * (price - prev);

    totalValue += currValue;
    totalCost += cost;
    todayGain += today;

    return {
      ...pos,
      price,
      prev,
      currValue,
      gain,
      gainPct,
      today,
    };
  });

  // Allocation %
  if (totalValue > 0) {
    enriched.forEach((p) => {
      p.allocationPct = (p.currValue / totalValue) * 100;
    });
  } else {
    enriched.forEach((p) => (p.allocationPct = 0));
  }

  // ----------------------------------------------------
  // SORTING
  // ----------------------------------------------------
  const applySorting = (list) => {
    switch (sortMode) {
      case "gain":
        return [...list].sort((a, b) => b.gain - a.gain);
      case "shares":
        return [...list].sort((a, b) => b.shares - a.shares);
      case "allocation":
        return [...list].sort((a, b) => b.allocationPct - a.allocationPct);
      case "az":
        return [...list].sort((a, b) => a.symbol.localeCompare(b.symbol));
      default:
        return list;
    }
  };

  const enrichedSorted = applySorting(enriched);

  const fmt = (n) => (isNaN(n) ? "--" : Number(n).toFixed(2));

  if (loading) {
    return (
      <View style={styles.loading}>
        <Text style={{ color: "#9CA3AF" }}>Loading portfolio...</Text>
      </View>
    );
  }

  // ----------------------------------------------------
  // PER-SYMBOL AI INSIGHT TOGGLER
  // ----------------------------------------------------
  const handleToggleAIInsight = async (symbol, p, totalValueLocal) => {
    // Toggle UI immediately
    setAiState((prev) => {
      const current = prev[symbol] || {};
      return {
        ...prev,
        [symbol]: {
          ...current,
          expanded: !current.expanded,
        },
      };
    });

    const current = aiState[symbol];
    const alreadyLoaded = current && current.ai;
    const alreadyLoading = current && current.loading;

    if (alreadyLoaded || alreadyLoading) {
      return;
    }

    try {
      // Set loading
      setAiState((prev) => ({
        ...prev,
        [symbol]: {
          ...(prev[symbol] || {}),
          loading: true,
          error: null,
        },
      }));

      const url =
        `${API_BASE_URL}/portfolio-ai-insight/${symbol}` +
        `?allocation_pct=${p.allocationPct}` +
        `&gain_pct=${p.gainPct}` +
        `&position_value=${p.currValue}` +
        `&portfolio_total_value=${totalValueLocal}`;

      const res = await fetch(url);

      if (!res.ok) throw new Error("AI insight unavailable");

      const json = await res.json();

      const aiData = {
        trend: json.trend || "",
        expected_move: json.expected_move || "",
        risk: json.risk || "",
        confidence: json.confidence || "",
        pattern: json.pattern || "",
        five_day_prob: json.five_day_prob || "",
        rebalancing: json.rebalancing || "",
        message: json.message || "",
      };

      setAiState((prev) => ({
        ...prev,
        [symbol]: {
          ...(prev[symbol] || {}),
          loading: false,
          error: null,
          ai: aiData,
          text: json.message || "",
        },
      }));
    } catch (err) {
      console.warn("AI insight error:", err);

      setAiState((prev) => ({
        ...prev,
        [symbol]: {
          ...(prev[symbol] || {}),
          loading: false,
          error: "AI insight failed. Pull to refresh and try again.",
        },
      }));
    }
  };

  // ✅ Build payload for AstraChat (same structure backend expects)
  const portfolioData = {
    total_value: totalValue,
    total_gain: totalValue - totalCost,
    today_gain: todayGain,
    positions: enrichedSorted.map((p) => ({
      symbol: p.symbol,
      shares: p.shares,
      avg_cost: p.avgCost,
      price: p.price,
      gain: p.gain,
      gain_pct: p.gainPct,
      allocation_pct: p.allocationPct,
      today: p.today,
    })),
  };

  // ----------------------------------------------------
  // RENDER
  // ----------------------------------------------------
  return (
    <View style={styles.wrapper}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={{ paddingBottom: 120 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#00E396"
          />
        }
      >
        {/* HEADER */}
        <View style={styles.headerBox}>
          <Text style={styles.headerLabel}>{headerName}’s Portfolio</Text>

          <Text style={styles.totalValue}>${fmt(totalValue)}</Text>

          <Text
            style={[
              styles.totalGain,
              { color: totalValue >= totalCost ? "#00E396" : "#EF4444" },
            ]}
          >
            {totalValue - totalCost >= 0 ? "+$" : "-$"}
            {fmt(Math.abs(totalValue - totalCost))}{" "}
            ({fmt(((totalValue - totalCost) / (totalCost || 1)) * 100)}%)
          </Text>

          <Text
            style={[
              styles.todayGain,
              { color: todayGain >= 0 ? "#00E396" : "#EF4444" },
            ]}
          >
            Today: {todayGain >= 0 ? "+$" : "-$"}
            {fmt(Math.abs(todayGain))}
          </Text>
        </View>

        {/* PORTFOLIO ANALYTICS */}
        <View style={styles.analyticsBox}>
          <Text style={styles.analyticsTitle}>Portfolio Insights</Text>

          {/* Largest holding */}
          <View style={styles.analyticsRow}>
            <Text style={styles.analyticsLabel}>Largest Holding</Text>
            <Text style={styles.analyticsValue}>
              {enrichedSorted[0]?.symbol} (
              {fmt(enrichedSorted[0]?.allocationPct)}%)
            </Text>
          </View>

          {/* Top & worst performer */}
          {(() => {
            const sortedDesc = [...enrichedSorted].sort(
              (a, b) => b.gain - a.gain
            );
            const sortedAsc = [...enrichedSorted].sort(
              (a, b) => a.gain - b.gain
            );

            const top = sortedDesc[0];
            const worst = sortedAsc[0];

            return (
              <>
                <View style={styles.analyticsRow}>
                  <Text style={styles.analyticsLabel}>Top Performer</Text>
                  <Text
                    style={[styles.analyticsValue, { color: "#00E396" }]}
                  >
                    {top?.symbol || "--"} (
                    {top?.gain >= 0 ? "+$" : "-$"}
                    {fmt(Math.abs(top?.gain || 0))})
                  </Text>
                </View>

                <View style={styles.analyticsRow}>
                  <Text style={styles.analyticsLabel}>Worst Performer</Text>
                  <Text
                    style={[styles.analyticsValue, { color: "#EF4444" }]}
                  >
                    {worst?.symbol || "--"} (
                    {worst?.gain >= 0 ? "+$" : "-$"}
                    {fmt(Math.abs(worst?.gain || 0))})
                  </Text>
                </View>
              </>
            );
          })()}

          {/* Entry performance */}
          <View style={styles.analyticsRow}>
            <Text style={styles.analyticsLabel}>Entry Performance (%)</Text>
            <Text style={styles.analyticsValue}>
              {fmt(
                enriched.length
                  ? enriched.reduce(
                      (sum, p) =>
                        sum + ((p.price - p.avgCost) / p.avgCost) * 100,
                      0
                    ) / enriched.length
                  : 0
              )}
              %
            </Text>
          </View>

          {/* Risk exposure */}
          <View style={styles.analyticsRow}>
            <Text style={styles.analyticsLabel}>Risk Exposure</Text>
            <Text
              style={[
                styles.analyticsValue,
                {
                  color:
                    (enrichedSorted[0]?.allocationPct ?? 0) > 40
                      ? "#EF4444"
                      : (enrichedSorted[0]?.allocationPct ?? 0) > 20
                      ? "#FBBF24"
                      : "#00E396",
                },
              ]}
            >
              {(() => {
                const pct = enrichedSorted[0]?.allocationPct ?? 0;
                if (pct > 40) return "High";
                if (pct > 20) return "Moderate";
                return "Balanced";
              })()}
            </Text>
          </View>
        </View>

        {/* HOLDINGS */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Your Holdings</Text>

          <View style={styles.sortRow}>
            <TouchableOpacity onPress={() => setMenuVisible(!menuVisible)}>
              <Ionicons name="filter-outline" size={20} color="#9CA3AF" />
            </TouchableOpacity>

            <Text style={styles.holdingsCountText}>
              {portfolio.length} holdings
            </Text>
          </View>
        </View>

        {enrichedSorted.length === 0 ? (
          <Text style={{ color: "#6B7280", marginTop: 20 }}>
            No positions yet — tap + to add your first stock.
          </Text>
        ) : (
          enrichedSorted.map((p) => {
            const insight = aiState[p.symbol] || {};

            const renderRightActions = () => (
              <Pressable
                style={({ pressed }) => [
                  styles.editBtn,
                  { opacity: pressed ? 0.6 : 1 },
                ]}
                onPress={() =>
                  navigation.navigate("EditPositionScreen", {
                    symbol: p.symbol,
                    shares: p.shares,
                    avgCost: p.avgCost,
                  })
                }
              >
                <Text style={styles.editText}>Edit</Text>
              </Pressable>
            );

            const renderLeftActions = () => (
              <Pressable
                style={({ pressed }) => [
                  styles.deleteBtn,
                  { opacity: pressed ? 0.6 : 1 },
                ]}
                onPress={() => handleDelete(p.symbol)}
              >
                <Text style={styles.deleteText}>Delete</Text>
              </Pressable>
            );

            return (
              <Swipeable
                ref={(ref) => (swipeRefs.current[p.symbol] = ref)}
                key={p.symbol}
                renderRightActions={renderRightActions}
                renderLeftActions={renderLeftActions}
              >
                <TouchableOpacity
                  style={styles.positionCard}
                  activeOpacity={0.85}
                  onPress={() =>
                    navigation.navigate("StockDetailScreen", {
                      symbol: p.symbol,
                    })
                  }
                >
                  {/* SYMBOL + ALLOCATION + SHARES + AI ICON */}
                  <View style={styles.rowTop}>
                    <View>
                      <Text style={styles.symbol}>{p.symbol}</Text>
                      <Text style={styles.allocationText}>
                        {fmt(p.allocationPct)}% of portfolio
                      </Text>
                    </View>

                    <View style={styles.rowTopRight}>
                      <Text style={styles.shares}>{p.shares} shares</Text>

                      <Pressable
                        onPress={(e) => {
                          e.stopPropagation();
                          handleToggleAIInsight(p.symbol, p, totalValue);
                        }}
                        style={({ pressed }) => [
                          styles.aiIconBtn,
                          pressed && { opacity: 0.7 },
                        ]}
                      >
                        <Ionicons
                          name="sparkles-outline"
                          size={18}
                          color="#FBBF24"
                        />
                      </Pressable>
                    </View>
                  </View>

                  {/* PROFIT / LOSS */}
                  <View style={styles.rowMiddle}>
                    <Text
                      style={[
                        styles.plValue,
                        { color: p.gain >= 0 ? "#00E396" : "#EF4444" },
                      ]}
                    >
                      {p.gain >= 0 ? "Profit: +" : "Loss: -"}
                      ${fmt(Math.abs(p.gain))} ({fmt(p.gainPct)}%)
                    </Text>
                  </View>

                  {/* COST → PRICE + TODAY */}
                  <View style={styles.rowBottom}>
                    <Text style={styles.costText}>
                      Avg: ${fmt(p.avgCost)} → Current: ${fmt(p.price)}
                    </Text>

                    <Text
                      style={[
                        styles.todayText,
                        { color: p.today >= 0 ? "#00E396" : "#EF4444" },
                      ]}
                    >
                      Today: {p.today >= 0 ? "+$" : "-$"}
                      {fmt(Math.abs(p.today))}
                    </Text>
                  </View>

                  {/* AI INSIGHT COLLAPSIBLE */}
                  {insight.expanded && (
                    <View style={styles.aiBox}>
                      <Text style={styles.aiTitle}>AI View (BullBrain v2)</Text>

                      {insight.loading ? (
                        <Text style={styles.aiLoading}>
                          Fetching AI insight…
                        </Text>
                      ) : insight.error ? (
                        <Text style={styles.aiError}>{insight.error}</Text>
                      ) : insight.ai ? (
                        <>
                          <View style={styles.aiRow}>
                            <Text style={styles.aiLabel}>Trend:</Text>
                            <Text style={styles.aiValue}>
                              {insight.ai.trend}
                            </Text>
                          </View>

                          <View style={styles.aiRow}>
                            <Text style={styles.aiLabel}>Move:</Text>
                            <Text style={styles.aiValue}>
                              {insight.ai.expected_move}
                            </Text>
                          </View>

                          <View style={styles.aiRow}>
                            <Text style={styles.aiLabel}>Risk:</Text>
                            <Text style={styles.aiValue}>
                              {insight.ai.risk}
                            </Text>
                          </View>

                          <View style={styles.aiRow}>
                            <Text style={styles.aiLabel}>Confidence:</Text>
                            <Text style={styles.aiValue}>
                              {insight.ai.confidence}
                            </Text>
                          </View>

                          <View style={styles.aiRow}>
                            <Text style={styles.aiLabel}>Pattern:</Text>
                            <Text style={styles.aiValue}>
                              {insight.ai.pattern}
                            </Text>
                          </View>

                          <View style={styles.aiRow}>
                            <Text style={styles.aiLabel}>5-Day Outlook:</Text>
                            <Text style={styles.aiValue}>
                              {insight.ai.five_day_prob}
                            </Text>
                          </View>

                          <Text style={styles.aiRebalancingTitle}>
                            AI Rebalancing Suggestion
                          </Text>
                          <Text style={styles.aiRebalancingText}>
                            {insight.ai.rebalancing}
                          </Text>
                        </>
                      ) : (
                        <Text style={styles.aiText}>
                          AI view is not available right now. Try again later.
                        </Text>
                      )}
                    </View>
                  )}
                </TouchableOpacity>
              </Swipeable>
            );
          })
        )}
      </ScrollView>

              {/* Premium Add Button */}
        <Pressable style={styles.fab} onPress={() => navigation.navigate("AddPositionScreen")}>
          <Ionicons name="add" size={40} color="#00E396" />
        </Pressable>

        {/* Premium Astra Button */}
        {portfolio.length > 0 && (
          <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
            <Pressable style={styles.astraFab} onPress={() => setAstraVisible(true)}>
              <Ionicons name="aperture" size={40} color="#00E396" />
            </Pressable>
          </Animated.View>
        )}



      {/* SORTING MENU */}
      {menuVisible && (
        <View style={styles.sortMenu}>
          <TouchableOpacity
            style={styles.sortItem}
            onPress={() => {
              setSortMode("gain");
              setMenuVisible(false);
            }}
          >
            <Text style={styles.sortItemText}>Highest Gain</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.sortItem}
            onPress={() => {
              setSortMode("shares");
              setMenuVisible(false);
            }}
          >
            <Text style={styles.sortItemText}>Most Shares</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.sortItem}
            onPress={() => {
              setSortMode("allocation");
              setMenuVisible(false);
            }}
          >
            <Text style={styles.sortItemText}>Highest Allocation</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.sortItem}
            onPress={() => {
              setSortMode("az");
              setMenuVisible(false);
            }}
          >
            <Text style={styles.sortItemText}>Alphabetical (A → Z)</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ✅ AstraChat full-screen mini-popup */}
      <AstraChat
        visible={astraVisible}
        onClose={() => setAstraVisible(false)}
        portfolioData={portfolioData}
      />
    </View>
  );
}

// ================= STYLES =================
const styles = StyleSheet.create({
  wrapper: { flex: 1, backgroundColor: "#000" },
  container: { flex: 1, paddingHorizontal: 18 },

  loading: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#000",
  },

  headerBox: {
    marginTop: 75,
    backgroundColor: "#111827",
    padding: 20,
    borderRadius: 16,
    borderColor: "#1F2937",
    borderWidth: 1,
    alignItems: "center",
    marginBottom: -5,
  },
  headerLabel: { color: "#9CA3AF", fontSize: 14 },
  totalValue: { color: "#FFF", fontSize: 25, fontWeight: "800" },
  totalGain: { fontSize: 15, marginTop: 6, fontWeight: "600" },
  todayGain: { fontSize: 13, marginTop: 4 },

  sectionHeader: {
    marginTop: 1,
    marginBottom: 10,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  sectionTitle: { color: "#00E396", fontSize: 16, fontWeight: "600" },

  positionCard: {
    backgroundColor: "#111827",
    padding: 18,
    borderRadius: 14,
    borderColor: "#1F2937",
    borderWidth: 1,
    marginBottom: 10,
  },

  rowTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },

  rowTopRight: {
    flexDirection: "row",
    alignItems: "center",
  },

  symbol: { color: "#FFF", fontSize: 18, fontWeight: "700" },
  shares: { color: "#9CA3AF", fontSize: 13 },

  rowMiddle: { marginVertical: 6 },
  plValue: { fontSize: 15, fontWeight: "700" },

  rowBottom: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  costText: { color: "#9CA3AF", fontSize: 13 },
  todayText: { fontSize: 13 },

  editBtn: {
    backgroundColor: "#2563EB",
    width: 80,
    justifyContent: "center",
    alignItems: "center",
    marginVertical: 6,
    borderRadius: 12,
  },
  editText: { color: "#FFF", fontWeight: "700" },

  deleteBtn: {
    backgroundColor: "#EF4444",
    width: 80,
    justifyContent: "center",
    alignItems: "center",
    marginVertical: 6,
    borderRadius: 12,
  },
  deleteText: { color: "#FFF", fontWeight: "700" },

  allocationText: {
    color: "#9CA3AF",
    fontSize: 12,
    marginTop: 2,
  },

  sortRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },

  holdingsCountText: {
    color: "#9CA3AF",
    fontSize: 13,
  },

  // SORT MENU
  sortMenu: {
    position: "absolute",
    top: 165,
    right: 20,
    backgroundColor: "#111827",
    paddingVertical: 8,
    width: 220,
    borderRadius: 12,
    borderColor: "#1F2937",
    borderWidth: 1,
    zIndex: 9999,
    shadowColor: "#000",
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 10,
  },

  sortItem: {
    paddingVertical: 10,
    paddingHorizontal: 14,
  },

  sortItemText: {
    color: "#E5E7EB",
    fontSize: 15,
  },

  // ANALYTICS
  analyticsBox: {
    backgroundColor: "#111827",
    padding: 16,
    borderRadius: 14,
    borderColor: "#1F2937",
    borderWidth: 1,
    marginTop: 20,
    marginBottom: 10,
  },

  analyticsTitle: {
    color: "#E5E7EB",
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 10,
  },

  analyticsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
  },

  analyticsItem: {
    flex: 1,
  },

  analyticsLabel: {
    color: "#9CA3AF",
    fontSize: 12,
    marginBottom: 2,
  },

  analyticsValue: {
    color: "#FFF",
    fontSize: 14,
    fontWeight: "700",
  },

  analyticsPie: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#1F2937",
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#0F172A",
  },

  // AI INSIGHTS CARD
  aiIconBtn: {
    marginLeft: 8,
    padding: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#374151",
    backgroundColor: "#020617",
  },

  aiBox: {
    marginTop: 10,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#1F2937",
    backgroundColor: "rgba(15, 23, 42, 0.8)",
  },

  aiTitle: {
    color: "#FBBF24",
    fontSize: 13,
    fontWeight: "700",
    marginBottom: 8,
    letterSpacing: 0.3,
  },

  aiRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 6,
  },

  aiLabel: {
    color: "#9CA3AF",
    fontSize: 12,
  },

  aiValue: {
    color: "#FFF",
    fontSize: 12,
    fontWeight: "700",
  },

  aiText: {
    color: "#9CA3AF",
    fontSize: 13,
  },

  aiLoading: {
    color: "#9CA3AF",
    fontSize: 12,
  },

  aiError: {
    color: "#F97316",
    fontSize: 12,
  },

  aiRebalancingTitle: {
    color: "#FBBF24",
    fontSize: 12,
    fontWeight: "700",
    marginTop: 10,
    marginBottom: 4,
  },

  aiRebalancingText: {
    color: "#E5E7EB",
    fontSize: 12,
    lineHeight: 16,
  },
  astraFab: {
  position: "absolute",
  left: 20,
  bottom: 32,
  width: 42,
  height: 42,
  borderRadius: 29,
},
  fab: {
  position: "absolute",
  right: 20,
  bottom: 32,

  width: 42,
  height: 42,
  borderRadius: 29,
},
});
