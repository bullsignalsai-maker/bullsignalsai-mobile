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
  Pressable,
  StatusBar,
} from "react-native";

import { Ionicons } from "@expo/vector-icons";
import { Swipeable } from "react-native-gesture-handler";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect } from "@react-navigation/native";

import { getBatchPrices } from "../services/priceService";
import { auth, getPortfolio, deletePosition } from "../firebaseConfig";
import { API_BASE_URL } from "../config/apiKeys";
import AstraAnimatedIcon from "../components/AstraAnimatedIcon";
import AstraChat from "../components/AstraChat";
import { BRAND } from "../constants/theme";
import { TYPO } from "../constants/typography";

export default function PortfolioScreen({ navigation }) {
  const [portfolio, setPortfolio] = useState([]);
  const [prices, setPrices] = useState({});
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

  const [menuVisible, setMenuVisible] = useState(false);
  const [sortMode, setSortMode] = useState("gain");

  const [userProfile, setUserProfile] = useState({
    firstName: "",
    lastName: "",
  });

  const [aiState, setAiState] = useState({});
  const [astraVisible, setAstraVisible] = useState(false);

  const swipeRefs = useRef({});
  const pulseAnim = useRef(new Animated.Value(1)).current;

  const fullName = `${userProfile.firstName} ${userProfile.lastName}`.trim();
  const headerName = fullName.length ? fullName : "Your";

  const fmt = (n) => {
    if (n == null || Number.isNaN(Number(n))) return "--";
    return Number(n).toFixed(2);
  };

  const money = (n) => `$${fmt(n)}`;

  const signedMoney = (n) => {
    const value = Number(n || 0);
    return `${value >= 0 ? "+$" : "-$"}${fmt(Math.abs(value))}`;
  };

  const getGainColor = (n) => (Number(n || 0) >= 0 ? BRAND.green : BRAND.red);

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
            prev.filter((p) => p.symbol.toUpperCase() !== symbol.toUpperCase()),
          );

          setPrices((prev) => {
            const copy = { ...prev };
            delete copy[symbol];
            return copy;
          });
        },
      },
    ]);
  };

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
    } catch (err) {
      console.warn("Profile load error:", err);
    }
  };

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
  }, [loadPortfolio]);

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

  useFocusEffect(
    useCallback(() => {
      Object.values(swipeRefs.current).forEach((ref) => ref?.close());
    }, []),
  );

  const onRefresh = () => {
    setRefreshing(true);
    loadPortfolio();
  };

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
      allocationPct: 0,
    };
  });

  enriched.forEach((p) => {
    p.allocationPct = totalValue > 0 ? (p.currValue / totalValue) * 100 : 0;
  });

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

  const totalGain = totalValue - totalCost;
  const totalGainPct = totalCost > 0 ? (totalGain / totalCost) * 100 : 0;

  const topHolding = [...enrichedSorted].sort(
    (a, b) => b.allocationPct - a.allocationPct,
  )[0];

  const topPerformer = [...enrichedSorted].sort((a, b) => b.gain - a.gain)[0];
  const worstPerformer = [...enrichedSorted].sort((a, b) => a.gain - b.gain)[0];

  const riskExposure = (() => {
    const pct = topHolding?.allocationPct ?? 0;
    if (pct > 40) return { label: "High", color: BRAND.red };
    if (pct > 20) return { label: "Moderate", color: BRAND.amber };
    return { label: "Balanced", color: BRAND.green };
  })();

  const handleToggleAIInsight = async (symbol, p, totalValueLocal) => {
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

    if (alreadyLoaded || alreadyLoading) return;

    try {
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
          error: "AI insight is temporarily unavailable. Try again later.",
        },
      }));
    }
  };

  const portfolioData = {
    total_value: totalValue,
    total_gain: totalGain,
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

  if (loading) {
    return (
      <View style={styles.loading}>
        <StatusBar barStyle="light-content" backgroundColor={BRAND.bg} />
        <Text style={styles.loadingText}>Loading portfolio…</Text>
      </View>
    );
  }

  const renderPosition = (p) => {
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
        <Text style={styles.actionText}>Edit</Text>
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
        <Text style={styles.actionText}>Delete</Text>
      </Pressable>
    );

    return (
      <Swipeable
        ref={(ref) => (swipeRefs.current[p.symbol] = ref)}
        key={`${p.symbol}-${p.avgCost}-${p.shares}`}
        renderRightActions={renderRightActions}
        renderLeftActions={renderLeftActions}
      >
        <TouchableOpacity
          style={styles.positionCard}
          activeOpacity={0.88}
          onPress={() =>
            navigation.navigate("StockDetailScreen", {
              symbol: p.symbol,
            })
          }
        >
          <View style={styles.positionTopRow}>
            <View style={{ flex: 1 }}>
              <View style={styles.symbolLine}>
                <Text style={styles.symbol}>{p.symbol}</Text>
              </View>

              <Text style={styles.companyMeta}>
                {fmt(p.allocationPct)}% allocation · {p.shares} shares
              </Text>
            </View>

            <View style={styles.positionRight}>
              <Text style={styles.currentValue}>{money(p.currValue)}</Text>
              <Text
                style={[styles.todayText, { color: getGainColor(p.today) }]}
              >
                Day P&L {signedMoney(p.today)}
              </Text>
            </View>
          </View>

          <View style={styles.positionMiddle}>
            <Text style={[styles.plValue, { color: getGainColor(p.gain) }]}>
              Total Gain {signedMoney(p.gain)} ({fmt(p.gainPct)}%)
            </Text>

            <Pressable
              onPress={(e) => {
                e.stopPropagation();
                handleToggleAIInsight(p.symbol, p, totalValue);
              }}
              style={({ pressed }) => [
                styles.aiInlineBtn,
                pressed && { opacity: 0.6 },
              ]}
            >
              <Text style={styles.aiInlineText}>
                {insight.expanded ? "Hide AI View" : "AI View →"}
              </Text>
            </Pressable>
          </View>

          <View style={styles.priceRow}>
            <Text style={styles.priceMeta}>Current {money(p.price)}</Text>
            <Text style={styles.priceMeta}>Avg {money(p.avgCost)}</Text>
          </View>

          {insight.expanded && (
            <View style={styles.aiBox}>
              <Text style={styles.aiTitle}>AI Portfolio View</Text>

              {insight.loading ? (
                <Text style={styles.aiLoading}>Fetching AI insight…</Text>
              ) : insight.error ? (
                <Text style={styles.aiError}>{insight.error}</Text>
              ) : insight.ai ? (
                <>
                  <View style={styles.aiGrid}>
                    <View style={styles.aiMiniCard}>
                      <Text style={styles.aiLabel}>Trend</Text>
                      <Text style={styles.aiValue}>
                        {insight.ai.trend || "—"}
                      </Text>
                    </View>

                    <View style={styles.aiMiniCard}>
                      <Text style={styles.aiLabel}>Risk</Text>
                      <Text style={styles.aiValue}>
                        {insight.ai.risk || "—"}
                      </Text>
                    </View>

                    <View style={styles.aiMiniCard}>
                      <Text style={styles.aiLabel}>Move</Text>
                      <Text style={styles.aiValue}>
                        {insight.ai.expected_move || "—"}
                      </Text>
                    </View>

                    <View style={styles.aiMiniCard}>
                      <Text style={styles.aiLabel}>Confidence</Text>
                      <Text style={styles.aiValue}>
                        {insight.ai.confidence || "—"}
                      </Text>
                    </View>
                  </View>

                  {!!insight.ai.pattern && (
                    <Text style={styles.aiParagraph}>
                      Pattern: {insight.ai.pattern}
                    </Text>
                  )}

                  {!!insight.ai.five_day_prob && (
                    <Text style={styles.aiParagraph}>
                      5-Day Outlook: {insight.ai.five_day_prob}
                    </Text>
                  )}

                  {!!insight.ai.rebalancing && (
                    <>
                      <Text style={styles.aiRebalancingTitle}>
                        Rebalancing Context
                      </Text>
                      <Text style={styles.aiRebalancingText}>
                        {insight.ai.rebalancing}
                      </Text>
                    </>
                  )}
                </>
              ) : (
                <Text style={styles.aiLoading}>
                  AI view is not available right now.
                </Text>
              )}
            </View>
          )}
        </TouchableOpacity>
      </Swipeable>
    );
  };

  return (
    <View style={styles.wrapper}>
      <StatusBar barStyle="light-content" backgroundColor={BRAND.bg} />

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
        <View style={styles.heroCard}>
          <View style={styles.heroTopRow}>
            <View>
              <Text style={styles.headerTitle}>Portfolio</Text>
              <Text style={styles.headerSub}>Live portfolio intelligence</Text>
            </View>

            <View style={styles.livePill}>
              <View style={styles.liveDot} />
              <Text style={styles.liveText}>Live</Text>
            </View>
          </View>

          <Text style={styles.totalValue}>{money(totalValue)}</Text>

          <Text style={[styles.totalGain, { color: getGainColor(totalGain) }]}>
            {signedMoney(totalGain)} ({fmt(totalGainPct)}%)
          </Text>

          <View style={styles.heroStatsRow}>
            <View style={styles.heroStat}>
              <Text style={styles.heroStatLabel}>Today P&L</Text>
              <Text
                style={[
                  styles.heroStatValue,
                  { color: getGainColor(todayGain) },
                ]}
              >
                {signedMoney(todayGain)}
              </Text>
            </View>
            <View style={styles.heroStat}>
              <Text style={styles.heroStatLabel}>Holdings</Text>
              <Text style={styles.heroStatValue}>{portfolio.length}</Text>
            </View>
          </View>
        </View>

        <View style={styles.insightsCard}>
          <View style={styles.cardHeaderRow}>
            <Text style={styles.sectionTitle}>Portfolio Insights</Text>
            <Text style={styles.cardHint}>Live</Text>
          </View>

          <View style={styles.insightRow}>
            <Text style={styles.insightLabel}>Largest Holding</Text>
            <Text style={styles.insightValue}>
              {topHolding?.symbol || "--"}{" "}
              {topHolding ? `(${fmt(topHolding.allocationPct)}%)` : ""}
            </Text>
          </View>

          <View style={styles.insightRow}>
            <Text style={styles.insightLabel}>Top Performer</Text>
            <Text style={[styles.insightValue, { color: BRAND.green }]}>
              {topPerformer?.symbol || "--"}{" "}
              {topPerformer ? signedMoney(topPerformer.gain) : ""}
            </Text>
          </View>

          <View style={styles.insightRow}>
            <Text style={styles.insightLabel}>Weakest Performer</Text>
            <Text style={[styles.insightValue, { color: BRAND.red }]}>
              {worstPerformer?.symbol || "--"}{" "}
              {worstPerformer ? signedMoney(worstPerformer.gain) : ""}
            </Text>
          </View>

          <View style={styles.insightRow}>
            <Text style={styles.insightLabel}>Risk Exposure</Text>
            <Text style={[styles.insightValue, { color: riskExposure.color }]}>
              {riskExposure.label}
            </Text>
          </View>
        </View>

        <View style={styles.sectionHeader}>
          <View>
            <Text style={styles.sectionTitle}>Your Holdings</Text>
            <Text style={styles.sectionSub}>
              {portfolio.length} holdings · Sorted by{" "}
              {sortMode === "gain"
                ? "gain"
                : sortMode === "shares"
                  ? "shares"
                  : sortMode === "allocation"
                    ? "allocation"
                    : "A-Z"}
            </Text>
          </View>

          <TouchableOpacity
            style={styles.filterBtn}
            onPress={() => setMenuVisible(!menuVisible)}
            activeOpacity={0.8}
          >
            <Ionicons name="filter-outline" size={18} color={BRAND.sub} />
          </TouchableOpacity>
        </View>

        {enrichedSorted.length === 0 ? (
          <View style={styles.emptyBox}>
            <Ionicons name="briefcase-outline" size={30} color={BRAND.muted} />
            <Text style={styles.emptyTitle}>Start your portfolio</Text>
            <Text style={styles.emptySub}>
              Add stocks to track performance and AI insights in one place.
            </Text>
          </View>
        ) : (
          enrichedSorted.map(renderPosition)
        )}

        <View style={styles.footerWrap}>
          <Text style={styles.footerText}>
            Powered by <Text style={styles.footerBrand}>Alphaclara</Text>
          </Text>
          <Text style={styles.footerMeta}>
            Data updates periodically and may be delayed.
          </Text>
          <Text style={styles.disclaimer}>
            Portfolio values, AI insights, and market data are provided for
            informational and educational purposes only and are not financial,
            investment, trading, or tax advice.
          </Text>
        </View>
      </ScrollView>

      <Pressable
        style={styles.fab}
        onPress={() => navigation.navigate("AddPositionScreen")}
      >
        <Ionicons name="add" size={30} color="#0A0A0A" />
      </Pressable>

      {portfolio.length > 0 && (
        <Animated.View
          style={[styles.astraWrap, { transform: [{ scale: pulseAnim }] }]}
        >
          <Pressable
            style={styles.astraFab}
            onPress={() => setAstraVisible(true)}
          >
            <AstraAnimatedIcon size={40} />
          </Pressable>
        </Animated.View>
      )}

      {menuVisible && (
        <View style={styles.sortMenu}>
          {[
            { key: "gain", label: "Highest Gain" },
            { key: "shares", label: "Most Shares" },
            { key: "allocation", label: "Highest Allocation" },
            { key: "az", label: "Alphabetical (A → Z)" },
          ].map((item) => (
            <TouchableOpacity
              key={item.key}
              style={styles.sortItem}
              onPress={() => {
                setSortMode(item.key);
                setMenuVisible(false);
              }}
            >
              <Text
                style={[
                  styles.sortItemText,
                  sortMode === item.key && styles.sortItemTextActive,
                ]}
              >
                {item.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      <AstraChat
        visible={astraVisible}
        onClose={() => setAstraVisible(false)}
        portfolioData={portfolioData}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
    backgroundColor: BRAND.bg,
  },

  container: {
    flex: 1,
    paddingHorizontal: 14,
  },

  scrollContent: {
    paddingTop: 70,
    paddingBottom: 130,
  },

  loading: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: BRAND.bg,
  },

  loadingText: {
    color: BRAND.sub,
    fontSize: 13,
  },
  heroCard: {
    backgroundColor: "rgba(17,24,39,0.82)",

    borderRadius: 28,

    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.05)",

    padding: 22,

    marginBottom: 8,

    shadowColor: "#000",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.2,
    shadowRadius: 22,
  },
  eyebrow: {
    color: BRAND.muted,
    fontSize: 12,
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  totalValue: {
    color: BRAND.text,
    fontSize: 34,
    fontFamily: TYPO.fontFamily.extrabold,
    letterSpacing: -0.4,
    fontVariant: ["tabular-nums"],
  },

  totalGain: {
    fontSize: 15,
    marginTop: 5,
    fontFamily: TYPO.fontFamily.bold,
    fontVariant: ["tabular-nums"],
  },

  heroStatsRow: {
    flexDirection: "row",
    columnGap: 10,
    marginTop: 16,
  },

  heroStat: {
    flex: 1,
    backgroundColor: BRAND.card2,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: BRAND.softBorder,
    padding: 11,
  },

  heroStatLabel: {
    color: BRAND.muted,
    fontSize: 11,
    fontWeight: "800",
    marginBottom: 4,
  },

  heroStatValue: {
    color: BRAND.text,
    fontSize: 14,
    fontWeight: "900",
  },

  insightsCard: {
    backgroundColor: BRAND.card,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: BRAND.border,
    padding: 15,
    marginBottom: 14,
  },

  cardHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },

  cardHint: {
    color: BRAND.muted,
    fontSize: 11,
    fontWeight: "800",
  },

  insightRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 7,
    borderBottomWidth: 1,
    borderBottomColor: BRAND.softBorder,
  },

  insightLabel: {
    color: BRAND.sub,
    fontSize: 12,
    fontWeight: "700",
  },

  insightValue: {
    color: BRAND.text,
    fontSize: 12,
    fontWeight: "900",
  },

  sectionHeader: {
    marginTop: 2,
    marginBottom: 10,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  sectionTitle: {
    color: BRAND.text,
    fontSize: 17,
    fontFamily: TYPO.fontFamily.extrabold,
    letterSpacing: -0.2,
  },

  sectionSub: {
    color: BRAND.muted,
    fontSize: 11,
    marginTop: 3,
    fontFamily: TYPO.fontFamily.semibold,
  },

  filterBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: BRAND.card2,
    borderWidth: 1,
    borderColor: BRAND.border,
    alignItems: "center",
    justifyContent: "center",
  },

  positionCard: {
    backgroundColor: BRAND.card,

    padding: 16,

    borderRadius: 22,

    borderColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,

    marginBottom: 14,

    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.18,
    shadowRadius: 20,
  },

  positionTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },

  symbolLine: {
    flexDirection: "row",
    alignItems: "center",
  },

  symbol: {
    color: BRAND.text,
    fontSize: 18,
    fontFamily: TYPO.fontFamily.extrabold,
    marginRight: 8,
  },

  companyMeta: {
    color: BRAND.muted,
    fontSize: 11,
    marginTop: 4,
    fontFamily: TYPO.fontFamily.semibold,
  },
  positionRight: {
    alignItems: "flex-end",
  },

  currentValue: {
    color: BRAND.text,
    fontSize: 14,
    fontFamily: TYPO.fontFamily.extrabold,
    fontVariant: ["tabular-nums"],
  },

  todayText: {
    fontSize: 11.5,
    fontFamily: TYPO.fontFamily.bold,
    marginTop: 4,
    fontVariant: ["tabular-nums"],
  },

  positionMiddle: {
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: BRAND.softBorder,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },

  plValue: {
    fontSize: 14,
    fontFamily: TYPO.fontFamily.extrabold,
    flex: 1,
    fontVariant: ["tabular-nums"],
  },
  aiInlineBtn: {
    paddingLeft: 10,
  },

  aiInlineText: {
    color: BRAND.sub,
    fontSize: 12,
    fontFamily: TYPO.fontFamily.semibold,
  },

  priceRow: {
    marginTop: 10,
    flexDirection: "row",
    justifyContent: "space-between",
  },

  priceMeta: {
    color: BRAND.sub,
    fontSize: 11.5,
    fontFamily: TYPO.fontFamily.medium,
    fontVariant: ["tabular-nums"],
  },

  editBtn: {
    backgroundColor: BRAND.blue,
    width: 78,
    justifyContent: "center",
    alignItems: "center",
    marginVertical: 6,
    borderRadius: 14,
  },

  deleteBtn: {
    backgroundColor: BRAND.red,
    width: 78,
    justifyContent: "center",
    alignItems: "center",
    marginVertical: 6,
    borderRadius: 14,
  },

  actionText: {
    color: BRAND.text,
    fontWeight: "900",
  },

  aiBox: {
    marginTop: 12,
    padding: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: BRAND.softBorder,
    backgroundColor: BRAND.card2,
  },

  aiTitle: {
    color: BRAND.amber,
    fontSize: 13,
    fontWeight: "900",
    marginBottom: 10,
  },

  aiGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    rowGap: 8,
  },

  aiMiniCard: {
    width: "48%",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: BRAND.softBorder,
    padding: 9,
    backgroundColor: "rgba(15,23,42,0.75)",
  },

  aiLabel: {
    color: BRAND.muted,
    fontSize: 10.5,
    fontWeight: "800",
    marginBottom: 3,
  },

  aiValue: {
    color: BRAND.text,
    fontSize: 11.5,
    fontWeight: "900",
  },

  aiParagraph: {
    color: BRAND.sub,
    fontSize: 12,
    lineHeight: 17,
    marginTop: 9,
  },

  aiLoading: {
    color: BRAND.sub,
    fontSize: 12,
  },

  aiError: {
    color: BRAND.amber,
    fontSize: 12,
  },

  aiRebalancingTitle: {
    color: BRAND.amber,
    fontSize: 12,
    fontWeight: "900",
    marginTop: 12,
    marginBottom: 4,
  },

  aiRebalancingText: {
    color: BRAND.sub,
    fontSize: 12,
    lineHeight: 17,
  },

  emptyBox: {
    backgroundColor: BRAND.card,
    borderWidth: 1,
    borderColor: BRAND.border,
    borderRadius: 20,
    padding: 24,
    alignItems: "center",
    marginTop: 14,
  },

  emptyTitle: {
    color: BRAND.text,
    fontSize: 15,
    fontWeight: "900",
    marginTop: 10,
  },

  emptySub: {
    color: BRAND.sub,
    fontSize: 12,
    textAlign: "center",
    marginTop: 6,
    lineHeight: 17,
  },

  sortMenu: {
    position: "absolute",
    top: 185,
    right: 18,
    backgroundColor: BRAND.card,
    paddingVertical: 8,
    width: 230,
    borderRadius: 16,
    borderColor: BRAND.border,
    borderWidth: 1,
    zIndex: 9999,
    elevation: 10,
  },

  sortItem: {
    paddingVertical: 11,
    paddingHorizontal: 14,
  },

  sortItemText: {
    color: BRAND.text,
    fontSize: 14,
    fontWeight: "700",
  },
  sortItemTextActive: {
    color: BRAND.accent,
    fontWeight: "900",
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
    fontFamily: TYPO.fontFamily.bold,
  },

  disclaimer: {
    color: BRAND.muted,
    fontSize: 11,
    lineHeight: 16,
    textAlign: "center",
  },
  fab: {
    position: "absolute",
    right: 20,
    bottom: 32,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.16)",
    alignItems: "center",
    justifyContent: "center",
    elevation: 10,
  },

  astraWrap: {
    position: "absolute",
    left: 20,
    bottom: 32,
  },

  astraFab: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: BRAND.card2,
    borderWidth: 1,
    borderColor: BRAND.border,
    alignItems: "center",
    justifyContent: "center",
    elevation: 10,
  },
  headerTitle: {
    color: BRAND.text,
    fontSize: 26,
    fontFamily: TYPO.fontFamily.extrabold,
    letterSpacing: -0.3,
    marginBottom: 2,
    textAlign: "center",
  },

  headerSub: {
    color: BRAND.muted,
    fontSize: 12,
    fontFamily: TYPO.fontFamily.medium,
    marginBottom: 12,
  },
  footerMeta: {
    color: BRAND.muted,
    fontSize: 10.5,
    marginBottom: 8,
    fontWeight: "700",
  },
  liveRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
  },

  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 999,
    backgroundColor: BRAND.green,
    marginRight: 6,
  },

  liveText: {
    color: BRAND.sub,
    fontSize: 11,
    fontFamily: TYPO.fontFamily.semibold,
  },
  heroTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 5,
  },

  livePill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
});
