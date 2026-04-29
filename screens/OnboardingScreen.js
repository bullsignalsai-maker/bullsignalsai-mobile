import React from "react";
import {
  View,
  Text,
  Image,
  StyleSheet,
  Dimensions,
  TouchableOpacity,
} from "react-native";
import AppIntroSlider from "react-native-app-intro-slider";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useNavigation } from "@react-navigation/native";

const { width } = Dimensions.get("window");

const slides = [
  {
    key: "1",
    title: "AI-Powered Market Insights",
    text: "Analyze millions of signals — from tweets to trends — and catch moves before the crowd.",
    image: require("../assets/onboard1.png"),
  },
  {
    key: "2",
    title: "Real-Time Market Edge",
    text: "Live prices, sentiment analysis, and AI confidence indicators — all in one app.",
    image: require("../assets/onboard2.png"),
  },
  {
    key: "3",
    title: "Stay Ahead of Every Move",
    text: "Build your watchlist, receive alerts, and act with confidence — powered by AlphaWise.",
    image: require("../assets/onboard3.png"),
  },
];

export default function OnboardingScreen() {
  const navigation = useNavigation(); // ✅ Ensures navigation object is always available

  const completeOnboarding = async () => {
    try {
      await AsyncStorage.setItem("onboarded", "true");
      navigation.replace("Login"); // works now
    } catch (err) {
      console.error("Error saving onboarding status:", err);
    }
  };

  const renderItem = ({ item }) => (
    <View style={styles.slide}>
      <View style={styles.header}>
        <Image
          source={require("../assets/logo.png")}
          style={styles.logo}
          resizeMode="contain"
        />
        <Text style={styles.appName}>AlphaWise</Text>
      </View>

      <Image source={item.image} style={styles.image} resizeMode="contain" />
      <Text style={styles.title}>{item.title}</Text>
      <Text style={styles.text}>{item.text}</Text>
    </View>
  );

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
  slide: {
    flex: 1,
    backgroundColor: "#000",
    justifyContent: "flex-start",
    alignItems: "center",
    paddingTop: 60,
    paddingHorizontal: 24,
  },
  header: {
    alignItems: "center",
    marginBottom: 30,
  },
  logo: {
    width: 60,
    height: 60,
    marginBottom: 8,
  },
  appName: {
    color: "#00E396",
    fontSize: 22,
    fontWeight: "700",
  },
  image: {
    width: width * 0.7,
    height: width * 0.7,
    marginBottom: 40,
  },
  title: {
    color: "#FFF",
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
    backgroundColor: "#00E396",
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    minWidth: 120,
  },
  buttonText: {
    color: "#000",
    fontWeight: "700",
    fontSize: 15,
  },
  skipButton: {
    backgroundColor: "transparent",
    borderColor: "#444",
    borderWidth: 1,
  },
  skipText: {
    color: "#9CA3AF",
    fontWeight: "600",
    fontSize: 15,
  },
  dot: {
    backgroundColor: "#333",
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  activeDot: {
    backgroundColor: "#00E396",
    width: 24,
    height: 8,
    borderRadius: 4,
  },
});
