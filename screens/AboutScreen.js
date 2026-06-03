import React from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Image,
  TouchableOpacity,
} from "react-native";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import Svg, { Path, Circle } from "react-native-svg";
import { BRAND } from "../constants/theme";
import { TYPO } from "../constants/typography";

export default function AboutScreen({ navigation }) {
  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.wrapper}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.heroCard}>
        <LinearGradient
          colors={["#07111F", "#07111F", "rgba(0,227,150,0.36)"]}
          start={{ x: 0, y: 0.2 }}
          end={{ x: 1, y: 0.8 }}
          style={StyleSheet.absoluteFill}
        />

        <Svg style={styles.heroMesh} viewBox="0 0 240 170">
          <Path
            d="M0 125 C60 82 105 140 165 80 C195 50 215 52 240 30"
            stroke="rgba(80,255,190,0.18)"
            strokeWidth="1"
            fill="none"
          />
          <Path
            d="M0 142 C70 95 115 154 178 95 C205 70 222 74 240 58"
            stroke="rgba(80,255,190,0.12)"
            strokeWidth="1"
            fill="none"
          />
          <Path
            d="M0 158 C80 110 125 166 190 112 C215 90 230 92 240 78"
            stroke="rgba(80,255,190,0.09)"
            strokeWidth="1"
            fill="none"
          />
          <Circle cx="174" cy="34" r="2" fill="rgba(80,255,190,0.50)" />
          <Circle cx="202" cy="55" r="2" fill="rgba(80,255,190,0.38)" />
        </Svg>

        <Image
          source={require("../assets/alpha-transparent.png")}
          style={styles.heroWatermark}
          resizeMode="contain"
        />

        <View style={styles.heroTop}>
          <View style={styles.logoWrap}>
            <Image
              source={require("../assets/alpha-transparent.png")}
              style={styles.logo}
              resizeMode="contain"
            />
          </View>

          <View style={{ flex: 1 }}>
            <Text style={styles.titleBrand}>Alphaclara</Text>
            <View style={styles.badge}>
              <Ionicons
                name="sparkles-outline"
                size={13}
                color={BRAND.accent}
              />
              <Text style={styles.badgeText}>AI MARKET INTELLIGENCE</Text>
            </View>
          </View>
        </View>

        <Text style={styles.heroText}>
          AI-powered market intelligence designed to simplify complex financial
          data into clear, actionable insights.
        </Text>
      </View>

      <View style={styles.horizontalRow}>
        <View style={styles.miniInfoCard}>
          <View style={styles.miniHeader}>
            <View style={styles.smallIconBubble}>
              <MaterialCommunityIcons
                name="target"
                size={18}
                color={BRAND.accent}
              />
            </View>

            <Text style={styles.miniTitle}>What We Do</Text>
          </View>

          <Text style={styles.miniText}>
            AI-powered signals, watchlists, and market intelligence.
          </Text>
        </View>

        <View style={styles.miniInfoCard}>
          <View style={styles.miniHeader}>
            <View style={styles.smallIconBubble}>
              <MaterialCommunityIcons
                name="flag-variant-outline"
                size={18}
                color={BRAND.accent}
              />
            </View>

            <Text style={styles.miniTitle}>Mission</Text>
          </View>

          <Text style={styles.miniText}>
            Simplify financial intelligence for everyone.
          </Text>
        </View>
      </View>

      <View style={styles.coreCard}>
        <Text style={styles.sectionTitle}>Core Intelligence</Text>

        <View style={styles.grid}>
          <FeatureCard
            icon="chart-timeline-variant-shimmer"
            title="AI Signals"
            text="AI-generated BUY, HOLD, SELL signals with confidence levels."
          />
          <FeatureCard
            icon="bookmark-outline"
            title="Smart Watchlists"
            text="Track favorite assets with alerts and smart updates."
          />
          <FeatureCard
            icon="target"
            title="Market Pulse"
            text="Real-time market trends, volatility, risk, and movement analysis."
          />
          <FeatureCard
            icon="chat-processing-outline"
            title="Clara Assistant"
            text="Your AI assistant that explains market context clearly."
          />
        </View>
      </View>

      <View style={styles.disclaimerCard}>
        <View style={styles.dangerBubble}>
          <Ionicons name="shield-outline" size={30} color="#FF5A5F" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.disclaimerTitle}>Disclaimer</Text>
          <Text style={styles.text}>
            Alphaclara does not provide financial, investment, or trading
            advice. All information is for educational and informational
            purposes only.
          </Text>
        </View>
      </View>

      <View style={styles.footerWrap}>
        <Text style={styles.powered}>
          Powered by <Text style={styles.footerBrand}>Alphaclara</Text>
        </Text>

        <Text style={styles.footerMeta}>Market Intelligence · v1.0.1</Text>

        <Text style={styles.disclaimer}>
          Information provided is for educational and informational purposes
          only and is not financial, investment, trading, or tax advice.
        </Text>
      </View>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}
function FeatureCard({ icon, title, text }) {
  return (
    <View style={styles.featureCard}>
      <View style={styles.featureHeader}>
        <View style={styles.featureIcon}>
          <MaterialCommunityIcons name={icon} size={20} color={BRAND.accent} />
        </View>

        <Text style={styles.featureTitle}>{title}</Text>
      </View>

      <Text style={styles.featureText}>{text}</Text>
    </View>
  );
}
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BRAND.bg,
  },

  wrapper: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 24,
  },

  heroCard: {
    position: "relative",
    overflow: "hidden",
    borderRadius: 24,
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 14,
    minHeight: 195,
    borderWidth: 1,
    borderColor: "rgba(80,255,190,0.20)",
    marginBottom: 10,
    shadowColor: BRAND.accent,
    shadowOpacity: 0.12,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 7,
  },

  heroMesh: {
    position: "absolute",
    right: -10,
    bottom: -18,
    width: 230,
    height: 150,
    opacity: 0.85,
  },

  heroWatermark: {
    position: "absolute",
    right: 18,
    top: 48,
    width: 118,
    height: 118,
    opacity: 0.15,
  },

  heroTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },

  logoWrap: {
    width: 68,
    height: 68,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    alignItems: "center",
    justifyContent: "center",
  },

  logo: {
    width: 50,
    height: 50,
  },

  titleBrand: {
    color: BRAND.text,
    fontSize: 27,
    fontFamily: TYPO.fontFamily.brand,
    letterSpacing: -0.9,
  },

  badge: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginTop: 7,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: "rgba(0,227,150,0.13)",
    borderWidth: 1,
    borderColor: "rgba(0,227,150,0.18)",
  },

  badgeText: {
    color: BRAND.accent,
    fontSize: 9.8,
    fontFamily: TYPO.fontFamily.bold,
    letterSpacing: 0.4,
  },

  heroText: {
    color: BRAND.sub,
    fontSize: 13,
    lineHeight: 20,
    marginTop: 18,
    paddingRight: 86,
    fontFamily: TYPO.fontFamily.medium,
  },

  horizontalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 10,
  },

  miniInfoCard: {
    width: "48.3%",
    backgroundColor: "rgba(15,23,42,0.90)",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
    paddingHorizontal: 12,
    paddingVertical: 12,
  },

  miniHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
  },

  smallIconBubble: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: "rgba(0,227,150,0.11)",
    alignItems: "center",
    justifyContent: "center",
  },

  miniTitle: {
    flex: 1,
    color: BRAND.text,
    fontSize: 13.2,
    fontFamily: TYPO.fontFamily.extrabold,
    letterSpacing: -0.15,
  },

  miniText: {
    color: BRAND.sub,
    fontSize: 11.8,
    lineHeight: 17,
    fontFamily: TYPO.fontFamily.regular,
  },
  coreCard: {
    backgroundColor: "rgba(15,23,42,0.90)",
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.07)",
    paddingHorizontal: 14,
    paddingTop: 14,
    paddingBottom: 2,
    marginBottom: 10,
  },

  sectionTitle: {
    color: BRAND.text,
    fontSize: 16,
    marginBottom: 12,
    fontFamily: TYPO.fontFamily.extrabold,
  },

  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },
  featureCard: {
    width: "48.5%",
    backgroundColor: "rgba(255,255,255,0.035)",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
    paddingHorizontal: 12,
    paddingVertical: 12,
    marginBottom: 9,
  },

  featureHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
  },

  featureIcon: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: "rgba(0,227,150,0.11)",
    alignItems: "center",
    justifyContent: "center",
  },

  featureTitle: {
    flex: 1,
    color: BRAND.text,
    fontSize: 13.2,
    fontFamily: TYPO.fontFamily.extrabold,
    letterSpacing: -0.15,
  },

  featureText: {
    color: BRAND.sub,
    fontSize: 11.8,
    lineHeight: 17,
    fontFamily: TYPO.fontFamily.regular,
  },

  disclaimerCard: {
    flexDirection: "row",
    gap: 12,
    backgroundColor: "rgba(239,68,68,0.06)",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(239,68,68,0.20)",
    paddingHorizontal: 14,
    paddingVertical: 14,
    marginBottom: 10,
  },

  dangerBubble: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: "rgba(239,68,68,0.12)",
    alignItems: "center",
    justifyContent: "center",
  },

  disclaimerTitle: {
    color: "#FF7075",
    fontSize: 15,
    marginBottom: 4,
    fontFamily: TYPO.fontFamily.extrabold,
  },

  text: {
    color: BRAND.sub,
    fontSize: 12.8,
    lineHeight: 19,
    fontFamily: TYPO.fontFamily.regular,
  },

  footerCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "rgba(15,23,42,0.76)",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.07)",
    paddingHorizontal: 14,
    paddingVertical: 13,
  },

  footerWrap: {
    marginTop: 14,
    marginBottom: 8,
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderRadius: 22,
    backgroundColor: "rgba(15,23,42,0.72)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.07)",
    alignItems: "center",
  },

  powered: {
    color: BRAND.sub,
    fontSize: 12,
    marginBottom: 6,
    fontFamily: TYPO.fontFamily.medium,
  },

  footerBrand: {
    color: BRAND.text,
    fontSize: 13.5,
    fontFamily: TYPO.fontFamily.brand,
    letterSpacing: -0.45,
  },

  footerMeta: {
    color: BRAND.muted,
    fontSize: 11,
    marginTop: 5,
    marginBottom: 10,
    fontFamily: TYPO.fontFamily.medium,
  },

  disclaimer: {
    color: BRAND.muted,
    fontSize: 10.5,
    lineHeight: 16,
    textAlign: "center",
    fontFamily: TYPO.fontFamily.regular,
  },
});
