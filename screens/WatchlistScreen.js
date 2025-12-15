// screens/WatchlistScreen.js
import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  RefreshControl,
  Modal,
  Animated,
  Easing,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect } from "@react-navigation/native";
import * as Haptics from "expo-haptics";

import { auth, db } from "../firebaseConfig";
import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  orderBy,
  setDoc,
} from "firebase/firestore";

import { API_BASE_URL } from "../config/apiKeys";
import { SP500_LIST } from "../services/sp500";
import generateBullInsights from "../services/generateBullInsights";
import ToastMessage from "../components/ToastMessage";

const STORAGE_KEY = "@bullsignals_watchlist";
const ITEMS_STORAGE_KEY = "@bullsignals_items";

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

const isSP500Symbol = (s) => s && SP500_LIST.has(s.trim().toUpperCase());

const fmt = (v) =>
  typeof v === "number" && !Number.isNaN(v) ? v.toFixed(2) : "--";

const fmtDateTime = (ts) => {
  if (!ts) return "";
  try {
    const d = ts instanceof Date ? ts : new Date(ts);
    if (Number.isNaN(d.getTime())) return "";
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

const metaCache = {};
async function fetchCompanyMeta(symbol) {
  if (!symbol) return symbol;
  const sym = symbol.toUpperCase();
  if (metaCache[sym]) return metaCache[sym];

  try {
    const res = await fetch(`${API_BASE_URL}/search?q=${encodeURIComponent(sym)}`);
    const json = await res.json();
    const list = json?.data || [];
    if (!list.length) {
      metaCache[sym] = sym;
      return sym;
    }
    const exact = list.find((d) => d.symbol === sym);
    const item = exact || list[0];
    const name = item?.description || sym;
    metaCache[sym] = name;
    return name;
  } catch {
    metaCache[sym] = sym;
    return sym;
  }
}

export default function WatchlistScreen({ navigation }) {
  const [watchSymbols, setWatchSymbols] = useState([]);
  const [items, setItems] = useState([]);
  const [newSymbol, setNewSymbol] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [sortMode, setSortMode] = useState("confidence");
  const [sortVisible, setSortVisible] = useState(false);
  const fadeAnim = useState(new Animated.Value(0))[0];
  const [toast, setToast] = useState({ visible: false, message: "" });
  const [lastSync, setLastSync] = useState(new Date());
  const [ohlcCache, setOhlcCache] = useState({}); // ← REAL OHLC CACHE

  const user = auth.currentUser;

  // REAL OHLC FALLBACK: Yahoo Finance when backend sends same values
  useEffect(() => {
    items.forEach(item => {
      const f = item.features;
      const hasSameOHLC = f?.open !== undefined &&
        f.open === f.high && f.high === f.low && f.low === f.close;

      if (hasSameOHLC && !ohlcCache[item.symbol]) {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 8000);

        fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${item.symbol}?range=1d&interval=1d`, {
          signal: controller.signal,
        })
          .then(r => r.json())
          .then(json => {
            clearTimeout(timeout);
            const result = json?.chart?.result?.[0];
            if (result) {
              const q = result.indicators.quote[0];
              const meta = result.meta;
              setOhlcCache(prev => ({
                ...prev,
                [item.symbol]: {
                  open:  q?.open?.[0]  ?? meta?.previousClose,
                  high:  q?.high?.[0],
                  low:   q?.low?.[0],
                  close: q?.close?.[0] ?? meta?.regularMarketPrice,
                }
              }));
            }
          })
          .catch(() => clearTimeout(timeout));
      }
    });
  }, [items, ohlcCache]);

  // Load watchlist from Firestore
  useFocusEffect(
    useCallback(() => {
      if (!user) return;

      const q = query(
        collection(db, "users", user.uid, "watchlist"),
        orderBy("addedAt", "desc")
      );

      const unsub = onSnapshot(q, async (snap) => {
        const symbols = snap.docs.map((d) => d.id);
        setWatchSymbols(symbols);
        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(symbols));

        if (symbols.length > 0) {
          onRefresh(symbols);
        } else {
          setItems([]);
        }
      });

      return () => unsub();
    }, [user])
  );

  // Restore from local storage
  useEffect(() => {
    (async () => {
      try {
        const savedSymbols = await AsyncStorage.getItem(STORAGE_KEY);
        const savedItems = await AsyncStorage.getItem(ITEMS_STORAGE_KEY);
        if (savedSymbols) setWatchSymbols(JSON.parse(savedSymbols));
        if (savedItems) setItems(JSON.parse(savedItems));
      } catch (err) {
        console.warn("Restore error:", err);
      }
    })();
  }, []);

  // Autocomplete
  const handleInputChange = async (text) => {
    const up = text.toUpperCase();
    setNewSymbol(up);
    if (!up.trim()) {
      setSuggestions([]);
      return;
    }
    try {
      const res = await fetch(`${API_BASE_URL}/search?q=${encodeURIComponent(up)}`);
      const json = await res.json();
      const list = (json?.data || [])
        .filter(i => i.symbol && i.description)
        .slice(0, 5)
        .map(i => ({ symbol: i.symbol, desc: i.description }));
      setSuggestions(list);
    } catch {
      setSuggestions([]);
    }
  };

  // Add ticker
  const handleAddTicker = async (sym) => {
    const s = (sym || newSymbol || "").split(" ")[0].toUpperCase().trim();
    if (!s) return;
    if (watchSymbols.includes(s)) {
      showToast("Already in watchlist");
      return;
    }
    if (!user) {
      showToast("Login required");
      return;
    }
    try {
      await setDoc(doc(db, "users", user.uid, "watchlist", s), { addedAt: new Date().toISOString() });
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      showToast(`${s} added`);
      setNewSymbol("");
      setSuggestions([]);
    } catch (err) {
      showToast("Error adding ticker");
    }
  };

  // Remove ticker
  const handleRemove = async (sym) => {
    try {
      if (user) await deleteDoc(doc(db, "users", user.uid, "watchlist", sym));
      showToast(`${sym} removed`);
      const updated = watchSymbols.filter(s => s !== sym);
      setWatchSymbols(updated);
      setItems(items.filter(i => i.symbol !== sym));
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      await AsyncStorage.setItem(ITEMS_STORAGE_KEY, JSON.stringify(items.filter(i => i.symbol !== sym)));
    } catch {
      showToast("Error removing");
    }
  };

  // Refresh data
  const onRefresh = async (symbolsParam) => {
    const symbols = symbolsParam || watchSymbols;
    if (!symbols.length) return;
    setRefreshing(true);
    try {
      const res = await fetch(`${API_BASE_URL}/watchlist-batch?symbols=${encodeURIComponent(symbols.join(","))}`);
      const json = await res.json();
      const rawItems = json?.data || [];

      const enhanced = await Promise.all(
        rawItems.map(async (item) => {
          const sym = item.symbol?.toUpperCase() || "";
          const isSP = isSP500Symbol(sym);
          let bullInsights = null;
          if (isSP && item.features && item.bullbrain) {
            bullInsights = generateBullInsights({ features: item.features, model: item.bullbrain });
          }
          let companyName = item.companyName || item.name || item.description || item.fullName || item.company;
          if (!companyName) companyName = await fetchCompanyMeta(sym);

          return { ...item, symbol: sym, isSP500: isSP, bullInsights, companyName };
        })
      );

      setItems(enhanced);
      setLastSync(new Date());
      await AsyncStorage.setItem(ITEMS_STORAGE_KEY, JSON.stringify(enhanced));
    } catch (err) {
      showToast("Refresh failed");
    }
    setRefreshing(false);
  };

  const sorted = [...items].sort((a, b) => {
    if (sortMode === "confidence") return (b.hybridScore || 0) - (a.hybridScore || 0);
    if (sortMode === "alpha") return a.symbol.localeCompare(b.symbol);
    if (sortMode === "signal") {
      const order = { BUY: 1, HOLD: 2, SELL: 3 };
      return (order[a.hybridSignal] || 99) - (order[b.hybridSignal] || 99);
    }
    return 0;
  });

  const showToast = (msg) => setToast({ visible: true, message: msg });
  const openDetails = (item) => navigation.navigate("StockDetailScreen", { ...item });
  const timeAgo = () => {
    const mins = Math.floor((Date.now() - lastSync.getTime()) / 60000);
    return mins <= 0 ? "Just now" : `${mins} min ago`;
  };

  const toggleSortModal = () => {
    const next = !sortVisible;
    setSortVisible(next);
    Animated.timing(fadeAnim, { toValue: next ? 1 : 0, duration: 180, easing: Easing.out(Easing.quad), useNativeDriver: true }).start();
  };

  const selectSort = (mode) => {
    setSortMode(mode);
    toggleSortModal();
    showToast(mode === "confidence" ? "Sorted by Confidence" : mode === "alpha" ? "Sorted Alphabetically" : "Sorted by Signal");
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
        />
        <TouchableOpacity style={styles.addBtn} onPress={() => handleAddTicker()}>
          <Ionicons name="add" size={20} color="#000" />
        </TouchableOpacity>
      </View>

      {suggestions.length > 0 && (
        <View style={styles.suggestionsBox}>
          {suggestions.map((s) => (
            <TouchableOpacity key={s.symbol} onPress={() => handleAddTicker(s.symbol)} style={styles.suggestionRow}>
              <Ionicons name="trending-up-outline" size={16} color={BRAND.sub} />
              <Text style={styles.suggestionText}>{s.symbol} – {s.desc}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      <View style={styles.sortRow}>
        <TouchableOpacity onPress={toggleSortModal}>
          <Ionicons name="filter-outline" size={20} color={BRAND.sub} />
        </TouchableOpacity>
        <Text style={styles.trackedText}>{watchSymbols.length} tracked</Text>
      </View>

      <ScrollView
        refreshControl={<RefreshControl tintColor={BRAND.accent} refreshing={refreshing} onRefresh={() => onRefresh()} />}
        contentContainerStyle={{ paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}
      >
        {sorted.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="bookmark-outline" size={56} color="#333" />
            <Text style={styles.emptyTitle}>Your watchlist is empty</Text>
            <Text style={styles.emptyText}>Search for a stock and tap + to track it.</Text>
          </View>
        ) : (
          sorted.map((item) => {
            const signal = item.hybridSignal || "HOLD";
            const score = item.hybridScore || 0;
            const color = signal === "BUY" ? BRAND.accent : signal === "SELL" ? BRAND.red : BRAND.amber;
            const currentPrice = typeof item.price === "number" && !Number.isNaN(item.price) ? item.price : 0;

            const cached = ohlcCache[item.symbol];
            const open  = cached?.open  ?? item.features?.open  ?? currentPrice;
            const high  = cached?.high  ?? item.features?.high  ?? currentPrice;
            const low   = cached?.low   ?? item.features?.low   ?? currentPrice;
            const close = cached?.close ?? item.features?.close ?? currentPrice;

            const dollarChange = open && currentPrice ? (currentPrice - open).toFixed(2) : "0.00";
            let pctChange = item.changePct;
            if ((pctChange === undefined || pctChange === null) && open && open !== 0) {
              pctChange = ((currentPrice - open) / open) * 100;
            }
            pctChange = typeof pctChange === "number" ? pctChange : 0;

            const asOfLabel = fmtDateTime(item.timestamp || item.asOf || new Date());
            const companyName = item.companyName || item.name || item.description || item.fullName || item.company || item.symbol;

            return (
              <TouchableOpacity key={item.symbol} onPress={() => openDetails(item)} activeOpacity={0.9} style={styles.card}>
                <View style={styles.cardHead}>
                  <Text style={styles.nameRow}>{item.symbol} – {companyName}</Text>
                  <TouchableOpacity onPress={() => handleRemove(item.symbol)}>
                    <Ionicons name="close-outline" size={18} color={BRAND.sub} />
                  </TouchableOpacity>
                </View>

                <Text style={[styles.price, { color }]}>
                  ${fmt(currentPrice)} ({pctChange >= 0 ? "+" : ""}{fmt(pctChange)}%) • {asOfLabel}
                </Text>

                <Text style={styles.ohlcLine}>
                  O: {fmt(open)}   H: {fmt(high)}   L: {fmt(low)}   C: {fmt(close)} (+{dollarChange})
                </Text>

                <Text style={[styles.signalText, { color }]}>
                  {signal} • {Math.round(score)}% CONFIDENCE
                </Text>

                {item.grokSummary && <Text style={styles.grokLine}>{item.grokSummary}</Text>}
                {item.isSP500 && item.bullInsights?.oneLiner && <Text style={styles.bullLine}>{item.bullInsights.oneLiner}</Text>}

                <View style={styles.confBarBg}>
                  <View style={[styles.confBarFill, { width: `${Math.max(0, Math.min(100, Math.round(score)))}%`, backgroundColor: color }]} />
                </View>
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>

      <Modal transparent visible={sortVisible} animationType="none">
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={toggleSortModal}>
          <Animated.View style={[styles.sortBox, { opacity: fadeAnim, transform: [{ scale: fadeAnim.interpolate({ inputRange: [0, 1], outputRange: [0.97, 1] }) }] }]}>
            <TouchableOpacity onPress={() => selectSort("confidence")}><Text style={styles.sortOption}>Confidence (High to Low)</Text></TouchableOpacity>
            <TouchableOpacity onPress={() => selectSort("alpha")}><Text style={styles.sortOption}>Alphabetical (A to Z)</Text></TouchableOpacity>
            <TouchableOpacity onPress={() => selectSort("signal")}><Text style={styles.sortOption}>Signal (BUY to SELL)</Text></TouchableOpacity>
          </Animated.View>
        </TouchableOpacity>
      </Modal>

      <ToastMessage visible={toast.visible} message={toast.message} onHide={() => setToast({ visible: false, message: "" })} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BRAND.bg },
  header: { paddingTop: 56, alignItems: "center", marginBottom: 4 },
  headerTitle: { color: BRAND.accent, fontSize: 21, fontWeight: "800" },
  headerSubtitle: { color: BRAND.sub, fontSize: 11, marginTop: 2 },
  syncText: { textAlign: "center", color: BRAND.sub, fontSize: 11 },
  addRow: { flexDirection: "row", alignItems: "center", backgroundColor: BRAND.card, borderRadius: 8, paddingHorizontal: 10, marginHorizontal: 18, marginTop: 6, borderWidth: 1, borderColor: BRAND.border },
  input: { flex: 1, color: BRAND.text, fontSize: 13, paddingVertical: 8 },
  addBtn: { backgroundColor: BRAND.accent, borderRadius: 6, paddingVertical: 5, paddingHorizontal: 8, marginLeft: 6 },
  suggestionsBox: { marginHorizontal: 20, backgroundColor: BRAND.card, borderRadius: 8, borderWidth: 1, borderColor: BRAND.border, marginTop: 4, marginBottom: 8 },
  suggestionRow: { flexDirection: "row", alignItems: "center", paddingVertical: 6, paddingHorizontal: 10 },
  suggestionText: { color: BRAND.sub, fontSize: 13, marginLeft: 6 },
  sortRow: { flexDirection: "row", justifyContent: "flex-end", alignItems: "center", paddingHorizontal: 18, marginBottom: 4 },
  trackedText: { color: BRAND.sub, fontSize: 10, marginLeft: 4 },
  card: { backgroundColor: BRAND.card, borderRadius: 12, marginHorizontal: 18, marginBottom: 10, padding: 10, borderWidth: 1, borderColor: BRAND.border },
  cardHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  nameRow: { marginTop: 2, fontSize: 12, color: BRAND.sub },
  price: { marginTop: 2, fontSize: 14, fontWeight: "600" },
  ohlcLine: { marginTop: 2, fontSize: 11, color: BRAND.sub },
  signalText: { marginTop: 4, fontSize: 12, fontWeight: "700" },
  grokLine: { marginTop: 4, fontSize: 11, color: BRAND.sub, fontStyle: "italic" },
  bullLine: { marginTop: 2, fontSize: 11, color: BRAND.sub },
  confBarBg: { backgroundColor: BRAND.border, height: 3, borderRadius: 2, marginTop: 6 },
  confBarFill: { height: "100%", borderRadius: 2 },
  modalOverlay: { flex: 1, justifyContent: "flex-start", alignItems: "flex-end", paddingTop: 160, paddingRight: 20, backgroundColor: "rgba(0,0,0,0.4)" },
  sortBox: { backgroundColor: BRAND.card, borderRadius: 8, borderWidth: 1, borderColor: BRAND.border, width: 220, paddingVertical: 6 },
  sortOption: { color: "#E5E7EB", fontSize: 13, paddingVertical: 6, paddingHorizontal: 12 },
  emptyState: { alignItems: "center", marginTop: 80 },
  emptyTitle: { color: BRAND.text, fontSize: 16, fontWeight: "700", marginTop: 10 },
  emptyText: { color: BRAND.sub, fontSize: 12, marginTop: 4, textAlign: "center", paddingHorizontal: 40 },
});