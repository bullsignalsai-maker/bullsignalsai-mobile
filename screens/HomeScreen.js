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
import { registerNightlySummaryJob } from "../firebaseConfig";
import {
getQuotesForSymbols,
getTickerSummary, // ✅ new
} from "../services/marketData";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { AppState } from "react-native";
import LiveMarketStatus from "../components/LiveMarketStatus";




// --- Helper: detect if U.S. market is open (NYSE/Nasdaq hours)
function isMarketOpen() {
const now = new Date();
const est = new Date(now.toLocaleString("en-US", { timeZone: "America/New_York" }));
const day = est.getDay();
const hour = est.getHours();
const minute = est.getMinutes();




// Monday to Friday
if (day < 1 || day > 5) return false;




// Before 9:30 AM or at/after 4:00 PM
if (hour < 9 || hour >= 16) return false;
if (hour === 9 && minute < 30) return false;




return true;
}




// Helper to make timestamps human-readable (e.g. "Updated 5h ago")
function timeAgo(isoString) {
if (!isoString) return "Recently";
const diffMs = Date.now() - new Date(isoString).getTime();
const diffMins = Math.floor(diffMs / 60000);
const diffHrs = Math.floor(diffMins / 60);
const diffDays = Math.floor(diffHrs / 24);
if (diffMins < 1) return "Just now";
if (diffMins < 60) return `Updated ${diffMins}m ago`;
if (diffHrs < 24) return `Updated ${diffHrs}h ago`;
return `Updated ${diffDays}d ago`;
}
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








// Seed list – summary will be replaced by Grok when available
const SEED_SIGNALS = [
{
 symbol: "AAPL",
 name: "Apple Inc.",
 price: 189.2,
 changePct: 0.8,
 signal: "BUY",
 confidence: 75,
 summary: "Strong institutional demand.",
},
{
 symbol: "MSFT",
 name: "Microsoft Corp.",
 price: 347.5,
 changePct: -0.4,
 signal: "HOLD",
 confidence: 59,
 summary: "Neutral after earnings beat.",
},
{
 symbol: "AMZN",
 name: "Amazon.com",
 price: 131.9,
 changePct: 1.1,
 signal: "BUY",
 confidence: 72,
 summary: "Positive retail growth outlook.",
},
{
 symbol: "GOOGL",
 name: "Alphabet Inc.",
 price: 138.7,
 changePct: 0.2,
 signal: "HOLD",
 confidence: 61,
 summary: "Ad spend recovery continues.",
},
];




const LOGO = require("../assets/logo.png");




// ================================================
// 🔧 CONSISTENT SIGNAL + SUMMARY ENGINE
// ================================================




// Derive signal and confidence directly from price change
function deriveSignalFromChange(changePct) {
if (changePct == null || Number.isNaN(changePct)) {
  return { signal: "HOLD", confidence: 50 };
}




const abs = Math.abs(changePct);




if (changePct > 1.0) {
  const confidence = Math.min(85, 65 + Math.round(abs * 5));
  return { signal: "BUY", confidence };
}




if (changePct < -1.0) {
  const confidence = Math.min(80, 60 + Math.round(abs * 5));
  return { signal: "SELL", confidence };
}




// neutral range
const confidence = 45 + Math.round((1 - abs) * 10); // ~45–55%
return { signal: "HOLD", confidence };
}




// Auto-generate consistent summary text based on derived signal
function getAlignedSummary(symbol, signal, confidence, changePct) {
const abs = Math.abs(changePct || 0).toFixed(2);
const dir =
  changePct > 0
    ? `gain`
    : changePct < 0
    ? `decline`
    : `flat performance`;




switch (signal) {
  case "BUY":
    return `${symbol} shows bullish momentum with a ${abs}% ${dir} and ${confidence}% buy confidence.`;
  case "SELL":
    return `${symbol} shows bearish momentum with a ${abs}% ${dir} and ${confidence}% sell confidence.`;
  default:
    return `${symbol} remains range-bound with a ${abs}% ${dir} and ${confidence}% neutral outlook.`;
}
}












export default function HomeScreen({ navigation })
{
const [signals, setSignals] = useState(SEED_SIGNALS);
const [refreshing, setRefreshing] = useState(false);
const [lastSync, setLastSync] = useState("Just now");
const [marketMood, setMarketMood] = useState("Loading...");








const [carouselData, setCarouselData] = useState([
{ icon: "trending-up-outline", title: "AI Market Insights", value: "Loading..." },
{ icon: "flame-outline", title: "Top Gainers", value: "Loading..." },
{ icon: "stats-chart-outline", title: "Trending Sectors", value: "Loading..." },
]);




const [marketStatus, setMarketStatus] = useState(isMarketOpen() ? "Open" : "Closed");




// ⏱️ Update every 60 seconds
useEffect(() => {
const interval = setInterval(() => {
  setMarketStatus(isMarketOpen() ? "Open" : "Closed");
}, 60000);
return () => clearInterval(interval);
}, []);




// === Offline Caching Helpers ===
const saveToCache = async (data) => {
 try {
   await AsyncStorage.setItem("@last_prices", JSON.stringify(data));
 } catch (e) {
   console.warn("Cache save error", e);
 }
};








const loadFromCache = async () => {
 try {
   const raw = await AsyncStorage.getItem("@last_prices");
   if (raw) {
     const parsed = JSON.parse(raw);
     setSignals(parsed); // ✅ works now (inside scope)
     setMarketMood(computeMarketMood(parsed));
     await computeFeatureCarousel(parsed);
     console.log("💾 Loaded cached prices");
   }
 } catch (e) {
   console.warn("Cache load error", e);
 }
};








const computeMarketMood = (tickers) => {
if (!tickers || tickers.length === 0) return "No data";








// average confidence
const avgConfidence =
 tickers.reduce((sum, t) => sum + (t.confidence ?? 50), 0) /
 tickers.length;








const bias = avgConfidence - 50; // deviation from neutral
const rounded = Math.round(avgConfidence);




if (bias > 2)
 return `Bullish ${rounded}%`;
if (bias < -2)
 return `Bearish ${rounded}%`;
return `Neutral ${rounded}%`;
};




const computeFeatureCarousel = async () => {// === Feature Carousel (Live + After-Hours Smart Update) ===
try {
  // Helper to safely fetch JSON or return null
  const safeFetch = async (url, ms = 8000) => {
    return Promise.race([
      fetch(url, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          Accept: "application/json, text/plain, */*",
        },
      }).then(async (r) => {
        const txt = await r.text();
        if (txt.trim().startsWith("<")) return null;
        try {
          return JSON.parse(txt);
        } catch {
          return null;
        }
      }),
      new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout")), ms)),
    ]);
  };




  /* === 1️⃣ AI Market Insights (U.S. indices) === */
  let marketPulse = "Loading...";
  try {
    const indices = ["^GSPC", "^IXIC", "^DJI"]; // S&P 500, Nasdaq, Dow
    const res = await Promise.all(
      indices.map((sym) =>
        safeFetch(
          `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
            sym
          )}?range=1d&interval=1d`
        )
      )
    );




    const changes = res.map((d) => {
      const meta = d?.chart?.result?.[0]?.meta;
      const close = meta?.regularMarketPrice;
      const prev = meta?.chartPreviousClose;
      return prev ? ((close - prev) / prev) * 100 : 0;
    });




    const avg =
      changes.length > 0
        ? changes.reduce((a, b) => a + b, 0) / changes.length
        : 0;




    // 🕒 If market closed, show adjusted message
    if (isMarketOpen()) {
      marketPulse =
        Math.abs(avg) < 0.05
          ? "Flat today"
          : avg > 0
          ? `U.S. Market up +${avg.toFixed(2)}%`
          : `U.S. Market down ${avg.toFixed(2)}%`;
    } else {
      marketPulse =
        Math.abs(avg) < 0.05
          ? "Market Closed · Flat"
          : avg > 0
          ? `Market Closed · Last data +${avg.toFixed(2)}%`
          : `Market Closed · Last data ${avg.toFixed(2)}%`;
    }
  } catch (err) {
    console.warn("AI Market Insights error:", err);
    marketPulse = "Market data unavailable";
  }




  /* === 2️⃣ Crypto Movers (CoinGecko) === */
  let cryptoTrends = "Loading...";
  try {
    const crypto = await safeFetch(
      "https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=10&page=1"
    );
    if (Array.isArray(crypto)) {
      const top = crypto
        .sort((a, b) => b.price_change_percentage_24h - a.price_change_percentage_24h)
        .slice(0, 3)
        .map(
          (c) =>
            `${c.symbol.toUpperCase()} (${c.price_change_percentage_24h?.toFixed(
              1
            )}%)`
        )
        .join(", ");
      cryptoTrends = top || "No major movers";
    } else cryptoTrends = "Crypto data unavailable";
  } catch {
    cryptoTrends = "Crypto data unavailable";
  }




  /* === 3️⃣ Market Sentiment (Fear & Greed Index) === */
  let sentiment = "Loading...";
  try {
    const res = await safeFetch("https://api.alternative.me/fng/");
    const data = res?.data?.[0];
    if (data) sentiment = `${data.value_classification} (${data.value})`;
    else sentiment = "Sentiment unavailable";
  } catch {
    sentiment = "Sentiment unavailable";
  }




  /* === 4️⃣ Commodities Snapshot (Yahoo) === */
  let commodities = "Loading...";
  try {
    const symbols = ["GC=F", "CL=F", "SI=F"]; // Gold, Oil, Silver
    const res = await Promise.all(
      symbols.map((sym) =>
        safeFetch(
          `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
            sym
          )}?range=1d&interval=1d`
        )
      )
    );
    commodities = res
      .map((d, i) => {
        const meta = d?.chart?.result?.[0]?.meta;
        const close = meta?.regularMarketPrice;
        const prev = meta?.chartPreviousClose;
        const change = prev ? ((close - prev) / prev) * 100 : 0;
        const name = ["Gold", "Oil", "Silver"][i];
        return `${name} (${change >= 0 ? "+" : ""}${change.toFixed(1)}%)`;
      })
      .join(", ");
  } catch {
    commodities = "Commodities data unavailable";
  }




  /* === 5️⃣ Trending Sectors (Static fallback) === */
  const trendingSectors = "AI, Tech, Energy";




  // ✅ Update the carousel data
  setCarouselData([
    { icon: "pulse-outline", title: "AI Market Insights", value: marketPulse },
    { icon: "aperture-outline", title: "Crypto Movers", value: cryptoTrends },
    { icon: "speedometer-outline", title: "Market Sentiment", value: sentiment },
    { icon: "water-outline", title: "Commodities Snapshot", value: commodities },
    { icon: "stats-chart-outline", title: "Trending Sectors", value: trendingSectors },
  ]);
} catch (err) {
  console.warn("computeFeatureCarousel error:", err);
}
};
const dockTranslate = useRef(new Animated.Value(0)).current;
const lastY = useRef(0);
const [showAddModal, setShowAddModal] = useState(false);
const [newTicker, setNewTicker] = useState("");




// === Register nightly background summary refresh ===
useEffect(() => {
registerNightlySummaryJob();
}, []);




// === Initial load: hydrate from Finnhub + Grok ===
useEffect(() => {
(async () => {
 try {
   // ✅ Load cached data first for instant UI
   await loadFromCache();








   const symbols = SEED_SIGNALS.map((s) => s.symbol);
   const quotesArray = await getQuotesForSymbols(symbols);
   // ✅ Safety: ensure array
   const quotes = Array.isArray(quotesArray) ? quotesArray : [];
   const quoteMap = Object.fromEntries(quotes.map((q) => [q.symbol, q]));
   // ✅ Hydrate each base ticker with live data + aligned AI summary
const hydrated = await Promise.all(
SEED_SIGNALS.map(async (s) => {
  const quote = quoteMap[s.symbol];
  if (!quote) return s;




  const price = quote.price ?? s.price;
  const changePct = quote.changePct ?? s.changePct;




  const { signal, confidence } = deriveSignalFromChange(changePct);
  const summary = getAlignedSummary(s.symbol, signal, confidence, changePct);




  return {
    ...s,
    price,
    changePct,
    signal,
    confidence,
    summary,
    lastUpdated: new Date().toISOString(),
  };
})
);
   // ✅ Update state and cache
   setSignals(hydrated);
   setMarketMood(computeMarketMood(hydrated));
   setLastSync("Just now");
   await computeFeatureCarousel(hydrated);
   await saveToCache(hydrated);
 } catch (err) {
   console.warn("Initial signals hydrate error:", err);
 }
})();
}, []);
















// === Pull-to-refresh: update prices & % change (keep summary) ===
const onRefresh = async () => {
setRefreshing(true);
Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);








try {
 const symbols = signals.map((s) => s.symbol);
 const quotesArray = await getQuotesForSymbols(symbols);
 const quoteMap = Object.fromEntries(quotesArray.map((q) => [q.symbol, q]));








 const updated = signals.map((s) => {
const quote = quoteMap[s.symbol];
if (!quote) return s;




const price = quote.price ?? s.price;
const changePct = quote.changePct ?? s.changePct;




const { signal, confidence } = deriveSignalFromChange(changePct);
const summary = getAlignedSummary(s.symbol, signal, confidence, changePct);




return { ...s, price, changePct, signal, confidence, summary };
});








 // ✅ Use the correct variable name
 setSignals(updated);
 setMarketMood(computeMarketMood(updated));
 setLastSync("Just now");
 await computeFeatureCarousel(updated);
 await saveToCache(updated);
} catch (err) {
 console.warn("Refresh error:", err);
} finally {
 setRefreshing(false);
}
};




// === Auto-refresh every 60s (Finnhub only, no Grok) with background throttle ===
const intervalRef = useRef(null);
const resumeTimeoutRef = useRef(null);
const appState = useRef(AppState.currentState);
const startAutoRefresh = () => {
clearInterval(intervalRef.current);
intervalRef.current = setInterval(async () => {
 await performRefresh(false);
}, 60000); // every 60s
};








// ✅ helper that performs the refresh logic
const performRefresh = async (isFastResume = false) => {
try {
 console.log(isFastResume ? "⚡ Fast refresh after resume" : "⏱️ Auto-refresh triggered...");
 const symbols = signals.map((s) => s.symbol);
 if (symbols.length === 0) return;








 const quoteMap = await getQuotesForSymbols(symbols);








 const updated = signals.map((s) => {
   const quote = quoteMap[s.symbol];
   if (!quote) return s;








   const price = quote.price ?? s.price;
   const changePct = quote.changePct ?? s.changePct;
   const { signal, confidence } = deriveSignalFromChange(changePct);
   return { ...s, price, changePct, signal, confidence };
 });








 setSignals(updated);
 setMarketMood(computeMarketMood(updated));
 await computeFeatureCarousel(updated);
 await saveToCache(updated);
} catch (err) {
 console.warn("Auto-refresh error:", err);
}
};
// ✅ Main hook: handles auto-refresh + background detection
useEffect(() => {
startAutoRefresh();








const handleAppStateChange = (nextState) => {
 if (nextState === "background") {
   console.log("⏸️ App backgrounded — pausing auto-refresh");
   clearInterval(intervalRef.current);
   clearTimeout(resumeTimeoutRef.current);
 } else if (nextState === "active" && appState.current === "background") {
   console.log("▶️ App resumed — scheduling fast refresh");
   // Trigger a one-time fast refresh 5s after resume
   resumeTimeoutRef.current = setTimeout(() => performRefresh(true), 5000);
   startAutoRefresh(); // restart regular interval
 }
 appState.current = nextState;
};








const sub = AppState.addEventListener("change", handleAppStateChange);
return () => {
 clearInterval(intervalRef.current);
 clearTimeout(resumeTimeoutRef.current);
 sub.remove();
};
},[signals]);
const goToDetails = (item) => {
 navigation.navigate("StockDetailScreen", { ...item });
};


const handleScroll = (e) => {
 const y = e.nativeEvent.contentOffset.y;
 const goingDown = y > lastY.current + 6;
 const goingUp = y < lastY.current - 6;

 if (goingDown) {
   Animated.timing(dockTranslate, {
     toValue: 1,
     duration: 180,
     useNativeDriver: true,
   }).start();
 } else if (goingUp) {
   Animated.timing(dockTranslate, {
     toValue: 0,
     duration: 180,
     useNativeDriver: true,
   }).start();
 }
 lastY.current = y;
};

// === Add ticker with real data + AI summary ===
const handleAddTicker = async () => {
const raw = newTicker.trim().toUpperCase();
if (!raw) return;


const symbol = raw;
if (signals.find((s) => s.symbol === symbol)) {
 Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
 Alert.alert("Already Added", `${symbol} is already in your list.`);
 setShowAddModal(false);
 return;
}


try {
 // 1️⃣ Get live quote for this symbol
 const data = await getQuotesForSymbols([symbol]);
 let quote = null;

 // Handle both array and object return types safely
 if (Array.isArray(data)) quote = data[0];
 else if (typeof data === "object") quote = data[symbol];

 if (!quote || quote.price == null) {
   console.warn(`⚠️ No quote data for ${symbol}, skipping.`);
   Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
   setShowAddModal(false);
   return;
 }
 const price = quote.price;
 const changePct = quote.changePct;

 // 3️⃣ Derive signal + confidence
 const { signal, confidence } = deriveSignalFromChange(changePct);

 // 4️⃣ Get factual one-liner (Grok)
 let summary = "AI-generated forecast.";
 try {
   const aiSummary = await getTickerSummary({
     symbol,
     name: `${symbol} Corp.`,
     price,
     changePct,
   });
   if (aiSummary) summary = aiSummary;
 } catch (e) {
   console.warn("⚠️ Grok summary failed for added ticker", symbol, e);
 }

 // 5️⃣ Build new ticker object
 const newItem = {
   symbol,
   name: `${symbol} Corp.`,
   price,
   changePct,
   signal,
   confidence,
   summary,
 };

 // 6️⃣ Update list & persist (outside of state callback)
 const updated = [...signals, newItem];
 setSignals(updated);

 // ✅ Proper await placement — safe outside setSignals
 await saveToCache(updated);

 Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
 Alert.alert("Ticker Added", `${symbol} added successfully!`);
} catch (err) {
 console.warn("handleAddTicker error:", err);
 Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
} finally {
 setNewTicker("");
 setShowAddModal(false);
}
};

const dockY = dockTranslate.interpolate({
 inputRange: [0, 1],
 outputRange: [0, 60],
});
const dockOpacity = dockTranslate.interpolate({
 inputRange: [0, 1],
 outputRange: [1, 0],
});

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
<LiveMarketStatus marketStatus={marketStatus} />
<Text style={styles.moodText}> | Market: {marketMood}</Text>
</View>
</View>

   {/* FEATURE CARDS */}
   <ScrollView
     horizontal
     showsHorizontalScrollIndicator={false}
     style={styles.carousel}
     contentContainerStyle={styles.carouselContent}
   >
     {carouselData.map((c, i) => (
         <View key={i} style={styles.featureCard}>
           <View style={styles.featureHeader}>
             <Ionicons name={c.icon} size={18} color={BRAND.accent} style={{ marginRight: 6 }} />
             <Text style={styles.featureTitle} numberOfLines={1}>{c.title}</Text>
           </View>
           <Text style={styles.featureValue} numberOfLines={2}>{c.value}</Text>
         </View>
       ))}
   </ScrollView>

   {/* MAIN LIST */}
   <ScrollView
     onScroll={handleScroll}
     scrollEventThrottle={16}
     showsVerticalScrollIndicator={false}
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
       const changeColor = item.changePct >= 0 ? BRAND.accent : BRAND.red;

       return (
         <TouchableOpacity
           key={item.symbol + "_" + idx}
           style={styles.card}
           onPress={() => goToDetails(item)}
           activeOpacity={0.85}
         >
           <View style={styles.cardHeader}>
             <View>
               <Text style={styles.symbol}>{item.symbol}</Text>
               <Text style={styles.name}>{item.name}</Text>
             </View>
             <View style={{ alignItems: "flex-end" }}>
               <Text style={styles.price}>${item.price.toFixed(2)}</Text>
               <Text style={[styles.changePct, { color: changeColor }]}>
                 {item.changePct >= 0 ? "+" : ""}
                 {item.changePct.toFixed(2)}%
               </Text>
             </View>
           </View>

           <View style={styles.signalRow}>
             <View
               style={[styles.signalBadge, { backgroundColor: signalColor }]}
             >
               <Text style={styles.signalText}>{item.signal}</Text>
             </View>
             <Text style={styles.confLabel}>Confidence</Text>
             <Text
               style={[styles.confValue, { color: signalColor }]}
             >{`${Math.round(item.confidence)}%`}</Text>
           </View>

           <Text style={styles.summary} numberOfLines={2}>
             {item.summary}
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
       <Ionicons name="notifications-outline" size={26} color={BRAND.text} />
     </TouchableOpacity>
   </Animated.View>

   {/* ADD TICKER MODAL */}
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
           autoCapitalize="characters"
           returnKeyType="done"
           onSubmitEditing={handleAddTicker}
         />
         <View style={styles.modalActions}>
           <TouchableOpacity onPress={() => setShowAddModal(false)}>
             <Text style={styles.cancelText}>Cancel</Text>
           </TouchableOpacity>
           <TouchableOpacity onPress={handleAddTicker}>
             <Text style={styles.addText}>Add</Text>
           </TouchableOpacity>
         </View>
       </View>
     </View>
   </Modal>
 </View>
);
}

/* === Styles (unchanged layout) === */
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
carouselContent: { paddingHorizontal: 20, paddingBottom: 5 },
featureCard: {
 backgroundColor: BRAND.card,
 borderRadius: 14,
 padding: 12,
 width: 200,
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
 padding: 14,
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
signalRow: { flexDirection: "row", alignItems: "center", marginTop: 8 },
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
lastUpdated: {
color: BRAND.sub,
fontSize: 11,
marginTop: 2,
fontStyle: "italic",
opacity: 0.7,
},
marketStatus: {
color: BRAND.sub,
fontSize: 11,
marginTop: 4,
textAlign: "center",
fontWeight: "600",
},

modalActions: { flexDirection: "row", justifyContent: "space-between" },
cancelText: { color: BRAND.sub, fontSize: 14, fontWeight: "600" },
addText: { color: BRAND.accent, fontSize: 14, fontWeight: "700" },
});

