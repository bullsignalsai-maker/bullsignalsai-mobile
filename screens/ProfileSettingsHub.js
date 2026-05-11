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
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { registerForPushNotifications } from "../services/pushNotificationService";
import { SafeAreaView } from "react-native-safe-area-context";
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
    await AsyncStorage.setItem("profile_" + user.email, JSON.stringify(user));

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
      "This will remove your account data from this device. To permanently delete your account, contact support.",
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
      ],
    );
  };

  const fullName =
    `${user.firstName || ""} ${user.lastName || ""}`.trim() || "Your Profile";

  const SettingsRow = ({
    icon,
    label,
    onPress,
    right,
    danger = false,
    style,
  }) => (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={onPress}
      style={[styles.row, style]}
    >
      <View style={styles.rowLeft}>
        <Ionicons
          name={icon}
          size={18}
          color={danger ? BRAND.red : BRAND.accent}
        />
        <Text style={[styles.rowLabel, danger && { color: BRAND.red }]}>
          {label}
        </Text>
      </View>

      {right ? (
        right
      ) : (
        <Ionicons name="chevron-forward" size={18} color={BRAND.muted} />
      )}
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: BRAND.bg }}>
      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Account</Text>
        </View>
        {/* PROFILE CARD */}
        <View style={styles.profileCard}>
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={handleAvatarChange}
            style={styles.avatarTopRight}
          >
            {user.avatar ? (
              <Image source={{ uri: user.avatar }} style={styles.avatar} />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <Ionicons name="person" size={32} color={BRAND.sub} />
              </View>
            )}

            <View style={styles.avatarEditBadge}>
              <Ionicons name="pencil" size={12} color="#0A0A0A" />
            </View>
          </TouchableOpacity>

          <View style={styles.nameRow}>
            <Text style={styles.name}>{fullName}</Text>

            {!editable && (
              <TouchableOpacity
                style={styles.nameEditBtn}
                onPress={() => setEditable(true)}
                activeOpacity={0.8}
              >
                <Ionicons name="pencil" size={13} color={BRAND.sub} />
              </TouchableOpacity>
            )}
          </View>

          <Text style={styles.email}>{user.email || "No email available"}</Text>

          {!!user.bio ? (
            <Text style={styles.profileBio}>{user.bio}</Text>
          ) : null}
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
            onPress={() => navigation.navigate("Notifications")}
          />

          <SettingsRow
            icon="information-circle-outline"
            label="About Alphaclara"
            onPress={() => navigation.navigate("About")}
          />
          <SettingsRow
            icon="help-circle-outline"
            label="Support & Help"
            onPress={() => navigation.navigate("Support")}
          />
          <SettingsRow
            icon="shield-outline"
            label="Privacy Policy"
            onPress={() => navigation.navigate("PrivacyPolicy")}
          />

          <SettingsRow
            icon="document-text-outline"
            label="Terms of Use"
            onPress={() => navigation.navigate("TermsOfUseScreen")}
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
          <Text style={styles.toastText}>{toastMessage}</Text>
        </Animated.View>
        <Text style={styles.powered}>
          Powered by <Text style={{ color: BRAND.text }}>Alphaclara</Text>
        </Text>

        <Text style={styles.disclaimer}>
          Information provided is for educational purposes only and is not
          financial advice.
        </Text>
        <View style={styles.versionWrap}>
          <Text style={styles.versionText}>Alphaclara v1.0.0</Text>
          <Text style={styles.versionSubText}>
            AI-Powered Market Intelligence
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
    padding: 16,
  },

  header: {
    marginBottom: 6,
  },

  headerTitle: {
    color: BRAND.text,
    fontSize: 26,
    fontFamily: TYPO.fontFamily.extrabold,
    letterSpacing: -0.3,
  },

  profileCard: {
    backgroundColor: "rgba(17,24,39,0.82)",

    borderRadius: 24,

    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 18,

    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",

    marginTop: 8,
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
    backgroundColor: BRAND.card2,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },

  name: {
    color: BRAND.text,
    fontSize: 22,
    fontFamily: TYPO.fontFamily.extrabold,
    flexShrink: 1,
  },

  email: {
    color: BRAND.sub,
    fontSize: 13,
    marginTop: 4,
    fontFamily: TYPO.fontFamily.medium,
    paddingRight: 90,
  },
  editCard: {
    backgroundColor: "rgba(17,24,39,0.82)",

    borderRadius: 22,

    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.05)",

    paddingHorizontal: 15,
    paddingTop: 15,
    paddingBottom: 14,

    marginTop: 12,
  },

  editHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },

  sectionTitle: {
    color: BRAND.text,
    fontSize: 15,
    fontFamily: TYPO.fontFamily.extrabold,
  },

  fieldBlock: {
    marginBottom: 9,
  },

  fieldLabel: {
    color: BRAND.sub,
    fontSize: 12,
    fontFamily: TYPO.fontFamily.bold,
    marginBottom: 7,
  },

  input: {
    backgroundColor: BRAND.card2,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 11,
    color: BRAND.text,
    fontSize: 15,
    fontFamily: TYPO.fontFamily.semibold,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },

  bioInput: {
    height: 72,
    textAlignVertical: "top",
  },

  lockedInputWrap: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: BRAND.card2,
    borderRadius: 14,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    opacity: 0.65,
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
    backgroundColor: "#FFFFFF",
    paddingVertical: 11,
    borderRadius: 14,
    alignItems: "center",
  },

  saveText: {
    color: "#0A0A0A",
    fontFamily: TYPO.fontFamily.bold,
  },

  cancelBtn: {
    flex: 1,
    backgroundColor: BRAND.card2,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    paddingVertical: 11,
    borderRadius: 14,
    alignItems: "center",
  },

  cancelText: {
    color: BRAND.text,
    fontFamily: TYPO.fontFamily.bold,
  },

  groupTitle: {
    color: BRAND.muted,
    fontSize: 12,
    fontFamily: TYPO.fontFamily.bold,
    marginTop: 16,
    marginBottom: 8,
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },

  card: {
    backgroundColor: "rgba(17,24,39,0.82)",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
    paddingHorizontal: 14,
    paddingVertical: 4,
  },

  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.06)",
  },

  rowLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },

  rowLabel: {
    color: BRAND.text,
    fontSize: 15,
    fontFamily: TYPO.fontFamily.medium,
  },

  toast: {
    position: "absolute",
    bottom: 90,
    alignSelf: "center",
    backgroundColor: BRAND.card,
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },

  toastText: {
    color: BRAND.text,
    fontFamily: TYPO.fontFamily.bold,
  },

  powered: {
    color: BRAND.sub,
    fontSize: 12,
    textAlign: "center",
    marginTop: 14,
    fontFamily: TYPO.fontFamily.medium,
  },

  disclaimer: {
    color: BRAND.muted,
    fontSize: 10.5,
    lineHeight: 15,
    textAlign: "center",
    marginTop: 6,
    paddingHorizontal: 20,
    fontFamily: TYPO.fontFamily.regular,
  },

  versionWrap: {
    alignItems: "center",
    marginTop: 26,
  },

  versionText: {
    color: BRAND.muted,
    fontSize: 12,
    fontFamily: TYPO.fontFamily.semibold,
  },

  versionSubText: {
    color: BRAND.muted,
    fontSize: 11,
    marginTop: 4,
    fontFamily: TYPO.fontFamily.regular,
  },
  avatarTopRight: {
    position: "absolute",
    top: 18,
    right: 18,
  },

  profileBio: {
    color: BRAND.sub,
    fontSize: 12,
    lineHeight: 17,
    marginTop: 10,
    fontFamily: TYPO.fontFamily.regular,
    paddingRight: 90,
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 2,
    paddingRight: 110,
  },
  nameEditBtn: {
    marginLeft: 8,

    width: 24,
    height: 24,

    borderRadius: 12,

    backgroundColor: "rgba(255,255,255,0.06)",

    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",

    alignItems: "center",
    justifyContent: "center",

    flexShrink: 0,
  },

  avatarEditBadge: {
    position: "absolute",
    right: -2,
    bottom: -2,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: BRAND.card,
  },
  nameFieldsRow: {
    flexDirection: "row",
    gap: 10,
  },

  nameFieldCol: {
    flex: 1,
  },
});
