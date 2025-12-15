// screens/EditPositionScreen.js
import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ScrollView,
  TouchableWithoutFeedback,
  Keyboard,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { auth, buyShares, sellShares } from "../firebaseConfig";
import { Pressable } from "react-native";

export default function EditPositionScreen({ route, navigation }) {
  const { symbol, shares: currentShares = 0, avgCost: currentAvg = 0 } =
    route.params || {};

  const [txType, setTxType] = useState("BUY");
  const [txShares, setTxShares] = useState("");
  const [txPrice, setTxPrice] = useState("");
  const [loading, setLoading] = useState(false);

  const fmt = (n) => (isNaN(n) ? "--" : Number(n).toFixed(2));

  // ======================================================
  // PREVIEW FUNCTION (unchanged)
  // ======================================================
  const getPreview = () => {
    const s = Number(txShares) || 0;
    const p = Number(txPrice) || 0;
    const cs = Number(currentShares) || 0;
    const ca = Number(currentAvg) || 0;

    if (s <= 0) return { newShares: cs, newAvg: ca };

    if (txType === "BUY") {
      const newShares = cs + s;
      const newAvg = (cs * ca + s * p) / newShares;
      return { newShares, newAvg };
    } else {
      return { newShares: Math.max(cs - s, 0), newAvg: ca };
    }
  };

  const { newShares, newAvg } = getPreview();

  // ======================================================
  // SUBMIT (Added Keyboard.dismiss())
  // ======================================================
  const handleSubmit = async () => {
    Keyboard.dismiss(); // 🔥 close keyboard immediately

    const userId = auth.currentUser?.uid;
    if (!userId) {
      Alert.alert("Error", "You must be logged in.");
      return;
    }

    const s = Number(txShares) || 0;
    const p = Number(txPrice) || 0;

    if (s <= 0) {
      Alert.alert("Invalid shares", "Enter a positive number of shares.");
      return;
    }

    try {
      setLoading(true);

      if (txType === "BUY") {
        if (p <= 0) {
          Alert.alert("Invalid price", "Enter a valid buy price.");
          setLoading(false);
          return;
        }
        await buyShares(userId, symbol, s, p);
      } else {
        if (s > Number(currentShares || 0)) {
          Alert.alert("Too many shares", `You only have ${currentShares} ${symbol}.`);
          setLoading(false);
          return;
        }
        await sellShares(userId, symbol, s);
      }

      requestAnimationFrame(() => navigation.goBack());
    } catch (err) {
      console.warn("Edit transaction error:", err);
      Alert.alert("Error", err?.message || "Failed to apply transaction.");
    } finally {
      setLoading(false);
    }
  };

  // ======================================================
  // UI
  // ======================================================
  return (
    <TouchableWithoutFeedback onPress={() => Keyboard.dismiss()}>
      <KeyboardAvoidingView
        style={{ flex: 1, backgroundColor: "#000" }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.wrapper}
        >
          {/* Back */}
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="arrow-back" size={26} color="#9CA3AF" />
          </TouchableOpacity>

          {/* Header */}
          <Text style={styles.title}>{symbol} Position</Text>

          {/* Current Snapshot */}
          <View style={styles.card}>
            <View style={styles.row}>
              <Text style={styles.label}>Current Shares</Text>
              <Text style={styles.value}>{currentShares}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>Avg Cost</Text>
              <Text style={styles.value}>${fmt(currentAvg)}</Text>
            </View>
          </View>

          {/* Transaction Type */}
          <View style={styles.typeToggle}>
            <TouchableOpacity
              style={[
                styles.typeButton,
                txType === "BUY" && styles.typeButtonActive,
              ]}
              onPress={() => setTxType("BUY")}
            >
              <Text
                style={[
                  styles.typeText,
                  txType === "BUY" && styles.typeTextActive,
                ]}
              >
                Buy
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.typeButton,
                txType === "SELL" && styles.typeButtonActiveSell,
              ]}
              onPress={() => setTxType("SELL")}
            >
              <Text
                style={[
                  styles.typeText,
                  txType === "SELL" && styles.typeTextActive,
                ]}
              >
                Sell
              </Text>
            </TouchableOpacity>
          </View>

          {/* Inputs */}
          <View style={styles.card}>
            <View style={styles.fieldBlock}>
              <Text style={styles.label}>Shares</Text>
              <TextInput
                style={styles.input}
                placeholder="10"
                placeholderTextColor="#6B7280"
                keyboardType="numeric"
                value={txShares}
                onChangeText={setTxShares}
              />
            </View>

            {txType === "BUY" && (
              <View style={styles.fieldBlock}>
                <Text style={styles.label}>Price per Share</Text>
                <TextInput
                  style={styles.input}
                  placeholder="150.00"
                  placeholderTextColor="#6B7280"
                  keyboardType="numeric"
                  value={txPrice}
                  onChangeText={setTxPrice}
                />
              </View>
            )}
          </View>

          {/* Preview */}
          <View style={styles.card}>
            <Text style={styles.previewTitle}>Result Preview</Text>

            <View style={styles.row}>
              <Text style={styles.label}>New Shares</Text>
              <Text style={styles.value}>{newShares}</Text>
            </View>

            <View style={styles.row}>
              <Text style={styles.label}>New Avg Cost</Text>
              <Text style={styles.value}>${fmt(newAvg)}</Text>
            </View>
          </View>

          {/* Apply */}
          <Pressable
            onPress={handleSubmit}
            disabled={loading}
            style={({ pressed }) => [
              styles.saveBtn,
              loading && { opacity: 0.5 },
              pressed && { opacity: 0.6 },
            ]}
          >
            <Text style={styles.saveText}>
              {loading ? "Applying..." : "Apply Transaction"}
            </Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </TouchableWithoutFeedback>
  );
}

// === styles unchanged ===
const styles = StyleSheet.create({
  wrapper: { padding: 24, paddingTop: 60 },
  backBtn: {
    width: 40, height: 40, justifyContent: "center",
    alignItems: "center", marginBottom: 10,
  },
  title: { color: "#FFF", fontSize: 24, fontWeight: "800", marginBottom: 20 },
  card: {
    backgroundColor: "#111827",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#1F2937",
    padding: 16,
    marginBottom: 16,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 4,
  },
  label: { color: "#9CA3AF", fontSize: 14 },
  value: { color: "#FFF", fontSize: 15, fontWeight: "600" },
  typeToggle: { flexDirection: "row", marginBottom: 16, marginTop: 4 },
  typeButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#1F2937",
    alignItems: "center",
    marginRight: 6,
    backgroundColor: "#020617",
  },
  typeButtonActive: {
    backgroundColor: "#22C55E33",
    borderColor: "#22C55E",
  },
  typeButtonActiveSell: {
    backgroundColor: "#EF444433",
    borderColor: "#EF4444",
  },
  typeText: { color: "#9CA3AF", fontSize: 14, fontWeight: "600" },
  typeTextActive: { color: "#FFFFFF" },
  fieldBlock: { marginBottom: 14 },
  input: {
    marginTop: 4,
    backgroundColor: "#020617",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#1F2937",
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: "#FFF",
    fontSize: 15,
  },
  previewTitle: {
    color: "#E5E7EB",
    fontSize: 15,
    fontWeight: "600",
    marginBottom: 8,
  },
  saveBtn: {
    marginTop: 10,
    backgroundColor: "#00E396",
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: "center"
  },
  saveText: {
    color: "#000",
    fontSize: 16,
    fontWeight: "700",
  },
});
