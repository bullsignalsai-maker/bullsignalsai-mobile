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

const displayRating = (signal) => {
  if (signal === "BUY") return "Bullish";
  if (signal === "SELL") return "Bearish";
  return "Neutral";
};
const signalColor = (signal) =>
  signal === "BUY" ? BRAND.accent : signal === "SELL" ? BRAND.red : BRAND.amber;

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
    }, 30000); // align with snapshot TTL

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

    Keyboard.dismiss(); // ✅ hide keyboard immediately
    setSuggestions([]);

    try {
      await addToWatchlist(user.uid, s);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      showToast(`${s} added`);
      setNewSymbol("");
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
    // pinned first
    const ap = pinned[a.symbol] ? 1 : 0;
    const bp = pinned[b.symbol] ? 1 : 0;
    if (ap !== bp) return bp - ap;

    if (sortMode === "confidence") {
      return (b.hybridScore || 0) - (a.hybridScore || 0);
    }

    if (sortMode === "alpha") {
      return (a.symbol || "").localeCompare(b.symbol || "");
    }

    if (sortMode === "signal") {
      const order = { BUY: 1, HOLD: 2, SELL: 3 };
      return (order[a.hybridSignal] || 99) - (order[b.hybridSignal] || 99);
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
      name: item.companyName || item.symbol,
      source: "watchlist",
    });
  };

  const timeAgoFrom = (ts) => {
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
        <Text
          style={[
            styles.sectionHeader,
            index === 0 && { marginTop: 6 }, // 👈 reduce top gap for first header
          ]}
        >
          {item.title}
        </Text>
      );
    }

    if (item.__type === "divider") {
      return <View style={styles.sectionDivider} />;
    }
    // session comes from service (LIVE | LAST)
    const session = item.session;

    // flattened quote fields
    const price = item.price;
    const change = item.change;
    const changePct = item.changePct;

    const isLive = session === "LIVE";

    // 🔧 normalize bullbrain fields (watchlist-safe)
    const signal = item.bullbrain?.signal || "HOLD";
    const confidence =
      typeof item.bullbrain?.confidence === "number"
        ? item.bullbrain.confidence
        : null;

    const confidenceBadge = item.bullbrain?.confidenceBadge || null;
    const isMarketClosed = session !== "LIVE";
    const score = item.hybridScore || 0;
    const color = signalColor(signal);
    const patternName = item.pattern?.name;
    const patternWinRate = item.pattern?.winRate;

    return (
      <Swipeable
        ref={(r) => (swipeRefs.current[item.symbol] = r)}
        renderRightActions={() => renderRightActions(item.symbol)}
        overshootRight={false}
      >
        <TouchableOpacity
          activeOpacity={0.85}
          style={styles.card}
          onPress={() => openDetails(item)}
          onLongPress={() => onLongPressItem(item)}
        >
          {/* HEADER */}
          <View style={styles.cardHeader}>
            {/* LEFT — Symbol + Company */}
            <View style={{ flex: 1 }}>
              <Text style={styles.symbol}>{item.symbol}</Text>
              <Text style={styles.name}>{item.companyName || item.symbol}</Text>

              <MoveLabel changePct={item.changePct} style={styles.moveLabel} />
            </View>

            {/* {/* RIGHT — Price + Change */}
            <View style={styles.priceBlock}>
              <Animated.Text
                style={[
                  styles.price,
                  {
                    color:
                      session === "LIVE"
                        ? changePct >= 0
                          ? BRAND.accent
                          : BRAND.red
                        : BRAND.sub,

                    backgroundColor: priceFlash[item.symbol]?.interpolate({
                      inputRange: [0, 1],
                      outputRange: [
                        "transparent",
                        changePct >= 0
                          ? "rgba(0,227,150,0.30)"
                          : "rgba(255,69,96,0.30)",
                      ],
                    }),
                    paddingHorizontal: 8,
                    paddingVertical: 2,
                    borderRadius: 8,
                  },
                ]}
              >
                ${fmt(price)}
              </Animated.Text>

              {(() => {
                const isLive = item.session === "LIVE";

                const change =
                  typeof item.change === "number" ? item.change : null;
                const pct =
                  typeof item.changePct === "number" ? item.changePct : null;

                if (change == null || pct == null) {
                  return (
                    <Text style={[styles.changePct, { color: BRAND.sub }]}>
                      -- {session || ""}
                    </Text>
                  );
                }

                const isUp = pct >= 0;

                return (
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
                    {isUp ? "▲" : "▼"} ${Math.abs(change).toFixed(2)} (
                    {isUp ? "+" : "-"}
                    {Math.abs(pct).toFixed(2)}%) {session}
                  </Text>
                );
              })()}
            </View>
          </View>

          {/* SIGNAL ROW */}
          <View style={styles.signalRow}>
            <View
              style={[
                styles.signalBadge,
                { backgroundColor: signalColor(item.hybridSignal) },
              ]}
            >
              <Text style={styles.signalText}>
                {displayRating(item.hybridSignal || "HOLD")}
              </Text>
            </View>

            <Text
              style={[
                styles.confInline,
                { color: signalColor(item.hybridSignal) },
              ]}
            >
              {Math.round(item.bullbrain?.confidence ?? 0)}% confidence
            </Text>
          </View>

          <View style={styles.cardDivider} />

          {/* SUMMARY */}

          {!!item.watchlistSummary && (
            <Text style={styles.summary} numberOfLines={3}>
              {item.watchlistSummary}
            </Text>
          )}
          {/* SMART PATTERN */}
          {!!patternName && (
            <View style={styles.patternRow}>
              <Text style={styles.patternLabel}>Pattern</Text>
              <Text style={styles.patternValue}>
                {formatPatternLabel(patternName, patternWinRate)}
              </Text>
            </View>
          )}

          {/* UPDATED */}
          <View style={styles.cardFooterRow}>
            <Text style={styles.lastUpdated}>
              {timeAgoFrom(item.quote_updated_at)}
            </Text>
            <Text style={styles.tapHint}>Tap for details</Text>
          </View>
        </TouchableOpacity>
      </Swipeable>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Your Watchlist</Text>
        <Text style={styles.headerSubtitle}>AI-Powered Watchlist Tracking</Text>
      </View>

      <Text style={styles.syncText}>Last synced: {timeAgo()}</Text>

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
              key={`${s.symbol}-${idx}`} // ✅ avoid duplicate key warnings
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

      <View style={styles.sortRow}>
        <TouchableOpacity onPress={toggleSortModal}>
          <Ionicons name="filter-outline" size={20} color={BRAND.sub} />
        </TouchableOpacity>
        <Text style={styles.trackedText}>{items.length} tracked</Text>
      </View>
      <Text style={styles.helperText}>
        Long press a stock for alerts, notes, pin, or remove.
      </Text>
      <FlatList
        data={displayList}
        keyExtractor={(item, index) => `${item.symbol}-${index}`} // ✅ safe, avoids duplicate key issues
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
              provided for informational and educational purposes only and are
              not financial, investment, trading, or tax advice.
            </Text>
          </View>
        }
      />

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

/* ================= STYLES ================= */
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BRAND.bg },

  header: { paddingTop: 56, alignItems: "center", marginBottom: 4 },
  headerTitle: {
    color: BRAND.text,
    fontSize: 26,
    fontFamily: TYPO.fontFamily.extrabold,
    letterSpacing: -0.3,
  },
  headerSubtitle: {
    color: BRAND.sub,
    fontSize: 12.5,
    marginTop: 4,
    fontFamily: TYPO.fontFamily.medium,
  },
  syncText: { textAlign: "center", color: BRAND.sub, fontSize: 11 },
  addRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: BRAND.card2,
    borderRadius: 18,
    paddingHorizontal: 14,
    marginHorizontal: 18,
    marginTop: 10,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    minHeight: 54,
  },

  input: {
    flex: 1,
    color: BRAND.text,
    fontSize: 15,
    paddingVertical: 12,
    marginLeft: 10,
    fontFamily: TYPO.fontFamily.medium,
  },

  addBtn: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 8,
  },

  suggestionsBox: {
    marginHorizontal: 18,
    backgroundColor: BRAND.card,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: BRAND.border,
    marginTop: 6,
    marginBottom: 8,
    overflow: "hidden",
  },

  suggestionRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderTopWidth: 1,
    borderTopColor: "#0B1220",
  },

  suggestionText: {
    color: "#D1D5DB",
    fontSize: 13,
    marginLeft: 8,
  },

  sortRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "center",
    paddingHorizontal: 18,
    marginBottom: 4,
  },

  trackedText: {
    color: BRAND.sub,
    fontSize: 10,
    marginLeft: 4,
  },

  helperText: {
    color: BRAND.muted,
    fontSize: 10.5,
    textAlign: "center",
    marginBottom: 6,
    fontWeight: "700",
  },

  card: {
    backgroundColor: BRAND.card,
    borderRadius: 22,
    padding: 16,
    marginHorizontal: 14,
    marginBottom: 10,

    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",

    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.22,
    shadowRadius: 18,
  },

  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },

  symbol: {
    color: BRAND.text,
    fontSize: 18,
    fontFamily: TYPO.fontFamily.bold,
    letterSpacing: 0.2,
  },
  name: {
    color: BRAND.sub,
    fontSize: 13,
    marginTop: 3,
    fontFamily: TYPO.fontFamily.medium,
  },
  priceBlock: {
    alignItems: "flex-end",
    minWidth: 90,
  },

  price: {
    color: BRAND.text,
    fontSize: 22,
    fontFamily: TYPO.fontFamily.extrabold,
    letterSpacing: -0.2,
  },

  changePct: {
    fontSize: 12,
    fontWeight: "600",
  },

  signalRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 6,
  },

  signalBadge: {
    borderRadius: 999,
    paddingVertical: 4,
    paddingHorizontal: 10,
    marginRight: 8,
  },

  signalText: {
    color: "#000",
    fontSize: 11.5,
    fontWeight: "900",
  },

  confInline: {
    fontSize: 12,
    fontWeight: "800",
  },

  cardDivider: {
    height: 1,
    backgroundColor: BRAND.border,
    marginTop: 6,
    marginBottom: 6,
    opacity: 0.65,
  },

  confLabel: {
    color: BRAND.sub,
    fontSize: 12,
    marginRight: 4,
  },

  confValue: {
    fontSize: 12,
    fontWeight: "700",
  },

  summary: {
    color: "#D1D5DB",
    fontSize: 13.5,
    lineHeight: 21,
    fontFamily: TYPO.fontFamily.regular,
  },
  patternRow: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    marginTop: 6,
    paddingVertical: 4,
    paddingHorizontal: 9,
    borderRadius: 999,
    backgroundColor: BRAND.card2,
    borderWidth: 1,
    borderColor: BRAND.border,
  },
  patternLabel: {
    color: BRAND.muted,
    fontSize: 10,
    fontWeight: "900",
    marginRight: 6,
    textTransform: "uppercase",
  },
  cardFooterRow: {
    marginTop: 5,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },

  patternValue: {
    color: BRAND.sub,
    fontSize: 10.5,
    fontWeight: "800",
  },
  patternBadge: {
    alignSelf: "flex-start",
    marginTop: 6,
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 999,
  },

  patternText: {
    color: "#000",
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.3,
  },
  lastUpdated: {
    color: BRAND.muted,
    fontSize: 10.5,
    fontWeight: "700",
    opacity: 0.85,
  },
  tapHint: {
    color: BRAND.muted,
    fontSize: 10.5,
    fontWeight: "700",
  },
  sectionHeader: {
    marginHorizontal: 18,
    marginTop: 10,
    marginBottom: 6,
    color: "#9CA3AF",
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 1,
    textTransform: "uppercase",
  },

  sectionDivider: {
    height: 1,
    backgroundColor: "#0B1220",
    marginHorizontal: 18,
    marginVertical: 10,
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
    width: 96,
    marginRight: 18,
    marginBottom: 10,
    borderRadius: 14,
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
    paddingTop: 160,
    paddingRight: 20,
    backgroundColor: "rgba(0,0,0,0.4)",
  },

  sortBox: {
    backgroundColor: BRAND.card,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: BRAND.border,
    width: 230,
    paddingVertical: 6,
  },

  sortOption: {
    color: "#E5E7EB",
    fontSize: 13,
    paddingVertical: 8,
    paddingHorizontal: 12,
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
    borderRadius: 14,
    borderWidth: 1,
    borderColor: BRAND.border,
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
    borderRadius: 12,
    borderWidth: 1,
    borderColor: BRAND.border,
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
    marginTop: 24,
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
    color: BRAND.accent,
    fontWeight: "600",
  },

  disclaimer: {
    color: BRAND.muted,
    fontSize: 11,
    lineHeight: 16,
    textAlign: "center",
  },
  moveLabel: {
    fontSize: 12,
    fontWeight: "900",
    marginTop: 3,
  },
});
