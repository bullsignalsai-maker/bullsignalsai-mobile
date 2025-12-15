// components/MarketTicker.js
import React, { useEffect, useState, useRef } from "react";
import {
  View,
  Animated,
  Easing,
  StyleSheet,
  Dimensions,
  Pressable,
} from "react-native";

const screenWidth = Dimensions.get("window").width;

export default function MarketTicker() {
  const [tickers, setTickers] = useState([]);
  const translateX = useRef(new Animated.Value(screenWidth)).current;
  const blinkAnim = useRef(new Animated.Value(1)).current;
  const animationRef = useRef(null);
  const isPaused = useRef(false);

  // 🔹 Blink LIVE dot
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(blinkAnim, { toValue: 0.2, duration: 700, useNativeDriver: true }),
        Animated.timing(blinkAnim, { toValue: 1, duration: 700, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  // 🔹 New backend-only load function
  const loadData = async () => {
    try {
      const symbols =
        "GSPC,DJI,IXIC,AAPL,MSFT,NVDA,TSLA,AMZN,META";

      const url = `https://bullbrain-api.onrender.com/quotes?symbols=${symbols}`;
      const res = await fetch(url);
      const json = await res.json();

      if (json && typeof json === "object") {
        const formatted = Object.keys(json).map((key) => {
          const item = json[key];
          return {
            symbol: key.replace("^", ""),
            price: item?.price?.toFixed?.(2) ?? "–",
            change: item?.change?.toFixed?.(2) ?? "–",
            percent: item?.changePct?.toFixed?.(2) ?? "–",
          };
        });

        if (formatted.length > 0) {
          setTickers(formatted);
          return;
        }
      }

      throw new Error("Backend returned empty");
    } catch (err) {
      console.warn("⚠️ Ticker backend API failed:", err.message);

      // Fallback static
      setTickers([
        { symbol: "S&P500", price: "5050.22", percent: "+0.24" },
        { symbol: "NASDAQ", price: "15842.31", percent: "+0.37" },
      ]);
    }
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 60000);
    return () => clearInterval(interval);
  }, []);

  // 🔹 Animation
  const startAnimation = () => {
    animationRef.current = Animated.loop(
      Animated.timing(translateX, {
        toValue: -screenWidth * 4,
        duration: 25000,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );
    animationRef.current.start();
  };

  useEffect(() => {
    if (tickers.length > 0) {
      translateX.setValue(screenWidth);
      setTimeout(() => startAnimation(), 500);
    }
  }, [tickers]);

  // 🔹 Pause/resume
  const handlePause = () => {
    if (animationRef.current && !isPaused.current) {
      animationRef.current.stop();
      isPaused.current = true;
    }
  };

  const handleResume = () => {
    if (isPaused.current) {
      startAnimation();
      isPaused.current = false;
    }
  };

  const renderTickerText = () =>
    tickers
      .map((t) => {
        const isUp = parseFloat(t.change) >= 0;
        const sign = isUp ? "+" : "";
        return `${t.symbol} ${t.price} ${sign}${t.percent}%`;
      })
      .join("    •    ");

  if (!tickers.length) return null;

  return (
    <View style={styles.container}>
      <Animated.Text style={[styles.liveDot, { opacity: blinkAnim }]}>●</Animated.Text>
      <Pressable onPressIn={handlePause} onPressOut={handleResume} style={{ flex: 1 }}>
        <Animated.Text
          style={[styles.tickerText, { transform: [{ translateX }] }]}
          numberOfLines={1}
        >
          {renderTickerText()}
        </Animated.Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    height: 32,
    overflow: "hidden",
    backgroundColor: "#0A0A0A",
    borderBottomColor: "#1F2937",
    borderBottomWidth: 1,
    flexDirection: "row",
    alignItems: "center",
  },
  liveDot: {
    color: "#00E396",
    fontSize: 16,
    marginHorizontal: 10,
  },
  tickerText: {
    color: "#E5E7EB",
    fontSize: 13,
    fontWeight: "600",
    letterSpacing: 0.5,
    paddingHorizontal: 25,
  },
});
