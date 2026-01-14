// screens/HomeScreen.js
import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Animated,
  RefreshControl,
  Modal,
  TextInput,
  Image,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { Alert } from "react-native";
import { AppState } from "react-native";
import Svg, { Polyline } from "react-native-svg";

import { getHomeScreen } from "../services/HomeService";

const LOGO = require("../assets/logo.png");

const BRAND = {
  bg: "#000000",
  card: "#111827",
  border: "#1F2937",
  text: "#FFFFFF",
  sub: "#9CA3AF",
  accent: "#00E396",
  red: "#FF4560",
  amber: "#FEB019",
};

// % formatter (market style)
const fmtPct = (v) =>
  typeof v === "number" && !Number.isNaN(v)
    ? `${v >= 0 ? "+" : ""}${v.toFixed(2)}%`
    : "--";

// Session label from timestamp (same logic as Watchlist)
function getMarketSession(ts) {
  if (!ts) return null;
  const d = new Date(ts);
  const h = d.getHours();

  if (h < 9 || (h === 9 && d.getMinutes() < 30)) return "PRE";
  if (h >= 16) return "AH";
  return "LIVE";
}


// --- Helper: human-readable timestamps
function timeAgo(isoString) {
  if (!isoString) return "Recently";
  const diffMs = Date.now() - new Date(isoString).getTime();
  const mins = Math.floor(diffMs / 60000);
  const hrs = Math.floor(mins / 60);
  const days = Math.floor(hrs / 24);
  if (mins < 1) return "Just now";
  if (mins < 60) return `Updated ${mins}m ago`;
  if (hrs < 24) return `Updated ${hrs}h ago`;
  return `Updated ${days}d ago`;
}


function MiniSparkline({ data = [], width = 64, height = 20, color }) {
  if (!Array.isArray(data) || data.length < 6) return null;

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;

  const stepX = width / (data.length - 1);
  const points = data
    .map((v, i) => {
      const x = i * stepX;
      const y = height - ((v - min) / range) * height;
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <Svg width={width} height={height}>
      <Polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
      />
    </Svg>
  );
}

export default function HomeScreen({ navigation }) {
  const [home, setHome] = useState(null);
  // 🔥 price flash animation per symbol
const priceFlash = useRef({}).current;

  const [refreshing, setRefreshing] = useState(false);

  const dockTranslate = useRef(new Animated.Value(0)).current;
  const lastY = useRef(0);

  const [showAddModal, setShowAddModal] = useState(false);
  const [newTicker, setNewTicker] = useState("");

  /* ---------------------------------------------------------
     Load + Auto Refresh (5s)
  --------------------------------------------------------- */
  useEffect(() => {
    let mounted = true;

    const load = async () => {
      const data = await getHomeScreen();
      if (!mounted || !data) return;

      setHome(data);

      // 🔥 trigger price flash
      (data.signals || []).forEach((it) => {
        const anim = priceFlash[it.symbol];
        if (!anim) return;

        anim.setValue(1);
        Animated.timing(anim, {
          toValue: 0,
          duration: 900,
          useNativeDriver: false, // backgroundColor animation
        }).start();
      });
    };


    load();
    const interval = setInterval(load, 5000);

    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  /* ---------------------------------------------------------
     Pull To Refresh
  --------------------------------------------------------- */
  const onRefresh = async () => {
  setRefreshing(true);
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

  const data = await getHomeScreen();
  if (data) {
    setHome(data);

    // 🔥 trigger price flash
    (data.signals || []).forEach((it) => {
      const anim = priceFlash[it.symbol];
      if (!anim) return;

      anim.setValue(1);
      Animated.timing(anim, {
        toValue: 0,
        duration: 900,
        useNativeDriver: false,
      }).start();
    });
  }

  setRefreshing(false);
};


  /* ---------------------------------------------------------
     Scroll animation (unchanged)
  --------------------------------------------------------- */
  const handleScroll = (e) => {
    const y = e.nativeEvent.contentOffset.y;
    const goingDown = y > lastY.current + 6;
    const goingUp = y < lastY.current - 6;

    Animated.timing(dockTranslate, {
      toValue: goingDown ? 1 : 0,
      duration: 180,
      useNativeDriver: true,
    }).start();

    lastY.current = y;
  };

  const dockY = dockTranslate.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 60],
  });

  const dockOpacity = dockTranslate.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 0],
  });

  if (!home) {
    return (
      <View style={styles.container}>
        <Text style={{ color: BRAND.sub, textAlign: "center", marginTop: 100 }}>
          Loading…
        </Text>
      </View>
    );
  }

  const { header, carousel, signals } = home;

  return (
    <View style={styles.container}>
      {/* HEADER */}
      <View style={styles.header}>
        <View style={styles.headerBrandRow}>
          <Image source={LOGO} style={styles.logo} resizeMode="contain" />
          <Text style={styles.title}>BullSignals</Text>
        </View>
        <Text style={styles.subtitle}>AI-Powered Market Signals</Text>
         <View style={styles.syncRow}>
        <Text style={styles.marketStatusText}>
          {header.marketStatus}
        </Text>
      </View>
      <Text style={styles.moodText}>
        Market: {header.marketMood}
      </Text>


      </View>

      {/* FEATURE CARDS */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.carousel}
        contentContainerStyle={styles.carouselContent}
      >
        {carousel.map((c, i) => (
          <View key={i} style={styles.featureCard}>
            <View style={styles.featureHeader}>
              <Ionicons
                name={c.icon}
                size={18}
                color={BRAND.accent}
                style={{ marginRight: 6 }}
              />
              <Text style={styles.featureTitle} numberOfLines={1}>
                {c.title}
              </Text>
            </View>
            <Text style={styles.featureValue} numberOfLines={3}>
              {c.value}
            </Text>
          </View>
        ))}
      </ScrollView>

      {/* MAIN LIST */}
      <ScrollView
        onScroll={handleScroll}
        scrollEventThrottle={16}
        keyboardShouldPersistTaps="handled"   // ✅ REQUIRED
        refreshControl={
          <RefreshControl
            tintColor={BRAND.accent}
            colors={[BRAND.accent]}
            refreshing={refreshing}
            onRefresh={onRefresh}
          />
        }
        contentContainerStyle={{ paddingBottom: 50 }}
      >
        {signals.map((item, idx) => {
          const signalColor =
            item.signal === "BUY"
              ? BRAND.accent
              : item.signal === "SELL"
              ? BRAND.red
              : BRAND.amber;

          const changeColor =
            item.changePct >= 0 ? BRAND.accent : BRAND.red;
          // ensure animation value exists per symbol
          if (!priceFlash[item.symbol]) {
            priceFlash[item.symbol] = new Animated.Value(0);
          }

          return (
           <TouchableOpacity
              key={item.symbol + idx}
              activeOpacity={0.85}
              delayPressIn={0}
              style={styles.card}
              onPress={() => {
                console.log("Tapped:", item.symbol); // debug
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

                navigation.navigate("StockDetailScreen", {
                  symbol: item.symbol,
                  name: item.name || item.symbol,
                  source: "ui", // 👈 intent flag
                });
              }}
            >


              <View style={styles.cardHeader}>

                {/* LEFT */}
                <View style={{ flex: 1 }}>
                  <Text style={styles.symbol}>{item.symbol}</Text>
                  <Text style={styles.name}>{item.name}</Text>
                </View>

                {/* CENTER — Sparkline */}
                <View style={styles.sparklineCenter}>
                  <MiniSparkline
                    data={item.sparkline}
                    color={signalColor}
                  />
                </View>

                {/* RIGHT */}
                <View style={{ alignItems: "flex-end" }}>
                <Animated.Text
                  style={[
                    styles.price,
                    {
                      backgroundColor: priceFlash[item.symbol]?.interpolate({
                        inputRange: [0, 1],
                        outputRange: [
                          "transparent",
                          item.changePct >= 0
                            ? "rgba(0,227,150,0.18)"   // green flash
                            : "rgba(255,69,96,0.18)", // red flash
                        ],
                      }),
                      paddingHorizontal: 6,
                      borderRadius: 6,
                    },
                  ]}
                >
                  ${Number(item.price || 0).toFixed(2)}
                </Animated.Text>


                {(() => {
                  const session = getMarketSession(item.lastUpdated);
                  const isLive = session === "LIVE";
                  const isUp = typeof item.changePct === "number" ? item.changePct >= 0 : true;

                  return (
                    <Text
                      style={[
                        styles.changePct,
                        {
                          // LIVE = green/red, AH/PRE = muted
                          color: isLive ? (isUp ? BRAND.accent : BRAND.red) : BRAND.sub,
                          opacity: isLive ? 1 : 0.75,
                        },
                      ]}
                    >
                      {fmtPct(item.changePct)} {session || ""}
                    </Text>
                  );
                })()}
              </View>


              </View>


              <View style={styles.signalRow}>
                <View
                  style={[
                    styles.signalBadge,
                    { backgroundColor: signalColor },
                  ]}
                >
                  <Text style={styles.signalText}>{item.signal}</Text>
                </View>
                <Text style={styles.confLabel}>Confidence</Text>
                <Text
                  style={[styles.confValue, { color: signalColor }]}
                >
                  {item.confidence}%
                </Text>
              </View>

              <Text style={styles.summary} numberOfLines={2}>
                {item.grokSummary || item.summary}
              </Text>
              <Text style={styles.lastUpdated}>
                {timeAgo(item.lastUpdated)}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* FLOATING DOCK */}
      <Animated.View
        style={[
          styles.quickDock,
          { transform: [{ translateY: dockY }], opacity: dockOpacity },
        ]}
      >
        <TouchableOpacity onPress={() => setShowAddModal(true)}>
          <Ionicons name="add-circle-outline" size={28} color={BRAND.text} />
        </TouchableOpacity>
        <TouchableOpacity onPress={() => navigation.navigate("AlertScreen")}>
          <Ionicons
            name="notifications-outline"
            size={26}
            color={BRAND.text}
          />
        </TouchableOpacity>
      </Animated.View>

      {/* ADD TICKER MODAL (UI ONLY – backend will handle later) */}
      <Modal transparent visible={showAddModal} animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Add a Ticker</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter symbol (e.g., TSLA)"
              placeholderTextColor="#666"
              value={newTicker}
              onChangeText={setNewTicker}
            />
            <View style={styles.modalActions}>
              <TouchableOpacity onPress={() => setShowAddModal(false)}>
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => {
                  Alert.alert(
                    "Info",
                    "Ticker add handled server-side in next phase."
                  );
                  setShowAddModal(false);
                }}
              >
                <Text style={styles.addText}>Add</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

/* === Styles UNCHANGED === */
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BRAND.bg },
  header: { paddingTop: 56, alignItems: "center", marginBottom: 6 },
  headerBrandRow: { flexDirection: "row", alignItems: "center" },
  logo: { width: 25, height: 25, marginRight: 6 },
  title: { color: BRAND.accent, fontSize: 25, fontWeight: "800" },
  subtitle: { color: BRAND.sub, fontSize: 12, marginTop: 4 },
  syncRow: { flexDirection: "row", alignItems: "center", marginTop: 6 },
  moodText: { color: BRAND.sub, fontSize: 12, marginLeft: 2 },

  carousel: { marginTop: 5 },
  carouselContent: { paddingHorizontal: 20, paddingBottom: 16 },
  featureCard: {
    backgroundColor: BRAND.card,
    borderRadius: 14,
    padding: 12,
    width: 220,
    height: 80,
    marginRight: 12,
    borderWidth: 1,
    borderColor: BRAND.border,
    justifyContent: "center",
    marginBottom: 25,
  },
  featureHeader: { flexDirection: "row", alignItems: "center", marginBottom: 4 },
  featureTitle: { color: BRAND.text, fontWeight: "700", fontSize: 14 },
  featureValue: { color: BRAND.sub, fontSize: 12 },

  card: {
    backgroundColor: BRAND.card,
    borderRadius: 16,
    padding: 12,
    marginHorizontal: 20,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: BRAND.border,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  symbol: { color: BRAND.text, fontSize: 17, fontWeight: "700" },
  name: { color: BRAND.sub, fontSize: 12, marginTop: 2 },
  price: { color: BRAND.text, fontSize: 16, fontWeight: "600" },
  changePct: { fontSize: 12, fontWeight: "600" },

  signalRow: { flexDirection: "row", alignItems: "center", marginTop: 6 },
  signalBadge: {
    borderRadius: 8,
    paddingVertical: 4,
    paddingHorizontal: 10,
    marginRight: 10,
  },
  signalText: { color: "#000", fontSize: 12, fontWeight: "700" },
  confLabel: { color: BRAND.sub, fontSize: 12, marginRight: 4 },
  confValue: { fontSize: 12, fontWeight: "700" },

  summary: { color: BRAND.sub, fontSize: 13, marginTop: 6 },
  lastUpdated: {
    color: BRAND.sub,
    fontSize: 11,
    marginTop: 2,
    fontStyle: "italic",
    opacity: 0.7,
  },

  quickDock: {
    position: "absolute",
    bottom: 24,
    alignSelf: "center",
    flexDirection: "row",
    justifyContent: "space-around",
    width: 150,
    backgroundColor: "rgba(17,24,39,0.88)",
    borderRadius: 28,
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderWidth: 1,
    borderColor: BRAND.border,
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  modalBox: {
    backgroundColor: BRAND.card,
    borderColor: BRAND.border,
    borderWidth: 1,
    borderRadius: 14,
    width: "100%",
    padding: 16,
  },
  modalTitle: {
    color: BRAND.text,
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 10,
  },
  input: {
    backgroundColor: "#0A0A0A",
    color: BRAND.text,
    borderRadius: 10,
    padding: 12,
    fontSize: 15,
    borderWidth: 1,
    borderColor: BRAND.border,
    marginBottom: 12,
  },
  modalActions: { flexDirection: "row", justifyContent: "space-between" },
  cancelText: { color: BRAND.sub, fontSize: 14, fontWeight: "600" },
  addText: { color: BRAND.accent, fontSize: 14, fontWeight: "700" },
  marketStatusText: {
  color: BRAND.sub,
  fontSize: 12,
  fontWeight: "600",
},
sparklineCenter: {
  flex: 1,
  alignItems: "center",
  justifyContent: "center",
},

priceBlock: {
  alignItems: "flex-end",
  minWidth: 90,
},

});
