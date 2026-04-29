// screens/HomeScreen.js
import React, { useRef, useState } from "react";
import { useFocusEffect } from "@react-navigation/native";

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


function formatPattern(pattern, winRate) {
  if (!pattern) return null;
  if (typeof winRate === "number") {
    return `${pattern} · ${(winRate * 100).toFixed(0)}% win rate`;
  }
  return pattern;
}


function getPatternColor(winRate) {
  if (typeof winRate !== "number") return "#374151"; // neutral gray
  if (winRate >= 0.7) return "#16A34A"; // strong green
  if (winRate >= 0.6) return "#22C55E"; // green
  if (winRate >= 0.5) return "#FACC15"; // yellow
  return "#EF4444"; // red
}

function formatPatternLabel(pattern, winRate) {
  if (!pattern) return null;

  if (typeof winRate === "number") {
    return `${pattern} · ${Math.round(winRate * 100)}%`;
  }

  return pattern;
}

function renderColoredSegments(value, styles, BRAND) {
  if (!value) return null;

  const segments = value.split(" · ");

  return (
    <View style={styles.segmentWrap}>
      {segments.map((seg, idx) => {
        const isUp = seg.includes("▲") || seg.includes("+");
        const isDown = seg.includes("▼") || seg.includes("-");

        return (
          <Text
            key={idx}
            style={[
              styles.segmentText,
              isUp && { color: BRAND.accent },
              isDown && { color: BRAND.red },
            ]}
          >
            {seg}
            {idx < segments.length - 1 ? " · " : ""}
          </Text>
        );
      })}
    </View>
  );
}


// Session label from timestamp (RESTORE — DO NOT CHANGE)
function getMarketSession(ts) {
  if (!ts) return null;
  const d = new Date(ts);
  const h = d.getHours();

  if (h < 9 || (h === 9 && d.getMinutes() < 30)) return "PRE";
  if (h >= 16) return "AH";
  return "LIVE";
}


export default function HomeScreen({ navigation }) {
  const [home, setHome] = useState(null);
  // 🔥 price flash animation per symbol
const priceFlash = useRef({}).current;
const REFRESH_INTERVAL_MS = 15000; // ✅ matches quotes ttl (30s)


const [refreshing, setRefreshing] = useState(false);
  /* ---------------------------------------------------------
     Load + Auto Refresh (5s)
  --------------------------------------------------------- */
  useFocusEffect(
  React.useCallback(() => {
    let active = true;

    const load = async () => {
      if (!active) return;

      const data = await getHomeScreen();
      if (!data) return;

      setHome(data);

      // 🔥 trigger price flash
   
        (data.signals || []).forEach((it) => {
          // ✅ ensure animation exists
          if (!priceFlash[it.symbol]) {
            priceFlash[it.symbol] = new Animated.Value(0);
          }

          // ✅ don't skip — price updates should flash even if needsRefresh flips
          priceFlash[it.symbol].setValue(1);
          Animated.timing(priceFlash[it.symbol], {
            toValue: 0,
            duration: 900,
            useNativeDriver: false,
          }).start();
        });


    };

    // initial load
    load();

    // auto refresh
    const interval = setInterval(load, REFRESH_INTERVAL_MS);

    // cleanup when screen loses focus
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [])
);


  /* ---------------------------------------------------------
     Pull To Refresh
  --------------------------------------------------------- */
  const onRefresh = async () => {
  if (refreshing) return;

  setRefreshing(true);
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

  const data = await getHomeScreen();
  if (data) {
    setHome(data);

    (data.signals || []).forEach((it) => {
      if (!priceFlash[it.symbol]) {
        priceFlash[it.symbol] = new Animated.Value(0);
      }

      priceFlash[it.symbol].setValue(1);
      Animated.timing(priceFlash[it.symbol], {
        toValue: 0,
        duration: 900,
        useNativeDriver: false,
      }).start();
    });

  }

  setRefreshing(false);
};



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
          <Text style={styles.title}>AlphaWise</Text>
        </View>
        <Text style={styles.subtitle}>AI-Powered Market Intelligence</Text>
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

            {c.id === "sectors" ? (
              <View style={styles.sectorWrap}>
                {c.value.split(/\s*·\s*|\n/).filter(Boolean).map((seg, idx) => {
                  const isUp = seg.includes("▲");
                  const isDown = seg.includes("▼");

                  return (
                    <Text
                      key={idx}
                      style={[
                        styles.sectorText,
                        isUp && { color: BRAND.accent },
                        isDown && { color: BRAND.red },
                      ]}
                    >
                      {seg}
                      {idx < c.value.split(/\s*·\s*|\n/).filter(Boolean).length - 1 ? " · " : ""}
                    </Text>
                  );
                })}
              </View>
            ) : (
              renderColoredSegments(c.value, styles, BRAND)
            )}
          </View>
        ))}
      </ScrollView>


      {/* MAIN LIST */}
      <ScrollView
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
      const session = getMarketSession(item.lastUpdated);
      const isLive = session === "LIVE";

      const isUp =
        typeof item.changePct === "number"
          ? item.changePct >= 0
          : true;

          const signalColor =
            item.signal === "BUY"
              ? BRAND.accent
              : item.signal === "SELL"
              ? BRAND.red
              : BRAND.amber;
            const hasLivePrice = typeof item.price === "number";
  

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
                  <Text style={styles.name}>{item.companyName}</Text>

                </View>

                {/* RIGHT */}
              <View style={{ alignItems: "flex-end" }}>
                {/* PRICE */}
                <Animated.Text
                  style={[
                    styles.price,
                    {
                      color: isLive
                        ? isUp
                          ? BRAND.accent
                          : BRAND.red
                        : BRAND.sub,

                      backgroundColor: priceFlash[item.symbol]?.interpolate({
                        inputRange: [0, 1],
                        outputRange: [
                          "transparent",
                          isUp
                            ? "rgba(0,227,150,0.30)"
                            : "rgba(255,69,96,0.30)",
                        ],
                      }),
                      paddingHorizontal: 6,
                      borderRadius: 6,
                    },
                  ]}
                >
                  {item.price != null ? `$${item.price.toFixed(2)}` : "--"}
                </Animated.Text>

                {/* CHANGE + % */}
                {(() => {
                const session = getMarketSession(item.lastUpdated);
                const isLive = session === "LIVE";

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

              <Text style={styles.summary} numberOfLines={4}>
              {item.grokSummary ||
                (typeof item.summary === "string"
                  ? item.summary
                  : item.summary?.primary)}
            </Text>

              {item.pattern && (
                <View
                  style={[
                    styles.patternBadge,
                    { backgroundColor: getPatternColor(item.patternWinRate) },
                  ]}
                >
                  <Text style={styles.patternText}>
                    {formatPatternLabel(item.pattern, item.patternWinRate)}
                  </Text>
                </View>
              )}


              <Text style={styles.lastUpdated}>
                {timeAgo(item.lastUpdated)}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
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

   carousel: { marginTop: 5, marginBottom: 8 },
  carouselContent: { paddingHorizontal: 12, paddingBottom: 16 },
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
  padding: 14,           // slightly more inner space
  marginHorizontal: 10,  // ✅ wider cards
  marginBottom: 10,
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
priceBlock: {
  alignItems: "flex-end",
  minWidth: 90,
},
patternText: {
  color: BRAND.sub,
  fontSize: 12,
  marginTop: 2,
  opacity: 0.85,
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
sectorWrap: {
  flexDirection: "row",
  flexWrap: "wrap",
},

sectorText: {
  fontSize: 12,
  color: BRAND.sub,
  fontWeight: "600",
},
segmentWrap: {
  flexDirection: "row",
  flexWrap: "wrap",
},

segmentText: {
  fontSize: 12,
  color: BRAND.sub,
  fontWeight: "600",
},
changeLine: {
  fontSize: 12,
  fontWeight: "700",
  marginTop: 2,
},

});
