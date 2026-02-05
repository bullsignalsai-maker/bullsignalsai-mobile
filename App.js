// App.js (with Push Notification Integration + Notifications Screen)
import React, { useEffect, useState } from "react";
import { ActivityIndicator, View, Text } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { NavigationContainer } from "@react-navigation/native";
import { createStackNavigator } from "@react-navigation/stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Ionicons } from "@expo/vector-icons";

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
import NewsScreen from "./screens/NewsScreen";
import NewsDetailScreen from "./screens/NewsDetailScreen";
import MarketScreen from "./screens/MarketScreen";
import AlertScreen from "./screens/AlertScreen";
import NotificationsScreen from "./screens/NotificationsScreen"; // ✅ new
import EditPositionScreen from "./screens/EditPositionScreen"; // ✅ new
import PortfolioScreen from "./screens/PortfolioScreen"; // ✅ new
import AddPositionScreen from "./screens/AddPositionScreen"; // ✅ new
import FullPatternDetailScreen from "./screens/FullPatternDetailScreen"; // ✅ new
import FullTechnicalDetailScreen from "./screens/FullTechnicalDetailScreen"; // ✅ new
import MarketMoversScreen from "./screens/MarketMoversScreen"; // ✅ new
// Services
import { registerPushToken } from "./services/notifications"; // ✅ new import
import FullChartScreen from "./screens/FullChartScreen";


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
            Portfolio: "wallet-outline",   // ⭐ NEW TAB ICON
            Market: "analytics-outline",
            Profile: "person-outline",
          };
          return <Ionicons name={icons[route.name]} size={size} color={color} />;
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

  // === Register for push notifications once user reaches Main ===
  useEffect(() => {
    if (initialRoute === "Main") {
      registerPushToken(); // ask permission + save token in Firestore
    }
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
          Initializing BullSignalsAI...
        </Text>
      </View>
    );
  }

  return (
    <NavigationContainer>
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
          name="NewsDetailScreen"
          component={NewsDetailScreen}
          options={{
            headerShown: true,
            title: "Article Details",
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
                  ? "About BullSignalsAI"
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
