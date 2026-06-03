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
  Image,
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
      logoUrl: pos.profile?.logoUrl || null,
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
  const winnersCount = enrichedSorted.filter(
    (p) => Number(p.gain || 0) >= 0,
  ).length;
  const winnerPct =
    enrichedSorted.length > 0
      ? Math.round((winnersCount / enrichedSorted.length) * 100)
      : 0;

  const diversificationScore =
    topHolding?.allocationPct > 40
      ? 58
      : topHolding?.allocationPct > 25
        ? 74
        : 88;

  const hasHoldings = enrichedSorted.length > 0;

  const portfolioHealthScore = hasHoldings
    ? Math.round(
        Math.min(
          95,
          Math.max(45, winnerPct * 0.45 + diversificationScore * 0.55),
        ),
      )
    : 0;

  const healthLabel = !hasHoldings
    ? "No Data"
    : portfolioHealthScore >= 80
      ? "Excellent"
      : portfolioHealthScore >= 65
        ? "Healthy"
        : portfolioHealthScore >= 50
          ? "Watch"
          : "High Risk";

  const allocationLeaders = [...enrichedSorted]
    .sort((a, b) => b.allocationPct - a.allocationPct)
    .slice(0, 5);

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
          style={[
            styles.holdingRow,
            p.gain >= 0 ? styles.holdingRowUp : styles.holdingRowDown,
          ]}
          activeOpacity={0.88}
          onPress={() =>
            navigation.navigate("StockDetailScreen", {
              symbol: p.symbol,
            })
          }
        >
          <View style={styles.holdingTopRow}>
            <View style={styles.holdingAssetCol}>
              <View style={styles.holdingLogo}>
                {p.logoUrl ? (
                  <Image
                    source={{ uri: p.logoUrl }}
                    style={styles.holdingLogoImage}
                    resizeMode="contain"
                  />
                ) : (
                  <Text style={styles.holdingLogoText}>
                    {String(p.symbol || "").slice(0, 2)}
                  </Text>
                )}
              </View>

              <View>
                <Text style={styles.holdingSymbol}>{p.symbol}</Text>
                <Text style={styles.holdingName}>
                  {p.shares} shares · {fmt(p.allocationPct)}% allocation
                </Text>
              </View>
            </View>

            <View style={styles.holdingValueCol}>
              <Text style={styles.holdingValue}>{money(p.currValue)}</Text>
              <Text
                style={[styles.holdingGain, { color: getGainColor(p.gain) }]}
              >
                {signedMoney(p.gain)} · {fmt(p.gainPct)}%
              </Text>
            </View>
          </View>

          <View style={styles.holdingMetaRow}>
            <Text style={styles.holdingMeta}>Avg {money(p.avgCost)}</Text>
            <Text style={styles.holdingMeta}>Current {money(p.price)}</Text>
            <Text
              style={[styles.holdingMeta, { color: getGainColor(p.today) }]}
            >
              Day {signedMoney(p.today)}
            </Text>
          </View>
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
        <View style={styles.overviewCard}>
          <View style={styles.overviewHeaderRow}>
            <View>
              <Text style={styles.overviewTitle}>Portfolio Overview</Text>
              <Text style={styles.overviewSub}>
                Track performance and allocation
              </Text>
            </View>

            <View style={styles.datePill}>
              <Ionicons name="calendar-outline" size={13} color={BRAND.sub} />
              <Text style={styles.datePillText}>Today</Text>
            </View>
          </View>

          <View style={styles.overviewStatsGrid}>
            <View style={styles.overviewStat}>
              <Text style={styles.overviewLabel}>Total Value</Text>
              <Text style={styles.overviewValue}>{money(totalValue)}</Text>
              <Text
                style={[
                  styles.overviewChange,
                  { color: getGainColor(totalGain) },
                ]}
              >
                {fmt(totalGainPct)}%
              </Text>
            </View>

            <View style={styles.overviewDivider} />

            <View style={styles.overviewStat}>
              <Text style={styles.overviewLabel}>Day Gain</Text>
              <Text
                style={[
                  styles.overviewValue,
                  { color: getGainColor(todayGain) },
                ]}
              >
                {signedMoney(todayGain)}
              </Text>
              <Text
                style={[
                  styles.overviewChange,
                  { color: getGainColor(todayGain) },
                ]}
              >
                Today
              </Text>
            </View>

            <View style={styles.overviewDivider} />

            <View style={styles.overviewStat}>
              <Text style={styles.overviewLabel}>Total Gain</Text>
              <Text
                style={[
                  styles.overviewValue,
                  { color: getGainColor(totalGain) },
                ]}
              >
                {signedMoney(totalGain)}
              </Text>
              <Text
                style={[
                  styles.overviewChange,
                  { color: getGainColor(totalGain) },
                ]}
              >
                {fmt(totalGainPct)}%
              </Text>
            </View>
          </View>
        </View>
        <View style={styles.healthCard}>
          <View style={styles.healthHeaderRow}>
            <View style={styles.healthTitleRow}>
              <Text style={styles.healthTitle}>AI Portfolio Health</Text>
            </View>
          </View>

          <View style={styles.healthContentRow}>
            <View style={styles.healthRing}>
              <Text style={styles.healthScore}>{portfolioHealthScore}%</Text>
              <Text style={styles.healthLabel}>{healthLabel}</Text>
            </View>

            <View style={styles.healthColumn}>
              <View style={styles.healthColumnTitleRow}>
                <Ionicons name="sparkles" size={14} color={BRAND.green} />
                <Text
                  style={[styles.healthColumnTitle, { color: BRAND.green }]}
                >
                  Strengths
                </Text>
              </View>

              <Text style={styles.healthBullet}>
                {hasHoldings
                  ? `✓ ${winnersCount} positive holdings`
                  : "Add holdings to analyze"}
              </Text>
              <Text style={styles.healthBullet}>
                ✓ {riskExposure.label} exposure profile
              </Text>
              <Text style={styles.healthBullet}>
                ✓ Top holding: {topHolding?.symbol || "--"}
              </Text>
            </View>

            <View style={styles.healthColumn}>
              <View style={styles.healthColumnTitleRow}>
                <Ionicons name="shield-outline" size={14} color={BRAND.red} />
                <Text style={[styles.healthColumnTitle, { color: BRAND.red }]}>
                  Risks
                </Text>
              </View>

              <Text style={styles.healthBullet}>
                • Largest allocation{" "}
                {topHolding ? fmt(topHolding.allocationPct) : "--"}%
              </Text>
              <Text style={styles.healthBullet}>
                • Weakest: {worstPerformer?.symbol || "--"}
              </Text>
              <Text style={styles.healthBullet}>• Market volatility risk</Text>
            </View>
          </View>
        </View>

        <View style={styles.allocationCard}>
          <View style={styles.allocationHeader}>
            <Text style={styles.allocationTitle}>Portfolio Allocation</Text>
            <Text style={styles.allocationMeta}>Top holdings</Text>
          </View>

          {allocationLeaders.length === 0 ? (
            <Text style={styles.allocationEmpty}>No allocation data yet.</Text>
          ) : (
            allocationLeaders.map((p) => (
              <View key={`alloc-${p.symbol}`} style={styles.allocationRow}>
                <Text style={styles.allocationSymbol}>{p.symbol}</Text>

                <View style={styles.allocationBarTrack}>
                  <View
                    style={[
                      styles.allocationBarFill,
                      {
                        width: `${Math.min(100, Math.max(4, p.allocationPct))}%`,
                      },
                    ]}
                  />
                </View>

                <Text style={styles.allocationPct}>
                  {fmt(p.allocationPct)}%
                </Text>
              </View>
            ))
          )}
        </View>

        <View style={styles.holdingsHeader}>
          <View>
            <Text style={styles.holdingsTitle}>
              Holdings{" "}
              <Text style={styles.holdingsCount}>({portfolio.length})</Text>
            </Text>
          </View>

          <TouchableOpacity
            style={styles.groupBtn}
            onPress={() => setMenuVisible(!menuVisible)}
            activeOpacity={0.85}
          >
            <Text style={styles.groupBtnText}>
              Sort:{" "}
              {sortMode === "gain"
                ? "Gain"
                : sortMode === "shares"
                  ? "Shares"
                  : sortMode === "allocation"
                    ? "Allocation"
                    : "A-Z"}
            </Text>
            <Ionicons name="chevron-down" size={14} color={BRAND.sub} />
          </TouchableOpacity>
        </View>

        <View style={styles.tableHeader}>
          <Text style={styles.tableHeaderText}>Holdings Detail</Text>
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
            <AstraAnimatedIcon size={52} />
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
  wrapper: { flex: 1, backgroundColor: BRAND.bg },
  container: { flex: 1, paddingHorizontal: 14 },
  scrollContent: { paddingTop: 4, paddingBottom: 170 },
  loading: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: BRAND.bg,
  },
  loadingText: { color: BRAND.sub, fontSize: 13 },

  overviewCard: {
    backgroundColor: "#0B1220",
    borderRadius: 22,
    borderWidth: 1.3,
    borderColor: "rgba(0,227,150,0.24)",
    padding: 15,
    marginBottom: 8,
    shadowColor: "#00E396",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 6,
  },

  overviewHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 14,
  },

  overviewTitle: {
    color: BRAND.text,
    fontSize: 18,
    fontFamily: TYPO.fontFamily.extrabold,
    letterSpacing: -0.3,
  },

  overviewSub: {
    color: BRAND.muted,
    fontSize: 11,
    marginTop: 3,
    fontFamily: TYPO.fontFamily.medium,
  },

  datePill: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.09)",
    backgroundColor: "rgba(255,255,255,0.04)",
  },

  datePillText: {
    color: BRAND.sub,
    fontSize: 11,
    marginLeft: 5,
    fontFamily: TYPO.fontFamily.semibold,
  },

  overviewStatsGrid: {
    flexDirection: "row",
    alignItems: "stretch",
  },

  overviewStat: {
    flex: 1,
  },

  overviewLabel: {
    color: BRAND.muted,
    fontSize: 10.5,
    fontFamily: TYPO.fontFamily.medium,
    marginBottom: 6,
  },

  overviewValue: {
    color: BRAND.text,
    fontSize: 15,
    fontFamily: TYPO.fontFamily.extrabold,
    fontVariant: ["tabular-nums"],
  },

  overviewChange: {
    fontSize: 11,
    marginTop: 4,
    fontFamily: TYPO.fontFamily.bold,
  },

  overviewDivider: {
    width: 1,
    backgroundColor: "rgba(255,255,255,0.07)",
    marginHorizontal: 10,
  },
  portfolioHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 10,
  },
  valueRow: { marginTop: 2 },
  headerTitle: {
    color: BRAND.text,
    fontSize: 24,
    fontFamily: TYPO.fontFamily.extrabold,
    letterSpacing: -0.3,
  },
  headerSub: {
    color: BRAND.muted,
    fontSize: 11,
    fontFamily: TYPO.fontFamily.medium,
    marginTop: 2,
  },
  totalValue: {
    color: BRAND.text,
    fontSize: 30,
    fontFamily: TYPO.fontFamily.extrabold,
    letterSpacing: -0.5,
    fontVariant: ["tabular-nums"],
  },
  totalGain: {
    fontSize: 13,
    marginTop: 4,
    fontFamily: TYPO.fontFamily.bold,
    fontVariant: ["tabular-nums"],
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
  actionText: { color: BRAND.text, fontWeight: "900" },

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
  sortItem: { paddingVertical: 11, paddingHorizontal: 14 },
  sortItemText: { color: BRAND.text, fontSize: 14, fontWeight: "700" },
  sortItemTextActive: { color: BRAND.accent, fontWeight: "900" },

  footerWrap: {
    marginTop: 28,
    marginBottom: 30,
    paddingHorizontal: 18,
    alignItems: "center",
  },
  footerText: { color: BRAND.sub, fontSize: 12, marginBottom: 8 },
  footerBrand: {
    color: BRAND.text,
    fontSize: 13.5,
    fontFamily: TYPO.fontFamily.brand,
    letterSpacing: -0.35,
  },
  footerMeta: {
    color: BRAND.muted,
    fontSize: 10.5,
    marginBottom: 8,
    fontWeight: "700",
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
    bottom: 25,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.16)",
    alignItems: "center",
    justifyContent: "center",
    elevation: 10,
    zIndex: 50,
  },

  astraWrap: { position: "absolute", left: 20, bottom: 25, zIndex: 50 },
  astraFab: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: "transparent",
    borderWidth: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  healthCard: {
    backgroundColor: "#0B1220",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(0,227,150,0.22)",
    shadowColor: "#00E396",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 6,
    padding: 12,
    marginBottom: 10,
  },

  healthHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },

  healthTitleRow: {
    flexDirection: "row",
    alignItems: "center",
  },

  healthTitle: {
    color: BRAND.text,
    fontSize: 15.5,
    fontFamily: TYPO.fontFamily.extrabold,
    letterSpacing: -0.2,
  },

  healthContentRow: {
    flexDirection: "row",
    alignItems: "center",
  },

  healthRing: {
    width: 68,
    height: 68,
    borderRadius: 34,
    borderWidth: 5,
    borderColor: BRAND.green,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
    backgroundColor: "rgba(34,197,94,0.06)",
  },

  healthScore: {
    color: BRAND.text,
    fontSize: 18,
    fontFamily: TYPO.fontFamily.extrabold,
  },

  healthLabel: {
    color: BRAND.green,
    fontSize: 9,
    marginTop: 0,
    fontFamily: TYPO.fontFamily.bold,
  },

  healthColumn: {
    flex: 1,
  },

  healthColumnTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
  },

  healthColumnTitle: {
    fontSize: 10.5,
    marginLeft: 4,
    fontFamily: TYPO.fontFamily.bold,
  },

  healthBullet: {
    color: BRAND.sub,
    fontSize: 9.7,
    lineHeight: 14.5,
    fontFamily: TYPO.fontFamily.medium,
  },
  holdingsHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },

  holdingsTitle: {
    color: BRAND.text,
    fontSize: 19,
    fontFamily: TYPO.fontFamily.extrabold,
    letterSpacing: -0.3,
  },

  holdingsCount: {
    color: BRAND.sub,
    fontFamily: TYPO.fontFamily.bold,
  },

  groupBtn: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 13,
    paddingHorizontal: 11,
    paddingVertical: 8,
    backgroundColor: "rgba(255,255,255,0.045)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },

  groupBtnText: {
    color: BRAND.sub,
    fontSize: 11.5,
    marginRight: 5,
    fontFamily: TYPO.fontFamily.semibold,
  },

  tableHeader: {
    paddingHorizontal: 4,
    marginTop: 2,
    marginBottom: 8,
  },

  tableHeaderText: {
    color: BRAND.muted,
    fontSize: 11,
    fontFamily: TYPO.fontFamily.bold,
    textTransform: "uppercase",
    letterSpacing: 0.7,
  },

  holdingRow: {
    backgroundColor: "#0B1220",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.075)",
    borderRadius: 18,
    padding: 12,
    marginBottom: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 3,
  },
  holdingTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  holdingAssetCol: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    paddingRight: 8,
  },

  holdingValueCol: {
    minWidth: 112,
    alignItems: "flex-end",
  },

  holdingLogo: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.07)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.09)",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 9,
  },

  holdingLogoText: {
    color: BRAND.text,
    fontSize: 11,
    fontFamily: TYPO.fontFamily.extrabold,
  },
  holdingLogoImage: {
    width: 22,
    height: 22,
  },

  holdingSymbol: {
    color: BRAND.text,
    fontSize: 14,
    fontFamily: TYPO.fontFamily.extrabold,
  },

  holdingName: {
    color: BRAND.muted,
    fontSize: 10,
    marginTop: 2,
    fontFamily: TYPO.fontFamily.medium,
  },

  holdingValue: {
    color: BRAND.text,
    fontSize: 12.5,
    fontFamily: TYPO.fontFamily.extrabold,
    fontVariant: ["tabular-nums"],
  },

  holdingGain: {
    fontSize: 11,
    marginTop: 3,
    fontFamily: TYPO.fontFamily.bold,
  },
  holdingMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.065)",
    gap: 8,
  },

  holdingMeta: {
    flex: 1,
    color: BRAND.sub,
    fontSize: 10.8,
    fontFamily: TYPO.fontFamily.semibold,
    fontVariant: ["tabular-nums"],
  },
  allocationCard: {
    backgroundColor: "#0B1220",
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "rgba(212,166,58,0.24)",
    shadowColor: "#D4A63A",
    shadowOffset: { width: 0, height: 7 },
    shadowOpacity: 0.09,
    shadowRadius: 14,
    elevation: 5,
    padding: 12,
    marginBottom: 10,
  },

  allocationHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },

  allocationTitle: {
    color: BRAND.text,
    fontSize: 16.5,
    fontFamily: TYPO.fontFamily.extrabold,
  },

  allocationMeta: {
    color: BRAND.muted,
    fontSize: 11,
    fontFamily: TYPO.fontFamily.semibold,
  },

  allocationRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
  },

  allocationSymbol: {
    width: 48,
    color: BRAND.text,
    fontSize: 12.5,
    fontFamily: TYPO.fontFamily.extrabold,
  },

  allocationBarTrack: {
    flex: 1,
    height: 8,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.07)",
    overflow: "hidden",
  },

  allocationBarFill: {
    height: 8,
    borderRadius: 999,
    backgroundColor: "#D4A63A",
  },

  allocationPct: {
    width: 48,
    textAlign: "right",
    color: BRAND.sub,
    fontSize: 11.5,
    fontFamily: TYPO.fontFamily.bold,
  },

  allocationEmpty: {
    color: BRAND.muted,
    fontSize: 12,
    fontFamily: TYPO.fontFamily.medium,
  },
  holdingRowUp: {
    borderColor: "rgba(0,227,150,0.18)",
  },

  holdingRowDown: {
    borderColor: "rgba(255,69,96,0.18)",
  },
});
