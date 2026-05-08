// screens/OnboardingScreen.js
import React, { useEffect, useRef } from "react";
import {
  View,
  Text,
  Image,
  StyleSheet,
  Dimensions,
  Animated,
  StatusBar,
} from "react-native";
import AppIntroSlider from "react-native-app-intro-slider";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useNavigation } from "@react-navigation/native";
import { SafeAreaView } from "react-native-safe-area-context";

import { BRAND } from "../constants/theme";

const { width } = Dimensions.get("window");

const slides = [
  { key: "1", premiumIntro: true },
  {
    key: "2",
    title: "AI-Powered Market Insights",
    text: "Analyze price action, technical patterns, momentum, and market context to support your own analysis.",
  },
  {
    key: "3",
    title: "Stay Informed",
    text: "Track symbols, set price alerts, and explore contextual market information designed for clarity and learning.",
  },
];

export default function OnboardingScreen() {
  const navigation = useNavigation();

  // Animations
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.88)).current;
  const floatAnim = useRef(new Animated.Value(0)).current;
  const glowAnim = useRef(new Animated.Value(0)).current;

  const clarityOpacity = useRef(new Animated.Value(0)).current;
  const brandOpacity = useRef(new Animated.Value(0)).current;
  const taglineOpacity = useRef(new Animated.Value(0)).current;
  const subtitleOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Logo entrance
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 1000,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 6,
        tension: 40,
        useNativeDriver: true,
      }),
    ]).start();

    // Floating + Glow
    Animated.loop(
      Animated.sequence([
        Animated.timing(floatAnim, {
          toValue: -12,
          duration: 2200,
          useNativeDriver: true,
        }),
        Animated.timing(floatAnim, {
          toValue: 0,
          duration: 2200,
          useNativeDriver: true,
        }),
      ]),
    ).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, {
          toValue: 1,
          duration: 1800,
          useNativeDriver: true,
        }),
        Animated.timing(glowAnim, {
          toValue: 0,
          duration: 1800,
          useNativeDriver: true,
        }),
      ]),
    ).start();

    // Staggered Text Reveal: Alpha Clarity → Alphaclara
    Animated.sequence([
      Animated.delay(600),
      Animated.timing(clarityOpacity, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.delay(900),
      Animated.parallel([
        Animated.timing(clarityOpacity, {
          toValue: 0,
          duration: 600,
          useNativeDriver: true,
        }),
        Animated.timing(brandOpacity, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
      ]),
      Animated.delay(300),
      Animated.timing(taglineOpacity, {
        toValue: 1,
        duration: 700,
        useNativeDriver: true,
      }),
      Animated.delay(200),
      Animated.timing(subtitleOpacity, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const completeOnboarding = async () => {
    try {
      await AsyncStorage.setItem("onboarded", "true");
      navigation.replace("Login");
    } catch (err) {
      console.warn("Onboarding save error:", err);
    }
  };

  const renderBrandLogo = () => (
    <Text style={styles.brandText}>Alphaclara</Text>
  );

  const renderPremiumFirstSlide = () => {
    const glowScale = glowAnim.interpolate({
      inputRange: [0, 1],
      outputRange: [0.95, 1.18],
    });
    const glowOpacity = glowAnim.interpolate({
      inputRange: [0, 1],
      outputRange: [0.15, 0.35],
    });

    return (
      <View style={styles.firstSlide}>
        <View style={styles.heroContainer}>
          <Animated.View
            style={[
              styles.glowBase,
              { opacity: glowOpacity, transform: [{ scale: glowScale }] },
            ]}
          />
          <Animated.View
            style={[
              styles.glowInner,
              {
                opacity: glowOpacity * 0.6,
                transform: [{ scale: glowScale * 0.75 }],
              },
            ]}
          />

          <Animated.Image
            source={require("../assets/alpha-transparent.png")}
            style={[
              styles.alphaIcon,
              {
                opacity: fadeAnim,
                transform: [{ scale: scaleAnim }, { translateY: floatAnim }],
              },
            ]}
            resizeMode="contain"
          />
        </View>

        <View style={styles.contentArea}>
          {/* First: Alpha Clarity */}
          <Animated.Text
            style={[styles.clarityText, { opacity: clarityOpacity }]}
          >
            Alpha Clarity
          </Animated.Text>

          {/* Then: Alphaclara */}
          <Animated.View style={{ opacity: brandOpacity }}>
            {renderBrandLogo()}
          </Animated.View>

          <Animated.Text style={[styles.tagline, { opacity: taglineOpacity }]}>
            Clarity for every market move.
          </Animated.Text>

          <Animated.Text
            style={[styles.subtitle, { opacity: subtitleOpacity }]}
          >
            AI-assisted tools designed to help you better understand market
            trends, risk, and opportunities.
          </Animated.Text>

          <Text style={styles.disclaimer}>
            For informational and educational purposes only. Not financial
            advice.
          </Text>
        </View>
      </View>
    );
  };

  const renderNormalSlide = ({ item }) => (
    <View style={styles.slide}>
      <View style={styles.textContent}>
        <Text style={styles.title}>{item.title}</Text>
        <Text style={styles.text}>{item.text}</Text>
      </View>
      <Text style={styles.disclaimer}>
        For informational and educational purposes only. Not financial advice.
      </Text>
    </View>
  );

  const renderItem = ({ item }) =>
    item.premiumIntro ? renderPremiumFirstSlide() : renderNormalSlide({ item });

  const renderNextButton = () => (
    <View style={styles.primaryButton}>
      <Text style={styles.buttonText}>Next</Text>
    </View>
  );

  const renderSkipButton = () => (
    <View style={styles.skipButton}>
      <Text style={styles.skipText}>Skip</Text>
    </View>
  );

  const renderDoneButton = () => (
    <View style={styles.primaryButton}>
      <Text style={styles.buttonText}>Get Started</Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor={BRAND.bg} />
      <AppIntroSlider
        data={slides}
        renderItem={renderItem}
        keyExtractor={(item) => item.key}
        onDone={completeOnboarding}
        onSkip={completeOnboarding}
        showSkipButton
        renderNextButton={renderNextButton}
        renderSkipButton={renderSkipButton}
        renderDoneButton={renderDoneButton}
        dotStyle={styles.dot}
        activeDotStyle={styles.activeDot}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: BRAND.bg },
  firstSlide: {
    flex: 1,
    backgroundColor: BRAND.bg,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
  },
  heroContainer: {
    width: width * 0.78,
    height: width * 0.78,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 32,
  },
  glowBase: {
    position: "absolute",
    width: width * 0.68,
    height: width * 0.68,
    borderRadius: width,
    backgroundColor: "rgba(0, 227, 150, 0.18)",
    shadowColor: BRAND.accent,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 60,
  },
  glowInner: {
    position: "absolute",
    width: width * 0.52,
    height: width * 0.52,
    borderRadius: width,
    backgroundColor: "rgba(0, 227, 150, 0.25)",
  },
  alphaIcon: {
    width: width * 0.58,
    height: width * 0.58,
  },

  contentArea: { alignItems: "center", width: "100%" },

  clarityText: {
    color: BRAND.accent,
    fontSize: 36,
    fontWeight: "900",
    letterSpacing: 1.2,
    marginBottom: 8,
  },

  brandText: {
    color: BRAND.text,
    fontSize: 42,
    fontWeight: "900",
    letterSpacing: 1.4,
  },

  tagline: {
    color: BRAND.text,
    fontSize: 20,
    fontWeight: "700",
    textAlign: "center",
    marginTop: 12,
    marginBottom: 16,
    letterSpacing: 0.6,
  },
  subtitle: {
    color: BRAND.muted,
    fontSize: 15.5,
    lineHeight: 24,
    textAlign: "center",
    paddingHorizontal: 12,
    marginBottom: 24,
  },

  slide: {
    flex: 1,
    backgroundColor: BRAND.bg,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
    paddingBottom: 100,
  },
  textContent: { alignItems: "center" },
  title: {
    color: BRAND.text,
    fontSize: 28,
    fontWeight: "900",
    textAlign: "center",
    marginBottom: 16,
  },
  text: {
    color: BRAND.muted,
    fontSize: 16,
    lineHeight: 24,
    textAlign: "center",
    paddingHorizontal: 10,
  },

  disclaimer: {
    color: BRAND.muted,
    fontSize: 12.5,
    textAlign: "center",
    marginTop: 40,
    opacity: 0.75,
    lineHeight: 18,
  },

  primaryButton: {
    backgroundColor: BRAND.accent,
    paddingHorizontal: 42,
    paddingVertical: 14,
    borderRadius: 30,
    shadowColor: BRAND.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
  },
  buttonText: {
    color: BRAND.bg,
    fontWeight: "800",
    fontSize: 16,
    letterSpacing: 0.5,
  },
  skipButton: {
    paddingHorizontal: 24,
    paddingVertical: 14,
  },
  skipText: {
    color: BRAND.muted,
    fontWeight: "600",
    fontSize: 15.5,
  },

  dot: {
    backgroundColor: "#27272A",
    width: 8,
    height: 8,
    borderRadius: 4,
    marginHorizontal: 4,
  },
  activeDot: {
    backgroundColor: BRAND.accent,
    width: 28,
    height: 8,
    borderRadius: 4,
  },
});
