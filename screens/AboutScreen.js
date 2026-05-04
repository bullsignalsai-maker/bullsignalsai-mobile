import React from "react";
import { View, Text, ScrollView, StyleSheet, Image } from "react-native";
import CustomHeader from "../components/CustomHeader";

export default function AboutScreen() {
  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Image
          source={require("../assets/logo.png")}
          style={styles.logo}
          resizeMode="contain"
        />
        <Text style={styles.title}>About Alphaclara</Text>
      </View>

      <Text style={styles.text}>
        Alphaclara is an AI-powered market-insight application designed to
        help users monitor stocks, analyze sentiment, and stay informed about
        market trends in real time. The app aggregates data from multiple
        public and trusted financial sources, social sentiment signals, and
        algorithmic analysis to generate simplified “Buy,” “Sell,” and “Hold”
        insights.
      </Text>

      <Text style={styles.subTitle}>Our Mission</Text>
      <Text style={styles.text}>
        To democratize financial intelligence by making AI-driven market
        analytics accessible to everyone—from retail traders to experienced
        investors—through clean design, clarity, and transparency.
      </Text>

      <Text style={styles.subTitle}>How It Works</Text>
      <Text style={styles.text}>
        • Aggregates real-time market data, sentiment feeds, and analyst trends.{"\n"}
        • Uses natural-language processing to understand market mood and context.{"\n"}
        • Presents actionable signals and confidence indicators for selected tickers.{"\n"}
        • Offers personalized watchlists and notification alerts.
      </Text>

      <Text style={styles.subTitle}>Disclaimer</Text>
      <Text style={styles.text}>
        Alphaclara does not provide financial, investment, or trading
        advice. All information displayed is generated using algorithmic
        analysis and is intended for educational and informational purposes
        only. You should always conduct your own research or consult a licensed
        financial advisor before making investment decisions.
      </Text>

      <Text style={styles.footer}>
        © 2025 Alphaclara. All rights reserved.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000", padding: 20 },
  header: { alignItems: "center", marginBottom: 20 },
  logo: { width: 70, height: 70, marginBottom: 10 },
  title: { color: "#00E396", fontSize: 24, fontWeight: "700" },
  subTitle: {
    color: "#00E396",
    fontSize: 18,
    fontWeight: "600",
    marginTop: 20,
    marginBottom: 6,
  },
  text: { color: "#CCC", fontSize: 15, lineHeight: 22 },
  footer: {
    color: "#666",
    fontSize: 12,
    textAlign: "center",
    marginTop: 40,
  },
});
