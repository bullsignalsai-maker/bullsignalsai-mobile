import React, { useEffect, useRef } from "react";
import {
  View,
  Text,
  Image,
  StyleSheet,
  Dimensions,
  Animated,
} from "react-native";
import AppIntroSlider from "react-native-app-intro-slider";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useNavigation } from "@react-navigation/native";

const { width } = Dimensions.get("window");

const BRAND_GREEN = "#00E396";
const BRAND_GREEN_SOFT = "rgba(0, 227, 150, 0.12)";
const DARK_BG = "#000000";
const MUTED = "#9CA3AF";
const TEXT = "#FFFFFF";

const slides = [
  { key: "1", premiumIntro: true },
  {
    key: "2",
    title: "AI-Powered Market Insights",
    text: "Understand price action, patterns, momentum, and market context in one clear view.",
    image: require("../assets/onboard1.png"),
  },
  {
    key: "3",
    title: "Stay Informed",
    text: "Track your watchlist, set price alerts, and follow AI-powered market context with clarity.",
    image: require("../assets/onboard3.png"),
  },
];

export default function OnboardingScreen() {
  const navigation = useNavigation();

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.85)).current;
  const floatAnim = useRef(new Animated.Value(0)).current;
  const glowAnim = useRef(new Animated.Value(0)).current;

  const clarityOpacity = useRef(new Animated.Value(0)).current;
  const brandOpacity = useRef(new Animated.Value(0)).current;
  const taglineOpacity = useRef(new Animated.Value(0)).current;
  const welcomeOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 900,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 5,
        tension: 45,
        useNativeDriver: true,
      }),
    ]).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(floatAnim, {
          toValue: -8,
          duration: 1800,
          useNativeDriver: true,
        }),
        Animated.timing(floatAnim, {
          toValue: 0,
          duration: 1800,
          useNativeDriver: true,
        }),
      ])
    ).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, {
          toValue: 1,
          duration: 1600,
          useNativeDriver: true,
        }),
        Animated.timing(glowAnim, {
          toValue: 0,
          duration: 1600,
          useNativeDriver: true,
        }),
      ])
    ).start();

    Animated.sequence([
      Animated.delay(650),
      Animated.timing(clarityOpacity, {
        toValue: 1,
        duration: 700,
        useNativeDriver: true,
      }),
      Animated.delay(1100),
      Animated.parallel([
        Animated.timing(clarityOpacity, {
          toValue: 0,
          duration: 500,
          useNativeDriver: true,
        }),
        Animated.timing(brandOpacity, {
          toValue: 1,
          duration: 700,
          useNativeDriver: true,
        }),
      ]),
      Animated.timing(taglineOpacity, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.timing(welcomeOpacity, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const completeOnboarding = async () => {
    try {
      await AsyncStorage.setItem("onboarded", "true");
      navigation.replace("Login");
    } catch (err) {
      console.warn("Error saving onboarding status:", err);
    }
  };

  const renderBrandLogo = (large = true) => (
    <View style={styles.brandRow}>
      <Text style={large ? styles.alphaText : styles.smallAlphaText}>
        Alpha
      </Text>
      <Text style={large ? styles.claraText : styles.smallClaraText}>
        clara
      </Text>
    </View>
  );

  const renderPremiumFirstSlide = () => {
    const glowScale = glowAnim.interpolate({
      inputRange: [0, 1],
      outputRange: [1, 1.12],
    });

    const glowOpacity = glowAnim.interpolate({
      inputRange: [0, 1],
      outputRange: [0.1, 0.22],
    });

    return (
      <View style={styles.firstSlide}>
        <View style={styles.heroArea}>
          <Animated.View
            style={[
              styles.greenGlow,
              {
                opacity: glowOpacity,
                transform: [{ scale: glowScale }],
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

        <View style={styles.brandRevealArea}>
          <Animated.Text style={[styles.clarityText, { opacity: clarityOpacity }]}>
            Alpha Clarity
          </Animated.Text>

          <Animated.View style={[styles.brandLogoWrapper, { opacity: brandOpacity }]}>
            {renderBrandLogo(true)}
          </Animated.View>
        </View>

        <Animated.Text style={[styles.tagline, { opacity: taglineOpacity }]}>
          Clarity for every market move.
        </Animated.Text>

        <Animated.Text style={[styles.welcomeText, { opacity: welcomeOpacity }]}>
          Welcome to Alphaclara — AI-powered market intelligence designed to help
          you understand trends, risk, and opportunities with clarity.
        </Animated.Text>
      </View>
    );
  };

  const renderNormalSlide = ({ item }) => (
    <View style={styles.firstSlide}>

      <Image source={item.image} style={styles.image} resizeMode="contain" />

      <Text style={styles.title}>{item.title}</Text>
      <Text style={styles.text}>{item.text}</Text>

      {item.key === "3" && (
        <Text style={styles.disclaimerMini}>
          For informational and educational purposes only.
        </Text>
      )}
    </View>
  );

  const renderItem = ({ item }) =>
    item.premiumIntro ? renderPremiumFirstSlide() : renderNormalSlide({ item });

  const renderNextButton = () => (
    <View style={styles.button}>
      <Text style={styles.buttonText}>Next</Text>
    </View>
  );

  const renderSkipButton = () => (
    <View style={[styles.button, styles.skipButton]}>
      <Text style={styles.skipText}>Skip</Text>
    </View>
  );

  const renderDoneButton = () => (
    <View style={styles.button}>
      <Text style={styles.buttonText}>Get Started</Text>
    </View>
  );

  return (
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
  );
}

const styles = StyleSheet.create({
  firstSlide: {
    flex: 1,
    backgroundColor: DARK_BG,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 26,
    paddingBottom: 36,
  },

  heroArea: {
    width: width * 0.72,
    height: width * 0.72,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },

  greenGlow: {
    position: "absolute",
    width: width * 0.48,
    height: width * 0.48,
    borderRadius: width,
    backgroundColor: BRAND_GREEN_SOFT,
  },

  alphaIcon: {
    width: width * 0.58,
    height: width * 0.58,
  },

  normalHeroArea: {
    alignItems: "center",
    marginBottom: 22,
  },

  softIconWrap: {
    width: 74,
    height: 74,
    borderRadius: 37,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: BRAND_GREEN_SOFT,
    borderWidth: 1,
    borderColor: "rgba(0, 227, 150, 0.24)",
    marginBottom: 8,
  },

  smallLogo: {
    width: 58,
    height: 58,
  },

  image: {
    width: width * 0.62,
    height: width * 0.62,
    marginBottom: 28,
  },

  brandRevealArea: {
    height: 58,
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },

  clarityText: {
    position: "absolute",
    color: BRAND_GREEN,
    fontSize: 36,
    fontWeight: "900",
    letterSpacing: 0.8,
    textAlign: "center",
  },

  brandLogoWrapper: {
    position: "absolute",
  },

  brandRow: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "center",
  },

  alphaText: {
    color: BRAND_GREEN,
    fontSize: 38,
    fontWeight: "900",
    letterSpacing: 1,
  },

  claraText: {
    color: TEXT,
    fontSize: 29,
    fontWeight: "700",
    letterSpacing: 0.3,
  },

  smallAlphaText: {
    color: BRAND_GREEN,
    fontSize: 22,
    fontWeight: "900",
    letterSpacing: 0.5,
  },

  smallClaraText: {
    color: TEXT,
    fontSize: 17,
    fontWeight: "700",
    letterSpacing: 0.2,
  },

  tagline: {
    color: TEXT,
    fontSize: 19,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: 14,
  },

  welcomeText: {
    color: MUTED,
    fontSize: 15,
    textAlign: "center",
    lineHeight: 23,
    paddingHorizontal: 4,
  },

  title: {
    color: TEXT,
    fontSize: 25,
    fontWeight: "900",
    textAlign: "center",
    marginBottom: 10,
  },

  text: {
    color: MUTED,
    fontSize: 15.5,
    textAlign: "center",
    lineHeight: 22,
    paddingHorizontal: 8,
  },

  disclaimerMini: {
    color: MUTED,
    fontSize: 11,
    marginTop: 18,
    textAlign: "center",
    opacity: 0.7,
  },

  button: {
    backgroundColor: BRAND_GREEN,
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    minWidth: 120,
  },

  buttonText: {
    color: "#04110E",
    fontWeight: "800",
    fontSize: 15,
  },

  skipButton: {
    backgroundColor: "transparent",
    borderColor: "#1F2937",
    borderWidth: 1,
  },

  skipText: {
    color: MUTED,
    fontWeight: "600",
    fontSize: 15,
  },

  dot: {
    backgroundColor: "#1F2937",
    width: 8,
    height: 8,
    borderRadius: 4,
  },

  activeDot: {
    backgroundColor: BRAND_GREEN,
    width: 24,
    height: 8,
    borderRadius: 4,
  },
});