// screens/MarketMoversScreen.js
import React, {
  useEffect,
  useState,
  useCallback,
  useMemo,
  useRef,
} from "react";
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
  Image,
} from "react-native";
import ViewShot from "react-native-view-shot";
import * as Sharing from "expo-sharing";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { getMarketMovers } from "../services/MarketPulseService";
import { BRAND } from "../constants/theme";
import { TYPO } from "../constants/typography";
import MoveLabel from "../components/MoveLabel";
const ALPHACLARA_LOGO = require("../assets/alpha-transparent.png");
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
  if (n >= 1000)
    return `$${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
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
function priceFlashStyle(prev, next) {
  if (typeof prev !== "number" || typeof next !== "number") {
    return {};
  }

  if (prev === next) {
    return {};
  }

  return {
    backgroundColor:
      next > prev ? "rgba(0,227,150,0.16)" : "rgba(239,68,68,0.16)",

    borderWidth: 1,

    borderColor: next > prev ? "rgba(0,227,150,0.28)" : "rgba(239,68,68,0.28)",
  };
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
  const shareCardRef = useRef(null);
  const prevMoverPriceRef = useRef({});
  const currentMoverPriceRef = useRef({});
  const loadMovers = useCallback(
    async (silent = false) => {
      try {
        setErrorMessage("");
        if (!silent) setLoading(true);

        const data = await getMarketMovers("all");
        if (!data) {
          setErrorMessage(
            "Market movers are temporarily unavailable. Pull to refresh.",
          );
          return;
        }
        prevMoverPriceRef.current = { ...currentMoverPriceRef.current };

        [...(data.gainers || []), ...(data.losers || [])].forEach((m) => {
          if (m?.symbol && typeof m.price === "number") {
            currentMoverPriceRef.current[m.symbol] = m.price;
          }
        });
        setRaw({
          gainers: data.gainers || [],
          losers: data.losers || [],
          as_of: data.as_of || null,
          updated_at: data.updated_at || null,
        });
      } catch (e) {
        console.warn("MarketMoversScreen error:", e?.message || e);
        setErrorMessage(
          "Market movers are temporarily unavailable. Pull to refresh.",
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [fadeAnim],
  );

  useEffect(() => {
    loadMovers(false);
  }, [loadMovers]);

  useEffect(() => {
    const interval = setInterval(() => {
      loadMovers(true);
    }, 30000);

    return () => clearInterval(interval);
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
      if (sortBy === "dollar")
        return Math.abs(b.change || 0) - Math.abs(a.change || 0);
      if (sortBy === "pct")
        return Math.abs(b.changePct || 0) - Math.abs(a.changePct || 0);
      if (sortBy === "price") return (b.price || 0) - (a.price || 0);
      if (sortBy === "symbol")
        return String(a.symbol).localeCompare(String(b.symbol));
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
  const shareMovers = async () => {
    try {
      const uri = await shareCardRef.current?.capture?.();

      if (!uri) {
        console.warn("Share card capture failed: no URI");
        return;
      }

      const available = await Sharing.isAvailableAsync();

      if (!available) {
        console.warn("Sharing is not available on this device");
        return;
      }

      await Sharing.shareAsync(uri, {
        mimeType: "image/png",
        dialogTitle: "Share Alphaclara Market Movers",
      });
    } catch (e) {
      console.warn("Share movers card error:", e?.message || e);
    }
  };
  const shareRising = useMemo(() => {
    if (tab === "losers") return [];

    return [...(raw.gainers || [])]
      .map((m) => ({
        ...m,
        changePct: Number(m.changePct || 0),
        change: Number(m.change || 0),
        price: Number(m.price || 0),
      }))
      .sort((a, b) => Math.abs(b.changePct || 0) - Math.abs(a.changePct || 0));
  }, [raw.gainers, tab]);

  const sharePullingBack = useMemo(() => {
    if (tab === "gainers") return [];

    return [...(raw.losers || [])]
      .map((m) => ({
        ...m,
        changePct: Number(m.changePct || 0),
        change: Number(m.change || 0),
        price: Number(m.price || 0),
      }))
      .sort((a, b) => Math.abs(b.changePct || 0) - Math.abs(a.changePct || 0));
  }, [raw.losers, tab]);
  const renderRow = ({ item }) => {
    const pct = Number(item.changePct);
    const isUp = !Number.isNaN(pct) && pct >= 0;
    const { arrow, color } = arrowForChange(pct || 0);

    const trendLabel = item.trendLabel || item.trend?.label || "Market trend";
    const patternName =
      typeof item.pattern === "string"
        ? item.pattern
        : item.pattern?.name || null;

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
        <View
          style={[
            styles.rowCard,
            priceFlashStyle(prevMoverPriceRef.current[item.symbol], item.price),
          ]}
        >
          <View style={styles.rowTop}>
            <View style={styles.symbolBlock}>
              <View style={styles.symbolLine}>
                <Text style={styles.symbol}>{item.symbol}</Text>

                <MoveLabel
                  changePct={pct}
                  price={Number(item.price)}
                  style={styles.marketMoverLabel}
                />
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
            mover universe • updated {stats.updated}
          </Text>
        </View>

        <View style={styles.headerActions}>
          <TouchableOpacity
            style={styles.shareButton}
            activeOpacity={0.82}
            onPress={shareMovers}
          >
            <Ionicons name="share-outline" size={15} color={BRAND.text} />
            <Text style={styles.shareText}>Share</Text>
          </TouchableOpacity>

          <View style={styles.compactStats}>
            <Text style={styles.compactStatText}>
              <Text style={{ color: BRAND.green }}>{stats.gainers}</Text> ↑
            </Text>

            <Text style={styles.compactStatText}>
              <Text style={{ color: BRAND.red }}>{stats.losers}</Text> ↓
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.tabRow}>
        {[
          { key: "all", label: "All" },
          { key: "gainers", label: "Rising" },
          { key: "losers", label: "Dropping" },
        ].map((opt) => (
          <TouchableOpacity
            key={opt.key}
            onPress={() => setTab(opt.key)}
            style={[styles.tabPill, tab === opt.key && styles.tabPillActive]}
            activeOpacity={0.82}
          >
            <Text
              style={[styles.tabText, tab === opt.key && styles.tabTextActive]}
            >
              {opt.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.sortCompactRow}>
        <Text style={styles.sortLabel}>Sort</Text>

        {[
          { key: "move", label: "% Move" },
          { key: "dollar", label: "$ Chg" },
          { key: "pct", label: "% Chg" },
          { key: "price", label: "Price" },
          { key: "symbol", label: "Symbol" },
        ].map((opt) => (
          <TouchableOpacity
            key={opt.key}
            onPress={() => setSortBy(opt.key)}
            style={[
              styles.sortPill,
              sortBy === opt.key && styles.sortPillActive,
            ]}
            activeOpacity={0.82}
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
      <View style={styles.hiddenShareCardWrap} pointerEvents="none">
        <ViewShot
          ref={shareCardRef}
          collapsable={false}
          options={{ format: "png", quality: 1, result: "tmpfile" }}
        >
          <View style={styles.shareCard}>
            <View style={styles.shareBrandRow}>
              <View style={styles.shareLogoWrap}>
                <Image
                  source={ALPHACLARA_LOGO}
                  style={styles.shareLogo}
                  resizeMode="contain"
                />
              </View>

              <View>
                <Text style={styles.shareCardTitle}>Alphaclara</Text>
                <Text style={styles.shareCardSubTitle}>Market Movers</Text>
              </View>
            </View>

            <Text style={styles.shareCardMeta}>
              {new Date().toLocaleString()} • Informational only
            </Text>

            {shareRising.length > 0 && (
              <View style={styles.shareSection}>
                <Text
                  style={[styles.shareSectionTitle, { color: BRAND.green }]}
                >
                  Rising
                </Text>
                <Text style={styles.shareSectionMeta}>
                  Top {Math.min(shareRising.length, 15)} movers
                </Text>

                <View style={styles.shareTableHeader}>
                  <Text style={styles.shareHeaderSymbol}>Symbol</Text>
                  <Text style={styles.shareHeaderLabel}>Move</Text>
                  <Text style={styles.shareHeaderPrice}>Price</Text>
                  <Text style={styles.shareHeaderDollar}>$ Chg</Text>
                  <Text style={styles.shareHeaderMove}>% Chg</Text>
                </View>

                {shareRising.slice(0, 15).map((m, index) => (
                  <View
                    key={`rise-${m.symbol}-${index}`}
                    style={styles.shareTableRow}
                  >
                    <Text style={styles.shareColSymbol}>{m.symbol}</Text>

                    <View style={styles.shareColLabel}>
                      <MoveLabel
                        changePct={Number(m.changePct)}
                        price={Number(m.price)}
                        style={styles.shareMoveLabel}
                      />
                    </View>

                    <Text style={styles.shareColPrice}>
                      {formatPrice(m.price)}
                    </Text>

                    <Text
                      style={[styles.shareColDollar, { color: BRAND.green }]}
                    >
                      +${Math.abs(Number(m.change || 0)).toFixed(2)}
                    </Text>

                    <Text style={[styles.shareColMove, { color: BRAND.green }]}>
                      ▲ {Math.abs(Number(m.changePct || 0)).toFixed(2)}%
                    </Text>
                  </View>
                ))}
              </View>
            )}

            {sharePullingBack.length > 0 && (
              <View style={styles.shareSection}>
                <Text style={[styles.shareSectionTitle, { color: BRAND.red }]}>
                  Dropping
                </Text>
                <Text style={styles.shareSectionMeta}>
                  Top {Math.min(sharePullingBack.length, 15)} movers
                </Text>
                <View style={styles.shareTableHeader}>
                  <Text style={styles.shareHeaderSymbol}>Symbol</Text>
                  <Text style={styles.shareHeaderLabel}>Move</Text>
                  <Text style={styles.shareHeaderPrice}>Price</Text>
                  <Text style={styles.shareHeaderDollar}>$ Chg</Text>
                  <Text style={styles.shareHeaderMove}>% Chg</Text>
                </View>

                {sharePullingBack.slice(0, 15).map((m, index) => (
                  <View
                    key={`pull-${m.symbol}-${index}`}
                    style={styles.shareTableRow}
                  >
                    <Text style={styles.shareColSymbol}>{m.symbol}</Text>

                    <View style={styles.shareColLabel}>
                      <MoveLabel
                        changePct={Number(m.changePct)}
                        price={Number(m.price)}
                        style={styles.shareMoveLabel}
                      />
                    </View>

                    <Text style={styles.shareColPrice}>
                      {formatPrice(m.price)}
                    </Text>

                    <Text style={[styles.shareColDollar, { color: BRAND.red }]}>
                      -${Math.abs(Number(m.change || 0)).toFixed(2)}
                    </Text>

                    <Text style={[styles.shareColMove, { color: BRAND.red }]}>
                      ▼ {Math.abs(Number(m.changePct || 0)).toFixed(2)}%
                    </Text>
                  </View>
                ))}
              </View>
            )}

            <Text style={styles.shareFooter}>
              Powered by Alphaclara • Not financial advice
            </Text>
          </View>
        </ViewShot>
      </View>
      <View style={{ flex: 1 }}>
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

              <Text style={styles.footerMeta}>
                Last updated {stats.updated}
              </Text>

              <Text style={styles.disclaimer}>
                Market Movers are based on Alphaclara’s internal tracked
                universe, percentage price movement, trend context, and pattern
                analytics. Content is provided for informational and educational
                purposes only and is not financial, investment, trading, or tax
                advice.
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
      </View>
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
    paddingHorizontal: 9,
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
    fontSize: 10.5,
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
    fontSize: 17,
    fontFamily: TYPO.fontFamily.bold,
    letterSpacing: 0.2,
    marginRight: 8,
  },

  company: {
    color: BRAND.muted,
    fontSize: 12,
    marginTop: 3,
    fontFamily: TYPO.fontFamily.medium,
  },
  priceBlock: {
    flex: 1,
    alignItems: "flex-end",
  },

  price: {
    color: BRAND.text,
    fontSize: 15,
    fontFamily: TYPO.fontFamily.extrabold,
    fontVariant: ["tabular-nums"],
  },

  change: {
    marginTop: 4,
    fontSize: 12.5,
    fontFamily: TYPO.fontFamily.bold,
    fontVariant: ["tabular-nums"],
  },
  oneLiner: {
    color: BRAND.sub,
    fontSize: 12.5,
    lineHeight: 18,
    marginTop: 10,
    fontFamily: TYPO.fontFamily.medium,
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
    fontSize: 24,
    fontFamily: TYPO.fontFamily.extrabold,
    letterSpacing: -0.3,
  },
  compactSub: {
    color: BRAND.muted,
    fontSize: 11.5,
    marginTop: 3,
    fontFamily: TYPO.fontFamily.medium,
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
    flexWrap: "wrap",
    columnGap: 6,
    rowGap: 6,
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

  footerMeta: {
    color: BRAND.muted,
    fontSize: 10.5,
    marginBottom: 8,
    fontWeight: "700",
  },
  headerActions: {
    alignItems: "flex-end",
    rowGap: 6,
  },

  shareButton: {
    flexDirection: "row",
    alignItems: "center",
    columnGap: 4,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  shareText: {
    color: BRAND.text,
    fontSize: 11,
    fontFamily: TYPO.fontFamily.bold,
  },
  hiddenShareCardWrap: {
    position: "absolute",
    left: -9999,
    top: 0,
    opacity: 1,
  },

  shareCard: {
    width: 900,
    backgroundColor: BRAND.bg,

    paddingHorizontal: 34,
    paddingTop: 76,
    paddingBottom: 34,

    borderRadius: 28,
    borderWidth: 1,
    borderColor: BRAND.border,
  },
  shareBrandRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },

  shareLogoWrap: {
    width: 58,
    height: 58,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },

  shareLogo: {
    width: 46,
    height: 46,
  },

  shareCardTitle: {
    color: BRAND.text,
    fontSize: 34,
    fontFamily: TYPO.fontFamily.extrabold,
    letterSpacing: 0.2,
  },
  shareCardSubTitle: {
    color: BRAND.sub,
    fontSize: 18,
    fontFamily: TYPO.fontFamily.bold,
    marginTop: -2,
  },

  shareCardMeta: {
    color: BRAND.sub,
    textAlign: "center",
    fontSize: 14,
    fontFamily: TYPO.fontFamily.semibold,
    marginBottom: 26,
  },

  shareSection: {
    marginTop: 14,
    backgroundColor: BRAND.card,
    borderWidth: 1,
    borderColor: BRAND.softBorder,
    borderRadius: 20,
    padding: 16,
  },

  shareSectionTitle: {
    fontSize: 20,
    fontWeight: "900",
    marginBottom: 10,
  },

  shareTableHeader: {
    flexDirection: "row",
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: BRAND.softBorder,
    paddingBottom: 8,
    marginBottom: 4,
  },

  shareTableRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.04)",
  },

  shareColSymbol: {
    width: 120,
    color: BRAND.text,
    fontSize: 15,
    fontFamily: TYPO.fontFamily.extrabold,
  },
  shareColPrice: {
    width: 150,
    color: BRAND.sub,
    fontSize: 15,
    fontFamily: TYPO.fontFamily.bold,
    textAlign: "right",
  },
  shareColMove: {
    width: 150,
    color: BRAND.text,
    fontSize: 15,
    fontFamily: TYPO.fontFamily.extrabold,
    textAlign: "right",
  },

  shareFooter: {
    color: BRAND.muted,
    textAlign: "center",
    marginTop: 22,
    fontSize: 13,
    fontWeight: "700",
  },
  shareHeaderSymbol: {
    width: 120,
    color: BRAND.muted,
    fontSize: 13,
    fontFamily: TYPO.fontFamily.bold,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  shareHeaderPrice: {
    width: 150,
    color: BRAND.muted,
    fontSize: 13,
    fontFamily: TYPO.fontFamily.bold,
    textAlign: "right",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },

  shareHeaderMove: {
    width: 150,
    color: BRAND.muted,
    fontSize: 13,
    fontFamily: TYPO.fontFamily.bold,
    textAlign: "right",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },

  shareHeaderDollar: {
    width: 150,
    color: BRAND.muted,
    fontSize: 13,
    fontFamily: TYPO.fontFamily.bold,
    textAlign: "right",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },

  shareColDollar: {
    width: 150,
    color: BRAND.text,
    fontSize: 15,
    fontFamily: TYPO.fontFamily.bold,
    textAlign: "right",
  },
  marketMoverLabel: {
    fontSize: 10.5,
    fontFamily: TYPO.fontFamily.semibold,
    fontStyle: "italic",
    letterSpacing: -0.15,
    marginLeft: 4,
    marginTop: 0,
  },
  shareHeaderLabel: {
    width: 210,
    color: BRAND.muted,
    fontSize: 13,
    fontFamily: TYPO.fontFamily.bold,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },

  shareColLabel: {
    width: 210,
    justifyContent: "center",
  },

  shareMoveLabel: {
    fontSize: 13,
    fontFamily: TYPO.fontFamily.semibold,
    fontStyle: "italic",
    letterSpacing: -0.15,
    marginTop: 0,
  },
  shareSectionMeta: {
    color: BRAND.muted,
    fontSize: 12,
    marginBottom: 10,
    fontFamily: TYPO.fontFamily.medium,
  },
});
