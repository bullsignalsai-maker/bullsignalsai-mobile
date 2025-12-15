// screens/ProfileSettingsHub.js
import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Image,
  Alert,
  Switch,
  Animated,
  Easing,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as ImagePicker from "expo-image-picker";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";

export default function ProfileSettingsHub({ navigation }) {
  const [user, setUser] = useState({
    firstName: "",
    lastName: "",
    email: "",
    bio: "",
    avatar: null,
  });
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [editable, setEditable] = useState(false);
  const [successAnim] = useState(new Animated.Value(0));
  const [successMessage, setSuccessMessage] = useState("");

  // === Load Data on Focus ===
  useFocusEffect(
    useCallback(() => {
      (async () => {
        const email = (await AsyncStorage.getItem("userToken")) || "";
        const profile =
          JSON.parse(await AsyncStorage.getItem("profile_" + email)) || {};
        setUser({ ...user, email, ...profile });
        setNotificationsEnabled(
          (await AsyncStorage.getItem("@notifications")) === "true"
        );
        setIsDarkMode((await AsyncStorage.getItem("@theme_mode")) !== "light");
      })();
    }, [])
  );

  // === Success Animation Toast ===
  const showSuccess = (msg) => {
    setSuccessMessage(msg);
    successAnim.setValue(0);
    Animated.sequence([
      Animated.timing(successAnim, {
        toValue: 1,
        duration: 200,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),
      Animated.delay(1000),
      Animated.timing(successAnim, {
        toValue: 0,
        duration: 200,
        easing: Easing.in(Easing.ease),
        useNativeDriver: true,
      }),
    ]).start();
  };

  // === Avatar Upload (with permission) ===
  const handleAvatarChange = async () => {
    if (!editable) return;

    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission Required", "Please allow photo access.");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });

    if (!result.canceled) {
      const uri = result.assets[0].uri;
      const updated = { ...user, avatar: uri };
      setUser(updated);
      await AsyncStorage.setItem("profile_" + user.email, JSON.stringify(updated));
      showSuccess("Avatar updated!");
    }
  };

  const handleFieldChange = (field, value) => {
    setUser({ ...user, [field]: value });
  };

  const handleSaveChanges = async () => {
    await AsyncStorage.setItem("profile_" + user.email, JSON.stringify(user));
    setEditable(false);
    showSuccess("Profile updated!");
  };

  const handleCancelEdit = () => setEditable(false);

  const toggleTheme = async () => {
    const newMode = !isDarkMode;
    setIsDarkMode(newMode);
    await AsyncStorage.setItem("@theme_mode", newMode ? "dark" : "light");
  };

  const toggleNotifications = async () => {
    const newVal = !notificationsEnabled;
    setNotificationsEnabled(newVal);
    await AsyncStorage.setItem("@notifications", String(newVal));
  };

  const handleLogout = async () => {
    await AsyncStorage.removeItem("userToken");
    navigation.reset({ index: 0, routes: [{ name: "Login" }] });
  };

  const handleDeleteAccount = async () => {
    Alert.alert(
      "Confirm Delete",
      "Are you sure you want to permanently delete your account?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            await AsyncStorage.multiRemove([
              "userToken",
              "profile_" + user.email,
            ]);
            navigation.reset({ index: 0, routes: [{ name: "Signup" }] });
          },
        },
      ]
    );
  };

  return (
    <ScrollView style={styles.container}>
      {/* HEADER */}
      <View style={styles.header}>
        <Text style={styles.title}>Profile & Settings</Text>
      </View>

      {/* USER CARD */}
      <View style={styles.userCard}>
        <View style={{ alignItems: "center" }}>
          <TouchableOpacity
            onPress={editable ? handleAvatarChange : null}
            activeOpacity={editable ? 0.8 : 1}
          >
            {user.avatar ? (
              <Image source={{ uri: user.avatar }} style={styles.avatar} />
            ) : (
              <Ionicons name="person-circle-outline" size={70} color="#444" />
            )}
          </TouchableOpacity>

          {editable && (
            <Text style={styles.editPhotoText}>Edit Photo</Text>
          )}
        </View>

        <View style={{ flex: 1, marginLeft: 10 }}>
          <Text style={styles.name}>
            {user.firstName || "Your Name"} {user.lastName || ""}
          </Text>
          <Text style={styles.email}>{user.email || "—"}</Text>
        </View>

        {!editable && (
          <TouchableOpacity onPress={() => setEditable(true)}>
            <Ionicons name="create-outline" size={22} color="#00E396" />
          </TouchableOpacity>
        )}
      </View>

      {/* PRO ANALYST CARD */}
      <View style={styles.proCard}>
        <Ionicons name="medal-outline" size={26} color="#00E396" />
        <View>
          <Text style={styles.proTitle}>Pro Analyst</Text>
          <Text style={styles.proSub}>
            AI Verified{" "}
            <Ionicons name="checkmark-circle" size={12} color="#00E396" /> • 92%
            Accuracy
          </Text>
        </View>
      </View>

      {/* Divider */}
      <View style={styles.divider} />

      {/* STATS */}
      <View style={styles.statsCard}>
        <View style={styles.statBox}>
          <Ionicons name="trending-up-outline" size={18} color="#00E396" />
          <Text style={styles.statValue}>8</Text>
          <Text style={styles.statLabel}>Tracked</Text>
        </View>
        <View style={styles.statBox}>
          <Ionicons name="notifications-outline" size={18} color="#00E396" />
          <Text style={styles.statValue}>5</Text>
          <Text style={styles.statLabel}>Alerts</Text>
        </View>
        <View style={styles.statBox}>
          <Ionicons name="checkmark-done-outline" size={18} color="#00E396" />
          <Text style={styles.statValue}>92%</Text>
          <Text style={styles.statLabel}>Accuracy</Text>
        </View>
      </View>

      {/* PERSONAL INFO */}
      {editable && (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Edit Personal Info</Text>
          <TextInput
            style={styles.input}
            placeholder="First Name"
            placeholderTextColor="#555"
            value={user.firstName}
            onChangeText={(v) => handleFieldChange("firstName", v)}
          />
          <TextInput
            style={styles.input}
            placeholder="Last Name"
            placeholderTextColor="#555"
            value={user.lastName}
            onChangeText={(v) => handleFieldChange("lastName", v)}
          />
          <TextInput
            style={[styles.input, { color: "#777" }]}
            value={user.email}
            editable={false}
          />
          <TextInput
            style={[styles.input, { height: 80 }]}
            placeholder="Bio"
            placeholderTextColor="#555"
            value={user.bio}
            onChangeText={(v) => handleFieldChange("bio", v)}
            multiline
          />

          <View style={styles.editActions}>
            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: "#00E396" }]}
              onPress={handleSaveChanges}
            >
              <Text style={styles.actionText}>Save Changes</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: "#333" }]}
              onPress={handleCancelEdit}
            >
              <Text style={[styles.actionText, { color: "#FFF" }]}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* PREFERENCES */}
      <Text style={styles.sectionTitle}>Preferences</Text>
      <View style={styles.card}>
        <View style={styles.row}>
          <View style={styles.rowLeft}>
            <Ionicons name="moon-outline" color="#00E396" size={18} />
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
            <Ionicons name="notifications-outline" color="#00E396" size={18} />
            <Text style={styles.rowLabel}>Push Notifications</Text>
          </View>
          <Switch
            value={notificationsEnabled}
            onValueChange={toggleNotifications}
            trackColor={{ false: "#555", true: "#00E396" }}
            thumbColor="#FFF"
          />
        </View>
      </View>

      {/* INFORMATION */}
      <Text style={styles.sectionTitle}>Information</Text>
      <View style={styles.card}>
      <TouchableOpacity onPress={() => navigation.navigate("Notifications")}>
        <Text style={styles.link}>Notification Preferences</Text>
      </TouchableOpacity>

        <TouchableOpacity onPress={() => navigation.navigate("About")}>
          <Text style={styles.link}>About BullSignalsAI</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => navigation.navigate("PrivacyPolicy")}>
          <Text style={styles.link}>Privacy Policy</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => navigation.navigate("TermsOfUseScreen")}>
          <Text style={styles.link}>Terms of Use</Text>
        </TouchableOpacity>
      </View>

      {/* ACCOUNT */}
      <Text style={styles.sectionTitle}>Account</Text>
      <View style={styles.accountContainer}>
        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
          <Ionicons name="log-out-outline" size={18} color="#00E396" />
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.deleteBtn} onPress={handleDeleteAccount}>
          <Ionicons name="trash-outline" size={18} color="#EF4444" />
          <Text style={styles.deleteText}>Delete Account</Text>
        </TouchableOpacity>
      </View>

      {/* SUCCESS TOAST */}
      <Animated.View
        pointerEvents="none"
        style={[
          styles.toast,
          { opacity: successAnim, transform: [{ scale: successAnim }] },
        ]}
      >
        <Text style={styles.toastText}>{successMessage}</Text>
      </Animated.View>

      <View style={{ height: 80 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000", padding: 20 },
  header: { alignItems: "center", marginTop: 50, marginBottom: 10 },
  title: { color: "#00E396", fontSize: 22, fontWeight: "700" },
  userCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#111827",
    borderRadius: 14,
    padding: 14,
    marginBottom: 8,
  },
  avatar: { width: 70, height: 70, borderRadius: 35 },
  editPhotoText: {
    color: "#00E396",
    fontSize: 12,
    marginTop: 4,
  },
  name: { color: "#FFF", fontSize: 17, fontWeight: "700" },
  email: { color: "#9CA3AF", fontSize: 14 },
  proCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#111827",
    borderColor: "#00E396",
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    marginBottom: 8,
  },
  divider: {
    borderBottomColor: "#1F2937",
    borderBottomWidth: 1,
    marginVertical: 1,
  },
  proTitle: { color: "#00E396", fontSize: 15, fontWeight: "700" },
  proSub: { color: "#9CA3AF", fontSize: 13 },
  statsCard: {
    flexDirection: "row",
    justifyContent: "space-around",
    backgroundColor: "#111827",
    borderRadius: 14,
    paddingVertical: 14,
    marginBottom: -10,
  },
  statBox: { alignItems: "center" },
  statValue: { color: "#FFF", fontSize: 18, fontWeight: "700", marginTop: 2 },
  statLabel: { color: "#9CA3AF", fontSize: 12 },
  sectionTitle: { color: "#9CA3AF", fontSize: 16, fontWeight: "600", marginTop: 20 },
  card: {
    backgroundColor: "#111827",
    borderRadius: 14,
    padding: 14,
    marginBottom: 1,
    borderWidth: 1,
    borderColor: "#1F2937",
  },
  input: {
    backgroundColor: "#0A0A0A",
    color: "#FFF",
    borderRadius: 8,
    padding: 10,
    marginBottom: 10,
    fontSize: 15,
  },
  editActions: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 10,
    gap: 10,
  },
  actionBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: "center",
  },
  actionText: { fontWeight: "700", fontSize: 15, color: "#000" },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 10,
  },
  rowLeft: { flexDirection: "row", alignItems: "center", gap: 8 },
  rowLabel: { color: "#FFF", fontSize: 15 },
  link: {
    color: "#00E396",
    fontSize: 15,
    paddingVertical: 8,
    textAlign: "center",
  },
  accountContainer: {
    backgroundColor: "#111827",
    borderRadius: 14,
    paddingVertical: 16,
    marginBottom: 2,
  },
  logoutBtn: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 6,
    paddingVertical: 10,
  },
  deleteBtn: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 6,
    paddingVertical: 10,
  },
  logoutText: {
    color: "#00E396",
    fontWeight: "700",
    fontSize: 16,
  },
  deleteText: {
    color: "#EF4444",
    fontWeight: "700",
    fontSize: 16,
  },
  toast: {
    position: "absolute",
    bottom: 100,
    alignSelf: "center",
    backgroundColor: "#111",
    padding: 10,
    borderRadius: 10,
  },
  toastText: { color: "#00E396", fontWeight: "600" },
});
