// App.js (with Push Notification Integration + Notifications Screen)
import React, { useEffect, useState, useRef } from "react";
import { ActivityIndicator, View, Text } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { NavigationContainer } from "@react-navigation/native";
import { createStackNavigator } from "@react-navigation/stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Ionicons } from "@expo/vector-icons";
import * as Notifications from "expo-notifications";
// Screens
import HomeScreen from "./screens/HomeScreen";
import StockDetailScreen from "./screens/StockDetailScreen";
import WatchlistScreen from "./screens/WatchlistScreen";
import ProfileSettingsHub from "./screens/ProfileSettingsHub";
import AboutScreen from "./screens/AboutScreen";
import PrivacyPolicyScreen from "./screens/PrivacyPolicyScreen";
import OnboardingScreen from "./screens/OnboardingScreen";
import LoginScreen from "./screens/LoginScreen";
import SignupScreen from "./screens/SignupScreen";
import TermsOfUseScreen from "./screens/TermsOfUseScreen";
import MarketScreen from "./screens/MarketScreen";
import AlertScreen from "./screens/AlertScreen";
import NotificationsScreen from "./screens/NotificationsScreen";
import EditPositionScreen from "./screens/EditPositionScreen";
import PortfolioScreen from "./screens/PortfolioScreen";
import AddPositionScreen from "./screens/AddPositionScreen";
import FullPatternDetailScreen from "./screens/FullPatternDetailScreen";
import FullTechnicalDetailScreen from "./screens/FullTechnicalDetailScreen";
import MarketMoversScreen from "./screens/MarketMoversScreen";
import SignalDetailScreen from "./screens/SignalDetailScreen";
import { registerForPushNotifications } from "./services/pushNotificationService";
import { auth } from "./firebaseConfig";
import FullChartScreen from "./screens/FullChartScreen";
import AddAlertScreen from "./screens/AddAlertScreen";
import SupportScreen from "./screens/SupportScreen";
const Stack = createStackNavigator();
const Tab = createBottomTabNavigator();

// === MAIN TABS ===
function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarStyle: {
          backgroundColor: "#0A0A0A",
          borderTopColor: "#1F2937",
        },
        tabBarActiveTintColor: "#00E396",
        tabBarInactiveTintColor: "#6B7280",
        tabBarIcon: ({ color, size }) => {
          const icons = {
            Home: "home-outline",
            Watchlist: "star-outline",
            Portfolio: "wallet-outline", // ⭐ NEW TAB ICON
            Market: "analytics-outline",
            Profile: "person-outline",
          };
          return (
            <Ionicons name={icons[route.name]} size={size} color={color} />
          );
        },
      })}
    >
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Watchlist" component={WatchlistScreen} />

      {/* ⭐ RENAMED NEWS → PORTFOLIO (placeholder for now) */}
      <Tab.Screen
        name="Portfolio"
        component={PortfolioScreen}
        options={{ title: "Portfolio" }}
      />

      {/* ⭐ Market (Insights Screen) stays same */}
      <Tab.Screen name="Market" component={MarketScreen} />

      <Tab.Screen
        name="Profile"
        component={ProfileSettingsHub}
        options={{ title: "Profile" }}
      />
    </Tab.Navigator>
  );
}

// === ROOT STACK ===
export default function App() {
  const [initialRoute, setInitialRoute] = useState(null);
  const navigationRef = useRef(null);
  const isNavigationReady = useRef(false);
  const handleNotificationNavigation = (response) => {
    const data = response?.notification?.request?.content?.data || {};

    const symbol = data?.symbol;
    const type = data?.type;

    // 1) Symbol alerts → Stock Detail
    if (
      symbol &&
      (type === "watchlist_big_move" ||
        type === "watchlist_signal_change" ||
        type === "portfolio_position_big_move" ||
        type === "portfolio_concentration_risk" ||
        type === "portfolio_allocation_shift" ||
        type === "portfolio_risk_loss_combo" ||
        type === "watchlist_price_alert")
    ) {
      setTimeout(() => {
        if (!isNavigationReady.current) return;

        navigationRef.current?.navigate("StockDetailScreen", {
          symbol,
          name: symbol,
          source: "push_notification",
        });
      }, 800);

      return;
    }

    // 2) Portfolio alerts → Portfolio tab
    if (
      type === "portfolio_daily_performance" ||
      type === "portfolio_ai_rebalance"
    ) {
      setTimeout(() => {
        if (!isNavigationReady.current) return;

        navigationRef.current?.navigate("Main", {
          screen: "Portfolio",
        });
      }, 800);

      return;
    }

    // 3) Crypto alerts → Market tab
    if (type === "crypto_market_move") {
      setTimeout(() => {
        if (!isNavigationReady.current) return;

        navigationRef.current?.navigate("Main", {
          screen: "Market",
        });
      }, 800);
    }
  };
  // === Check login/onboarding state ===
  useEffect(() => {
    const checkUserStatus = async () => {
      try {
        const onboarded = await AsyncStorage.getItem("onboarded");
        const userToken = await AsyncStorage.getItem("userToken");

        if (userToken) setInitialRoute("Main");
        else if (onboarded) setInitialRoute("Login");
        else setInitialRoute("Onboarding");
      } catch {
        setInitialRoute("Onboarding");
      }
    };
    checkUserStatus();
  }, []);

  useEffect(() => {
    if (initialRoute === "Main") {
      const userId = auth.currentUser?.uid;

      if (userId) {
        registerForPushNotifications(userId);
      }
    }
  }, [initialRoute]);
  useEffect(() => {
    if (!initialRoute) return;

    // Handles notification tap when app is already open/background
    const sub = Notifications.addNotificationResponseReceivedListener(
      handleNotificationNavigation,
    );

    // Handles notification tap when app was fully closed
    Notifications.getLastNotificationResponseAsync().then((response) => {
      if (response) {
        handleNotificationNavigation(response);
      }
    });

    return () => sub.remove();
  }, [initialRoute]);

  if (!initialRoute) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: "#000",
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <ActivityIndicator size="large" color="#00E396" />
        <Text style={{ color: "#A3A3A3", marginTop: 12, fontSize: 14 }}>
          Initializing Alphaclara...
        </Text>
      </View>
    );
  }

  return (
    <NavigationContainer
      ref={navigationRef}
      onReady={() => {
        isNavigationReady.current = true;
      }}
    >
      <Stack.Navigator
        initialRouteName={initialRoute}
        screenOptions={{
          headerShown: false,
          headerStyle: { backgroundColor: "#000" },
          headerTintColor: "#00E396",
        }}
      >
        {/* AUTH FLOW */}
        <Stack.Screen name="Onboarding" component={OnboardingScreen} />
        <Stack.Screen name="Login" component={LoginScreen} />
        <Stack.Screen name="Signup" component={SignupScreen} />
        <Stack.Screen
          name="FullChartScreen"
          component={FullChartScreen}
          options={{ headerShown: false }}
        />

        {/* MAIN TABS */}
        <Stack.Screen name="Main" component={MainTabs} />

        {/* DETAILS / SUB SCREENS */}
        <Stack.Screen
          name="StockDetailScreen"
          component={StockDetailScreen}
          options={{
            headerShown: true,
            title: "Stock Details",
            headerStyle: { backgroundColor: "#000" },
            headerTintColor: "#00E396",
            headerBackTitleVisible: false,
            headerBackTitle: false,
            headerBackImage: () => (
              <Ionicons
                name="chevron-back-outline"
                size={24}
                color="#00E396"
                style={{ marginLeft: 10 }}
              />
            ),
          }}
        />

        <Stack.Screen
          name="FullPatternDetailScreen"
          component={FullPatternDetailScreen}
          options={{
            headerShown: true,
            title: "Pattern Details",
            headerStyle: { backgroundColor: "#000" },
            headerTintColor: "#00E396",
            headerBackTitleVisible: false,
            headerBackTitle: false,
            headerBackImage: () => (
              <Ionicons
                name="chevron-back-outline"
                size={24}
                color="#00E396"
                style={{ marginLeft: 10 }}
              />
            ),
          }}
        />
        <Stack.Screen
          name="AddAlertScreen"
          component={AddAlertScreen}
          options={{
            headerShown: true,
            title: "Add Alert",
            headerStyle: { backgroundColor: "#000" },
            headerTintColor: "#00E396",
            headerBackTitleVisible: false,
            headerBackTitle: false,
            headerBackImage: () => (
              <Ionicons
                name="chevron-back-outline"
                size={24}
                color="#00E396"
                style={{ marginLeft: 10 }}
              />
            ),
          }}
        />
        <Stack.Screen
          name="FullTechnicalDetailScreen"
          component={FullTechnicalDetailScreen}
          options={{
            headerShown: true,
            title: "Technical Details",
            headerStyle: { backgroundColor: "#000" },
            headerTintColor: "#00E396",
            headerBackTitleVisible: false,
            headerBackTitle: false,
            headerBackImage: () => (
              <Ionicons
                name="chevron-back-outline"
                size={24}
                color="#00E396"
                style={{ marginLeft: 10 }}
              />
            ),
          }}
        />
        <Stack.Screen
          name="FullDecisionDetailScreen"
          component={SignalDetailScreen}
          options={{
            headerShown: true,
            title: "Rating Details",
            headerStyle: { backgroundColor: "#000" },
            headerTintColor: "#00E396",
            headerBackTitleVisible: false,
            headerBackTitle: false,
            headerBackImage: () => (
              <Ionicons
                name="chevron-back-outline"
                size={24}
                color="#00E396"
                style={{ marginLeft: 10 }}
              />
            ),
          }}
        />

        <Stack.Screen
          name="MarketMoversScreen"
          component={MarketMoversScreen}
          options={{
            headerShown: true,
            title: "Market Movers",
            headerStyle: { backgroundColor: "#000" },
            headerTintColor: "#00E396",
            headerBackTitleVisible: false,
            headerBackTitle: false,
            headerBackImage: () => (
              <Ionicons
                name="chevron-back-outline"
                size={24}
                color="#00E396"
                style={{ marginLeft: 10 }}
              />
            ),
          }}
        />
        {/* ALERT SCREEN */}
        <Stack.Screen
          name="AlertScreen"
          component={AlertScreen}
          options={{
            headerShown: false,
            title: "Alerts",
            headerStyle: { backgroundColor: "#000" },
            headerTintColor: "#00E396",
            headerBackTitleVisible: false,
            headerBackImage: () => (
              <Ionicons
                name="chevron-back-outline"
                size={24}
                color="#00E396"
                style={{ marginLeft: 10 }}
              />
            ),
          }}
        />
        {/* EditPositionScreen (new) */}
        <Stack.Screen
          name="EditPositionScreen"
          component={EditPositionScreen}
          options={{ headerShown: false }}
        />
        {/* AddPositionScreen (new) */}
        <Stack.Screen
          name="AddPositionScreen"
          component={AddPositionScreen}
          options={{ headerShown: false }}
        />
        {/* NOTIFICATIONS SCREEN (new) */}
        <Stack.Screen
          name="Notifications"
          component={NotificationsScreen}
          options={{
            headerShown: true,
            title: "Notifications",
            headerBackTitleVisible: false,
            headerBackTitle: false,
            headerBackImage: () => (
              <Ionicons
                name="chevron-back-outline"
                size={24}
                color="#00E396"
                style={{ marginLeft: 10 }}
              />
            ),
            headerStyle: { backgroundColor: "#000" },
            headerTintColor: "#00E396",
          }}
        />
        <Stack.Screen
          name="Support"
          component={SupportScreen}
          options={{
            headerShown: true,
            title: "Support & Help",
            headerBackTitleVisible: false,
            headerBackTitle: false,
            headerBackImage: () => (
              <Ionicons
                name="chevron-back-outline"
                size={24}
                color="#00E396"
                style={{ marginLeft: 10 }}
              />
            ),
            headerStyle: { backgroundColor: "#000" },
            headerTintColor: "#00E396",
          }}
        />
        {/* INFO PAGES (About / Privacy / Terms) */}
        {["About", "PrivacyPolicy", "TermsOfUseScreen"].map((screen, i) => (
          <Stack.Screen
            key={i}
            name={screen}
            component={
              screen === "About"
                ? AboutScreen
                : screen === "PrivacyPolicy"
                  ? PrivacyPolicyScreen
                  : TermsOfUseScreen
            }
            options={{
              headerShown: true,
              title:
                screen === "About"
                  ? "About Alphaclara"
                  : screen === "PrivacyPolicy"
                    ? "Privacy Policy"
                    : "Terms of Use",
              headerBackTitleVisible: false,
              headerBackTitle: false,
              headerBackImage: () => (
                <Ionicons
                  name="chevron-back-outline"
                  size={24}
                  color="#00E396"
                  style={{ marginLeft: 10 }}
                />
              ),
              headerStyle: { backgroundColor: "#000" },
              headerTintColor: "#00E396",
            }}
          />
        ))}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
