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

export default function NotificationsScreen() {
  const [prefs, setPrefs] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPrefs = async () => {
      try {
        const uid = auth.currentUser?.uid;
        if (!uid) return;
        const snap = await getDoc(doc(db, "users", uid));
        const data = snap.exists() ? snap.data().preferences || {} : {};
        setPrefs({
          priceAlerts: data.priceAlerts ?? true,
          aiSignalUpdates: data.aiSignalUpdates ?? true,
          breakingNews: data.breakingNews ?? true,
          dailySummary: data.dailySummary ?? true,
        });
      } catch (e) {
        console.error("fetchPrefs error", e);
      } finally {
        setLoading(false);
      }
    };
    fetchPrefs();
  }, []);

  const togglePref = async (key) => {
    try {
      const uid = auth.currentUser?.uid;
      if (!uid) return;
      const updated = { ...prefs, [key]: !prefs[key] };
      setPrefs(updated);
      await setDoc(doc(db, "users", uid), { preferences: updated }, { merge: true });
    } catch (err) {
      Alert.alert("Error", "Failed to update preference");
      console.error(err);
    }
  };

  if (loading || !prefs) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#00E396" />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.header}>Notification Preferences</Text>
      {[
        { key: "priceAlerts", label: "Price Alerts" },
        { key: "aiSignalUpdates", label: "AI Signal Updates" },
        { key: "breakingNews", label: "Breaking News" },
        { key: "dailySummary", label: "Daily Market Summary" },
      ].map((item) => (
        <View key={item.key} style={styles.row}>
          <Text style={styles.label}>{item.label}</Text>
          <Switch
            value={prefs[item.key]}
            onValueChange={() => togglePref(item.key)}
            trackColor={{ true: "#00E396", false: "#555" }}
            thumbColor="#FFF"
          />
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000", padding: 20 },
  header: {
    color: "#00E396",
    fontSize: 20,
    fontWeight: "700",
    marginBottom: 20,
    textAlign: "center",
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 16,
    borderBottomWidth: 0.5,
    borderColor: "#1F2937",
  },
  label: { color: "#FFF", fontSize: 16 },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
});
