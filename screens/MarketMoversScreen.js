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
import { BRAND } from "../constants/theme";

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
  if (n >= 1000) return `$${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
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
  const [errorMessage, setErrorMessage] = useState("");
  const [tab, setTab] = useState("all");
  const [sortBy, setSortBy] = useState("move");

  const fadeAnim = useRef(new Animated.Value(1)).current;

  const loadMovers = useCallback(
    async (silent = false) => {
      try {
        setErrorMessage("");
        if (!silent) setLoading(true);

        const data = await getMarketMovers();
        if (!data) {
          setErrorMessage("Market movers are temporarily unavailable. Pull to refresh.");
          return;
        }

        setRaw({
          gainers: data.gainers || [],
          losers: data.losers || [],
          as_of: data.as_of || null,
          updated_at: data.updated_at || null,
        });

        Animated.sequence([
          Animated.timing(fadeAnim, {
            toValue: 0.72,
            duration: 100,
            useNativeDriver: true,
          }),
          Animated.timing(fadeAnim, {
            toValue: 1,
            duration: 160,
            useNativeDriver: true,
          }),
        ]).start();
      } catch (e) {
        console.warn("MarketMoversScreen error:", e?.message || e);
        setErrorMessage("Market movers are temporarily unavailable. Pull to refresh.");
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

    const trendLabel = item.trendLabel || item.trend?.label || "Market trend";
    const patternName =
      typeof item.pattern === "string" ? item.pattern : item.pattern?.name || null;

    const showPattern = isMeaningfulPattern(patternName);

    return (
      <TouchableOpacity
        activeOpacity={0.88}
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
        <View style={styles.rowCard}>
          <View style={styles.rowTop}>
            <View style={styles.symbolBlock}>
              <View style={styles.symbolLine}>
                <Text style={styles.symbol}>{item.symbol}</Text>

                <View style={[styles.movePill, isUp ? styles.movePillUp : styles.movePillDown]}>
                  <Text style={[styles.movePillText, { color }]}>
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

            <View style={styles.priceBlock}>
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

          <View style={styles.rowBottom}>
            <View style={styles.trendWrap}>
              <Ionicons name="pulse-outline" size={13} color={BRAND.muted} />
              <Text style={styles.trendText} numberOfLines={1}>
                {trendLabel}
              </Text>
            </View>

            {showPattern ? (
              <View style={styles.patternBadge}>
                <Text style={styles.patternText} numberOfLines={1}>
                  {String(patternName)}
                </Text>
              </View>
            ) : null}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const ListHeader = () => (
  <View style={styles.headerWrap}>
    <View style={styles.compactTopRow}>
      <View style={{ flex: 1 }}>
        <Text style={styles.compactTitle}>Market Movers</Text>

        <Text style={styles.compactSub}>
          <Text style={{ color: BRAND.accent, fontWeight: "700" }}>
            Alphaclara
          </Text>{" "}
          tracked universe • {stats.updated}
        </Text>
      </View>

      <View style={styles.compactStats}>
        <Text style={styles.compactStatText}>
          <Text style={{ color: BRAND.green }}>{stats.gainers}</Text> ↑
        </Text>
        <Text style={styles.compactStatText}>
          <Text style={{ color: BRAND.red }}>{stats.losers}</Text> ↓
        </Text>
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
          activeOpacity={0.82}
        >
          <Text style={[styles.tabText, tab === opt.key && styles.tabTextActive]}>
            {opt.label}
          </Text>
        </TouchableOpacity>
      ))}
    </View>

    <View style={styles.sortCompactRow}>
      <Text style={styles.sortLabel}>Sort</Text>

      {[
        { key: "move", label: "% Move" },
        { key: "price", label: "Price" },
        { key: "symbol", label: "Symbol" },
      ].map((opt) => (
        <TouchableOpacity
          key={opt.key}
          onPress={() => setSortBy(opt.key)}
          style={[styles.sortPill, sortBy === opt.key && styles.sortPillActive]}
          activeOpacity={0.82}
        >
          <Text style={[styles.sortText, sortBy === opt.key && styles.sortTextActive]}>
            {opt.label}
          </Text>
        </TouchableOpacity>
      ))}
    </View>

    <View style={styles.resultRow}>
      <Text style={styles.resultCount}>{data.length} results</Text>
      <Text style={styles.resultHint}>Tap any symbol for detail</Text>
    </View>

    {errorMessage && data.length === 0 ? (
      <View style={styles.errorBox}>
        <Ionicons name="alert-circle-outline" size={15} color={BRAND.amber} />
        <Text style={styles.errorText}>{errorMessage}</Text>
      </View>
    ) : null}

    <View style={styles.columnHint}>
      <Text style={styles.columnHintText}>Symbol / Market context</Text>
      <Text style={styles.columnHintText}>Move</Text>
    </View>
  </View>
);

  if (loading) {
    return (
      <View style={styles.loading}>
        <StatusBar barStyle="light-content" backgroundColor={BRAND.bg} />
        <ActivityIndicator size="large" color={BRAND.green} />
        <Text style={styles.loadingText}>Loading market data…</Text>
      </View>
    );
  }

  return (
    <View style={styles.wrapper}>
      <StatusBar barStyle="light-content" backgroundColor={BRAND.bg} />

      <Animated.View style={{ flex: 1, opacity: fadeAnim }}>
        <FlatList
          data={data}
          keyExtractor={(item, index) => `${item.symbol}-${index}`}
          renderItem={renderRow}
          ListHeaderComponent={ListHeader}
          stickyHeaderIndices={[0]}
          ListEmptyComponent={
            <View style={styles.emptyBox}>
              <Ionicons name="pulse-outline" size={30} color={BRAND.muted} />
              <Text style={styles.emptyTitle}>No movers available</Text>
              <Text style={styles.emptySub}>
                Pull to refresh or check again after the next market update.
              </Text>
            </View>
          }
          ListFooterComponent={
            <View style={styles.footerWrap}>
              <Text style={styles.footerText}>
                Powered by <Text style={styles.footerBrand}>Alphaclara</Text>
              </Text>

              <Text style={styles.footerMeta}>Last updated {stats.updated}</Text>

              <Text style={styles.disclaimer}>
                Market Movers are based on Alphaclara’s internal tracked universe,
                percentage price movement, trend context, and pattern analytics.
                Content is provided for informational and educational purposes only
                and is not financial, investment, trading, or tax advice.
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
    fontSize: 13,
  },

  heroCard: {
    backgroundColor: BRAND.card,
    borderRadius: 24,
    padding: 18,
    borderWidth: 1,
    borderColor: BRAND.border,
    marginBottom: 12,
  },

  heroIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "rgba(0,227,150,0.10)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "rgba(0,227,150,0.24)",
  },

  heroTitle: {
    color: BRAND.text,
    fontSize: 23,
    fontWeight: "900",
    letterSpacing: 0.2,
  },

  heroSub: {
    color: BRAND.sub,
    fontSize: 12.5,
    lineHeight: 18,
    marginTop: 6,
  },

  updatedText: {
    color: BRAND.muted,
    fontSize: 11,
    marginTop: 10,
    fontWeight: "700",
  },

  summaryCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: BRAND.card2,
    borderWidth: 1,
    borderColor: BRAND.border,
    borderRadius: 20,
    paddingVertical: 14,
    marginBottom: 12,
  },

  summaryItem: {
    flex: 1,
    alignItems: "center",
  },

  summaryValue: {
    color: BRAND.text,
    fontSize: 21,
    fontWeight: "900",
  },

  summaryLabel: {
    color: BRAND.muted,
    fontSize: 11,
    marginTop: 3,
    fontWeight: "800",
  },

  summaryDivider: {
    width: 1,
    height: 30,
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
    paddingVertical: 8,
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

  sortCard: {
    backgroundColor: "rgba(17,24,39,0.72)",
    borderWidth: 1,
    borderColor: BRAND.softBorder,
    borderRadius: 16,
    padding: 10,
  },

  sortLabel: {
    color: BRAND.muted,
    fontSize: 10,
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 8,
  },

  sortOptions: {
    flexDirection: "row",
    columnGap: 8,
  },

  sortPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
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
    marginTop: 14,
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

  rowCard: {
    borderRadius: 20,
    backgroundColor: BRAND.card,
    borderWidth: 1,
    borderColor: BRAND.softBorder,
    padding: 13,
  },

  rowTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },

  symbolBlock: {
    flex: 1.35,
    paddingRight: 10,
  },

  symbolLine: {
    flexDirection: "row",
    alignItems: "center",
  },

  symbol: {
    color: BRAND.text,
    fontWeight: "900",
    fontSize: 17,
    letterSpacing: 0.2,
    marginRight: 8,
  },

  company: {
    color: BRAND.muted,
    fontSize: 11,
    marginTop: 4,
  },

  movePill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    borderWidth: 1,
  },

  movePillUp: {
    backgroundColor: "rgba(0,227,150,0.08)",
    borderColor: "rgba(0,227,150,0.42)",
  },

  movePillDown: {
    backgroundColor: "rgba(239,68,68,0.08)",
    borderColor: "rgba(239,68,68,0.42)",
  },

  movePillText: {
    fontSize: 9.5,
    fontWeight: "900",
  },

  priceBlock: {
    flex: 1,
    alignItems: "flex-end",
  },

  price: {
    color: BRAND.text,
    fontSize: 14,
    fontWeight: "900",
  },

  change: {
    marginTop: 4,
    fontSize: 13,
    fontWeight: "900",
  },

  oneLiner: {
    color: BRAND.sub,
    fontSize: 12,
    lineHeight: 17,
    marginTop: 10,
  },

  rowBottom: {
    marginTop: 11,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: BRAND.softBorder,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },

  trendWrap: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    paddingRight: 8,
  },

  trendText: {
    color: BRAND.sub,
    fontSize: 11,
    fontWeight: "800",
    marginLeft: 5,
    flexShrink: 1,
  },

  patternBadge: {
    maxWidth: "52%",
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: "rgba(250,204,21,0.10)",
    borderWidth: 1,
    borderColor: "rgba(250,204,21,0.50)",
  },

  patternText: {
    color: BRAND.amber,
    fontSize: 10,
    fontWeight: "900",
  },

  patternBadgeMuted: {
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: "rgba(107,114,128,0.08)",
    borderWidth: 1,
    borderColor: "rgba(107,114,128,0.18)",
  },

  patternMutedText: {
    color: BRAND.muted,
    fontSize: 10,
    fontWeight: "800",
  },

  separator: {
    height: 10,
  },

  emptyBox: {
    marginHorizontal: 16,
    marginTop: 26,
    padding: 24,
    borderRadius: 22,
    backgroundColor: BRAND.card,
    borderWidth: 1,
    borderColor: BRAND.border,
    alignItems: "center",
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

  errorBox: {
    marginTop: 12,
    padding: 10,
    borderRadius: 14,
    backgroundColor: "rgba(250,204,21,0.08)",
    borderWidth: 1,
    borderColor: "rgba(250,204,21,0.32)",
    flexDirection: "row",
    alignItems: "center",
  },

  errorText: {
    color: BRAND.amber,
    fontSize: 12,
    fontWeight: "700",
    marginLeft: 6,
    flex: 1,
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
    color: BRAND.accent,
    fontWeight: "600",
  },

  disclaimer: {
    color: BRAND.muted,
    fontSize: 11,
    lineHeight: 16,
    textAlign: "center",
  },
  headerWrap: {
  paddingTop: 8,
  paddingBottom: 8,
  paddingHorizontal: 14,
  backgroundColor: BRAND.bg,
},

compactTopRow: {
  flexDirection: "row",
  justifyContent: "space-between",
  alignItems: "center",
  marginBottom: 10,
},

compactTitle: {
  color: BRAND.text,
  fontSize: 22,
  fontWeight: "900",
},

compactSub: {
  color: BRAND.muted,
  fontSize: 11,
  marginTop: 2,
  fontWeight: "700",
},

compactStats: {
  flexDirection: "row",
  columnGap: 8,
  backgroundColor: BRAND.card2,
  borderWidth: 1,
  borderColor: BRAND.border,
  borderRadius: 999,
  paddingHorizontal: 10,
  paddingVertical: 6,
},

compactStatText: {
  color: BRAND.sub,
  fontSize: 12,
  fontWeight: "900",
},

sortCompactRow: {
  flexDirection: "row",
  alignItems: "center",
  columnGap: 8,
  marginTop: 8,
},
headerWrap: {
  paddingTop: 8,
  paddingBottom: 8,
  paddingHorizontal: 14,
  backgroundColor: BRAND.bg,
  borderBottomWidth: 1,
  borderBottomColor: BRAND.softBorder,
},

compactTopRow: {
  flexDirection: "row",
  justifyContent: "space-between",
  alignItems: "center",
  marginBottom: 10,
},

compactTitle: {
  color: BRAND.text,
  fontSize: 22,
  fontWeight: "900",
},

compactSub: {
  color: BRAND.muted,
  fontSize: 11,
  marginTop: 2,
  fontWeight: "700",
},

compactStats: {
  flexDirection: "row",
  columnGap: 8,
  backgroundColor: BRAND.card2,
  borderWidth: 1,
  borderColor: BRAND.border,
  borderRadius: 999,
  paddingHorizontal: 10,
  paddingVertical: 6,
},

compactStatText: {
  color: BRAND.sub,
  fontSize: 12,
  fontWeight: "900",
},

sortCompactRow: {
  flexDirection: "row",
  alignItems: "center",
  columnGap: 8,
  marginTop: 8,
},

resultRow: {
  flexDirection: "row",
  justifyContent: "space-between",
  alignItems: "center",
  marginTop: 10,
},

resultCount: {
  color: BRAND.sub,
  fontSize: 11,
  fontWeight: "800",
},

resultHint: {
  color: BRAND.muted,
  fontSize: 11,
  fontWeight: "700",
},

rowCard: {
  borderRadius: 18,
  backgroundColor: BRAND.card,
  borderWidth: 1,
  borderColor: BRAND.softBorder,
  padding: 11,
},

oneLiner: {
  color: BRAND.sub,
  fontSize: 11.5,
  lineHeight: 16,
  marginTop: 8,
},

rowBottom: {
  marginTop: 9,
  paddingTop: 8,
  borderTopWidth: 1,
  borderTopColor: BRAND.softBorder,
  flexDirection: "row",
  justifyContent: "space-between",
  alignItems: "center",
},
  
separator: {
  height: 8,
},

footerMeta: {
  color: BRAND.muted,
  fontSize: 10.5,
  marginBottom: 8,
  fontWeight: "700",
},
});