// screens/NotificationsScreen.js
import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  Switch,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
} from "react-native";
import { db, auth } from "../firebaseConfig";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { Ionicons } from "@expo/vector-icons";
import { BRAND } from "../constants/theme";

export default function NotificationsScreen() {
  const [prefs, setPrefs] = useState(null);
  const [loading, setLoading] = useState(true);

  const prefItems = [
    {
      key: "enabled",
      label: "Push Notifications",
      desc: "Master control for Alphaclara alerts.",
      icon: "notifications-outline",
    },
    {
      key: "watchlist",
      label: "Watchlist Alerts",
      desc: "Price alerts and watchlist movement updates.",
      icon: "star-outline",
    },
    {
      key: "portfolio",
      label: "Portfolio Alerts",
      desc: "Portfolio movement and risk context updates.",
      icon: "wallet-outline",
    },
    {
      key: "crypto",
      label: "Crypto Alerts",
      desc: "Major crypto market movement notifications.",
      icon: "logo-bitcoin",
    },
  ];

  useEffect(() => {
    const fetchPrefs = async () => {
      try {
        const uid = auth.currentUser?.uid;
        if (!uid) return;

        const ref = doc(db, "users", uid, "preferences", "notifications");
        const snap = await getDoc(ref);

        const data = snap.exists() ? snap.data() || {} : {};

        const defaultPrefs = {
          enabled: data.enabled ?? true,
          watchlist: data.watchlist ?? true,
          portfolio: data.portfolio ?? true,
          crypto: data.crypto ?? true,
        };

        setPrefs(defaultPrefs);

        if (!snap.exists()) {
          await setDoc(
            ref,
            {
              ...defaultPrefs,
              updatedAt: new Date().toISOString(),
            },
            { merge: true }
          );
        }
      } catch (e) {
        console.warn("Notification preferences load failed:", e?.message || e);
        Alert.alert("Unable to Load", "Could not load notification preferences.");
      } finally {
        setLoading(false);
      }
    };

    fetchPrefs();
  }, []);

  const togglePref = async (key) => {
    try {
      const uid = auth.currentUser?.uid;
      if (!uid || !prefs) return;

      const updated = { ...prefs, [key]: !prefs[key] };
      setPrefs(updated);

      const ref = doc(db, "users", uid, "preferences", "notifications");

      await setDoc(
        ref,
        {
          ...updated,
          updatedAt: new Date().toISOString(),
        },
        { merge: true }
      );
    } catch (err) {
      Alert.alert("Update Failed", "Could not update this preference.");
      console.warn("Notification preference update failed:", err?.message || err);
    }
  };

  if (loading || !prefs) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={BRAND.accent} />
        <Text style={styles.loadingText}>Loading preferences…</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.wrapper}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.header}>
        <Text style={styles.title}>Notification Preferences</Text>
        <Text style={styles.subtitle}>
          Choose the alerts you want to receive from Alphaclara.
        </Text>
      </View>

      <View style={styles.card}>
        {prefItems.map((item, index) => {
          const disabled = item.key !== "enabled" && !prefs.enabled;

          return (
            <View
              key={item.key}
              style={[
                styles.row,
                index === prefItems.length - 1 && styles.lastRow,
                disabled && styles.disabledRow,
              ]}
            >
              <View style={styles.rowLeft}>
                <View style={styles.iconWrap}>
                  <Ionicons
                    name={item.icon}
                    size={18}
                    color={disabled ? BRAND.muted : BRAND.accent}
                  />
                </View>

                <View style={{ flex: 1 }}>
                  <Text style={styles.label}>{item.label}</Text>
                  <Text style={styles.desc}>{item.desc}</Text>
                </View>
              </View>

              <Switch
                value={prefs[item.key]}
                disabled={disabled}
                onValueChange={() => togglePref(item.key)}
                trackColor={{ true: BRAND.accent, false: "#374151" }}
                thumbColor="#FFF"
              />
            </View>
          );
        })}
      </View>

      <View style={styles.footerWrap}>
        <Text style={styles.footerText}>
          Powered by <Text style={styles.footerBrand}>Alphaclara</Text>
        </Text>

        <Text style={styles.disclaimer}>
          Notifications are informational only and are not financial,
          investment, trading, or tax advice.
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BRAND.bg,
  },

  wrapper: {
    paddingHorizontal: 18,
    paddingTop: 24,
    paddingBottom: 50,
  },

  center: {
    flex: 1,
    backgroundColor: BRAND.bg,
    justifyContent: "center",
    alignItems: "center",
  },

  loadingText: {
    color: BRAND.muted,
    marginTop: 10,
    fontSize: 13,
    fontWeight: "700",
  },

  header: {
    marginBottom: 18,
  },

  title: {
    color: BRAND.accent,
    fontSize: 24,
    fontWeight: "900",
    textAlign: "center",
  },

  subtitle: {
    color: BRAND.muted,
    fontSize: 12.5,
    lineHeight: 18,
    textAlign: "center",
    marginTop: 6,
    paddingHorizontal: 8,
  },

  card: {
    backgroundColor: BRAND.card,
    borderWidth: 1,
    borderColor: BRAND.border,
    borderRadius: 20,
    paddingHorizontal: 14,
  },

  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: BRAND.border,
  },

  lastRow: {
    borderBottomWidth: 0,
  },

  disabledRow: {
    opacity: 0.45,
  },

  rowLeft: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    marginRight: 12,
  },

  iconWrap: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: BRAND.card2,
    borderWidth: 1,
    borderColor: BRAND.border,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },

  label: {
    color: BRAND.text,
    fontSize: 14,
    fontWeight: "900",
  },

  desc: {
    color: BRAND.muted,
    fontSize: 11.5,
    lineHeight: 16,
    marginTop: 3,
  },

  footerWrap: {
    marginTop: 24,
    alignItems: "center",
    paddingHorizontal: 12,
  },

  footerText: {
    color: BRAND.sub,
    fontSize: 12,
    marginBottom: 8,
  },

  footerBrand: {
    color: BRAND.accent,
    fontWeight: "600",
  },

  disclaimer: {
    color: BRAND.muted,
    fontSize: 11,
    lineHeight: 16,
    textAlign: "center",
  },
});