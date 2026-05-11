// screens/EditPositionScreen.js
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
import { auth, buyShares, sellShares } from "../firebaseConfig";
import { BRAND } from "../constants/theme";
import { TYPO } from "../constants/typography";

export default function EditPositionScreen({ route, navigation }) {
  const {
    symbol,
    shares: currentShares = 0,
    avgCost: currentAvg = 0,
  } = route.params || {};

  const [txType, setTxType] = useState("BUY");
  const [txShares, setTxShares] = useState("");
  const [txPrice, setTxPrice] = useState("");
  const [loading, setLoading] = useState(false);

  const priceRef = useRef(null);

  const fmt = (n) => {
    if (n == null || Number.isNaN(Number(n))) return "--";
    return Number(n).toFixed(2);
  };

  const money = (n) => `$${fmt(n)}`;

  const getPreview = () => {
    const s = Number(txShares) || 0;
    const p = Number(txPrice) || 0;
    const cs = Number(currentShares) || 0;
    const ca = Number(currentAvg) || 0;

    if (s <= 0) return { newShares: cs, newAvg: ca, txValue: 0 };

    if (txType === "BUY") {
      const newShares = cs + s;
      const newAvg = p > 0 ? (cs * ca + s * p) / newShares : ca;
      return { newShares, newAvg, txValue: s * p };
    }

    return {
      newShares: Math.max(cs - s, 0),
      newAvg: ca,
      txValue: s * ca,
    };
  };

  const { newShares, newAvg, txValue } = getPreview();

  const isValid =
    txType === "BUY"
      ? Number(txShares) > 0 && Number(txPrice) > 0
      : Number(txShares) > 0 && Number(txShares) <= Number(currentShares || 0);

  const handleSubmit = async () => {
    Keyboard.dismiss();

    const userId = auth.currentUser?.uid;
    if (!userId) {
      Alert.alert(
        "Sign In Required",
        "Please sign in to update this position.",
      );
      return;
    }

    const s = Number(txShares) || 0;
    const p = Number(txPrice) || 0;

    if (s <= 0) {
      Alert.alert("Shares Required", "Enter a positive number of shares.");
      return;
    }

    try {
      setLoading(true);

      if (txType === "BUY") {
        if (p <= 0) {
          Alert.alert("Price Required", "Enter a valid buy price.");
          setLoading(false);
          return;
        }

        await buyShares(userId, symbol, s, p);
      } else {
        if (s > Number(currentShares || 0)) {
          Alert.alert(
            "Too Many Shares",
            `You only have ${currentShares} ${symbol}.`,
          );
          setLoading(false);
          return;
        }

        await sellShares(userId, symbol, s);
      }

      requestAnimationFrame(() => navigation.goBack());
    } catch (err) {
      console.warn("Edit transaction error:", err);
      Alert.alert(
        "Unable to Apply Transaction",
        err?.message || "Please try again.",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <TouchableWithoutFeedback onPress={() => Keyboard.dismiss()}>
      <KeyboardAvoidingView
        style={styles.screen}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <StatusBar barStyle="light-content" backgroundColor={BRAND.bg} />

        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.wrapper}
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
            <Text style={styles.headerTitle}>{symbol}</Text>
            <Text style={styles.headerSub}>Update Portfolio Position</Text>
          </View>

          <View style={styles.snapshotCard}>
            <View style={styles.snapshotRow}>
              <View style={styles.snapshotItem}>
                <Text style={styles.snapshotLabel}>Current Shares</Text>
                <Text style={styles.snapshotValue}>{currentShares}</Text>
              </View>

              <View style={styles.snapshotDivider} />

              <View style={styles.snapshotItem}>
                <Text style={styles.snapshotLabel}>Avg Cost</Text>
                <Text style={styles.snapshotValue}>{money(currentAvg)}</Text>
              </View>
            </View>
          </View>

          <View style={styles.typeToggle}>
            <TouchableOpacity
              style={[
                styles.typeButton,
                txType === "BUY" && styles.typeButtonBuyActive,
              ]}
              onPress={() => setTxType("BUY")}
              activeOpacity={0.85}
            >
              <Text
                style={[
                  styles.typeText,
                  txType === "BUY" && { color: BRAND.green },
                ]}
              >
                Buy More
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.typeButton,
                txType === "SELL" && styles.typeButtonSellActive,
              ]}
              onPress={() => setTxType("SELL")}
              activeOpacity={0.85}
            >
              <Text
                style={[
                  styles.typeText,
                  txType === "SELL" && { color: BRAND.red },
                ]}
              >
                Sell Shares
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.formCard}>
            <View style={styles.fieldBlock}>
              <Text style={styles.label}>Shares</Text>
              <TextInput
                style={styles.input}
                placeholder="Example: 10"
                placeholderTextColor={BRAND.muted}
                keyboardType="decimal-pad"
                value={txShares}
                onChangeText={setTxShares}
                returnKeyType={txType === "BUY" ? "next" : "default"}
                onSubmitEditing={() => {
                  if (txType === "BUY") priceRef.current?.focus();
                  else Keyboard.dismiss();
                }}
              />
            </View>

            {txType === "BUY" && (
              <View style={[styles.fieldBlock, styles.lastFieldBlock]}>
                <Text style={styles.label}>Price per Share</Text>
                <TextInput
                  ref={priceRef}
                  style={styles.input}
                  placeholder="Example: 150.00"
                  placeholderTextColor={BRAND.muted}
                  keyboardType="decimal-pad"
                  value={txPrice}
                  onChangeText={setTxPrice}
                  returnKeyType="default"
                  onSubmitEditing={() => Keyboard.dismiss()}
                />
              </View>
            )}
          </View>

          <View style={styles.previewCard}>
            <View style={styles.previewHeaderRow}>
              <Text style={styles.previewTitle}>Result Preview</Text>
              <Text
                style={[
                  styles.previewBadge,
                  { color: txType === "BUY" ? BRAND.green : BRAND.red },
                ]}
              >
                {txType}
              </Text>
            </View>

            <View style={styles.previewRow}>
              <Text style={styles.previewLabel}>New Shares</Text>
              <Text style={styles.previewValue}>{fmt(newShares)}</Text>
            </View>

            <View style={styles.previewRow}>
              <Text style={styles.previewLabel}>New Avg Cost</Text>
              <Text style={styles.previewValue}>{money(newAvg)}</Text>
            </View>

            <View style={styles.previewRow}>
              <Text style={styles.previewLabel}>
                {txType === "BUY"
                  ? "Estimated Buy Value"
                  : "Estimated Position Reduction"}
              </Text>
              <Text style={styles.previewValue}>
                {Number(txShares) > 0 &&
                (txType === "SELL" || Number(txPrice) > 0)
                  ? money(txValue)
                  : "—"}
              </Text>
            </View>
          </View>

          <Pressable
            onPress={handleSubmit}
            disabled={!isValid || loading}
            style={({ pressed }) => [
              styles.saveBtn,
              (!isValid || loading) && styles.saveDisabled,
              pressed && isValid && !loading && { opacity: 0.65 },
            ]}
          >
            <Text style={styles.saveText}>
              {loading
                ? "Applying Transaction…"
                : txType === "BUY"
                  ? "Apply Buy Transaction"
                  : "Update Shares"}
            </Text>
          </Pressable>

          <View style={styles.footerWrap}>
            <Text style={styles.footerText}>
              Powered by <Text style={styles.footerBrand}>Alphaclara</Text>
            </Text>

            <Text style={styles.disclaimer}>
              Portfolio transactions are used for tracking and educational
              purposes only. This is not financial, investment, trading, or tax
              advice.
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
    paddingTop: 54,
    paddingBottom: 90,
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
    marginBottom: 14,
  },

  headerTitle: {
    color: BRAND.text,
    fontSize: 30,
    fontFamily: TYPO.fontFamily.extrabold,
    letterSpacing: -0.4,
    marginBottom: 5,
  },
  headerSub: {
    color: BRAND.muted,
    fontSize: 12.5,
    fontFamily: TYPO.fontFamily.medium,
  },

  snapshotCard: {
    backgroundColor: "rgba(17,24,39,0.82)",

    borderRadius: 24,

    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.05)",

    padding: 18,

    marginBottom: 12,

    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.18,
    shadowRadius: 20,
  },

  snapshotRow: {
    flexDirection: "row",
    alignItems: "center",
  },

  snapshotItem: {
    flex: 1,
    alignItems: "center",
  },

  snapshotDivider: {
    width: 1,
    height: 34,
    backgroundColor: BRAND.softBorder,
  },
  snapshotLabel: {
    color: BRAND.muted,
    fontSize: 11,
    fontFamily: TYPO.fontFamily.bold,
    marginBottom: 5,
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },

  snapshotValue: {
    color: BRAND.text,
    fontSize: 18,
    fontFamily: TYPO.fontFamily.extrabold,
    fontVariant: ["tabular-nums"],
  },
  typeToggle: {
    flexDirection: "row",

    backgroundColor: "rgba(255,255,255,0.04)",

    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",

    borderRadius: 999,

    padding: 4,

    marginBottom: 12,
  },

  typeButton: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: 999,
    alignItems: "center",
  },

  typeButtonBuyActive: {
    backgroundColor: "rgba(255,255,255,0.10)",
  },

  typeButtonSellActive: {
    backgroundColor: "rgba(255,255,255,0.10)",
  },
  typeText: {
    color: BRAND.sub,
    fontSize: 13,
    fontFamily: TYPO.fontFamily.bold,
  },

  formCard: {
    backgroundColor: "rgba(17,24,39,0.82)",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.05)",
    padding: 15,
    marginBottom: 12,
  },

  fieldBlock: {
    marginBottom: 10,
  },

  label: {
    color: BRAND.sub,
    marginBottom: 8,
    fontSize: 12,
    fontFamily: TYPO.fontFamily.bold,
    letterSpacing: 0.15,
  },

  input: {
    backgroundColor: BRAND.card2,

    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",

    borderRadius: 16,

    paddingHorizontal: 15,
    paddingVertical: 14,

    color: BRAND.text,

    fontSize: 15,
    fontFamily: TYPO.fontFamily.semibold,
  },

  previewCard: {
    backgroundColor: "rgba(17,24,39,0.82)",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.05)",
    padding: 15,
    marginBottom: 12,
  },

  previewHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 10,
  },

  previewTitle: {
    color: BRAND.text,
    fontSize: 16,
    fontFamily: TYPO.fontFamily.extrabold,
  },

  previewBadge: {
    fontSize: 11,
    fontWeight: "900",
  },

  previewRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 7,
    borderBottomWidth: 1,
    borderBottomColor: BRAND.softBorder,
  },

  previewLabel: {
    color: BRAND.sub,
    fontSize: 12,
    fontFamily: TYPO.fontFamily.medium,
  },

  previewValue: {
    color: BRAND.text,
    fontSize: 13,
    fontFamily: TYPO.fontFamily.bold,
    fontVariant: ["tabular-nums"],
  },

  saveBtn: {
    marginTop: 4,

    backgroundColor: "#FFFFFF",

    paddingVertical: 15,

    borderRadius: 18,

    alignItems: "center",

    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 18,
  },

  saveDisabled: {
    backgroundColor: "#374151",
  },

  saveText: {
    color: "#0A0A0A",
    fontSize: 15,
    fontFamily: TYPO.fontFamily.bold,
  },
  footerWrap: {
    marginTop: 18,
    alignItems: "center",
    paddingHorizontal: 14,
  },

  footerText: {
    color: BRAND.sub,
    fontSize: 12,
    marginBottom: 8,
  },

  footerBrand: {
    color: BRAND.text,
    fontFamily: TYPO.fontFamily.bold,
  },

  disclaimer: {
    color: BRAND.muted,
    fontSize: 10.5,
    lineHeight: 15,
    fontFamily: TYPO.fontFamily.regular,
    textAlign: "center",
  },
  lastFieldBlock: {
    marginBottom: 0,
  },
});
