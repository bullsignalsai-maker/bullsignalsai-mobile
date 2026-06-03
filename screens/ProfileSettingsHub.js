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
  Animated,
} from "react-native";

import AsyncStorage from "@react-native-async-storage/async-storage";
import * as ImagePicker from "expo-image-picker";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import Svg, { Path, Circle } from "react-native-svg";
import { useFocusEffect } from "@react-navigation/native";

import { SafeAreaView } from "react-native-safe-area-context";
import { auth, db } from "../firebaseConfig";
import { deleteUser } from "firebase/auth";
import {
  doc,
  getDoc,
  setDoc,
  deleteDoc,
  collection,
  getDocs,
} from "firebase/firestore";
import { BRAND } from "../constants/theme";
import { TYPO } from "../constants/typography";

export default function ProfileSettingsHub({ navigation }) {
  const [user, setUser] = useState({
    firstName: "",
    lastName: "",
    email: "",
    bio: "",
    avatar: null,
  });

  const [editable, setEditable] = useState(false);

  const toastAnim = useState(new Animated.Value(0))[0];
  const [toastMessage, setToastMessage] = useState("");

  useFocusEffect(
    useCallback(() => {
      (async () => {
        const email = (await AsyncStorage.getItem("userToken")) || "";
        const userId = auth.currentUser?.uid;

        let saved = {};

        if (userId) {
          const profileRef = doc(db, "users", userId, "profile", "main");
          const profileSnap = await getDoc(profileRef);

          if (profileSnap.exists()) {
            saved = profileSnap.data() || {};
          } else {
            saved =
              JSON.parse(await AsyncStorage.getItem("profile_" + email)) || {};
          }
        } else {
          saved =
            JSON.parse(await AsyncStorage.getItem("profile_" + email)) || {};
        }

        setUser({
          firstName: saved.firstName || "",
          lastName: saved.lastName || "",
          email: saved.email || email,
          bio: saved.bio || "",
          avatar: saved.avatar || null,
        });
      })();
    }, []),
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
    const userId = auth.currentUser?.uid;

    const profileData = {
      firstName: user.firstName || "",
      lastName: user.lastName || "",
      email: user.email || "",
      bio: user.bio || "",
      avatar: user.avatar || null,
      updatedAt: new Date().toISOString(),
    };

    await AsyncStorage.setItem(
      "profile_" + user.email,
      JSON.stringify(profileData),
    );

    if (userId) {
      const profileRef = doc(db, "users", userId, "profile", "main");
      await setDoc(profileRef, profileData, { merge: true });
    }

    setEditable(false);
    showToast("Profile updated");
  };
  const handleAvatarChange = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (status !== "granted") {
      Alert.alert(
        "Permission Required",
        "Please allow photo access to update your profile picture.",
      );
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      allowsEditing: true,
      quality: 0.7,
      aspect: [1, 1],
      mediaTypes: ["images"],
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
        JSON.stringify(updated),
      );

      const userId = auth.currentUser?.uid;

      if (userId) {
        const profileRef = doc(db, "users", userId, "profile", "main");

        await setDoc(
          profileRef,
          {
            firstName: updated.firstName || "",
            lastName: updated.lastName || "",
            email: updated.email || "",
            bio: updated.bio || "",
            avatar: updated.avatar || null,
            updatedAt: new Date().toISOString(),
          },
          { merge: true },
        );
      }

      showToast("Profile photo updated");
    }
  };

  const handleLogout = () => {
    Alert.alert("Logout", "Are you sure you want to log out?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Logout",
        style: "destructive",
        onPress: async () => {
          await AsyncStorage.removeItem("userToken");

          navigation.reset({
            index: 0,
            routes: [{ name: "Login" }],
          });
        },
      },
    ]);
  };
  const handleDeleteAccount = () => {
    Alert.alert(
      "Delete Account",
      "This will delete your Alphaclara profile, watchlist, portfolio, notification preferences, saved summaries, and account access. This action cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              const currentUser = auth.currentUser;
              const userId = currentUser?.uid;
              const email = user.email || currentUser?.email || "";

              if (!userId || !currentUser) {
                Alert.alert(
                  "Sign In Required",
                  "Please sign in again to delete your account.",
                );
                return;
              }

              const deleteCollectionDocs = async (pathParts) => {
                const snap = await getDocs(collection(db, ...pathParts));
                await Promise.all(snap.docs.map((d) => deleteDoc(d.ref)));
              };

              await deleteCollectionDocs(["users", userId, "portfolio"]);
              await deleteCollectionDocs(["users", userId, "watchlist"]);
              await deleteCollectionDocs(["users", userId, "summaries"]);

              await deleteDoc(doc(db, "users", userId, "profile", "main"));
              await deleteDoc(
                doc(db, "users", userId, "preferences", "notifications"),
              );
              await deleteCollectionDocs(["users", userId, "alert_state"]);
              await deleteCollectionDocs(["users", userId, "news_ai"]);
              await deleteDoc(doc(db, "users", userId));

              await AsyncStorage.multiRemove(["userToken", "profile_" + email]);

              await deleteUser(currentUser);

              navigation.reset({
                index: 0,
                routes: [{ name: "Signup" }],
              });
            } catch (err) {
              console.warn(
                "Delete account failed:",
                err?.code || err?.message || err,
              );

              if (err?.code === "auth/requires-recent-login") {
                Alert.alert(
                  "Please Sign In Again",
                  "For security, please log out, sign in again, and then delete your account.",
                );
                return;
              }

              Alert.alert(
                "Delete Failed",
                "Unable to delete your account right now. Please try again.",
              );
            }
          },
        },
      ],
    );
  };
  const fullName =
    `${user.firstName || ""} ${user.lastName || ""}`.trim() || "Your Profile";

  const SettingsRow = ({
    icon,
    label,
    subtitle,
    onPress,
    right,
    danger = false,
    style,
  }) => (
    <TouchableOpacity
      activeOpacity={0.82}
      onPress={onPress}
      style={[styles.row, style]}
    >
      <View style={styles.rowLeft}>
        <View style={[styles.iconBubble, danger && styles.dangerBubble]}>
          <Ionicons
            name={icon}
            size={20}
            color={danger ? BRAND.red : BRAND.accent}
          />
        </View>

        <View>
          <Text style={[styles.rowLabel, danger && { color: BRAND.red }]}>
            {label}
          </Text>

          {!!subtitle && <Text style={styles.rowSubtitle}>{subtitle}</Text>}
        </View>
      </View>

      {right ? (
        right
      ) : (
        <Ionicons name="chevron-forward" size={20} color={BRAND.muted} />
      )}
    </TouchableOpacity>
  );
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: BRAND.bg }}>
      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Profile</Text>
          <Text style={styles.headerSubtitle}>
            Manage your account and preferences
          </Text>
        </View>
        {/* PROFILE CARD */}
        <View style={styles.profileCard}>
          <LinearGradient
            colors={["#07111F", "#07111F", "rgba(0,227,150,0.34)"]}
            start={{ x: 0, y: 0.2 }}
            end={{ x: 1, y: 0.5 }}
            style={StyleSheet.absoluteFill}
          />

          <Svg style={styles.meshSvg} viewBox="0 0 220 150">
            <Path
              d="M0 115 C55 70 95 135 150 70 C180 35 205 45 220 25"
              stroke="rgba(80,255,190,0.18)"
              strokeWidth="1"
              fill="none"
            />
            <Path
              d="M0 130 C60 82 105 142 160 82 C188 52 205 58 220 42"
              stroke="rgba(80,255,190,0.13)"
              strokeWidth="1"
              fill="none"
            />
            <Path
              d="M0 145 C68 94 112 150 170 96 C195 72 210 74 220 62"
              stroke="rgba(80,255,190,0.10)"
              strokeWidth="1"
              fill="none"
            />
            <Circle cx="172" cy="38" r="2" fill="rgba(80,255,190,0.45)" />
            <Circle cx="194" cy="58" r="2" fill="rgba(80,255,190,0.35)" />
          </Svg>

          <TouchableOpacity
            activeOpacity={0.85}
            onPress={handleAvatarChange}
            style={styles.avatarWrap}
          >
            {user.avatar ? (
              <Image source={{ uri: user.avatar }} style={styles.avatar} />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <Ionicons name="person" size={34} color={BRAND.sub} />
              </View>
            )}

            <View style={styles.avatarEditBadge}>
              <Ionicons name="pencil" size={13} color={BRAND.accent} />
            </View>
          </TouchableOpacity>

          <View style={styles.profileMain}>
            <View style={styles.nameRow}>
              <Text style={styles.name} numberOfLines={1}>
                {fullName}
              </Text>
              <Ionicons name="checkmark-circle" size={18} color="#FACC15" />
            </View>

            <Text style={styles.email} numberOfLines={1}>
              {user.email || "No email available"}
            </Text>

            <View style={styles.rolePill}>
              <Text style={styles.roleText}>{user.bio || "Founder"}</Text>
            </View>
          </View>
        </View>

        {editable && (
          <View style={styles.editCard}>
            <View style={styles.editHeaderRow}>
              <Text style={styles.sectionTitle}>Edit Profile</Text>
            </View>

            <View style={styles.nameFieldsRow}>
              <View style={styles.nameFieldCol}>
                <Text style={styles.fieldLabel}>First Name</Text>

                <TextInput
                  placeholder="First name"
                  placeholderTextColor={BRAND.muted}
                  style={styles.input}
                  value={user.firstName}
                  onChangeText={(v) => handleFieldChange("firstName", v)}
                />
              </View>

              <View style={styles.nameFieldCol}>
                <Text style={styles.fieldLabel}>Last Name</Text>

                <TextInput
                  placeholder="Last name"
                  placeholderTextColor={BRAND.muted}
                  style={styles.input}
                  value={user.lastName}
                  onChangeText={(v) => handleFieldChange("lastName", v)}
                />
              </View>
            </View>

            <View style={styles.fieldBlock}>
              <Text style={styles.fieldLabel}>Email</Text>
              <View style={styles.lockedInputWrap}>
                <TextInput
                  style={styles.lockedInput}
                  value={user.email}
                  editable={false}
                />
                <Ionicons
                  name="lock-closed-outline"
                  size={16}
                  color={BRAND.muted}
                />
              </View>
            </View>

            <View style={styles.fieldBlock}>
              <Text style={styles.fieldLabel}>Short Bio</Text>
              <TextInput
                placeholder="Add a short profile note"
                placeholderTextColor={BRAND.muted}
                style={[styles.input, styles.bioInput]}
                multiline
                value={user.bio}
                onChangeText={(v) => handleFieldChange("bio", v)}
              />
            </View>

            <View style={styles.actionRow}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => setEditable(false)}
              >
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.saveBtn} onPress={handleSave}>
                <Text style={styles.saveText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* INFORMATION */}
        <Text style={styles.groupTitle}>Legal & Info</Text>

        <View style={styles.card}>
          <SettingsRow
            icon="notifications-outline"
            label="Notification Preferences"
            subtitle="Manage how you receive updates"
            onPress={() => navigation.navigate("Notifications")}
          />

          <SettingsRow
            icon="information-circle-outline"
            label="About Alphaclara"
            subtitle="Learn more about our platform"
            onPress={() => navigation.navigate("About")}
          />

          <SettingsRow
            icon="headset-outline"
            label="Support & Help"
            subtitle="Get help and contact support"
            onPress={() => navigation.navigate("Support")}
          />

          <SettingsRow
            icon="shield-outline"
            label="Privacy Policy"
            subtitle="How we protect your data"
            onPress={() => navigation.navigate("PrivacyPolicy")}
          />

          <SettingsRow
            icon="document-text-outline"
            label="Terms of Use"
            subtitle="Read our terms and conditions"
            onPress={() => navigation.navigate("TermsOfUseScreen")}
          />
        </View>

        {/* ACCOUNT */}
        <Text style={styles.groupTitle}>Account</Text>

        <View style={styles.card}>
          <SettingsRow
            icon="log-out-outline"
            label="Logout"
            subtitle="Sign out of your account"
            onPress={handleLogout}
          />

          <SettingsRow
            icon="trash-outline"
            label="Delete Account"
            subtitle="Permanently delete your account"
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
          <Text style={styles.toastText}>{toastMessage}</Text>
        </Animated.View>
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

        <View style={{ height: 90 }} />
      </ScrollView>
    </SafeAreaView>
  );
}
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BRAND.bg,
    paddingHorizontal: 16,
    paddingTop: 4,
  },

  header: {
    marginTop: 2,
    marginBottom: 14,
  },

  headerTitle: {
    color: BRAND.text,
    fontSize: 28,
    fontFamily: TYPO.fontFamily.extrabold,
    letterSpacing: -0.7,
  },

  headerSubtitle: {
    color: BRAND.sub,
    fontSize: 14,
    marginTop: 4,
    fontFamily: TYPO.fontFamily.medium,
  },

  profileCard: {
    position: "relative",
    overflow: "hidden",
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 24,
    paddingHorizontal: 18,
    paddingVertical: 16,
    borderWidth: 1,
    borderColor: "rgba(80,255,190,0.22)",
    marginTop: 2,
    minHeight: 130,
    shadowColor: BRAND.accent,
    shadowOpacity: 0.18,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 9 },
    elevation: 9,
  },

  meshSvg: {
    position: "absolute",
    right: -2,
    bottom: -12,
    width: 245,
    height: 158,
    opacity: 1,
  },

  shieldMark: {
    position: "absolute",
    right: 34,
    top: 25,
    opacity: 1,
  },

  avatarWrap: {
    width: 90,
    height: 90,
    borderRadius: 45,
    marginRight: 16,
    backgroundColor: "rgba(0,227,150,0.08)",
    borderWidth: 1.6,
    borderColor: "rgba(0,227,150,0.42)",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 3,
  },

  avatar: {
    width: 82,
    height: 82,
    borderRadius: 41,
  },

  avatarPlaceholder: {
    width: 82,
    height: 82,
    borderRadius: 41,
    backgroundColor: "rgba(255,255,255,0.06)",
    alignItems: "center",
    justifyContent: "center",
  },

  avatarEditBadge: {
    position: "absolute",
    right: -3,
    bottom: -3,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: "#102033",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "rgba(80,255,190,0.58)",
  },

  profileMain: {
    flex: 1,
    zIndex: 3,
    paddingRight: 36,
  },

  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },

  name: {
    color: BRAND.text,
    fontSize: 20,
    fontFamily: TYPO.fontFamily.extrabold,
    flexShrink: 1,
    letterSpacing: -0.35,
  },

  email: {
    color: BRAND.sub,
    fontSize: 13,
    marginTop: 5,
    fontFamily: TYPO.fontFamily.medium,
  },

  rolePill: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "rgba(0,227,150,0.13)",
    borderWidth: 1,
    borderColor: "rgba(0,227,150,0.24)",
  },

  roleText: {
    color: BRAND.sub,
    fontSize: 12.5,
    fontFamily: TYPO.fontFamily.bold,
  },

  editCard: {
    backgroundColor: "rgba(15,23,42,0.92)",
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 16,
    marginTop: 8,
  },

  editHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },

  sectionTitle: {
    color: BRAND.text,
    fontSize: 16,
    fontFamily: TYPO.fontFamily.extrabold,
  },

  nameFieldsRow: {
    flexDirection: "row",
    gap: 10,
  },

  nameFieldCol: {
    flex: 1,
  },

  fieldBlock: {
    marginBottom: 10,
  },

  fieldLabel: {
    color: BRAND.sub,
    fontSize: 12,
    fontFamily: TYPO.fontFamily.bold,
    marginBottom: 7,
  },

  input: {
    backgroundColor: "rgba(255,255,255,0.05)",
    borderRadius: 15,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: BRAND.text,
    fontSize: 15,
    fontFamily: TYPO.fontFamily.semibold,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },

  bioInput: {
    height: 76,
    textAlignVertical: "top",
  },

  lockedInputWrap: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.05)",
    borderRadius: 15,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    opacity: 0.68,
  },

  lockedInput: {
    flex: 1,
    paddingVertical: 13,
    color: BRAND.muted,
    fontSize: 15,
    fontFamily: TYPO.fontFamily.semibold,
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
    borderRadius: 15,
    alignItems: "center",
  },

  saveText: {
    color: "#03110C",
    fontFamily: TYPO.fontFamily.bold,
  },

  cancelBtn: {
    flex: 1,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    paddingVertical: 12,
    borderRadius: 15,
    alignItems: "center",
  },

  cancelText: {
    color: BRAND.text,
    fontFamily: TYPO.fontFamily.bold,
  },

  groupTitle: {
    color: BRAND.muted,
    fontSize: 11,
    fontFamily: TYPO.fontFamily.bold,

    marginTop: 12,
    marginBottom: 6,

    marginLeft: 2,

    textTransform: "uppercase",
    letterSpacing: 0.9,
  },

  card: {
    backgroundColor: "rgba(15,23,42,0.90)",
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    paddingHorizontal: 14,
    paddingVertical: 2,
    shadowColor: "#000",
    shadowOpacity: 0.24,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
  },

  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.07)",
  },

  rowLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    flex: 1,
  },

  iconBubble: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "rgba(0,227,150,0.10)",
    alignItems: "center",
    justifyContent: "center",
  },

  dangerBubble: {
    backgroundColor: "rgba(239,68,68,0.10)",
  },

  rowLabel: {
    color: BRAND.text,
    fontSize: 15,
    fontFamily: TYPO.fontFamily.semibold,
    letterSpacing: -0.2,
  },

  rowSubtitle: {
    color: BRAND.sub,
    fontSize: 12,
    marginTop: 3,
    fontFamily: TYPO.fontFamily.regular,
  },

  toast: {
    position: "absolute",
    bottom: 90,
    alignSelf: "center",
    backgroundColor: "rgba(15,23,42,0.96)",
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(0,227,150,0.18)",
  },

  toastText: {
    color: BRAND.text,
    fontFamily: TYPO.fontFamily.bold,
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
