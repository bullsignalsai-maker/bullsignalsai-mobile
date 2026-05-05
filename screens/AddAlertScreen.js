import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Switch,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { auth, db } from "../firebaseConfig";
import { doc, getDoc, setDoc } from "firebase/firestore";

const BRAND = {
  bg: "#000",
  card: "#111827",
  border: "#1F2937",
  text: "#FFF",
  sub: "#9CA3AF",
  accent: "#00E396",
  red: "#FF4560",
};

export default function AddAlertScreen({ route, navigation }) {
  const symbol = route?.params?.symbol;
  const userId = auth.currentUser?.uid;

  const [enabled, setEnabled] = useState(true);
  const [abovePrice, setAbovePrice] = useState("");
  const [belowPrice, setBelowPrice] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadAlert();
  }, []);

  const loadAlert = async () => {
    if (!userId || !symbol) return;

    const ref = doc(
      db,
      "users",
      userId,
      "watchlist",
      symbol,
      "alerts",
      "price_alert"
    );

    const snap = await getDoc(ref);

    if (snap.exists()) {
      const data = snap.data() || {};
      setEnabled(data.enabled ?? true);
      setAbovePrice(data.abovePrice ? String(data.abovePrice) : "");
      setBelowPrice(data.belowPrice ? String(data.belowPrice) : "");
    }
  };

  const saveAlert = async () => {
    if (!userId || !symbol) return;

    const above = abovePrice.trim() ? Number(abovePrice) : null;
    const below = belowPrice.trim() ? Number(belowPrice) : null;

    if (above === null && below === null) {
      Alert.alert("Alert Required", "Please enter above price or below price.");
      return;
    }

    if (
      (above !== null && (Number.isNaN(above) || above <= 0)) ||
      (below !== null && (Number.isNaN(below) || below <= 0))
    ) {
      Alert.alert("Invalid Price", "Please enter a valid price.");
      return;
    }

    try {
      setSaving(true);

      const ref = doc(
        db,
        "users",
        userId,
        "watchlist",
        symbol,
        "alerts",
        "price_alert"
      );

      await setDoc(
        ref,
        {
          symbol,
          enabled,
          abovePrice: above,
          belowPrice: below,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        { merge: true }
      );

      Alert.alert("Alert Saved", `${symbol} price alert has been saved.`, [
        { text: "OK", onPress: () => navigation.goBack() },
      ]);
    } catch (e) {
      Alert.alert("Save Failed", e.message || "Could not save alert.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <View style={styles.iconWrap}>
          <Ionicons name="notifications-outline" size={32} color={BRAND.accent} />
        </View>

        <Text style={styles.title}>{symbol} Alert</Text>
        <Text style={styles.subtitle}>
          Get notified when {symbol} reaches your selected price level.
        </Text>

        <View style={styles.row}>
          <Text style={styles.label}>Enable Alert</Text>
          <Switch
            value={enabled}
            onValueChange={setEnabled}
            trackColor={{ false: "#444", true: BRAND.accent }}
            thumbColor="#FFF"
          />
        </View>

        <Text style={styles.inputLabel}>Alert when price is above</Text>
        <TextInput
          value={abovePrice}
          onChangeText={setAbovePrice}
          placeholder="Example: 25.00"
          placeholderTextColor="#6B7280"
          keyboardType="decimal-pad"
          style={styles.input}
        />

        <Text style={styles.inputLabel}>Alert when price is below</Text>
        <TextInput
          value={belowPrice}
          onChangeText={setBelowPrice}
          placeholder="Example: 18.50"
          placeholderTextColor="#6B7280"
          keyboardType="decimal-pad"
          style={styles.input}
        />

        <TouchableOpacity
          style={[styles.saveBtn, saving && { opacity: 0.6 }]}
          onPress={saveAlert}
          disabled={saving}
        >
          <Text style={styles.saveText}>{saving ? "Saving..." : "Save Alert"}</Text>
        </TouchableOpacity>

        <Text style={styles.note}>
          Alerts are informational only and not financial advice.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BRAND.bg, padding: 18 },
  card: {
    marginTop: 40,
    backgroundColor: BRAND.card,
    borderWidth: 1,
    borderColor: BRAND.border,
    borderRadius: 18,
    padding: 18,
  },
  iconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "rgba(0,227,150,0.08)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },
  title: { color: BRAND.text, fontSize: 24, fontWeight: "900" },
  subtitle: { color: BRAND.sub, fontSize: 14, marginTop: 6, lineHeight: 20 },
  row: {
    marginTop: 22,
    marginBottom: 16,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  label: { color: BRAND.text, fontSize: 15, fontWeight: "700" },
  inputLabel: { color: BRAND.sub, fontSize: 13, marginTop: 12, marginBottom: 6 },
  input: {
    backgroundColor: "#050505",
    borderWidth: 1,
    borderColor: BRAND.border,
    borderRadius: 12,
    padding: 13,
    color: BRAND.text,
    fontSize: 16,
  },
  saveBtn: {
    backgroundColor: BRAND.accent,
    borderRadius: 999,
    paddingVertical: 14,
    marginTop: 24,
    alignItems: "center",
  },
  saveText: { color: "#000", fontSize: 15, fontWeight: "900" },
  note: { color: BRAND.sub, fontSize: 11, marginTop: 14, textAlign: "center" },
});