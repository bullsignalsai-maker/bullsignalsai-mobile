import React from "react";
import { View, Text, ScrollView, StyleSheet, Image } from "react-native";
import { BRAND } from "../constants/theme";
import { TYPO } from "../constants/typography";
export default function AboutScreen() {
  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.wrapper}
      showsVerticalScrollIndicator={false}
    >
      {/* HEADER */}
      <View style={styles.header}>
        <View style={styles.logoWrap}>
          <Image
            source={require("../assets/alpha-transparent.png")}
            style={styles.logo}
            resizeMode="contain"
          />
        </View>

        <Text style={styles.title}>Alphaclara</Text>
        <Text style={styles.tagline}>AI-Powered Market Intelligence</Text>
      </View>

      {/* CARD CONTENT */}
      <View style={styles.card}>
        <Text style={styles.text}>
          Alphaclara is an AI-powered market intelligence platform designed to
          help users understand market trends, monitor watchlists and
          portfolios, receive timely alerts, and interpret market signals with
          clarity. The app combines market data, crypto movement, portfolio
          context, and AI-generated insights into a simplified, human-readable
          experience.
        </Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.subTitle}>Our Mission</Text>
        <Text style={styles.text}>
          To democratize financial intelligence by transforming complex market
          data into clear, actionable insights—accessible to everyone, from
          beginners to experienced investors.
        </Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.subTitle}>How It Works</Text>

        <Text style={styles.bullet}>
          • Aggregates market, watchlist, portfolio, and crypto movement data
        </Text>
        <Text style={styles.bullet}>
          • Interprets patterns, trends, volatility, and risk using AI models
        </Text>
        <Text style={styles.bullet}>
          • Generates AI signals with confidence levels
        </Text>
        <Text style={styles.bullet}>
          • Provides personalized watchlists, portfolio insights, and smart
          alerts
        </Text>
        <Text style={styles.bullet}>
          • Includes Astra, an AI assistant that explains market context in
          simple language
        </Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.subTitle}>Disclaimer</Text>
        <Text style={styles.text}>
          Alphaclara does not provide financial, investment, or trading advice.
          All information is generated through algorithmic analysis and is
          intended solely for educational and informational purposes. Users
          should conduct their own research or consult a licensed financial
          advisor before making investment decisions.
        </Text>
      </View>

      {/* FOOTER */}
      <View style={styles.footerWrap}>
        <Text style={styles.powered}>
          Powered by{" "}
          <Text style={{ color: BRAND.text, fontFamily: TYPO.fontFamily.bold }}>
            Alphaclara
          </Text>
        </Text>

        <Text style={styles.footer}>
          © 2026 Alphaclara. All rights reserved.
        </Text>
      </View>

      <View style={{ height: 60 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BRAND.bg,
  },

  wrapper: {
    paddingHorizontal: 18,
    paddingTop: 20,
    paddingBottom: 40,
  },

  header: {
    alignItems: "center",
    marginBottom: 22,
  },

  title: {
    color: BRAND.text,
    fontSize: 28,
    fontFamily: TYPO.fontFamily.extrabold,
    letterSpacing: -0.4,
  },

  tagline: {
    color: BRAND.sub,
    fontSize: 13,
    marginTop: 4,
    fontFamily: TYPO.fontFamily.medium,
  },
  logoWrap: {
    width: 78,
    height: 78,
    borderRadius: 24,
    backgroundColor: "rgba(17,24,39,0.82)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },

  logo: {
    width: 56,
    height: 56,
  },

  card: {
    backgroundColor: "rgba(17,24,39,0.82)",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
    padding: 16,
    marginBottom: 12,
  },

  subTitle: {
    color: BRAND.text,
    fontSize: 16,
    fontFamily: TYPO.fontFamily.extrabold,
    marginBottom: 8,
  },

  text: {
    color: BRAND.sub,
    fontSize: 14,
    lineHeight: 21,
    fontFamily: TYPO.fontFamily.regular,
  },

  bullet: {
    color: BRAND.sub,
    fontSize: 14,
    marginBottom: 6,
    lineHeight: 21,
    fontFamily: TYPO.fontFamily.regular,
  },
  footerWrap: {
    alignItems: "center",
    marginTop: 20,
  },

  powered: {
    color: BRAND.sub,
    fontSize: 12,
    marginBottom: 8,
    fontFamily: TYPO.fontFamily.medium,
  },

  footer: {
    color: BRAND.muted,
    fontSize: 11,
    fontFamily: TYPO.fontFamily.regular,
  },
});
