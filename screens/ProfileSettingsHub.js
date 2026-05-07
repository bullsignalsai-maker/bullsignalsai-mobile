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
import { auth, db } from "../firebaseConfig";
import { SafeAreaView } from "react-native";
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

  const handleLogout = () => {
    Alert.alert(
      "Logout",
      "Are you sure you want to log out?",
      [
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
      ]
    );
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
  <SafeAreaView style={{ flex: 1, backgroundColor: BRAND.bg }}>
    <ScrollView
      style={styles.container}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Profile & Settings</Text>
      </View>
      {/* PROFILE CARD */}
      <View style={styles.profileCard}>
        <TouchableOpacity
          activeOpacity={editable ? 0.85 : 1}
          onPress={editable ? handleAvatarChange : null}
        >
          {user.avatar ? (
            <Image source={{ uri: user.avatar }} style={styles.avatar} />
          ) : (
            <View style={styles.avatarPlaceholder}>
              <Ionicons name="person" size={36} color={BRAND.sub} />
            </View>
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
              Alphaclara Intelligence
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
            style={styles.editInline}
            onPress={() => setEditable(true)}
          >
            <Ionicons name="pencil" size={16} color={BRAND.accent} />
            <Text style={styles.editInlineText}>Edit</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      {/* EDIT MODE */}
      {editable && (
        <View style={styles.editCard}>
          <View style={styles.editHeaderRow}>
            <Text style={styles.sectionTitle}>Edit Profile</Text>
            <Ionicons name="person-outline" size={18} color={BRAND.accent} />
          </View>

          <View style={styles.fieldBlock}>
            <Text style={styles.fieldLabel}>First Name</Text>
            <TextInput
              placeholder="First name"
              placeholderTextColor={BRAND.muted}
              style={styles.input}
              value={user.firstName}
              onChangeText={(v) => handleFieldChange("firstName", v)}
            />
          </View>

          <View style={styles.fieldBlock}>
            <Text style={styles.fieldLabel}>Last Name</Text>
            <TextInput
              placeholder="Last name"
              placeholderTextColor={BRAND.muted}
              style={styles.input}
              value={user.lastName}
              onChangeText={(v) => handleFieldChange("lastName", v)}
            />
          </View>

          <View style={styles.fieldBlock}>
            <Text style={styles.fieldLabel}>Email</Text>
            <View style={styles.lockedInputWrap}>
              <TextInput
                style={styles.lockedInput}
                value={user.email}
                editable={false}
              />
              <Ionicons name="lock-closed-outline" size={16} color={BRAND.muted} />
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
            <TouchableOpacity style={styles.cancelBtn} onPress={() => setEditable(false)}>
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
          onPress={() =>
            navigation.navigate("Notifications")
          }
        />

        <SettingsRow
          icon="information-circle-outline"
          label="About Alphaclara"
          onPress={() =>
            navigation.navigate("About")
          }
        />
        <SettingsRow
          icon="help-circle-outline"
          label="Support & Help"
          onPress={() => navigation.navigate("Support")}
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
        <Text style={styles.powered}>
        Powered by <Text style={{ color: BRAND.accent }}>Alphaclara</Text>
      </Text>

      <Text style={styles.disclaimer}>
        Information provided is for educational purposes only and is not financial advice.
      </Text>
      <View style={styles.versionWrap}>
        <Text style={styles.versionText}>Alphaclara v1.0.0</Text>
        <Text style={styles.versionSubText}>AI-Powered Market Intelligence</Text>
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

  profileCard: {
    backgroundColor: BRAND.card,
    borderRadius: 18,
    padding: 20,
    borderWidth: 1,
    borderColor: BRAND.border,
    alignItems: "center",
    marginTop: 10,
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
    borderBottomColor: BRAND.border,
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
header: {
  marginBottom: 10,
},

headerTitle: {
  color: BRAND.text,
  fontSize: 22,
  fontWeight: "900",
},  
avatarPlaceholder: {
  width: 82,
  height: 82,
  borderRadius: 41,
  backgroundColor: BRAND.card2,
  alignItems: "center",
  justifyContent: "center",
  borderWidth: 1,
  borderColor: BRAND.border,
},
powered: {
  color: BRAND.sub,
  fontSize: 12,
  textAlign: "center",
  marginTop: 14,
},

disclaimer: {
  color: BRAND.muted,
  fontSize: 10,
  textAlign: "center",
  marginTop: 6,
  paddingHorizontal: 20,
},
editInline: {
  position: "absolute",
  top: 16,
  right: 16,
  flexDirection: "row",
  alignItems: "center",
  gap: 6,
},

editInlineText: {
  color: BRAND.accent,
  fontSize: 13,
  fontWeight: "700",
},
editCard: {
  backgroundColor: BRAND.card,
  borderRadius: 18,
  borderWidth: 1,
  borderColor: BRAND.border,
  padding: 16,
  marginTop: 14,
},

editHeaderRow: {
  flexDirection: "row",
  alignItems: "center",
  justifyContent: "space-between",
  marginBottom: 14,
},

fieldBlock: {
  marginBottom: 12,
},

fieldLabel: {
  color: BRAND.sub,
  fontSize: 12,
  fontWeight: "800",
  marginBottom: 7,
},

input: {
  backgroundColor: BRAND.card2,
  borderRadius: 14,
  paddingHorizontal: 14,
  paddingVertical: 13,
  color: BRAND.text,
  fontSize: 15,
  fontWeight: "700",
  borderWidth: 1,
  borderColor: BRAND.softBorder,
},

bioInput: {
  height: 90,
  textAlignVertical: "top",
},

lockedInputWrap: {
  flexDirection: "row",
  alignItems: "center",
  backgroundColor: BRAND.card2,
  borderRadius: 14,
  paddingHorizontal: 14,
  borderWidth: 1,
  borderColor: BRAND.softBorder,
  opacity: 0.65,
},

lockedInput: {
  flex: 1,
  paddingVertical: 13,
  color: BRAND.muted,
  fontSize: 15,
  fontWeight: "700",
},

actionRow: {
  flexDirection: "row",
  gap: 10,
  marginTop: 8,
},

saveBtn: {
  flex: 1,
  backgroundColor: BRAND.accent,
  paddingVertical: 13,
  borderRadius: 14,
  alignItems: "center",
},

saveText: {
  color: BRAND.bg,
  fontWeight: "900",
},

cancelBtn: {
  flex: 1,
  backgroundColor: BRAND.card2,
  borderWidth: 1,
  borderColor: BRAND.border,
  paddingVertical: 13,
  borderRadius: 14,
  alignItems: "center",
},

cancelText: {
  color: BRAND.text,
  fontWeight: "800",
},
});