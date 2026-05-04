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

import {
  fetchWatchlist,
  addToWatchlist,
  removeFromWatchlist,
} from "../services/watchlistService";

/* ================= BRAND ================= */
const BRAND = {
  bg: "#000",
  card: "#111827",
  border: "#1F2937",
  text: "#FFF",
  sub: "#9CA3AF",
  accent: "#00E396",
  red: "#FF4560",
  amber: "#FEB019",
};

const fmt = (v) =>
  typeof v === "number" && !Number.isNaN(v) ? v.toFixed(2) : "--";

const fmtPct = (v) =>
  typeof v === "number" && !Number.isNaN(v) ? `${v >= 0 ? "+" : ""}${v.toFixed(2)}%` : "--";

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



const signalColor = (signal) =>
  signal === "BUY" ? BRAND.accent : signal === "SELL" ? BRAND.red : BRAND.amber;


const getSessionTextStyle = (session, isUp) => {
  if (session === "LIVE") {
    return { color: isUp ? BRAND.accent : BRAND.red };
  }
  // AH / PRE → muted
  return { color: BRAND.sub, opacity: 0.75 };
};

const getMarketSession = (ts) => {
  if (!ts) return null;

  const d = new Date(ts);
  const h = d.getHours(); // local time is fine for UX

  if (h < 9 || (h === 9 && d.getMinutes() < 30)) return "PRE";
  if (h >= 16) return "AH";
  return "LIVE";
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
  const [noteModal, setNoteModal] = useState({ visible: false, symbol: "", text: "" });

  const fadeAnim = useState(new Animated.Value(0))[0];
  const swipeRefs = useRef({});

  // Enable LayoutAnimation on Android
  useEffect(() => {
    if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
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
    if (!silent) setRefreshing(true); // 👈 only show spinner for manual refresh

    const res = await fetchWatchlist(user.uid);
    setItems(res.watchlist || []);
    setLastSync(new Date());

    // 🔥 trigger price flash
    (res.watchlist || []).forEach((it) => {
      const anim = priceFlash[it.symbol];
      if (!anim) return;

      anim.setValue(1);
      Animated.timing(anim, {
        toValue: 0,
        duration: 900,
        useNativeDriver: false,
      }).start();
    });

  } catch {
    if (!silent) showToast("Failed to load watchlist");
  } finally {
    if (!silent) setRefreshing(false);
  }
};


  useFocusEffect(
    useCallback(() => {
      loadWatchlist();
      loadPins();
    }, [user])
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
      const res = await fetch(`${API_BASE_URL}/search?q=${encodeURIComponent(up)}`);
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

const pinnedItems = sortedItems.filter(i => pinned[i.symbol]);
const normalItems = sortedItems.filter(i => !pinned[i.symbol]);
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
      "Add Alert (coming soon)",
      "Notes",
      "Remove",
      "Cancel",
    ];

    const handler = (idx) => {
      const choice = actions[idx];
      if (choice === "Pin" || choice === "Unpin") togglePin(sym);
      else if (choice === "Add Alert (coming soon)") showToast("Alerts coming soon");
      else if (choice === "Notes") openNotes(sym);
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
        handler
      );
    } else {
      Alert.alert(sym, "Actions", [
        { text: pinnedNow ? "Unpin" : "Pin", onPress: () => togglePin(sym) },
        { text: "Notes", onPress: () => openNotes(sym) },
        { text: "Remove", style: "destructive", onPress: () => optimisticRemove(sym) },
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
    const session = getMarketSession(item.quote_updated_at);
    // 🔧 normalize quote fields (backend-safe)
    const price = item.quote?.price;
    const change = item.quote?.change;
    const changePct = item.quote?.changePct;
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

      if (!priceFlash[item.symbol]) {
      priceFlash[item.symbol] = new Animated.Value(0);
    }

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
                <Text style={styles.name}>
                  {item.companyName || item.symbol}
                </Text>
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
                        paddingHorizontal: 6,
                        borderRadius: 6,
                      },
                    ]}
                  >
                    ${fmt(price)}
                  </Animated.Text>

{(() => {
  const session = getMarketSession(item.quote_updated_at);
  const isLive = session === "LIVE";

  const change =
    typeof item.quote?.change === "number" ? item.quote.change : null;
  const pct =
    typeof item.quote?.changePct === "number" ? item.quote.changePct : null;

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
      {item.hybridSignal || "HOLD"}
    </Text>
  </View>

  <Text style={styles.confLabel}>Confidence</Text>
  <Text
    style={[
      styles.confValue,
      { color: signalColor(item.hybridSignal) },
    ]}
  >
    {Math.round(item.bullbrain?.confidence ?? 0)}%
  </Text>
</View>


  {/* SUMMARY */}
  {!!item.watchlistSummary && (
    <Text style={styles.summary} numberOfLines={3}>
      {item.watchlistSummary}
    </Text>
  )}
{/* SMART PATTERN */}
<View
  style={[
    styles.patternBadge,
    { backgroundColor: getPatternColor(patternWinRate) },
  ]}
>
  <Text style={styles.patternText}>
    {formatPatternLabel(patternName, patternWinRate)}
  </Text>
</View>

  {/* UPDATED */}
  <Text style={styles.lastUpdated}>
    {timeAgoFrom(item.quote_updated_at)}
  </Text>
</TouchableOpacity>


      </Swipeable>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Your Watchlist</Text>
        <Text style={styles.headerSubtitle}>AI-Powered Market Tracking</Text>
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
              <Ionicons name="trending-up-outline" size={16} color={BRAND.sub} />
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
            <Text style={styles.emptyText}>Search for a stock and tap + to track it.</Text>
          </View>
        }
      />

      <Modal transparent visible={sortVisible} animationType="none">
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={toggleSortModal}>
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
              <Text style={styles.sortOption}>Confidence (High to Low)</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => selectSort("alpha")}>
              <Text style={styles.sortOption}>Alphabetical (A to Z)</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => selectSort("signal")}>
              <Text style={styles.sortOption}>Signal (BUY to SELL)</Text>
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
                onPress={() => setNoteModal({ visible: false, symbol: "", text: "" })}
                style={[styles.noteBtn, { backgroundColor: BRAND.border }]}
              >
                <Text style={styles.noteBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={saveNotes} style={[styles.noteBtn, { backgroundColor: BRAND.accent }]}>
                <Text style={[styles.noteBtnText, { color: "#000" }]}>Save</Text>
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
  headerTitle: { color: BRAND.accent, fontSize: 21, fontWeight: "800" },
  headerSubtitle: { color: BRAND.sub, fontSize: 11, marginTop: 2 },
  syncText: { textAlign: "center", color: BRAND.sub, fontSize: 11 },

  addRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: BRAND.card,
    borderRadius: 10,
    paddingHorizontal: 10,
    marginHorizontal: 18,
    marginTop: 6,
    borderWidth: 1,
    borderColor: BRAND.border,
  },
  input: { flex: 1, color: BRAND.text, fontSize: 13, paddingVertical: 10 },
  addBtn: {
    backgroundColor: BRAND.accent,
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 9,
    marginLeft: 6,
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
  suggestionText: { color: "#D1D5DB", fontSize: 13, marginLeft: 8 },

  sortRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "center",
    paddingHorizontal: 18,
    marginBottom: 4,
  },
  trackedText: { color: BRAND.sub, fontSize: 10, marginLeft: 4 },

  card: {
    backgroundColor: BRAND.card,
    borderRadius: 14,
    marginHorizontal: 18,
    marginBottom: 8,
    padding: 8, 
    borderWidth: 1,
    borderColor: BRAND.border,
  },
  cardHead: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },

  symbol: { fontSize: 14, fontWeight: "800", color: "#E5E7EB" },
  company: { marginTop: 1, fontSize: 12, color: BRAND.sub },

  badge: {
    marginLeft: 10,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  badgeText: { fontSize: 11, fontWeight: "800", letterSpacing: 0.6 },

  priceRow: { marginTop: 6, flexDirection: "row", alignItems: "center" },
  priceVal: { fontSize: 16, fontWeight: "800" },
  priceDelta: { flexDirection: "row", alignItems: "center", marginLeft: 10 },
  pct: { fontSize: 12, fontWeight: "700" },
  dot: { color: BRAND.sub, marginHorizontal: 8, fontSize: 12 },
  time: { color: BRAND.sub, fontSize: 12 },

  signalLine: { marginTop: 4, fontSize: 12, fontWeight: "800" },

  grokLine: {
    marginTop: 4,
    fontSize: 11,
    color: BRAND.sub,
    fontStyle: "italic",
  },

  confBarBg: {
    backgroundColor: "#0B1220",
    height: 3,
    borderRadius: 4,
    marginTop: 8,
    overflow: "hidden",
  },
  confBarFill: { height: "100%", borderRadius: 4 },

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

  emptyState: { alignItems: "center", marginTop: 80 },
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

  // Swipe delete
  swipeDelete: {
    width: 96,
    marginRight: 18,
    marginBottom: 10,
    borderRadius: 14,
    backgroundColor: BRAND.red,
    alignItems: "center",
    justifyContent: "center",
  },
  swipeDeleteText: { color: "#fff", marginTop: 4, fontSize: 11, fontWeight: "800" },

  // Notes modal
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
  noteTitle: { color: "#E5E7EB", fontWeight: "900", fontSize: 14, marginBottom: 8 },
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
  noteBtns: { flexDirection: "row", justifyContent: "flex-end", marginTop: 12 },
  noteBtn: { paddingVertical: 10, paddingHorizontal: 14, borderRadius: 12, marginLeft: 10 },
  noteBtnText: { color: "#E5E7EB", fontWeight: "900" },
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
sessionBadge: {
  marginLeft: 6,
  paddingHorizontal: 6,
  paddingVertical: 2,
  borderRadius: 6,
  backgroundColor: "#0B1220",
  borderWidth: 1,
  borderColor: BRAND.border,
},
sessionText: {
  fontSize: 10,
  fontWeight: "800",
  color: BRAND.sub,
},
rowTop: {
  flexDirection: "row",
  justifyContent: "space-between",
  alignItems: "center",
},

priceBlock: {
  alignItems: "flex-end",
},

liveDotRow: {
  flexDirection: "row",
  alignItems: "center",
  marginTop: 2,
},

liveDot: {
  width: 6,
  height: 6,
  borderRadius: 3,
  backgroundColor: "#00E396",
  marginRight: 4,
},

liveText: {
  fontSize: 10,
  color: "#9CA3AF",
  fontWeight: "700",
},

signalRow: {
  flexDirection: "row",
  alignItems: "center",
  marginTop: 4,
},

confText: {
  marginLeft: 8,
  fontSize: 12,
  color: "#9CA3AF",
  fontWeight: "600",
},
card: {
  backgroundColor: BRAND.card,
  borderRadius: 16,
  padding: 12,            // 👈 smaller than Home (14 → 12)
  marginHorizontal: 18,
  marginBottom: 8,
  borderWidth: 1,
  borderColor: BRAND.border,
},

cardHeader: {
  flexDirection: "row",
  justifyContent: "space-between",
  alignItems: "center",
},

symbol: {
  color: BRAND.text,
  fontSize: 16,
  fontWeight: "700",
},

name: {
  color: BRAND.sub,
  fontSize: 12,
  marginTop: 2,
},

price: {
  color: BRAND.text,
  fontSize: 15,
  fontWeight: "600",
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
  borderRadius: 8,
  paddingVertical: 4,
  paddingHorizontal: 10,
  marginRight: 10,
},

signalText: {
  color: "#000",
  fontSize: 12,
  fontWeight: "700",
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
  color: BRAND.sub,
  fontSize: 13,
  marginTop: 6,
},

lastUpdated: {
  color: BRAND.sub,
  fontSize: 11,
  marginTop: 2,
  fontStyle: "italic",
  opacity: 0.7,
},

priceBlock: {
  alignItems: "flex-end",
  minWidth: 90, // keeps price aligned nicely
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

});
