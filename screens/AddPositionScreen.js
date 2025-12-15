// screens/AddPositionScreen.js
import React, { useState, useRef } from "react";
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
  Pressable
} from "react-native";

import { Ionicons } from "@expo/vector-icons";
import { auth, addPosition } from "../firebaseConfig";
import { API_BASE_URL } from "../config/apiKeys";   // SAME AS WATCHLIST

export default function AddPositionScreen({ navigation }) {
  const [symbol, setSymbol] = useState("");
  const [shares, setShares] = useState("");
  const [avgCost, setAvgCost] = useState("");
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState([]);

  // 👉 REFS FOR BETTER KEYBOARD FLOW
  const sharesRef = useRef(null);
  const costRef = useRef(null);

  // ------------------------------------
  // 🔍 LIVE AUTOCOMPLETE
  // ------------------------------------
  const handleSymbolChange = async (text) => {
    const up = text.toUpperCase();
    setSymbol(up);

    if (!up.trim()) {
      setSuggestions([]);
      return;
    }

    try {
      const url = `${API_BASE_URL}/search?q=${encodeURIComponent(up)}`;
      const res = await fetch(url);
      const json = await res.json();

      const list = (json?.data || [])
        .filter(i => i.symbol && i.description)
        .slice(0, 5)
        .map(i => ({
          symbol: i.symbol,
          desc: i.description,
        }));

      setSuggestions(list);
    } catch {
      setSuggestions([]);
    }
  };

  const handleSelectSuggestion = (item) => {
    setSymbol(item.symbol);
    setSuggestions([]);
    Keyboard.dismiss();
  };

  // ------------------------------------
  // SAVE POSITION
  // ------------------------------------
  const handleSave = async () => {
    if (!symbol.trim()) {
      Alert.alert("Invalid Symbol", "Please enter a stock symbol.");
      return;
    }
    if (!shares || Number(shares) <= 0) {
      Alert.alert("Invalid Shares", "Enter number of shares.");
      return;
    }
    if (!avgCost || Number(avgCost) <= 0) {
      Alert.alert("Invalid Cost", "Enter average cost.");
      return;
    }

    try {
      setLoading(true);
      const userId = auth.currentUser?.uid;
      if (!userId) return;

      await addPosition(
        userId,
        symbol.toUpperCase(),
        Number(shares),
        Number(avgCost)
      );

      navigation.goBack();
    } catch (err) {
      console.warn("AddPosition error:", err);
      Alert.alert("Error", "Failed to add position.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <TouchableWithoutFeedback onPress={() => Keyboard.dismiss()}>
      <KeyboardAvoidingView
        style={{ flex: 1, backgroundColor: "#000" }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView 
          contentContainerStyle={styles.wrapper}
          keyboardShouldPersistTaps="handled"   // 👈 Fixes double-tap bug
        >
          {/* Back */}
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={26} color="#9CA3AF" />
          </TouchableOpacity>

          <Text style={styles.title}>Add Position</Text>

          {/* SYMBOL INPUT */}
          <View style={styles.block}>
            <Text style={styles.label}>Symbol</Text>
            <TextInput
              style={styles.input}
              placeholder="TSLA"
              placeholderTextColor="#6B7280"
              autoCapitalize="characters"
              value={symbol}
              onChangeText={handleSymbolChange}
              returnKeyType="next"
              onSubmitEditing={() => sharesRef.current.focus()}
            />

            {/* AUTOCOMPLETE DROPDOWN */}
            {suggestions.length > 0 && (
              <View style={styles.dropdown}>
                {suggestions.map((item) => (
                  <Pressable
                    key={item.symbol}
                    style={styles.dropdownRow}
                    android_ripple={{ color: "#1F2937" }}
                    onPress={() => handleSelectSuggestion(item)}
                  >
                    <Text style={styles.dropSymbol}>{item.symbol}</Text>
                    <Text style={styles.dropDesc}>{item.desc}</Text>
                  </Pressable>
                ))}
              </View>
            )}
          </View>

          {/* SHARES */}
          <View style={styles.block}>
            <Text style={styles.label}>Shares</Text>
            <TextInput
              ref={sharesRef}
              style={styles.input}
              placeholder="10"
              placeholderTextColor="#6B7280"
              keyboardType="numeric"
              value={shares}
              onChangeText={setShares}
              returnKeyType="next"
              onSubmitEditing={() => costRef.current.focus()}
            />
          </View>

          {/* AVG COST */}
          <View style={styles.block}>
            <Text style={styles.label}>Average Cost</Text>
            <TextInput
              ref={costRef}
              style={styles.input}
              placeholder="150.00"
              placeholderTextColor="#6B7280"
              keyboardType="numeric"
              value={avgCost}
              onChangeText={setAvgCost}
              returnKeyType="done"
              onSubmitEditing={handleSave}
            />
          </View>

          {/* SAVE BUTTON */}
          <Pressable
            style={[styles.saveBtn, loading && { opacity: 0.4 }]}
            android_ripple={{ color: "#1F2937" }}
            onPress={handleSave}
            disabled={loading}
          >
            <Text style={styles.saveText}>
              {loading ? "Saving..." : "Add Position"}
            </Text>
          </Pressable>

        </ScrollView>
      </KeyboardAvoidingView>
    </TouchableWithoutFeedback>
  );
}

// ****************************
// STYLES
// ****************************
const styles = StyleSheet.create({
  wrapper: {
    padding: 24,
    paddingTop: 60,
  },
  backBtn: {
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 10,
  },
  title: {
    color: "#FFF",
    fontSize: 26,
    fontWeight: "800",
    marginBottom: 30,
  },
  block: {
    marginBottom: 22,
  },
  label: {
    color: "#9CA3AF",
    marginBottom: 6,
  },
  input: {
    backgroundColor: "#111827",
    borderWidth: 1,
    borderColor: "#1F2937",
    borderRadius: 14,
    padding: 14,
    color: "#FFF",
    fontSize: 16,
  },

  // DROPDOWN
  dropdown: {
    backgroundColor: "#1F2937",
    marginTop: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#374151",
    overflow: "hidden",
  },
  dropdownRow: {
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  dropSymbol: {
    color: "#00E396",
    fontSize: 16,
    fontWeight: "700",
  },
  dropDesc: {
    color: "#9CA3AF",
    fontSize: 13,
  },

  saveBtn: {
    marginTop: 30,
    backgroundColor: "#00E396",
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: "center",
  },
  saveText: {
    color: "#000",
    fontSize: 16,
    fontWeight: "700",
  },
});
