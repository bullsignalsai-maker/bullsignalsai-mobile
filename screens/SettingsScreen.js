// screens/SettingsScreen.js
import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Switch,
  Image,
  ScrollView,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";

export default function SettingsScreen({ navigation }) {
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [user, setUser] = useState({ name: "", email: "", avatar: null });

  // ✅ Load profile whenever screen focused
  useFocusEffect(
    useCallback(() => {
      const loadProfile = async () => {
        const email = (await AsyncStorage.getItem("userToken")) || "";
        const profile =
          JSON.parse(await AsyncStorage.getItem("profile_" + email)) || {};
        const fullName = `${profile.firstName || "User"} ${
          profile.lastName || ""
        }`.trim();
        setUser({
          name: fullName,
          email: email,
          avatar: profile.avatar || null,
        });
      };
      loadProfile();
    }, [])
  );

  // ✅ Theme toggle handler
  const toggleTheme = async () => {
    setIsDarkMode((prev) => !prev);
    await AsyncStorage.setItem("@theme_mode", !isDarkMode ? "dark" : "light");
  };

  // ✅ Navigate to ProfileScreen
  const goToProfile = () => navigation.navigate("ProfileScreen");

  return (
    <ScrollView style={styles.container}>
      {/* HEADER */}
      <View style={styles.header}>
        <Text style={styles.title}>Settings</Text>
      </View>

      {/* USER CARD */}
      <View style={styles.userCard}>
        {user.avatar ? (
          <Image source={{ uri: user.avatar }} style={styles.avatar} />
        ) : (
          <Ionicons name="person-circle-outline" size={50} color="#333" />
        )}
        <View style={{ marginLeft: 10 }}>
          <Text style={styles.userName}>{user.name}</Text>
          <Text style={styles.userEmail}>{user.email}</Text>
        </View>
      </View>

      {/* PREFERENCES */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Preferences</Text>

        <View style={styles.row}>
          <View style={styles.rowLeft}>
            <Ionicons name="moon-outline" size={20} color="#00E396" />
            <Text style={styles.rowLabel}>Dark Mode</Text>
          </View>
          <Switch
            value={isDarkMode}
            onValueChange={toggleTheme}
            trackColor={{ false: "#555", true: "#00E396" }}
            thumbColor="#FFF"
          />
        </View>

        <View style={styles.row}>
          <View style={styles.rowLeft}>
            <Ionicons name="notifications-outline" size={20} color="#00E396" />
            <Text style={styles.rowLabel}>Push Notifications</Text>
          </View>
          <Switch
            value={notificationsEnabled}
            onValueChange={setNotificationsEnabled}
            trackColor={{ false: "#555", true: "#00E396" }}
            thumbColor="#FFF"
          />
        </View>
      </View>

      {/* INFO LINKS */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Information</Text>

        <TouchableOpacity
          style={styles.linkRow}
          onPress={() => navigation.navigate("About")}
        >
          <Ionicons name="information-circle-outline" size={18} color="#00E396" />
          <Text style={styles.linkText}>About BullSignalsAI</Text>
          <Ionicons
            name="chevron-forward-outline"
            size={18}
            color="#6B7280"
            style={{ marginLeft: "auto" }}
          />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.linkRow}
          onPress={() => navigation.navigate("PrivacyPolicy")}
        >
          <Ionicons name="lock-closed-outline" size={18} color="#00E396" />
          <Text style={styles.linkText}>Privacy Policy</Text>
          <Ionicons
            name="chevron-forward-outline"
            size={18}
            color="#6B7280"
            style={{ marginLeft: "auto" }}
          />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.linkRow}
          onPress={() => navigation.navigate("TermsOfUseScreen")}
        >
          <Ionicons name="document-text-outline" size={18} color="#00E396" />
          <Text style={styles.linkText}>Terms of Use</Text>
          <Ionicons
            name="chevron-forward-outline"
            size={18}
            color="#6B7280"
            style={{ marginLeft: "auto" }}
          />
        </TouchableOpacity>
      </View>

      {/* ACCOUNT SECTION */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Account</Text>

        <TouchableOpacity style={styles.linkRow} onPress={goToProfile}>
          <Ionicons name="person-outline" size={18} color="#00E396" />
          <Text style={styles.linkText}>Edit Profile</Text>
          <Ionicons
            name="chevron-forward-outline"
            size={18}
            color="#6B7280"
            style={{ marginLeft: "auto" }}
          />
        </TouchableOpacity>
      </View>

      <View style={{ height: 60 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000", padding: 20 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 50,
  },
  title: { color: "#00E396", fontSize: 22, fontWeight: "800" },
  userCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#111827",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#1F2937",
    padding: 14,
    marginTop: 16,
  },
  avatar: { width: 50, height: 50, borderRadius: 25 },
  userName: { color: "#FFF", fontSize: 16, fontWeight: "700" },
  userEmail: { color: "#9CA3AF", fontSize: 13 },
  section: {
    backgroundColor: "#111827",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#1F2937",
    padding: 14,
    marginTop: 20,
  },
  sectionTitle: {
    color: "#9CA3AF",
    fontSize: 14,
    fontWeight: "700",
    marginBottom: 10,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 8,
  },
  rowLeft: { flexDirection: "row", alignItems: "center", gap: 10 },
  rowLabel: { color: "#FFF", fontSize: 15 },
  linkRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 10,
  },
  linkText: { color: "#FFF", fontSize: 15, fontWeight: "500" },
});
