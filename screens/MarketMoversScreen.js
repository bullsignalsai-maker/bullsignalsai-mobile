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

import { getMarketMovers } from "../services/MarketPulseService";
import * as Haptics from "expo-haptics";

/* ---------------------------------------------------------
   Utils
--------------------------------------------------------- */
function arrowForChange(pct) {
  if (pct >= 0) return { arrow: "▲", color: "#00E396" };
  return { arrow: "▼", color: "#EF4444" };
}

function formatPct(v) {
  if (v == null || Number.isNaN(Number(v))) return "—";
  return `${Math.abs(Number(v)).toFixed(2)}%`;
}

function formatPrice(v) {
  if (v == null || Number.isNaN(Number(v))) return "—";
  const n = Number(v);
  // keep compact for huge prices
  if (n >= 1000) return `$${n.toFixed(0)}`;
  if (n >= 100) return `$${n.toFixed(2)}`;
  if (n >= 1) return `$${n.toFixed(2)}`;
  return `$${n.toFixed(4)}`;
}

function isMeaningfulPattern(name) {
  if (!name) return false;
  const up = String(name).trim().toUpperCase();
  if (!up) return false;
  if (up === "NO CLEAR PATTERN") return false;
  return true;
}


/* ---------------------------------------------------------
   Screen
--------------------------------------------------------- */
export default function MarketMoversScreen({ navigation }) {
  const [raw, setRaw] = useState({ gainers: [], losers: [], as_of: null, updated_at: null });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [sortBy, setSortBy] = useState("change"); 
    // "change" | "price" | "confidence"

  // subtle refresh pulse
  const fadeAnim = useRef(new Animated.Value(1)).current;

  const loadMovers = useCallback(async (silent = false) => {
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
          toValue: 0.6,
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
  }, [fadeAnim]);

  useEffect(() => {
    loadMovers(false);
  }, [loadMovers]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadMovers(true);
  };

  const data = useMemo(() => {
  const combined = [...(raw.gainers || []), ...(raw.losers || [])];

  const cleaned = combined
    .map((m) => ({
      ...m,
      changePct: Number(m.changePct),
      price: m.price == null ? null : Number(m.price),
      confidence: m.confidence == null ? null : Number(m.confidence),
    }))
    .filter((m) => m.symbol);

  cleaned.sort((a, b) => {
    if (sortBy === "price") {
      return (b.price || 0) - (a.price || 0);
    }
    if (sortBy === "confidence") {
      return (b.confidence || 0) - (a.confidence || 0);
    }
    // default: % change
    return Math.abs(b.changePct || 0) - Math.abs(a.changePct || 0);
  });

  return cleaned;
}, [raw.gainers, raw.losers, sortBy]);


  const headerMeta = useMemo(() => {
    const total = data.length;
    const g = raw.gainers?.length || 0;
    const l = raw.losers?.length || 0;
    const asOf = raw.as_of ? String(raw.as_of) : "";
    return { total, g, l, asOf };
  }, [data.length, raw.as_of, raw.gainers, raw.losers]);

  /* ---------------------------------------------------------
     Row Renderer
  --------------------------------------------------------- */
  const renderRow = ({ item }) => {
    const pct = Number(item.changePct);
    const isUp = !Number.isNaN(pct) && pct >= 0;
    const { arrow, color } = arrowForChange(pct || 0);

    const trendLabel =
      item.trendLabel ||
      item.trend?.label ||
      null;

    const patternName =
      item.pattern ||
      item.pattern?.name ||
      null;

    const showPattern = isMeaningfulPattern(patternName);

    return (
      <TouchableOpacity
        activeOpacity={0.85}
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
          {/* Subtle left accent */}
          <View style={[styles.accentBar, isUp ? styles.accentUp : styles.accentDown]} />

          {/* Main content */}
          <View style={styles.rowContent}>
            <View style={styles.topLine}>
              <View style={styles.leftBlock}>
                <Text style={styles.symbol}>{item.symbol}</Text>
                {item.company ? (
                  <Text style={styles.company} numberOfLines={1}>
                    {item.company}
                  </Text>
                ) : null}
              </View>

              <View style={styles.rightBlock}>
                {/* PRICE */}
                <Text style={styles.price}>
                  {formatPrice(item.price)}
                </Text>

                {/* CHANGE + % */}
                <Text style={[styles.change, { color }]}>
                  {arrow}{" "}
                  {Math.abs(item.change ?? 0).toFixed(2)} (
                  {formatPct(pct)})
                </Text>
              </View>

            </View>

            <View style={styles.bottomLine}>
              {trendLabel ? (
                <Text style={styles.trendText}>
                  {trendLabel}
                </Text>
              ) : (
                <Text style={styles.trendTextMuted}>—</Text>
              )}

              {showPattern ? (
                <View style={styles.badge}>
                  <Text style={styles.badgeText} numberOfLines={1}>
                    {String(patternName)}
                  </Text>
                </View>
              ) : (
                <View style={styles.badgeGhost}>
                  <Text style={styles.badgeGhostText}> </Text>
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

      <View style={styles.subHeader}>
            <Text style={styles.subHeaderText}>
            Sorted by % change · {headerMeta.g} gainers · {headerMeta.l} losers
            </Text>
     </View>
     <View style={styles.sortRow}>
  {[
    { key: "change", label: "% Change" },
    { key: "price", label: "Price" },
    { key: "confidence", label: "Confidence" },
  ].map((opt) => (
    <TouchableOpacity
      key={opt.key}
      onPress={() => setSortBy(opt.key)}
      style={[
        styles.sortPill,
        sortBy === opt.key && styles.sortPillActive,
      ]}
    >
      <Text
        style={[
          styles.sortText,
          sortBy === opt.key && styles.sortTextActive,
        ]}
      >
        {opt.label}
      </Text>
    </TouchableOpacity>
  ))}
</View>

      
      {/* Sticky-ish mini note row (visual polish) */}
      <View style={styles.miniNoteRow}>
        <Text style={styles.miniNoteLeft}>Symbol / Price</Text>
        <Text style={styles.miniNoteRight}>Move</Text>
      </View>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.loading}>
        <StatusBar barStyle="light-content" backgroundColor="#000" />
        <ActivityIndicator size="large" color="#00E396" />
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
          ListFooterComponent={
                <View style={styles.footerWrap}>
                    <Text style={styles.poweredBy}>
                    Powered by BullSignals
                    </Text>

                    <Text style={styles.disclaimer}>
                    Disclaimer: Market Movers are based on percentage price movement and internal analytics.
                    This content is for informational purposes only and is not financial advice.
                    Always do your own research before making investment decisions.
                    </Text>
                </View>
                }

          contentContainerStyle={{ paddingBottom: 40 }}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#00E396"
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
    backgroundColor: "#000",
  },

  /* HEADER */
headerWrap: {
  paddingTop: 6,          // 👈 KEY FIX
  paddingBottom: 8,
  paddingHorizontal: 14,
},

  headerTitle: {
    color: "#00E396",
    fontSize: 22,
    fontWeight: "700",
  },

  headerSub: {
    color: "#9CA3AF",
    fontSize: 12,
    marginTop: 3,
  },

  headerMeta: {
    color: "#6B7280",
    fontSize: 11,
    marginTop: 4,
  },

  miniNoteRow: {
    marginTop: 10,
    paddingTop: 10,
    flexDirection: "row",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: "#111827",
  },

  miniNoteLeft: {
    color: "#6B7280",
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.4,
    textTransform: "uppercase",
  },

  miniNoteRight: {
    color: "#6B7280",
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.4,
    textTransform: "uppercase",
  },

  /* ROWS */
  rowTouch: {
    paddingHorizontal: 10,
  },

  row: {
    flexDirection: "row",
    alignItems: "stretch",
    borderRadius: 14,
    overflow: "hidden",
    backgroundColor: "#0B1220",
    borderWidth: 1,
    borderColor: "#111827",
  },

  accentBar: {
    width: 3,
  },

  accentUp: {
    backgroundColor: "#00E396",
  },

  accentDown: {
    backgroundColor: "#EF4444",
  },

  rowContent: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },

  topLine: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },

  leftBlock: {
    flex: 1.35,
    paddingRight: 10,
  },

  rightBlock: {
    flex: 1,
    alignItems: "flex-end",
  },

  symbol: {
    color: "#FFFFFF",
    fontWeight: "800",
    fontSize: 15,
    letterSpacing: 0.2,
  },

  company: {
    color: "#6B7280",
    fontSize: 11,
    marginTop: 2,
  },

  price: {
    color: "#E5E7EB",
    fontSize: 13,
    fontWeight: "700",
  },

  change: {
    marginTop: 2,
    fontSize: 13,
    fontWeight: "800",
  },

  bottomLine: {
    marginTop: 8,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },

  trendText: {
    color: "#9CA3AF",
    fontSize: 11,
    fontWeight: "700",
  },

  trendTextMuted: {
    color: "#6B7280",
    fontSize: 11,
    fontWeight: "700",
  },

  badge: {
    maxWidth: "62%",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: "rgba(250,204,21,0.10)",
    borderWidth: 1,
    borderColor: "#FACC15",
  },

  badgeText: {
    color: "#FACC15",
    fontSize: 10,
    fontWeight: "800",
  },

  // Keeps row heights consistent when pattern is missing
  badgeGhost: {
    maxWidth: "62%",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: "transparent",
  },

  badgeGhostText: {
    color: "transparent",
    fontSize: 10,
    fontWeight: "800",
  },

  separator: {
    height: 10,
  },

  /* LOADING */
  loading: {
    flex: 1,
    backgroundColor: "#000",
    justifyContent: "center",
    alignItems: "center",
  },

  loadingText: {
    color: "#9CA3AF",
    marginTop: 10,
  },
  subHeader: {
  paddingTop: 2,
  paddingBottom: 6,
  alignItems: "center",
  backgroundColor: "#000",
},

subHeaderText: {
  color: "#9CA3AF",
  fontSize: 13,
  fontWeight: "600",
},
sortRow: {
  flexDirection: "row",
  justifyContent: "center",
  marginTop: 4,
  gap: 8,
},

sortPill: {
  paddingHorizontal: 12,
  paddingVertical: 5,
  borderRadius: 999,
  borderWidth: 1,
  borderColor: "#1F2937",
  backgroundColor: "#020617",
},

sortPillActive: {
  backgroundColor: "rgba(0,227,150,0.12)",
  borderColor: "#00E396",
},

sortText: {
  color: "#9CA3AF",
  fontSize: 11,
  fontWeight: "700",
},

sortTextActive: {
  color: "#00E396",
},
footerWrap: {
  marginTop: 28,
  paddingTop: 18,
  paddingBottom: 30,
  paddingHorizontal: 18,
  borderTopWidth: 1,
  borderTopColor: "#111827",
  alignItems: "center",
},

poweredBy: {
  color: "#00E396",
  fontSize: 12,
  fontWeight: "700",
  marginBottom: 8,
},

disclaimer: {
  color: "#6B7280",
  fontSize: 11,
  lineHeight: 16,
  textAlign: "center",
},
change: {
  marginTop: 2,
  fontSize: 13,
  fontWeight: "800",
},

});
