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
  Pressable,
  StatusBar,
} from "react-native";

import { Ionicons } from "@expo/vector-icons";
import { auth, addPosition } from "../firebaseConfig";
import { API_BASE_URL } from "../config/apiKeys";
import { BRAND } from "../constants/theme";

export default function AddPositionScreen({ navigation }) {
  const [symbol, setSymbol] = useState("");
  const [shares, setShares] = useState("");
  const [avgCost, setAvgCost] = useState("");
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState([]);

  const sharesRef = useRef(null);
  const costRef = useRef(null);

  const handleSymbolChange = async (text) => {
    const up = text.toUpperCase().trimStart();
    setSymbol(up);

    if (!up.trim()) {
      setSuggestions([]);
      return;
    }

    try {
      const url = `${API_BASE_URL}/search?q=${encodeURIComponent(up)}`;
      const res = await fetch(url);
      const json = await res.json();

      const seen = new Set();

      const list = (json?.data || [])
        .filter((i) => i.symbol && i.description)
        .filter((i) => {
          const sym = String(i.symbol).toUpperCase();
          if (seen.has(sym)) return false;
          seen.add(sym);
          return true;
        })
        .slice(0, 5)
        .map((i) => ({
          symbol: String(i.symbol).toUpperCase(),
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
    sharesRef.current?.focus();
  };

  const handleSave = async () => {
    const cleanSymbol = symbol.trim().toUpperCase();
    const shareNumber = Number(shares);
    const avgCostNumber = Number(avgCost);

    if (!cleanSymbol) {
      Alert.alert("Symbol Required", "Enter a valid stock symbol.");
      return;
    }

    if (!shares || Number.isNaN(shareNumber) || shareNumber <= 0) {
      Alert.alert("Shares Required", "Enter the number of shares you own.");
      return;
    }

    if (!avgCost || Number.isNaN(avgCostNumber) || avgCostNumber <= 0) {
      Alert.alert("Average Cost Required", "Enter your average purchase price.");
      return;
    }

    try {
      setLoading(true);

      const userId = auth.currentUser?.uid;
      if (!userId) {
        Alert.alert("Sign In Required", "Please sign in to add a position.");
        return;
      }

      await addPosition(userId, cleanSymbol, shareNumber, avgCostNumber);

      navigation.goBack();
    } catch (err) {
      console.warn("AddPosition error:", err);
      Alert.alert("Unable to Add Position", "Please try again in a moment.");
    } finally {
      setLoading(false);
    }
  };
    const isValid =
      symbol.trim() &&
      Number(shares) > 0 &&
      Number(avgCost) > 0;

    const estimatedValue =
      Number(shares) > 0 && Number(avgCost) > 0
        ? Number(shares) * Number(avgCost)
        : null;
  return (
    <TouchableWithoutFeedback onPress={() => Keyboard.dismiss()}>
      <KeyboardAvoidingView
        style={styles.screen}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <StatusBar barStyle="light-content" backgroundColor={BRAND.bg} />

        <ScrollView
          contentContainerStyle={styles.wrapper}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.topRow}>
            <TouchableOpacity
              style={styles.backBtn}
              onPress={() => navigation.goBack()}
              activeOpacity={0.8}
            >
              <Ionicons name="chevron-back" size={24} color={BRAND.sub} />
            </TouchableOpacity>
          </View>

          <View style={styles.headerBox}>
            <Text style={styles.headerTitle}>Add Position</Text>
            <Text style={styles.headerSub}>
              Track holdings, performance, and AI-powered portfolio context.
            </Text>
          </View>

          <View style={styles.formCard}>
            <View style={styles.block}>
              <Text style={styles.label}>Stock Symbol</Text>

              <TextInput
                style={styles.input}
                placeholder="Example: TSLA"
                placeholderTextColor={BRAND.muted}
                autoCapitalize="characters"
                autoCorrect={false}
                value={symbol}
                onChangeText={handleSymbolChange}
                returnKeyType="next"
                onSubmitEditing={() => sharesRef.current?.focus()}
              />

              {suggestions.length > 0 && (
                <View style={styles.dropdown}>
                  {suggestions.map((item, index) => (
                  <Pressable
                    key={`${item.symbol}-${index}`}
                      style={({ pressed }) => [
                        styles.dropdownRow,
                        pressed && { backgroundColor: BRAND.softBorder },
                      ]}
                      onPress={() => handleSelectSuggestion(item)}
                    >
                      <Text style={styles.dropSymbol}>{item.symbol}</Text>
                      <Text style={styles.dropDesc} numberOfLines={1}>
                        {item.desc}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              )}
            </View>

            <View style={styles.block}>
              <Text style={styles.label}>Shares</Text>

              <TextInput
                ref={sharesRef}
                style={styles.input}
                placeholder="Example: 10"
                placeholderTextColor={BRAND.muted}
                keyboardType="decimal-pad"
                value={shares}
                onChangeText={setShares}
                returnKeyType="next"
                onSubmitEditing={() => costRef.current?.focus()}
              />
            </View>

            <View style={styles.block}>
              <Text style={styles.label}>Average Cost</Text>

              <TextInput
                ref={costRef}
                style={styles.input}
                placeholder="Example: 150.00"
                placeholderTextColor={BRAND.muted}
                keyboardType="decimal-pad"
                value={avgCost}
                onChangeText={setAvgCost}
                returnKeyType="default"
                onSubmitEditing={() => Keyboard.dismiss()}
              />
              {estimatedValue ? (
                <Text style={styles.estimateText}>
                  Est. Position Value: ${estimatedValue.toFixed(2)}
                </Text>
              ) : null}
            </View>

            <Pressable
              style={({ pressed }) => [
                styles.saveBtn,
                (!isValid || loading) && styles.saveDisabled,
                (pressed || loading) && { opacity: 0.65 },
              ]}
              onPress={handleSave}
              disabled={!isValid || loading}
            >
              <Text style={styles.saveText}>
                {loading ? "Saving Position…" : "Add Position"}
              </Text>
            </Pressable>
          </View>

          <View style={styles.footerWrap}>
            <Text style={styles.footerText}>
              Powered by <Text style={styles.footerBrand}>Alphaclara</Text>
            </Text>

            <Text style={styles.disclaimer}>
              Portfolio tracking is for informational and educational purposes
              only and is not financial, investment, trading, or tax advice.
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </TouchableWithoutFeedback>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: BRAND.bg,
  },

  wrapper: {
    paddingHorizontal: 18,
    paddingTop: 58,
    paddingBottom: 50,
  },

  topRow: {
    height: 38,
    justifyContent: "center",
    marginBottom: 8,
  },

  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: BRAND.card2,
    borderWidth: 1,
    borderColor: BRAND.border,
    alignItems: "center",
    justifyContent: "center",
  },

  headerBox: {
    alignItems: "center",
    marginBottom: 18,
  },

  headerTitle: {
    color: BRAND.accent,
    fontSize: 24,
    fontWeight: "900",
    letterSpacing: 0.3,
    marginBottom: 4,
  },

  headerSub: {
    color: BRAND.muted,
    fontSize: 12,
    fontWeight: "700",
    lineHeight: 17,
    textAlign: "center",
    paddingHorizontal: 12,
  },

  formCard: {
    backgroundColor: BRAND.card,
    borderWidth: 1,
    borderColor: BRAND.border,
    borderRadius: 22,
    padding: 16,
  },

  block: {
    marginBottom: 16,
  },

  label: {
    color: BRAND.sub,
    marginBottom: 7,
    fontSize: 12,
    fontWeight: "800",
  },

  input: {
    backgroundColor: BRAND.card2,
    borderWidth: 1,
    borderColor: BRAND.softBorder,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 13,
    color: BRAND.text,
    fontSize: 15,
    fontWeight: "700",
  },

  dropdown: {
    backgroundColor: BRAND.card2,
    marginTop: 7,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: BRAND.border,
    overflow: "hidden",
  },

  dropdownRow: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: BRAND.softBorder,
  },

  dropSymbol: {
    color: BRAND.accent,
    fontSize: 15,
    fontWeight: "900",
  },

  dropDesc: {
    color: BRAND.sub,
    fontSize: 12,
    marginTop: 2,
    fontWeight: "600",
  },

  saveBtn: {
    marginTop: 10,
    backgroundColor: BRAND.accent,
    paddingVertical: 15,
    borderRadius: 16,
    alignItems: "center",
  },

  saveText: {
    color: BRAND.bg,
    fontSize: 15,
    fontWeight: "900",
  },

  footerWrap: {
    marginTop: 28,
    alignItems: "center",
    paddingHorizontal: 14,
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
  estimateText: {
  color: BRAND.muted,
  fontSize: 11.5,
  marginTop: 7,
  fontWeight: "700",
},

saveDisabled: {
  backgroundColor: "#374151",
},
});