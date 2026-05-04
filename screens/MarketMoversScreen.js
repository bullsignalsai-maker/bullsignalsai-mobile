// screens/MarketMoversScreen.js
import React, { useEffect, useState, useCallback, useMemo, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  StatusBar,
  Animated,
  RefreshControl,
} from "react-native";

import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { getMarketMovers } from "../services/MarketPulseService";

const BRAND = {
  bg: "#000000",
  card: "#0B1220",
  card2: "#020617",
  border: "#1F2937",
  softBorder: "#111827",
  text: "#FFFFFF",
  sub: "#9CA3AF",
  muted: "#6B7280",
  green: "#00E396",
  red: "#EF4444",
  amber: "#FACC15",
  blue: "#60A5FA",
};

/* ---------------------------------------------------------
   Utils
--------------------------------------------------------- */
function arrowForChange(pct) {
  if (Number(pct) >= 0) return { arrow: "▲", color: BRAND.green };
  return { arrow: "▼", color: BRAND.red };
}

function formatPct(v) {
  if (v == null || Number.isNaN(Number(v))) return "—";
  return `${Math.abs(Number(v)).toFixed(2)}%`;
}

function formatPrice(v) {
  if (v == null || Number.isNaN(Number(v))) return "—";
  const n = Number(v);
  if (n >= 1000) return `$${n.toFixed(0)}`;
  if (n >= 1) return `$${n.toFixed(2)}`;
  return `$${n.toFixed(4)}`;
}

function formatChange(v) {
  if (v == null || Number.isNaN(Number(v))) return "—";
  return Math.abs(Number(v)).toFixed(2);
}

function isMeaningfulPattern(name) {
  if (!name) return false;
  const up = String(name).trim().toUpperCase();
  return up && up !== "NO CLEAR PATTERN";
}

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

/* ---------------------------------------------------------
   Screen
--------------------------------------------------------- */
export default function MarketMoversScreen({ navigation }) {
  const [raw, setRaw] = useState({
    gainers: [],
    losers: [],
    as_of: null,
    updated_at: null,
  });

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [tab, setTab] = useState("all"); // all | gainers | losers
  const [sortBy, setSortBy] = useState("move"); // move | price | symbol

  const fadeAnim = useRef(new Animated.Value(1)).current;

  const loadMovers = useCallback(
    async (silent = false) => {
      try {
        if (!silent) setLoading(true);

        const data = await getMarketMovers();
        if (!data) return;

        setRaw({
          gainers: data.gainers || [],
          losers: data.losers || [],
          as_of: data.as_of || null,
          updated_at: data.updated_at || null,
        });

        Animated.sequence([
          Animated.timing(fadeAnim, {
            toValue: 0.65,
            duration: 120,
            useNativeDriver: true,
          }),
          Animated.timing(fadeAnim, {
            toValue: 1,
            duration: 180,
            useNativeDriver: true,
          }),
        ]).start();
      } catch (e) {
        console.warn("MarketMoversScreen error:", e.message);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [fadeAnim]
  );

  useEffect(() => {
    loadMovers(false);
  }, [loadMovers]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadMovers(true);
  };

  const data = useMemo(() => {
    let combined = [];

    if (tab === "gainers") combined = raw.gainers || [];
    else if (tab === "losers") combined = raw.losers || [];
    else combined = [...(raw.gainers || []), ...(raw.losers || [])];

    const cleaned = combined
      .map((m) => ({
        ...m,
        changePct: m.changePct == null ? null : Number(m.changePct),
        change: m.change == null ? null : Number(m.change),
        price: m.price == null ? null : Number(m.price),
      }))
      .filter((m) => !!m.symbol);

    cleaned.sort((a, b) => {
      if (sortBy === "price") return (b.price || 0) - (a.price || 0);
      if (sortBy === "symbol") return String(a.symbol).localeCompare(String(b.symbol));
      return Math.abs(b.changePct || 0) - Math.abs(a.changePct || 0);
    });

    return cleaned;
  }, [raw.gainers, raw.losers, tab, sortBy]);

  const stats = useMemo(() => {
    const gainers = raw.gainers?.length || 0;
    const losers = raw.losers?.length || 0;
    return {
      gainers,
      losers,
      total: gainers + losers,
      updated: timeAgoFromUtc(raw.updated_at || raw.as_of),
    };
  }, [raw]);

  const renderRow = ({ item }) => {
    const pct = Number(item.changePct);
    const isUp = !Number.isNaN(pct) && pct >= 0;
    const { arrow, color } = arrowForChange(pct || 0);

    const trendLabel = item.trendLabel || item.trend?.label || null;

    const patternName =
      typeof item.pattern === "string"
        ? item.pattern
        : item.pattern?.name || null;

    const showPattern = isMeaningfulPattern(patternName);

    return (
      <TouchableOpacity
        activeOpacity={0.86}
        style={styles.rowTouch}
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          navigation.navigate("StockDetailScreen", {
            symbol: item.symbol,
            name: item.company || item.symbol,
            source: "market_movers",
          });
        }}
      >
        <View style={styles.row}>
          <View style={[styles.accentBar, isUp ? styles.accentUp : styles.accentDown]} />

          <View style={styles.rowContent}>
            <View style={styles.topLine}>
              <View style={styles.leftBlock}>
                <View style={styles.symbolRow}>
                  <Text style={styles.symbol}>{item.symbol}</Text>

                  <View
                    style={[
                      styles.directionPill,
                      isUp ? styles.directionPillUp : styles.directionPillDown,
                    ]}
                  >
                    <Text
                      style={[
                        styles.directionText,
                        { color: isUp ? BRAND.green : BRAND.red },
                      ]}
                    >
                      {isUp ? "Gainer" : "Loser"}
                    </Text>
                  </View>
                </View>

                {!!item.company && (
                  <Text style={styles.company} numberOfLines={1}>
                    {item.company}
                  </Text>
                )}
              </View>

              <View style={styles.rightBlock}>
                <Text style={styles.price}>{formatPrice(item.price)}</Text>
                <Text style={[styles.change, { color }]}>
                  {arrow} {formatChange(item.change)} ({formatPct(pct)})
                </Text>
              </View>
            </View>

            {!!item.oneLiner && (
              <Text style={styles.oneLiner} numberOfLines={2}>
                {item.oneLiner}
              </Text>
            )}

            <View style={styles.bottomLine}>
              <View style={styles.metaLeft}>
                <Ionicons
                  name="analytics-outline"
                  size={13}
                  color={BRAND.muted}
                  style={{ marginRight: 5 }}
                />
                <Text style={styles.trendText}>
                  {trendLabel || "Trend unavailable"}
                </Text>
              </View>

              {showPattern ? (
                <View style={styles.badge}>
                  <Text style={styles.badgeText} numberOfLines={1}>
                    {String(patternName)}
                  </Text>
                </View>
              ) : (
                <View style={styles.badgeMuted}>
                  <Text style={styles.badgeMutedText}>No clear pattern</Text>
                </View>
              )}
            </View>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const ListHeader = () => (
    <View style={styles.headerWrap}>
      <View style={styles.subHeaderOnly}>
        <Text style={styles.headerSub}>
          Internal tracked universe · Updated {stats.updated}
        </Text>
      </View>

      <View style={styles.summaryCard}>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryValue}>{stats.total}</Text>
          <Text style={styles.summaryLabel}>Total</Text>
        </View>

        <View style={styles.summaryDivider} />

        <View style={styles.summaryItem}>
          <Text style={[styles.summaryValue, { color: BRAND.green }]}>
            {stats.gainers}
          </Text>
          <Text style={styles.summaryLabel}>Gainers</Text>
        </View>

        <View style={styles.summaryDivider} />

        <View style={styles.summaryItem}>
          <Text style={[styles.summaryValue, { color: BRAND.red }]}>
            {stats.losers}
          </Text>
          <Text style={styles.summaryLabel}>Losers</Text>
        </View>
      </View>

      <View style={styles.tabRow}>
        {[
          { key: "all", label: "All" },
          { key: "gainers", label: "Gainers" },
          { key: "losers", label: "Losers" },
        ].map((opt) => (
          <TouchableOpacity
            key={opt.key}
            onPress={() => setTab(opt.key)}
            style={[styles.tabPill, tab === opt.key && styles.tabPillActive]}
            activeOpacity={0.8}
          >
            <Text style={[styles.tabText, tab === opt.key && styles.tabTextActive]}>
              {opt.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.sortRow}>
        <Text style={styles.sortLabel}>Sort by</Text>

        {[
          { key: "move", label: "% Move" },
          { key: "price", label: "Price" },
          { key: "symbol", label: "Symbol" },
        ].map((opt) => (
          <TouchableOpacity
            key={opt.key}
            onPress={() => setSortBy(opt.key)}
            style={[styles.sortPill, sortBy === opt.key && styles.sortPillActive]}
            activeOpacity={0.8}
          >
            <Text
              style={[styles.sortText, sortBy === opt.key && styles.sortTextActive]}
            >
              {opt.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.columnHint}>
        <Text style={styles.columnHintText}>Symbol / Signal context</Text>
        <Text style={styles.columnHintText}>Move</Text>
      </View>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.loading}>
        <StatusBar barStyle="light-content" backgroundColor="#000" />
        <ActivityIndicator size="large" color={BRAND.green} />
        <Text style={styles.loadingText}>Loading market movers…</Text>
      </View>
    );
  }

  return (
    <View style={styles.wrapper}>
      <StatusBar barStyle="light-content" backgroundColor="#000" />

      <Animated.View style={{ flex: 1, opacity: fadeAnim }}>
        <FlatList
          data={data}
          keyExtractor={(item) => item.symbol}
          renderItem={renderRow}
          ListHeaderComponent={ListHeader}
          ListEmptyComponent={
            <View style={styles.emptyBox}>
              <Ionicons name="pulse-outline" size={28} color={BRAND.muted} />
              <Text style={styles.emptyTitle}>No movers available</Text>
              <Text style={styles.emptySub}>
                Pull to refresh or check again after the next market update.
              </Text>
            </View>
          }
          ListFooterComponent={
            <View style={styles.footerWrap}>
              <Text style={styles.poweredBy}>Powered by Alphaclara</Text>

              <Text style={styles.disclaimer}>
                Market Movers are based on Alphaclara’s internal tracked universe,
                percentage price movement, trend context, and pattern analytics.
                This is educational information only and not financial advice.
              </Text>
            </View>
          }
          contentContainerStyle={styles.listContent}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={BRAND.green}
            />
          }
        />
      </Animated.View>
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

  listContent: {
    paddingBottom: 42,
  },

  loading: {
    flex: 1,
    backgroundColor: BRAND.bg,
    justifyContent: "center",
    alignItems: "center",
  },

  loadingText: {
    color: BRAND.sub,
    marginTop: 10,
  },

  headerWrap: {
    paddingTop: 5,
    paddingBottom: 15,
    paddingHorizontal: 14,
    backgroundColor: BRAND.bg,
  },
  headerSub: {
  color: BRAND.sub,
  fontSize: 12,
  marginTop: 1,
  textAlign: "center",
},

  summaryCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: BRAND.card,
    borderWidth: 1,
    borderColor: BRAND.border,
    borderRadius: 18,
    paddingVertical: 14,
    marginBottom: 12,
  },

  summaryItem: {
    flex: 1,
    alignItems: "center",
  },

  summaryValue: {
    color: BRAND.text,
    fontSize: 20,
    fontWeight: "900",
  },

  summaryLabel: {
    color: BRAND.muted,
    fontSize: 11,
    marginTop: 3,
    fontWeight: "700",
  },

  summaryDivider: {
    width: 1,
    height: 28,
    backgroundColor: BRAND.border,
  },

  tabRow: {
    flexDirection: "row",
    backgroundColor: BRAND.card2,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: BRAND.border,
    padding: 4,
    marginBottom: 10,
  },

  tabPill: {
    flex: 1,
    paddingVertical: 7,
    borderRadius: 999,
    alignItems: "center",
  },

  tabPillActive: {
    backgroundColor: "rgba(0,227,150,0.14)",
  },

  tabText: {
    color: BRAND.sub,
    fontSize: 12,
    fontWeight: "800",
  },

  tabTextActive: {
    color: BRAND.green,
  },

  sortRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 2,
    columnGap: 8,
  },

  sortLabel: {
    color: BRAND.muted,
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase",
    marginRight: 2,
  },

  sortPill: {
    paddingHorizontal: 11,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: BRAND.border,
    backgroundColor: BRAND.card2,
  },

  sortPillActive: {
    borderColor: BRAND.green,
    backgroundColor: "rgba(0,227,150,0.10)",
  },

  sortText: {
    color: BRAND.sub,
    fontSize: 11,
    fontWeight: "800",
  },

  sortTextActive: {
    color: BRAND.green,
  },

  columnHint: {
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: BRAND.softBorder,
    flexDirection: "row",
    justifyContent: "space-between",
  },

  columnHintText: {
    color: BRAND.muted,
    fontSize: 10,
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },

  rowTouch: {
    paddingHorizontal: 10,
  },

  row: {
    flexDirection: "row",
    alignItems: "stretch",
    borderRadius: 16,
    overflow: "hidden",
    backgroundColor: BRAND.card,
    borderWidth: 1,
    borderColor: BRAND.softBorder,
  },

  accentBar: {
    width: 4,
  },

  accentUp: {
    backgroundColor: BRAND.green,
  },

  accentDown: {
    backgroundColor: BRAND.red,
  },

  rowContent: {
    flex: 1,
    paddingVertical: 11,
    paddingHorizontal: 12,
  },

  topLine: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },

  leftBlock: {
    flex: 1.3,
    paddingRight: 10,
  },

  symbolRow: {
    flexDirection: "row",
    alignItems: "center",
  },

  symbol: {
    color: BRAND.text,
    fontWeight: "900",
    fontSize: 16,
    letterSpacing: 0.2,
    marginRight: 8,
  },

  directionPill: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 999,
    borderWidth: 1,
  },

  directionPillUp: {
    backgroundColor: "rgba(0,227,150,0.08)",
    borderColor: "rgba(0,227,150,0.45)",
  },

  directionPillDown: {
    backgroundColor: "rgba(239,68,68,0.08)",
    borderColor: "rgba(239,68,68,0.45)",
  },

  directionText: {
    fontSize: 9.5,
    fontWeight: "900",
  },

  company: {
    color: BRAND.muted,
    fontSize: 11,
    marginTop: 3,
  },

  rightBlock: {
    flex: 1,
    alignItems: "flex-end",
  },

  price: {
    color: BRAND.text,
    fontSize: 13,
    fontWeight: "800",
  },

  change: {
    marginTop: 3,
    fontSize: 13,
    fontWeight: "900",
  },

  oneLiner: {
    color: BRAND.sub,
    fontSize: 11.5,
    lineHeight: 16,
    marginTop: 8,
  },

  bottomLine: {
    marginTop: 9,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },

  metaLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    paddingRight: 8,
  },

  trendText: {
    color: BRAND.sub,
    fontSize: 11,
    fontWeight: "800",
  },

  badge: {
    maxWidth: "58%",
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: "rgba(250,204,21,0.10)",
    borderWidth: 1,
    borderColor: "rgba(250,204,21,0.65)",
  },

  badgeText: {
    color: BRAND.amber,
    fontSize: 10,
    fontWeight: "900",
  },

  badgeMuted: {
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: "rgba(107,114,128,0.08)",
    borderWidth: 1,
    borderColor: "rgba(107,114,128,0.18)",
  },

  badgeMutedText: {
    color: BRAND.muted,
    fontSize: 10,
    fontWeight: "800",
  },

  separator: {
    height: 10,
  },

  emptyBox: {
    marginHorizontal: 16,
    marginTop: 28,
    padding: 24,
    borderRadius: 18,
    backgroundColor: BRAND.card,
    borderWidth: 1,
    borderColor: BRAND.border,
    alignItems: "center",
  },

  emptyTitle: {
    color: BRAND.text,
    fontSize: 15,
    fontWeight: "800",
    marginTop: 10,
  },

  emptySub: {
    color: BRAND.sub,
    fontSize: 12,
    textAlign: "center",
    marginTop: 6,
    lineHeight: 17,
  },

  footerWrap: {
    marginTop: 28,
    paddingTop: 18,
    paddingBottom: 30,
    paddingHorizontal: 18,
    borderTopWidth: 1,
    borderTopColor: BRAND.softBorder,
    alignItems: "center",
  },

  poweredBy: {
    color: BRAND.green,
    fontSize: 12,
    fontWeight: "800",
    marginBottom: 8,
  },

  disclaimer: {
    color: BRAND.muted,
    fontSize: 11,
    lineHeight: 16,
    textAlign: "center",
  },
  subHeaderOnly: {
  paddingBottom: 5,
  alignItems: "center",
  paddingTop: 5,
},
});