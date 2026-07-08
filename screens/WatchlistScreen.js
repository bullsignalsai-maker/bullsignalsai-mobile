// screens/WatchlistScreen.js
import React, { useState, useCallback, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  RefreshControl,
  Modal,
  Animated,
  Easing,
  TouchableOpacity,
  Keyboard,
  Platform,
  ActionSheetIOS,
  Alert,
  LayoutAnimation,
  UIManager,
  FlatList,
  Image,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import * as Haptics from "expo-haptics";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Swipeable } from "react-native-gesture-handler";

import { auth } from "../firebaseConfig";
import { API_BASE_URL } from "../config/apiKeys";
import ToastMessage from "../components/ToastMessage";
import MoveLabel from "../components/MoveLabel";
import {
  getWatchlistScreen,
  addToWatchlist,
  removeFromWatchlist,
} from "../services/watchlistService";

import { BRAND } from "../constants/theme";
import { TYPO } from "../constants/typography";
import PortfolioScreen from "./PortfolioScreen";
import {
  displayRating,
  signalColor,
  getAuthoritativeSignal,
} from "../utils/signalUtils";
// Per-session visual treatment for the price freshness dot.
// LIVE/PRE/AH/CLOSED are all "we know exactly what this is" states.
// LAST/PENDING mean data quality is degraded, so they're dimmed
// rather than lumped visually with a normal closed market.
const SESSION_DOT_STYLE = {
  LIVE: { color: BRAND.accent, opacity: 1 },
  PRE: { color: BRAND.amber, opacity: 1 },
  AH: { color: BRAND.amber, opacity: 1 },
  CLOSED: { color: BRAND.sub, opacity: 1 },
  LAST: { color: BRAND.sub, opacity: 0.6 },
  PENDING: { color: BRAND.sub, opacity: 0.6 },
};

const fmt = (v) =>
  typeof v === "number" && !Number.isNaN(v) ? v.toFixed(2) : "--";

const fmtPct = (v) =>
  typeof v === "number" && !Number.isNaN(v)
    ? `${v >= 0 ? "+" : ""}${v.toFixed(2)}%`
    : "--";

const fmtDateTime = (ts) => {
  if (!ts) return "";
  try {
    const d = new Date(ts);
    return d.toLocaleString([], {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      timeZoneName: "short",
    });
  } catch {
    return "";
  }
};
const fmtChange = (v) =>
  typeof v === "number" && !Number.isNaN(v)
    ? `${v >= 0 ? "+" : ""}$${Math.abs(v).toFixed(2)}`
    : "--";

function getPatternColor(winRate) {
  if (typeof winRate !== "number") return "#374151"; // neutral gray
  if (winRate >= 0.7) return "#16A34A"; // strong green
  if (winRate >= 0.6) return "#22C55E"; // green
  if (winRate >= 0.5) return "#FACC15"; // yellow
  return "#EF4444"; // red
}

function formatPatternLabel(pattern, winRate) {
  if (!pattern) return "NO CLEAR PATTERN";
  if (typeof winRate === "number") {
    return `${pattern} ${Math.round(winRate * 100)}%`;
  }
  return pattern;
}

export default function WatchlistScreen({ navigation }) {
  const user = auth.currentUser;
  const priceFlash = useRef({}).current;
  const prevPrices = useRef({}).current;
  const [viewMode, setViewMode] = useState("watchlist");
  const [items, setItems] = useState([]);
  const [newSymbol, setNewSymbol] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [sortMode, setSortMode] = useState("confidence");
  const [sortVisible, setSortVisible] = useState(false);
  const [toast, setToast] = useState({ visible: false, message: "" });
  const [lastSync, setLastSync] = useState(new Date());

  // Pin + Notes (local UX polish)
  const [pinned, setPinned] = useState({});
  const [noteModal, setNoteModal] = useState({
    visible: false,
    symbol: "",
    text: "",
  });

  const fadeAnim = useState(new Animated.Value(0))[0];
  const swipeRefs = useRef({});

  // Enable LayoutAnimation on Android
  useEffect(() => {
    if (
      Platform.OS === "android" &&
      UIManager.setLayoutAnimationEnabledExperimental
    ) {
      UIManager.setLayoutAnimationEnabledExperimental(true);
    }
  }, []);

  useEffect(() => {
    if (!user) return;

    const t = setInterval(() => {
      loadWatchlist({ silent: true }); // snapshot-aware, TTL-safe
    }, 15000); // align with snapshot TTL

    return () => clearInterval(t);
  }, [user]);

  /* ================= PINS STORAGE ================= */
  const pinsKey = user ? `watchlist_pins_${user.uid}` : null;

  const loadPins = async () => {
    if (!pinsKey) return;
    try {
      const raw = await AsyncStorage.getItem(pinsKey);
      const json = raw ? JSON.parse(raw) : {};
      setPinned(json && typeof json === "object" ? json : {});
    } catch {
      setPinned({});
    }
  };

  const savePins = async (next) => {
    if (!pinsKey) return;
    try {
      await AsyncStorage.setItem(pinsKey, JSON.stringify(next));
    } catch {}
  };

  useEffect(() => {
    loadPins();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pinsKey]);

  /* ================= LOAD SNAPSHOT ================= */
  const loadWatchlist = async ({ silent = false } = {}) => {
    if (!user) return;

    try {
      if (!silent) setRefreshing(true);

      const res = await getWatchlistScreen(user.uid);
      const list = res?.items || [];

      setItems(list);
      setLastSync(new Date());

      // 🔥 allow render to commit before animating
      requestAnimationFrame(() => {
        list.forEach((it) => {
          const sym = it.symbol;
          const price = it.price;

          if (!priceFlash[sym]) {
            priceFlash[sym] = new Animated.Value(0);
          }

          if (it.needs_refresh) {
            prevPrices[sym] = price;
            return;
          }

          if (prevPrices[sym] == null) {
            prevPrices[sym] = price;
            return;
          }

          // 👇 tolerance instead of strict equality
          if (Math.abs(price - prevPrices[sym]) < 0.005) return;

          priceFlash[sym].setValue(1);
          Animated.timing(priceFlash[sym], {
            toValue: 0,
            duration: 900,
            useNativeDriver: false,
          }).start();

          prevPrices[sym] = price;
        });
      });
    } catch {
      if (!silent) showToast("Failed to refresh watchlist");
    } finally {
      if (!silent) setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadWatchlist();
      loadPins();
    }, [user]),
  );

  /* ================= SEARCH ================= */
  const handleInputChange = async (text) => {
    const up = (text || "").toUpperCase();
    setNewSymbol(up);

    if (!up.trim()) {
      setSuggestions([]);
      return;
    }

    try {
      const res = await fetch(
        `${API_BASE_URL}/search?q=${encodeURIComponent(up)}`,
      );
      const json = await res.json();

      // dedupe by symbol to avoid "duplicate key" warnings
      const raw = (json?.data || []).slice(0, 10);
      const seen = new Set();
      const list = [];
      for (const i of raw) {
        const sym = (i?.symbol || "").toUpperCase();
        if (!sym || seen.has(sym)) continue;
        seen.add(sym);
        list.push({ symbol: sym, desc: i.description || "" });
        if (list.length >= 5) break;
      }
      setSuggestions(list);
    } catch {
      setSuggestions([]);
    }
  };

  /* ================= ADD / REMOVE ================= */
  const handleAddTicker = async (sym) => {
    const s = (sym || newSymbol || "").split(" ")[0].toUpperCase().trim();
    if (!s || !user) return;

    Keyboard.dismiss();
    setSuggestions([]);
    setNewSymbol("");

    try {
      await addToWatchlist(user.uid, s);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      showToast(`${s} added`);
      await loadWatchlist();
    } catch {
      showToast("Failed to add ticker");
    }
  };

  const optimisticRemove = async (sym) => {
    if (!user) return;

    // close swipe if open
    try {
      swipeRefs.current[sym]?.close?.();
    } catch {}

    // optimistic UI
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    const prev = items;
    setItems((cur) => cur.filter((x) => x.symbol !== sym));

    try {
      await removeFromWatchlist(user.uid, sym);
      showToast(`${sym} removed`);
      await loadWatchlist();
    } catch {
      // revert on failure
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setItems(prev);
      showToast("Failed to remove ticker");
    }
  };

  /* ================= SORT ================= */
  const sortedItems = [...items].sort((a, b) => {
    const ap = pinned[a.symbol] ? 1 : 0;
    const bp = pinned[b.symbol] ? 1 : 0;
    if (ap !== bp) return bp - ap;

    if (sortMode === "confidence") {
      const ac = Number(a.bullbrain?.confidence ?? a.hybridScore ?? 0);
      const bc = Number(b.bullbrain?.confidence ?? b.hybridScore ?? 0);
      return bc - ac;
    }

    if (sortMode === "alpha") {
      return String(a.symbol || "").localeCompare(String(b.symbol || ""));
    }

    if (sortMode === "signal") {
      const order = { BUY: 1, HOLD: 2, SELL: 3 };
      return (
        (order[getAuthoritativeSignal(a)] || 99) -
        (order[getAuthoritativeSignal(b)] || 99)
      );
    }

    if (sortMode === "price") {
      return Number(b.price || 0) - Number(a.price || 0);
    }

    if (sortMode === "pct") {
      return (
        Math.abs(Number(b.changePct || 0)) - Math.abs(Number(a.changePct || 0))
      );
    }

    if (sortMode === "dollar") {
      return Math.abs(Number(b.change || 0)) - Math.abs(Number(a.change || 0));
    }

    return 0;
  });

  const pinnedItems = sortedItems.filter((i) => pinned[i.symbol]);
  const normalItems = sortedItems.filter((i) => !pinned[i.symbol]);
  const displayList = [
    ...(pinnedItems.length
      ? [{ __type: "header", title: "Pinned" }, ...pinnedItems]
      : []),

    ...(pinnedItems.length && normalItems.length
      ? [{ __type: "divider" }]
      : []),

    ...(normalItems.length
      ? [{ __type: "header", title: "Watchlist" }, ...normalItems]
      : []),
  ];

  const toggleSortModal = () => {
    const next = !sortVisible;
    setSortVisible(next);
    Animated.timing(fadeAnim, {
      toValue: next ? 1 : 0,
      duration: 180,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start();
  };

  const selectSort = (mode) => {
    setSortMode(mode);
    toggleSortModal();
  };

  const showToast = (msg) => setToast({ visible: true, message: msg });

  /* ================= NAVIGATION (HomeScreen-style) ================= */
  const openDetails = (item) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    navigation.navigate("StockDetailScreen", {
      symbol: item.symbol,
      name: item.companyName || item.name || item.displayName || item.symbol,
      source: "ui",
    });
  };

  const timeAgoFrom = (ts, needsRefresh) => {
    // A quote the backend has flagged as needing refresh is never
    // "Live"/"Ns ago", no matter how recent its timestamp looks —
    // matches the session dot's LAST state (see watchlistService.js).
    if (needsRefresh) return "LAST";
    if (!ts) return "";
    const diff = Date.now() - new Date(ts).getTime();
    const sec = Math.floor(diff / 1000);
    const min = Math.floor(sec / 60);

    if (sec < 30) return "Live";
    if (min < 1) return `${sec}s ago`;
    if (min < 60) return `${min}m ago`;
    return fmtDateTime(ts); // fallback
  };

  const timeAgo = () => {
    const diffMs = Date.now() - lastSync.getTime();
    const sec = Math.floor(diffMs / 1000);
    const min = Math.floor(sec / 60);
    const hr = Math.floor(min / 60);

    if (sec < 15) return "Just now";
    if (min < 1) return `${sec}s ago`;
    if (min < 60) return `${min}m ago`;
    return `${hr}h ago`;
  };

  /* ================= LONG PRESS ACTIONS ================= */
  const togglePin = async (sym) => {
    const next = { ...(pinned || {}) };
    if (next[sym]) delete next[sym];
    else next[sym] = true;
    setPinned(next);
    savePins(next);
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
  };

  const openNotes = async (sym) => {
    try {
      const key = `watchlist_note_${user?.uid || "anon"}_${sym}`;
      const raw = await AsyncStorage.getItem(key);
      setNoteModal({ visible: true, symbol: sym, text: raw || "" });
    } catch {
      setNoteModal({ visible: true, symbol: sym, text: "" });
    }
  };

  const saveNotes = async () => {
    try {
      const sym = noteModal.symbol;
      const key = `watchlist_note_${user?.uid || "anon"}_${sym}`;
      await AsyncStorage.setItem(key, noteModal.text || "");
      setNoteModal({ visible: false, symbol: "", text: "" });
      showToast(`${sym} note saved`);
    } catch {
      showToast("Failed to save note");
    }
  };

  const onLongPressItem = (item) => {
    const sym = item.symbol;
    const pinnedNow = !!pinned[sym];

    const actions = [
      pinnedNow ? "Unpin" : "Pin",
      "Add Alert",
      "Notes",
      "Remove",
      "Cancel",
    ];

    const handler = (idx) => {
      const choice = actions[idx];
      if (choice === "Pin" || choice === "Unpin") togglePin(sym);
      else if (choice === "Add Alert") {
        navigation.navigate("AddAlertScreen", {
          symbol: item.symbol,
          companyName: item.companyName || item.symbol,
          price: item.price,
          change: item.change,
          changePct: item.changePct,
          session: item.session,
          quoteUpdatedAt: item.quote_updated_at,
        });
      } else if (choice === "Notes") openNotes(sym);
      else if (choice === "Remove") optimisticRemove(sym);
    };

    if (Platform.OS === "ios") {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: actions,
          cancelButtonIndex: actions.length - 1,
          destructiveButtonIndex: actions.indexOf("Remove"),
          title: sym,
        },
        handler,
      );
    } else {
      Alert.alert(sym, "Actions", [
        { text: pinnedNow ? "Unpin" : "Pin", onPress: () => togglePin(sym) },
        {
          text: "Add Alert",
          onPress: () =>
            navigation.navigate("AddAlertScreen", {
              symbol: item.symbol,
              companyName: item.companyName || item.symbol,
              price: item.price,
              change: item.change,
              changePct: item.changePct,
              session: item.session,
              quoteUpdatedAt: item.quote_updated_at,
            }),
        },
        { text: "Notes", onPress: () => openNotes(sym) },
        {
          text: "Remove",
          style: "destructive",
          onPress: () => optimisticRemove(sym),
        },
        { text: "Cancel", style: "cancel" },
      ]);
    }
  };

  /* ================= SWIPE ACTION ================= */
  const renderRightActions = (sym) => (
    <TouchableOpacity
      activeOpacity={0.9}
      onPress={() => optimisticRemove(sym)}
      style={styles.swipeDelete}
    >
      <Ionicons name="trash-outline" size={18} color="#fff" />
      <Text style={styles.swipeDeleteText}>Remove</Text>
    </TouchableOpacity>
  );

  /* ================= RENDER ITEM ================= */
  const renderItem = ({ item, index }) => {
    if (item.__type === "header") {
      return (
        <Text style={[styles.sectionHeader, index === 0 && { marginTop: 4 }]}>
          {item.title}
        </Text>
      );
    }

    if (item.__type === "divider") {
      return <View style={styles.sectionDivider} />;
    }

    const price = item.price;
    const change = item.change;
    const changePct = item.changePct;

    // Backend/service-computed session: PRE/LIVE/AH/CLOSED only apply
    // to a fresh quote; a stale or missing quote is LAST/PENDING.
    // See watchlistService.js's getMarketPeriod/mergeWatchlistQuotes.
    const session = item.session;

    const isLive = session === "LIVE";

    const pct = typeof item.changePct === "number" ? item.changePct : 0;

    const isUp = pct >= 0;

    // 🔧 normalize bullbrain fields (watchlist-safe)
    const signal = getAuthoritativeSignal(item);

    const patternName = item.pattern?.name;
    const patternWinRate = item.pattern?.winRate;

    const sessionDotStyle =
      SESSION_DOT_STYLE[session] || SESSION_DOT_STYLE.PENDING;

    return (
      <Swipeable
        ref={(r) => (swipeRefs.current[item.symbol] = r)}
        renderRightActions={() => renderRightActions(item.symbol)}
        overshootRight={false}
      >
        <TouchableOpacity
          activeOpacity={0.85}
          style={[styles.card, isUp ? styles.cardUp : styles.cardDown]}
          onPress={() => openDetails(item)}
          onLongPress={() => onLongPressItem(item)}
        >
          {/* HEADER */}
          <View style={styles.cardHeader}>
            {/* LEFT — Symbol + Company */}
            <View
              style={[
                styles.symbolAvatar,
                isUp ? styles.avatarUp : styles.avatarDown,
              ]}
            >
              {item.logoUrl ? (
                <Image
                  source={{ uri: item.logoUrl }}
                  style={styles.tickerLogoImage}
                  resizeMode="contain"
                />
              ) : (
                <Text style={styles.symbolAvatarText}>
                  {String(item.symbol || "").slice(0, 2)}
                </Text>
              )}
            </View>
            <View style={styles.cardMiddle}>
              <View style={styles.symbolRow}>
                <Text style={styles.symbol}>{item.symbol}</Text>

                <MoveLabel
                  changePct={item.changePct}
                  price={item.price}
                  style={styles.moveLabelInline}
                />
              </View>

              <Text style={styles.name} numberOfLines={1}>
                {item.companyName ||
                  item.name ||
                  item.displayName ||
                  item.description ||
                  item.symbol}
              </Text>
              <View style={styles.inlineSignalRow}>
                <View
                  style={[
                    styles.inlineSignalBadge,
                    { backgroundColor: signalColor(signal) },
                  ]}
                >
                  <Text style={styles.inlineSignalText}>
                    {displayRating(signal)}
                  </Text>
                </View>

                <Text
                  style={[
                    styles.inlineConfidence,
                    { color: signalColor(signal) },
                  ]}
                >
                  {Math.round(item.bullbrain?.confidence ?? 0)}%
                </Text>
              </View>
            </View>

            {/* {/* RIGHT — Price + Change */}

            <View style={styles.priceBlock}>
              <Animated.Text
                style={[
                  styles.price,
                  {
                    backgroundColor: priceFlash[item.symbol]?.interpolate({
                      inputRange: [0, 1],
                      outputRange: [
                        "transparent",
                        isUp ? "rgba(0,227,150,0.30)" : "rgba(255,69,96,0.30)",
                      ],
                    }),
                    paddingHorizontal: 6,
                    paddingVertical: 2,
                    borderRadius: 7,
                    overflow: "hidden",
                  },
                ]}
              >
                ${fmt(price)}
              </Animated.Text>

              <View style={styles.changeStack}>
                <Text
                  style={[
                    styles.changePct,
                    {
                      color: isLive
                        ? isUp
                          ? BRAND.accent
                          : BRAND.red
                        : BRAND.sub,
                      opacity: isLive ? 1 : 0.75,
                    },
                  ]}
                >
                  {isUp ? "▲" : "▼"} {Math.abs(pct).toFixed(2)}%
                </Text>

                <Text
                  style={[
                    styles.changeDollar,
                    {
                      color: isLive
                        ? isUp
                          ? BRAND.accent
                          : BRAND.red
                        : BRAND.sub,
                      opacity: isLive ? 0.9 : 0.65,
                    },
                  ]}
                >
                  {fmtChange(change)}
                </Text>
              </View>
              <View style={styles.sessionRow}>
                <View
                  style={[
                    styles.sessionDot,
                    {
                      backgroundColor: sessionDotStyle.color,
                      opacity: sessionDotStyle.opacity,
                    },
                  ]}
                />
                <Text style={styles.sessionText}>{session || "LAST"}</Text>
              </View>
            </View>
          </View>

          {/* SUMMARY */}

          <Text style={styles.summary} numberOfLines={2}>
            {item.watchlistSummary ||
              "AI analysis is preparing for this ticker."}
          </Text>
          {/* SMART PATTERN */}
          {!!patternName && (
            <View style={styles.patternRow}>
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <Text style={styles.patternLabel}>Pattern</Text>
                <Text style={styles.patternValue}>
                  {formatPatternLabel(patternName, patternWinRate)}
                </Text>
              </View>

              <Text style={styles.patternTime}>
                {timeAgoFrom(item.quote_updated_at, item.needs_refresh)}
              </Text>
            </View>
          )}

          {/* UPDATED */}
        </TouchableOpacity>
      </Swipeable>
    );
  };
  const bullishSignals = new Set([
    "BUY",
    "STRONG_BULLISH",
    "BULLISH_WATCH",
    "MOMENTUM_WATCH",
  ]);

  const neutralSignals = new Set(["HOLD", "HIGH_RISK_MOMENTUM", "CAUTION"]);

  const bearishSignals = new Set(["SELL", "BEARISH_WATCH"]);

  const buyCount = items.filter((x) =>
    bullishSignals.has(getAuthoritativeSignal(x)),
  ).length;

  const holdCount = items.filter((x) =>
    neutralSignals.has(getAuthoritativeSignal(x)),
  ).length;

  const sellCount = items.filter((x) =>
    bearishSignals.has(getAuthoritativeSignal(x)),
  ).length;
  const avgConfidence =
    items.length > 0
      ? Math.round(
          items.reduce(
            (sum, x) =>
              sum + Number(x.bullbrain?.confidence ?? x.hybridScore ?? 0),
            0,
          ) / items.length,
        )
      : 0;
  return (
    <View style={styles.container}>
      <View style={styles.assetsHero}>
        <View style={styles.assetsTitleRow}>
          <View style={styles.assetsSparkle}>
            <Ionicons name="sparkles" size={22} color="#D4A63A" />
          </View>

          <View>
            <Text style={styles.assetsTitle}>My Assets</Text>
            <Text style={styles.assetsSubtitle}>Track. Analyze. Grow.</Text>
          </View>
        </View>

        {viewMode === "watchlist" ? (
          <TouchableOpacity
            onPress={toggleSortModal}
            style={styles.assetsIconBtn}
            activeOpacity={0.82}
          >
            <Ionicons name="options-outline" size={18} color={BRAND.text} />
          </TouchableOpacity>
        ) : (
          <View style={styles.assetsIconPlaceholder} />
        )}
      </View>

      <View style={styles.modeSwitch}>
        <TouchableOpacity
          activeOpacity={0.85}
          style={
            viewMode === "watchlist" ? styles.modePillActive : styles.modePill
          }
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            setViewMode("watchlist");
          }}
        >
          <Ionicons
            name="star-outline"
            size={14}
            color={viewMode === "watchlist" ? "#D4A63A" : BRAND.sub}
          />
          <Text
            style={
              viewMode === "watchlist"
                ? styles.modePillActiveText
                : styles.modePillText
            }
          >
            Watchlist
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          activeOpacity={0.85}
          style={
            viewMode === "portfolio" ? styles.modePillActive : styles.modePill
          }
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            setViewMode("portfolio");
          }}
        >
          <Ionicons
            name="wallet-outline"
            size={14}
            color={viewMode === "portfolio" ? "#D4A63A" : BRAND.sub}
          />
          <Text
            style={
              viewMode === "portfolio"
                ? styles.modePillActiveText
                : styles.modePillText
            }
          >
            Portfolio
          </Text>
        </TouchableOpacity>
      </View>
      {viewMode === "watchlist" && (
        <View style={styles.intelligenceCard}>
          <View style={styles.intelligenceTopRow}>
            <View>
              <Text style={styles.intelligenceTitle}>
                Watchlist Intelligence
              </Text>
              <Text style={styles.intelligenceSub}>
                AI signal health across tracked assets
              </Text>
            </View>

            <View style={styles.intelligenceScore}>
              <Text style={styles.intelligenceScoreText}>{avgConfidence}%</Text>
              <Text style={styles.intelligenceScoreLabel}>
                {avgConfidence >= 70
                  ? "Bullish"
                  : avgConfidence >= 50
                    ? "Neutral"
                    : "Cautious"}
              </Text>
            </View>
          </View>

          <View style={styles.signalStatsCompactRow}>
            <Text style={styles.signalCompactText}>
              Bullish <Text style={styles.signalCompactValue}>{buyCount}</Text>
            </Text>

            <View style={styles.signalCompactDot} />

            <Text style={styles.signalCompactText}>
              Neutral <Text style={styles.signalCompactValue}>{holdCount}</Text>
            </Text>

            <View style={styles.signalCompactDot} />

            <Text style={styles.signalCompactText}>
              Bearish <Text style={styles.signalCompactValue}>{sellCount}</Text>
            </Text>

            <View style={styles.signalCompactDot} />

            <Text style={styles.signalCompactText}>
              Tracked{" "}
              <Text style={styles.signalCompactValue}>{items.length}</Text>
            </Text>
          </View>
        </View>
      )}
      {viewMode === "portfolio" ? (
        <PortfolioScreen navigation={navigation} embedded />
      ) : (
        <>
          <View style={styles.addRow}>
            <Ionicons name="search-outline" size={18} color="#6B7280" />
            <TextInput
              style={styles.input}
              value={newSymbol}
              placeholder="Search or add ticker (e.g., AAPL)"
              placeholderTextColor="#6B7280"
              onChangeText={handleInputChange}
              autoCapitalize="characters"
              returnKeyType="done"
              onSubmitEditing={() => handleAddTicker()}
              blurOnSubmit={true}
            />
            <TouchableOpacity
              style={styles.addBtn}
              onPress={() => handleAddTicker()}
              activeOpacity={0.85}
            >
              <Ionicons name="add" size={20} color="#000" />
            </TouchableOpacity>
          </View>

          {suggestions.length > 0 && (
            <View style={styles.suggestionsBox}>
              {suggestions.map((s, idx) => (
                <TouchableOpacity
                  key={`${s.symbol}-${idx}`}
                  onPress={() => handleAddTicker(s.symbol)}
                  style={styles.suggestionRow}
                  activeOpacity={0.85}
                >
                  <Ionicons
                    name="trending-up-outline"
                    size={16}
                    color={BRAND.sub}
                  />
                  <Text style={styles.suggestionText}>
                    {s.symbol} – {s.desc}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          <FlatList
            data={displayList}
            keyExtractor={(item, index) => `${item.symbol}-${index}`}
            renderItem={renderItem}
            refreshControl={
              <RefreshControl
                tintColor={BRAND.accent}
                refreshing={refreshing}
                onRefresh={() => loadWatchlist({ silent: false })}
              />
            }
            contentContainerStyle={{ paddingBottom: 110 }}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <Ionicons name="bookmark-outline" size={56} color="#333" />
                <Text style={styles.emptyTitle}>Your watchlist is empty</Text>
                <Text style={styles.emptyText}>
                  Search for a stock and tap + to track it.
                </Text>
              </View>
            }
            ListFooterComponent={
              <View style={styles.footerWrap}>
                <Text style={styles.footerText}>
                  Powered by <Text style={styles.footerBrand}>Alphaclara</Text>
                </Text>

                <Text style={styles.disclaimer}>
                  Watchlist prices, AI ratings, alerts, and market context are
                  provided for informational and educational purposes only and
                  are not financial, investment, trading, or tax advice.
                </Text>
              </View>
            }
          />
        </>
      )}
      <Modal transparent visible={sortVisible} animationType="none">
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={toggleSortModal}
        >
          <Animated.View
            style={[
              styles.sortBox,
              {
                opacity: fadeAnim,
                transform: [
                  {
                    scale: fadeAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0.97, 1],
                    }),
                  },
                ],
              },
            ]}
          >
            <TouchableOpacity onPress={() => selectSort("confidence")}>
              <Text
                style={[
                  styles.sortOption,
                  sortMode === "confidence" && styles.sortOptionActive,
                ]}
              >
                Confidence (High to Low)
              </Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={() => selectSort("alpha")}>
              <Text
                style={[
                  styles.sortOption,
                  sortMode === "alpha" && styles.sortOptionActive,
                ]}
              >
                Alphabetical (A to Z)
              </Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={() => selectSort("signal")}>
              <Text
                style={[
                  styles.sortOption,
                  sortMode === "signal" && styles.sortOptionActive,
                ]}
              >
                AI Rating
              </Text>
              <TouchableOpacity onPress={() => selectSort("price")}>
                <Text
                  style={[
                    styles.sortOption,
                    sortMode === "price" && styles.sortOptionActive,
                  ]}
                >
                  Price High to Low
                </Text>
              </TouchableOpacity>

              <TouchableOpacity onPress={() => selectSort("pct")}>
                <Text
                  style={[
                    styles.sortOption,
                    sortMode === "pct" && styles.sortOptionActive,
                  ]}
                >
                  % Change
                </Text>
              </TouchableOpacity>

              <TouchableOpacity onPress={() => selectSort("dollar")}>
                <Text
                  style={[
                    styles.sortOption,
                    sortMode === "dollar" && styles.sortOptionActive,
                  ]}
                >
                  $ Change
                </Text>
              </TouchableOpacity>
            </TouchableOpacity>
          </Animated.View>
        </TouchableOpacity>
      </Modal>

      {/* Notes modal */}
      <Modal transparent visible={noteModal.visible} animationType="fade">
        <View style={styles.noteOverlay}>
          <View style={styles.noteCard}>
            <Text style={styles.noteTitle}>{noteModal.symbol} Notes</Text>
            <TextInput
              style={styles.noteInput}
              value={noteModal.text}
              onChangeText={(t) => setNoteModal((s) => ({ ...s, text: t }))}
              placeholder="Write a quick note…"
              placeholderTextColor="#6B7280"
              multiline
            />
            <View style={styles.noteBtns}>
              <TouchableOpacity
                onPress={() =>
                  setNoteModal({ visible: false, symbol: "", text: "" })
                }
                style={[styles.noteBtn, { backgroundColor: BRAND.border }]}
              >
                <Text style={styles.noteBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={saveNotes}
                style={[styles.noteBtn, { backgroundColor: BRAND.accent }]}
              >
                <Text style={[styles.noteBtnText, { color: "#000" }]}>
                  Save
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <ToastMessage
        visible={toast.visible}
        message={toast.message}
        onHide={() => setToast({ visible: false, message: "" })}
      />
    </View>
  );
}
const PREMIUM = {
  cardSoft: "#0B1220",
  border: "rgba(255,255,255,0.065)",
  borderStrong: "rgba(255,255,255,0.095)",
  glass: "rgba(255,255,255,0.038)",
  textSoft: "rgba(255,255,255,0.92)",
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BRAND.bg },

  topBar: {
    paddingTop: 52,
    paddingHorizontal: 16,
    marginBottom: 8,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },

  headerTitle: {
    color: PREMIUM.textSoft,
    fontSize: 29,
    fontFamily: TYPO.fontFamily.extrabold,
    letterSpacing: -0.9,
  },

  syncInline: {
    color: BRAND.sub,
    fontSize: 11.5,
    marginTop: 2,
    fontFamily: TYPO.fontFamily.medium,
  },

  sortCompactBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: PREMIUM.glass,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: PREMIUM.border,
    paddingHorizontal: 11,
    paddingVertical: 6,
  },

  sortCompactText: {
    color: BRAND.sub,
    fontSize: 11,
    marginLeft: 5,
    fontFamily: TYPO.fontFamily.semibold,
  },

  addRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.045)",
    borderRadius: 22,
    paddingHorizontal: 14,
    marginHorizontal: 6,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.18)",
    minHeight: 40,
  },

  input: {
    flex: 1,
    color: BRAND.text,
    fontSize: 14,
    paddingVertical: 11,
    marginLeft: 10,
    fontFamily: TYPO.fontFamily.medium,
  },

  addBtn: {
    backgroundColor: "#FFFFFF",
    borderRadius: 15,
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 8,
  },

  card: {
    backgroundColor: PREMIUM.cardSoft,
    borderRadius: 18,

    paddingHorizontal: 13,
    paddingVertical: 7,

    marginHorizontal: 6,
    marginBottom: 9,

    borderWidth: 1,
    borderColor: "rgba(0,227,150,0.16)",

    shadowColor: "#00E396",
    shadowOffset: {
      width: 0,
      height: 8,
    },
    shadowOpacity: 0.08,
    shadowRadius: 14,
    elevation: 5,

    overflow: "hidden",
  },

  cardUp: {
    borderLeftWidth: 3,
    borderLeftColor: BRAND.accent,

    borderColor: "rgba(0,227,150,0.18)",
  },
  cardDown: {
    borderLeftWidth: 3,
    borderLeftColor: BRAND.red,

    borderColor: "rgba(255,69,96,0.18)",
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
  },

  symbolAvatar: {
    width: 38,
    height: 38,
    marginRight: 11,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },

  avatarUp: {
    backgroundColor: "rgba(0,227,150,0.10)",
    borderColor: "rgba(0,227,150,0.22)",
  },

  avatarDown: {
    backgroundColor: "rgba(255,69,96,0.10)",
    borderColor: "rgba(255,69,96,0.22)",
  },

  symbolAvatarText: {
    color: PREMIUM.textSoft,
    fontSize: 12.5,
    fontFamily: TYPO.fontFamily.extrabold,
  },

  cardMiddle: {
    flex: 1,
    paddingRight: 8,
  },

  symbolRow: {
    flexDirection: "row",
    alignItems: "center",
  },

  symbol: {
    color: PREMIUM.textSoft,
    fontSize: 18,
    fontFamily: TYPO.fontFamily.extrabold,
    letterSpacing: -0.4,
  },

  moveLabelInline: {
    marginLeft: 7,
    fontSize: 10,
    fontFamily: TYPO.fontFamily.bold,
  },

  name: {
    color: BRAND.sub,
    fontSize: 12.3,
    lineHeight: 15,
    marginTop: 1,
    fontFamily: TYPO.fontFamily.medium,
  },

  priceBlock: {
    width: 96,
    alignItems: "flex-end",
    paddingTop: 1,
  },

  price: {
    color: PREMIUM.textSoft,
    fontSize: 15.8,
    fontFamily: TYPO.fontFamily.extrabold,
    fontVariant: ["tabular-nums"],
  },

  changeStack: {
    alignItems: "flex-end",
    marginTop: 3,
  },

  changePct: {
    fontSize: 12,
    fontFamily: TYPO.fontFamily.bold,
    fontVariant: ["tabular-nums"],
  },

  changeDollar: {
    fontSize: 11,
    marginTop: 1,
    fontFamily: TYPO.fontFamily.semibold,
    fontVariant: ["tabular-nums"],
  },

  signalRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 4,
  },

  signalBadge: {
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginRight: 7,
  },

  signalText: {
    color: "#000",
    fontSize: 9.8,
    fontFamily: TYPO.fontFamily.bold,
  },

  confInline: {
    fontSize: 10.4,
    fontFamily: TYPO.fontFamily.semibold,
  },

  summary: {
    color: PREMIUM.textSoft,
    fontSize: 12,
    lineHeight: 16,
    marginTop: 3,
    fontFamily: TYPO.fontFamily.medium,
    opacity: 0.92,
  },
  patternRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 2,
    paddingVertical: 2,
    paddingHorizontal: 7,
    borderRadius: 999,
    backgroundColor: "rgba(99,102,241,0.08)",
    borderWidth: 1,
    borderColor: "rgba(129,140,248,0.18)",
  },
  patternTime: {
    color: BRAND.muted,
    fontSize: 9,
    fontFamily: TYPO.fontFamily.medium,
  },
  patternLabel: {
    color: "#A5B4FC",
    fontSize: 8.5,
    fontWeight: "900",
    marginRight: 5,
    textTransform: "uppercase",
    letterSpacing: 0.45,
  },

  patternValue: {
    color: "#D1D5DB",
    fontSize: 9.4,
    fontWeight: "800",
  },

  sectionHeader: {
    marginHorizontal: 12,
    marginTop: 2,
    marginBottom: 5,
    color: "#9CA3AF",
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 1,
    textTransform: "uppercase",
  },

  sectionDivider: {
    height: 1,
    backgroundColor: "rgba(255,255,255,0.05)",
    marginHorizontal: 18,
    marginVertical: 8,
  },

  suggestionsBox: {
    marginHorizontal: 10,
    backgroundColor: BRAND.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: PREMIUM.border,
    marginTop: 4,
    marginBottom: 8,
    overflow: "hidden",
  },

  suggestionRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 9,
    paddingHorizontal: 12,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.045)",
  },

  suggestionText: {
    color: "#D1D5DB",
    fontSize: 12,
    marginLeft: 8,
    flex: 1,
  },

  emptyState: {
    alignItems: "center",
    marginTop: 80,
  },

  emptyTitle: {
    color: BRAND.text,
    fontSize: 16,
    fontWeight: "700",
    marginTop: 10,
  },

  emptyText: {
    color: BRAND.sub,
    fontSize: 12,
    marginTop: 4,
    textAlign: "center",
    paddingHorizontal: 40,
  },

  swipeDelete: {
    width: 90,
    marginRight: 10,
    marginBottom: 9,
    borderRadius: 18,
    backgroundColor: BRAND.red,
    alignItems: "center",
    justifyContent: "center",
  },

  swipeDeleteText: {
    color: "#fff",
    marginTop: 4,
    fontSize: 11,
    fontWeight: "800",
  },

  modalOverlay: {
    flex: 1,
    justifyContent: "flex-start",
    alignItems: "flex-end",
    paddingTop: 150,
    paddingRight: 18,
    backgroundColor: "rgba(0,0,0,0.45)",
  },

  sortBox: {
    backgroundColor: BRAND.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: PREMIUM.borderStrong,
    width: 230,
    paddingVertical: 7,
  },

  sortOption: {
    color: "#E5E7EB",
    fontSize: 13,
    paddingVertical: 9,
    paddingHorizontal: 13,
  },

  sortOptionActive: {
    color: BRAND.accent,
    fontWeight: "900",
  },

  noteOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
  },

  noteCard: {
    width: "100%",
    maxWidth: 520,
    backgroundColor: BRAND.card,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: PREMIUM.borderStrong,
    padding: 14,
  },

  noteTitle: {
    color: "#E5E7EB",
    fontWeight: "900",
    fontSize: 14,
    marginBottom: 8,
  },

  noteInput: {
    minHeight: 120,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: PREMIUM.border,
    padding: 12,
    color: "#E5E7EB",
    backgroundColor: "#0B1220",
    textAlignVertical: "top",
  },

  noteBtns: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginTop: 12,
  },

  noteBtn: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    marginLeft: 10,
  },

  noteBtnText: {
    color: "#E5E7EB",
    fontWeight: "900",
  },

  footerWrap: {
    marginTop: 22,
    marginBottom: 30,
    paddingHorizontal: 22,
    alignItems: "center",
  },

  footerText: {
    color: BRAND.sub,
    fontSize: 12,
    marginBottom: 8,
    fontFamily: TYPO.fontFamily.medium,
  },

  footerBrand: {
    color: PREMIUM.textSoft,
    fontSize: 13.5,
    fontFamily: TYPO.fontFamily.brand,
    letterSpacing: -0.45,
  },

  disclaimer: {
    color: BRAND.muted,
    fontSize: 10.5,
    lineHeight: 15.5,
    textAlign: "center",
  },
  sessionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    marginTop: 2,
  },

  sessionDot: {
    width: 6,
    height: 6,
    borderRadius: 999,
    marginRight: 4,
  },

  sessionText: {
    color: BRAND.muted,
    fontSize: 9.5,
    fontFamily: TYPO.fontFamily.bold,
  },
  inlineSignalRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 4,
  },

  inlineSignalBadge: {
    borderRadius: 999,
    paddingHorizontal: 7,
    paddingVertical: 2,
    marginRight: 6,
  },

  inlineSignalText: {
    color: "#000",
    fontSize: 8.8,
    fontFamily: TYPO.fontFamily.bold,
  },

  inlineConfidence: {
    fontSize: 10.2,
    fontFamily: TYPO.fontFamily.semibold,
  },
  tickerLogoImage: {
    width: 28,
    height: 28,
    borderRadius: 14,
  },
  modeSwitch: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.035)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.075)",
    borderRadius: 999,
    padding: 4,
    marginHorizontal: 6,
    marginBottom: 6,
  },

  modePillActive: {
    flex: 1,
    height: 34,
    borderRadius: 999,
    backgroundColor: "rgba(212,166,58,0.12)",
    borderWidth: 1,
    borderColor: "rgba(212,166,58,0.30)",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },

  modePillActiveText: {
    color: "#D4A63A",
    fontSize: 12,
    fontFamily: TYPO.fontFamily.bold,
  },

  modePill: {
    flex: 1,
    height: 34,
    borderRadius: 999,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },

  modePillText: {
    color: BRAND.sub,
    fontSize: 12,
    fontFamily: TYPO.fontFamily.semibold,
  },
  assetsHero: {
    paddingTop: 54,
    paddingHorizontal: 16,
    marginBottom: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  assetsTitleRow: {
    flexDirection: "row",
    alignItems: "center",
  },

  assetsSparkle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
    backgroundColor: "rgba(212,166,58,0.10)",
  },

  assetsTitle: {
    color: PREMIUM.textSoft,
    fontSize: 24,
    fontFamily: TYPO.fontFamily.extrabold,
    letterSpacing: -0.8,
  },

  assetsSubtitle: {
    color: BRAND.sub,
    fontSize: 11,
    marginTop: 1,
    fontFamily: TYPO.fontFamily.medium,
  },

  assetsIconBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(255,255,255,0.055)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    alignItems: "center",
    justifyContent: "center",
  },

  intelligenceCard: {
    backgroundColor: PREMIUM.cardSoft,
    borderRadius: 22,
    marginHorizontal: 6,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "rgba(0,227,150,0.22)",
    shadowColor: "#00E396",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 6,
    padding: 10,
  },

  intelligenceTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 6,
  },

  intelligenceTitle: {
    color: PREMIUM.textSoft,
    fontSize: 17,
    fontFamily: TYPO.fontFamily.extrabold,
    letterSpacing: -0.25,
  },

  intelligenceSub: {
    color: BRAND.sub,
    fontSize: 11,
    marginTop: 3,
    fontFamily: TYPO.fontFamily.medium,
  },

  intelligenceScore: {
    alignItems: "flex-end",
  },

  intelligenceScoreText: {
    color: BRAND.accent,
    fontSize: 21,
    fontFamily: TYPO.fontFamily.extrabold,
  },

  intelligenceScoreLabel: {
    color: BRAND.sub,
    fontSize: 11,
    fontFamily: TYPO.fontFamily.bold,
  },

  signalStatsRow: {
    flexDirection: "row",
    alignItems: "center",
  },

  signalStat: {
    flex: 1,
  },

  signalStatLabel: {
    color: BRAND.sub,
    fontSize: 9,
    marginTop: 4,
    fontFamily: TYPO.fontFamily.medium,
  },

  signalStatValue: {
    color: PREMIUM.textSoft,
    fontSize: 13,
    marginTop: 5,
    fontFamily: TYPO.fontFamily.extrabold,
  },

  signalDivider: {
    width: 1,
    height: 42,
    backgroundColor: "rgba(255,255,255,0.07)",
    marginHorizontal: 8,
  },
  signalStatsCompactRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    marginTop: 2,
  },

  signalCompactText: {
    color: BRAND.sub,
    fontSize: 10.5,
    fontFamily: TYPO.fontFamily.semibold,
  },

  signalCompactValue: {
    color: PREMIUM.textSoft,
    fontFamily: TYPO.fontFamily.extrabold,
  },

  signalCompactDot: {
    width: 3.5,
    height: 3.5,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.22)",
    marginHorizontal: 7,
  },
  assetsIconPlaceholder: {
    width: 44,
    height: 44,
  },
});
