// screens/ProfileSettingsHub.js

import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Image,
  Alert,
  Switch,
  Animated,
} from "react-native";

import AsyncStorage from "@react-native-async-storage/async-storage";
import * as ImagePicker from "expo-image-picker";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { registerForPushNotifications } from "../services/pushNotificationService";
import { auth, db } from "../firebaseConfig";
import { doc, getDoc, setDoc } from "firebase/firestore";

const BRAND = {
  bg: "#000000",
  card: "#0B1220",
  card2: "#111827",
  border: "#1F2937",
  text: "#FFFFFF",
  sub: "#9CA3AF",
  muted: "#6B7280",
  accent: "#00E396",
  red: "#EF4444",
};

export default function ProfileSettingsHub({ navigation }) {
  const [user, setUser] = useState({
    firstName: "",
    lastName: "",
    email: "",
    bio: "",
    avatar: null,
  });

  const [editable, setEditable] = useState(false);
  
  const [notifPrefs, setNotifPrefs] = useState({
  enabled: true,
  watchlist: true,
  portfolio: true,
  crypto: true,
  });

  const toastAnim = useState(new Animated.Value(0))[0];
  const [toastMessage, setToastMessage] = useState("");

  useFocusEffect(
    useCallback(() => {
      (async () => {
        const email = (await AsyncStorage.getItem("userToken")) || "";
        const userId = auth.currentUser?.uid;

        if (userId) {
          registerForPushNotifications(userId);
        }
        const saved =
          JSON.parse(await AsyncStorage.getItem("profile_" + email)) || {};

        setUser({
          firstName: saved.firstName || "",
          lastName: saved.lastName || "",
          email,
          bio: saved.bio || "",
          avatar: saved.avatar || null,
        });
       
    

if (userId) {
  const prefRef = doc(db, "users", userId, "preferences", "notifications");
  const prefSnap = await getDoc(prefRef);

  if (prefSnap.exists()) {
    const data = prefSnap.data() || {};

    setNotifPrefs({
  enabled: data.enabled ?? true,
  watchlist: data.watchlist ?? true,
  portfolio: data.portfolio ?? true,
  crypto: data.crypto ?? true,
    });
  } else {
    await setDoc(
      prefRef,
      {
        enabled: true,
        watchlist: true,
        portfolio: true,
        crypto: true,
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );
  }
}

      })();
    }, [])
  );

  const showToast = (msg) => {
    setToastMessage(msg);

    Animated.sequence([
      Animated.timing(toastAnim, {
        toValue: 1,
        duration: 220,
        useNativeDriver: true,
      }),
      Animated.delay(1200),
      Animated.timing(toastAnim, {
        toValue: 0,
        duration: 220,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const handleFieldChange = (field, value) => {
    setUser((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleSave = async () => {
    await AsyncStorage.setItem(
      "profile_" + user.email,
      JSON.stringify(user)
    );

    setEditable(false);
    showToast("Profile updated");
  };

  const handleAvatarChange = async () => {
    if (!editable) return;

    const { status } =
      await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (status !== "granted") {
      Alert.alert(
        "Permission Required",
        "Please allow photo access to update your profile picture."
      );
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      allowsEditing: true,
      quality: 0.7,
      aspect: [1, 1],
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
    });

    if (!result.canceled) {
      const uri = result.assets[0].uri;

      const updated = {
        ...user,
        avatar: uri,
      };

      setUser(updated);

      await AsyncStorage.setItem(
        "profile_" + user.email,
        JSON.stringify(updated)
      );

      showToast("Profile photo updated");
    }
  };

const updateNotifPref = async (key, value) => {
  try {
    const userId = auth.currentUser?.uid;


    if (!userId) {
      showToast("Please login again");
      return;
    }

    const updated = {
      ...notifPrefs,
      [key]: value,
    };

    setNotifPrefs(updated);

    const prefRef = doc(db, "users", userId, "preferences", "notifications");

    await setDoc(
      prefRef,
      {
        ...updated,
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );

   

    showToast("Notification preference updated");
  } catch (e) {
    console.warn("❌ Notification pref save failed:", e.message || e);
    showToast("Could not save notification preference");
  }
};

  const handleLogout = async () => {
    await AsyncStorage.removeItem("userToken");

    navigation.reset({
      index: 0,
      routes: [{ name: "Login" }],
    });
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      "Delete Account",
      "This will permanently remove your local profile data from this device.",
      [
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            await AsyncStorage.multiRemove([
              "userToken",
              "profile_" + user.email,
            ]);

            navigation.reset({
              index: 0,
              routes: [{ name: "Signup" }],
            });
          },
        },
      ]
    );
  };

  const fullName =
    `${user.firstName || ""} ${user.lastName || ""}`.trim() ||
    "Your Profile";

  const SettingsRow = ({
    icon,
    label,
    onPress,
    right,
    danger = false,
  }) => (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={onPress}
      style={styles.row}
    >
      <View style={styles.rowLeft}>
        <Ionicons
          name={icon}
          size={18}
          color={danger ? BRAND.red : BRAND.accent}
        />
        <Text
          style={[
            styles.rowLabel,
            danger && { color: BRAND.red },
          ]}
        >
          {label}
        </Text>
      </View>

      {right ? (
        right
      ) : (
        <Ionicons
          name="chevron-forward"
          size={18}
          color={BRAND.muted}
        />
      )}
    </TouchableOpacity>
  );

  return (
    <ScrollView
      style={styles.container}
      showsVerticalScrollIndicator={false}
    >
      {/* PROFILE CARD */}
      <View style={styles.profileCard}>
        <TouchableOpacity
          activeOpacity={editable ? 0.85 : 1}
          onPress={editable ? handleAvatarChange : null}
        >
          {user.avatar ? (
            <Image
              source={{ uri: user.avatar }}
              style={styles.avatar}
            />
          ) : (
            <Ionicons
              name="person-circle-outline"
              size={82}
              color="#3B3B3B"
            />
          )}
        </TouchableOpacity>

        <Text style={styles.name}>{fullName}</Text>
        <Text style={styles.email}>
          {user.email || "No email available"}
        </Text>

        <View style={styles.intelligenceCard}>
          <Ionicons
            name="sparkles-outline"
            size={20}
            color={BRAND.accent}
          />
          <View style={{ flex: 1 }}>
            <Text style={styles.intelligenceTitle}>
              AlphaWise Intelligence
            </Text>
            <Text style={styles.intelligenceSub}>
              AI-powered market insights and decision support
            </Text>
          </View>
        </View>
        {editable && (
          <TouchableOpacity
            style={styles.photoBtn}
            onPress={handleAvatarChange}
          >
            <Ionicons name="camera-outline" size={15} color={BRAND.accent} />
            <Text style={styles.photoBtnText}>Change Photo</Text>
          </TouchableOpacity>
        )}
        {!editable ? (
          
          <TouchableOpacity
            style={styles.editBtn}
            onPress={() => setEditable(true)}
          >
            <Ionicons
              name="create-outline"
              size={16}
              color="#000"
            />
            <Text style={styles.editBtnText}>
              Edit Profile
            </Text>
          </TouchableOpacity>
        ) : null}
      </View>

      {/* EDIT MODE */}
      {editable && (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>
            Personal Information
          </Text>

          <TextInput
            placeholder="First Name"
            placeholderTextColor="#555"
            style={styles.input}
            value={user.firstName}
            onChangeText={(v) =>
              handleFieldChange("firstName", v)
            }
          />

          <TextInput
            placeholder="Last Name"
            placeholderTextColor="#555"
            style={styles.input}
            value={user.lastName}
            onChangeText={(v) =>
              handleFieldChange("lastName", v)
            }
          />

          <TextInput
            style={[styles.input, { color: "#777" }]}
            value={user.email}
            editable={false}
          />

          <TextInput
            placeholder="Short Bio"
            placeholderTextColor="#555"
            style={[styles.input, { height: 90 }]}
            multiline
            value={user.bio}
            onChangeText={(v) =>
              handleFieldChange("bio", v)
            }
          />

          <View style={styles.actionRow}>
            <TouchableOpacity
              style={styles.saveBtn}
              onPress={handleSave}
            >
              <Text style={styles.saveText}>
                Save Changes
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.cancelBtn}
              onPress={() => setEditable(false)}
            >
              <Text style={styles.cancelText}>
                Cancel
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* PREFERENCES */}
      <Text style={styles.groupTitle}>Notification Settings</Text>

      <View style={styles.card}>
        <SettingsRow
          icon="notifications-outline"
          label="Push Notifications"
          right={
            <Switch
              value={notifPrefs.enabled}
              onValueChange={(v) => updateNotifPref("enabled", v)}
              trackColor={{ false: "#444", true: BRAND.accent }}
              thumbColor="#FFF"
            />
          }
        />

        <SettingsRow
          icon="star-outline"
          label="Watchlist Alerts"
          right={
            <Switch
              value={notifPrefs.watchlist}
              disabled={!notifPrefs.enabled}
              onValueChange={(v) => updateNotifPref("watchlist", v)}
              trackColor={{ false: "#444", true: BRAND.accent }}
              thumbColor="#FFF"
            />
          }
        />

        <SettingsRow
          icon="wallet-outline"
          label="Portfolio Alerts"
          right={
            <Switch
              value={notifPrefs.portfolio}
              disabled={!notifPrefs.enabled}
              onValueChange={(v) => updateNotifPref("portfolio", v)}
              trackColor={{ false: "#444", true: BRAND.accent }}
              thumbColor="#FFF"
            />
          }
        />

        <SettingsRow
          icon="logo-bitcoin"
          label="Crypto Alerts"
          right={
            <Switch
              value={notifPrefs.crypto}
              disabled={!notifPrefs.enabled}
              onValueChange={(v) => updateNotifPref("crypto", v)}
              trackColor={{ false: "#444", true: BRAND.accent }}
              thumbColor="#FFF"
            />
          }
        />
      </View>
      
      {/* INFORMATION */}
      <Text style={styles.groupTitle}>Information</Text>

      <View style={styles.card}>
        <SettingsRow
          icon="notifications-outline"
          label="Notification Preferences"
          onPress={() =>
            navigation.navigate("Notifications")
          }
        />

        <SettingsRow
          icon="information-circle-outline"
          label="About AlphaWise"
          onPress={() =>
            navigation.navigate("About")
          }
        />

        <SettingsRow
          icon="shield-outline"
          label="Privacy Policy"
          onPress={() =>
            navigation.navigate("PrivacyPolicy")
          }
        />

        <SettingsRow
          icon="document-text-outline"
          label="Terms of Use"
          onPress={() =>
            navigation.navigate("TermsOfUseScreen")
          }
        />
      </View>

      {/* ACCOUNT */}
      <Text style={styles.groupTitle}>Account</Text>

      <View style={styles.card}>
        <SettingsRow
          icon="log-out-outline"
          label="Logout"
          onPress={handleLogout}
        />

        <SettingsRow
          icon="trash-outline"
          label="Delete Account"
          onPress={handleDeleteAccount}
          danger
        />
      </View>

      {/* TOAST */}
      <Animated.View
        pointerEvents="none"
        style={[
          styles.toast,
          {
            opacity: toastAnim,
            transform: [{ scale: toastAnim }],
          },
        ]}
      >
        <Text style={styles.toastText}>
          {toastMessage}
        </Text>
      </Animated.View>

      <View style={styles.versionWrap}>
        <Text style={styles.versionText}>AlphaWise v1.0.0</Text>
        <Text style={styles.versionSubText}>AI-Powered Market Intelligence</Text>
      </View>

      <View style={{ height: 90 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BRAND.bg,
    padding: 16,
  },

  profileCard: {
    backgroundColor: BRAND.card,
    borderRadius: 18,
    padding: 20,
    borderWidth: 1,
    borderColor: BRAND.border,
    alignItems: "center",
    marginTop: 38,
  },

  avatar: {
    width: 82,
    height: 82,
    borderRadius: 41,
  },

  name: {
    color: BRAND.text,
    fontSize: 20,
    fontWeight: "800",
    marginTop: 10,
  },

  email: {
    color: BRAND.sub,
    fontSize: 13,
    marginTop: 4,
  },

  intelligenceCard: {
    marginTop: 18,
    backgroundColor: BRAND.card2,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: BRAND.border,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    width: "100%",
  },

  intelligenceTitle: {
    color: BRAND.accent,
    fontSize: 14,
    fontWeight: "700",
  },

  intelligenceSub: {
    color: BRAND.sub,
    fontSize: 12,
    marginTop: 2,
  },

  editBtn: {
    marginTop: 18,
    backgroundColor: BRAND.accent,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 999,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },

  editBtnText: {
    color: "#000",
    fontWeight: "800",
    fontSize: 14,
  },

  groupTitle: {
    color: BRAND.sub,
    fontSize: 15,
    fontWeight: "700",
    marginTop: 22,
    marginBottom: 8,
  },

  card: {
    backgroundColor: BRAND.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: BRAND.border,
    padding: 14,
  },

  sectionTitle: {
    color: BRAND.text,
    fontSize: 15,
    fontWeight: "700",
    marginBottom: 14,
  },

  input: {
    backgroundColor: "#050505",
    borderRadius: 10,
    padding: 12,
    color: "#FFF",
    marginBottom: 10,
    fontSize: 15,
    borderWidth: 1,
    borderColor: BRAND.border,
  },

  actionRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 8,
  },

  saveBtn: {
    flex: 1,
    backgroundColor: BRAND.accent,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: "center",
  },

  saveText: {
    color: "#000",
    fontWeight: "800",
  },

  cancelBtn: {
    flex: 1,
    backgroundColor: "#222",
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: "center",
  },

  cancelText: {
    color: "#FFF",
    fontWeight: "700",
  },

  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#111",
  },

  rowLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },

  rowLabel: {
    color: BRAND.text,
    fontSize: 15,
    fontWeight: "500",
  },

  toast: {
    position: "absolute",
    bottom: 90,
    alignSelf: "center",
    backgroundColor: "#111",
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: BRAND.border,
  },

  toastText: {
    color: BRAND.accent,
    fontWeight: "700",
  },
  photoBtn: {
  marginTop: 10,
  flexDirection: "row",
  alignItems: "center",
  gap: 6,
  paddingHorizontal: 12,
  paddingVertical: 7,
  borderRadius: 999,
  backgroundColor: "rgba(0,227,150,0.08)",
  borderWidth: 1,
  borderColor: "rgba(0,227,150,0.35)",
},

photoBtnText: {
  color: BRAND.accent,
  fontSize: 12,
  fontWeight: "700",
},
versionWrap: {
  alignItems: "center",
  marginTop: 26,
},

versionText: {
  color: BRAND.muted,
  fontSize: 12,
  fontWeight: "700",
},

versionSubText: {
  color: BRAND.muted,
  fontSize: 11,
  marginTop: 4,
},
});