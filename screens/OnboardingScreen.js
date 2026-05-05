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

const GOLD = "#F5C542";
const SOFT_GOLD = "#D4AF37";
const DARK_BG = "#020807";

const slides = [
  {
    key: "1",
    premiumIntro: true,
  },
  {
    key: "2",
    title: "AI-Powered Market Insights",
    text: "Analyze millions of signals — from prices to patterns — and catch moves before the crowd.",
    image: require("../assets/onboard1.png"),
  },
  {
    key: "3",
    title: "Stay Ahead of Every Move",
    text: "Build your watchlist, receive alerts, and act with confidence — powered by Alphaclara.",
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
      console.error("Error saving onboarding status:", err);
    }
  };

  const renderBrandLogo = () => (
    <View style={styles.brandRow}>
      <Text style={styles.alphaText}>Alpha</Text>
      <Text style={styles.claraText}>clara</Text>
    </View>
  );

  const renderPremiumFirstSlide = () => {
    const glowScale = glowAnim.interpolate({
      inputRange: [0, 1],
      outputRange: [1, 1.12],
    });

    const glowOpacity = glowAnim.interpolate({
      inputRange: [0, 1],
      outputRange: [0.18, 0.5],
    });

    return (
      <View style={styles.firstSlide}>
        <View style={styles.heroArea}>
          <Animated.View
            style={[
              styles.goldGlow,
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
          <Animated.Text
            style={[
              styles.clarityText,
              {
                opacity: clarityOpacity,
              },
            ]}
          >
            Alpha Clarity
          </Animated.Text>

          <Animated.View
            style={[
              styles.brandLogoWrapper,
              {
                opacity: brandOpacity,
              },
            ]}
          >
            {renderBrandLogo()}
          </Animated.View>
        </View>

        <Animated.Text
          style={[
            styles.tagline,
            {
              opacity: taglineOpacity,
            },
          ]}
        >
          See the signal before the crowd.
        </Animated.Text>

        <Animated.Text
          style={[
            styles.welcomeText,
            {
              opacity: welcomeOpacity,
            },
          ]}
        >
          Welcome to Alphaclara — your AI-powered market companion for clearer
          insights, smarter signals, and confident decisions.
        </Animated.Text>
      </View>
    );
  };

  const renderNormalSlide = ({ item }) => (
    <View style={styles.slide}>
      <View style={styles.smallHeader}>
        <Image
          source={require("../assets/icon.png")}
          style={styles.smallLogo}
          resizeMode="contain"
        />

        <View style={styles.smallBrandRow}>
          <Text style={styles.smallAlphaText}>Alpha</Text>
          <Text style={styles.smallClaraText}>clara</Text>
        </View>
      </View>

      <Image source={item.image} style={styles.image} resizeMode="contain" />
      <Text style={styles.title}>{item.title}</Text>
      <Text style={styles.text}>{item.text}</Text>
    </View>
  );

  const renderItem = ({ item }) => {
    if (item.premiumIntro) {
      return renderPremiumFirstSlide();
    }

    return renderNormalSlide({ item });
  };

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
  },

  heroArea: {
    width: width * 0.72,
    height: width * 0.72,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },

  goldGlow: {
    position: "absolute",
    width: width * 0.56,
    height: width * 0.56,
    borderRadius: width,
    backgroundColor: GOLD,
  },

  alphaIcon: {
    width: width * 0.58,
    height: width * 0.58,
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
    color: GOLD,
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
    color: GOLD,
    fontSize: 40,
    fontWeight: "900",
    letterSpacing: 1,
  },

  claraText: {
    color: SOFT_GOLD,
    fontSize: 30,
    fontWeight: "700",
    letterSpacing: 0.3,
  },

  tagline: {
    color: "#FFFFFF",
    fontSize: 19,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: 14,
  },

  welcomeText: {
    color: "#A7B7B2",
    fontSize: 16,
    textAlign: "center",
    lineHeight: 24,
    paddingHorizontal: 4,
  },

  slide: {
    flex: 1,
    backgroundColor: DARK_BG,
    justifyContent: "flex-start",
    alignItems: "center",
    paddingTop: 60,
    paddingHorizontal: 24,
  },

  smallHeader: {
    alignItems: "center",
    marginBottom: 30,
  },

  smallLogo: {
    width: 58,
    height: 58,
    marginBottom: 8,
  },

  smallBrandRow: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "center",
  },

  smallAlphaText: {
    color: GOLD,
    fontSize: 22,
    fontWeight: "900",
    letterSpacing: 0.5,
  },

  smallClaraText: {
    color: SOFT_GOLD,
    fontSize: 17,
    fontWeight: "700",
    letterSpacing: 0.2,
  },

  image: {
    width: width * 0.7,
    height: width * 0.7,
    marginBottom: 40,
  },

  title: {
    color: "#FFFFFF",
    fontSize: 26,
    fontWeight: "800",
    textAlign: "center",
    marginBottom: 12,
  },

  text: {
    color: "#9CA3AF",
    fontSize: 16,
    textAlign: "center",
    lineHeight: 22,
    paddingHorizontal: 10,
  },

  button: {
    backgroundColor: GOLD,
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
    borderColor: "#3A4A45",
    borderWidth: 1,
  },

  skipText: {
    color: "#A7B7B2",
    fontWeight: "600",
    fontSize: 15,
  },

  dot: {
    backgroundColor: "#243530",
    width: 8,
    height: 8,
    borderRadius: 4,
  },

  activeDot: {
    backgroundColor: GOLD,
    width: 24,
    height: 8,
    borderRadius: 4,
  },
});