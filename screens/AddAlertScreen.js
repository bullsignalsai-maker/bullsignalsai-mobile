import React, { useEffect, useState, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Switch,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  TouchableWithoutFeedback,
  Keyboard,
  Pressable,
  StatusBar,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { auth, db } from "../firebaseConfig";
import { doc, getDoc, setDoc, deleteDoc } from "firebase/firestore";
import { BRAND } from "../constants/theme";

export default function AddAlertScreen({ route, navigation }) {
  const symbol = route?.params?.symbol;
    const companyName = route?.params?.companyName || symbol;
    const currentPrice = route?.params?.price;
    const currentChange = route?.params?.change;
    const currentChangePct = route?.params?.changePct;
    const session = route?.params?.session;
    const quoteUpdatedAt = route?.params?.quoteUpdatedAt;

    const isUp = Number(currentChangePct) >= 0;
    const hasPrice = typeof currentPrice === "number";

    const formatMoney = (v) =>
    typeof v === "number" && !Number.isNaN(v) ? `$${v.toFixed(2)}` : "—";

    const formatPct = (v) =>
    typeof v === "number" && !Number.isNaN(v)
        ? `${v >= 0 ? "+" : ""}${v.toFixed(2)}%`
        : "—";

    const formatChange = (v) =>
    typeof v === "number" && !Number.isNaN(v)
        ? `${v >= 0 ? "+" : "-"}$${Math.abs(v).toFixed(2)}`
        : "—";
  const userId = auth.currentUser?.uid;

  const [enabled, setEnabled] = useState(true);
  const [abovePrice, setAbovePrice] = useState("");
  const [belowPrice, setBelowPrice] = useState("");
  const [saving, setSaving] = useState(false);
  const [savedAlert, setSavedAlert] = useState(null);
    const [editing, setEditing] = useState(false);  
  const belowRef = useRef(null);

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
        setSavedAlert(data);
        setEditing(false);
        setEnabled(data.enabled ?? true);
        setAbovePrice(data.abovePrice ? String(data.abovePrice) : "");
        setBelowPrice(data.belowPrice ? String(data.belowPrice) : "");
        }
  };

  const saveAlert = async () => {
    Keyboard.dismiss();

    if (!userId || !symbol) return;

    const above = abovePrice.trim() ? Number(abovePrice) : null;
    const below = belowPrice.trim() ? Number(belowPrice) : null;

    if (enabled && above === null && below === null) {
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
        setSavedAlert({
        symbol,
        enabled,
        abovePrice: above,
        belowPrice: below,
        updatedAt: new Date().toISOString(),
        });

        setEditing(false);
     Alert.alert(
    savedAlert ? "Alert Updated" : "Alert Saved",
    enabled
        ? `${symbol} price alert has been saved.`
        : `${symbol} price alert has been disabled.`,
    [{ text: "OK", onPress: () => navigation.goBack() }]
    );
    } catch (e) {
      Alert.alert("Save Failed", e.message || "Could not save alert.");
    } finally {
      setSaving(false);
    }
  };

  const hasValidInput =
  savedAlert
    ? !enabled || Number(abovePrice) > 0 || Number(belowPrice) > 0
    : enabled && (Number(abovePrice) > 0 || Number(belowPrice) > 0);
    const aboveDistancePct =
    hasPrice && Number(abovePrice) > 0
        ? ((Number(abovePrice) - currentPrice) / currentPrice) * 100
        : null;

    const belowDistancePct =
    hasPrice && Number(belowPrice) > 0
        ? ((Number(belowPrice) - currentPrice) / currentPrice) * 100
        : null;
  const deleteAlert = async () => {
  if (!userId || !symbol) return;

  Alert.alert("Delete Alert", `Remove ${symbol} price alert?`, [
    { text: "Cancel", style: "cancel" },
    {
      text: "Delete",
      style: "destructive",
      onPress: async () => {
        const ref = doc(
          db,
          "users",
          userId,
          "watchlist",
          symbol,
          "alerts",
          "price_alert"
        );

        await deleteDoc(ref);

        setSavedAlert(null);
        setEnabled(true);
        setAbovePrice("");
        setBelowPrice("");
        setEditing(true);
      },
    },
  ]);
};

const startEditing = () => {
  setEditing(true);
  setEnabled(savedAlert?.enabled ?? true);
  setAbovePrice(savedAlert?.abovePrice ? String(savedAlert.abovePrice) : "");
  setBelowPrice(savedAlert?.belowPrice ? String(savedAlert.belowPrice) : "");
};
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
    

          <View style={styles.card}>
            <View style={styles.iconWrap}>
              <Ionicons
                name="notifications-outline"
                size={30}
                color={BRAND.accent}
              />
            </View>

            <Text style={styles.title}>{symbol} Alert</Text>
                <Text style={styles.subtitle}>
                Set a price alert to stay informed when {symbol} reaches your selected level.
                </Text>

                <View style={styles.livePriceCard}>
                <View style={{ flex: 1 }}>
                    <Text style={styles.liveLabel}>Current Price</Text>
                    <Text style={styles.liveCompany} numberOfLines={1}>
                    {companyName}
                    </Text>
                </View>

                <View style={styles.liveRight}>
                    <Text style={styles.livePrice}>
                    {hasPrice ? formatMoney(currentPrice) : "—"}
                    </Text>

                    <Text
                    style={[
                        styles.liveChange,
                        { color: isUp ? BRAND.accent : BRAND.red },
                    ]}
                    >
                    {formatChange(currentChange)} ({formatPct(currentChangePct)})
                    </Text>

                    {!!session && (
                    <Text style={styles.liveSession}>
                        {session}
                    </Text>
                    )}
                </View>
                </View>
            {savedAlert && !editing ? (
            <View style={styles.savedAlertCard}>
                <View style={styles.savedTopRow}>
                <View>
                    <Text style={styles.savedTitle}>Saved Alert</Text>
                    <Text style={styles.savedMeta}>
                    {symbol} · {savedAlert.enabled ? "Enabled" : "Disabled"}
                    </Text>
                </View>

                <View
                    style={[
                    styles.statusPill,
                    savedAlert.enabled ? styles.statusOn : styles.statusOff,
                    ]}
                >
                    <Text
                    style={[
                        styles.statusText,
                        { color: savedAlert.enabled ? BRAND.accent : BRAND.sub },
                    ]}
                    >
                    {savedAlert.enabled ? "ON" : "OFF"}
                    </Text>
                </View>
                </View>

                <View style={styles.savedLevels}>
                <Text style={styles.savedLevelText}>
                    Trigger Above:{" "}
                    <Text style={styles.savedLevelValue}>
                    {savedAlert.abovePrice ? `$${savedAlert.abovePrice}` : "—"}
                    </Text>
                </Text>

                <Text style={styles.savedLevelText}>
                    Trigger Below:{" "}
                    <Text style={styles.savedLevelValue}>
                    {savedAlert.belowPrice ? `$${savedAlert.belowPrice}` : "—"}
                    </Text>
                </Text>
                </View>

                <View style={styles.savedActions}>
                <Pressable style={styles.editAlertBtn} onPress={startEditing}>
                    <Text style={styles.editAlertText}>Edit</Text>
                </Pressable>

                <Pressable style={styles.deleteAlertBtn} onPress={deleteAlert}>
                    <Text style={styles.deleteAlertText}>Delete</Text>
                </Pressable>
                </View>
            </View>
            ) : null}
            {(!savedAlert || editing) && (
                <>
                    <Text style={styles.formTitle}>
                    {savedAlert ? "Edit Alert" : "Add New Alert"}
                    </Text>

                    <View style={styles.row}>
                    <View>
                        <Text style={styles.label}>Enable Alert</Text>
                        <Text style={styles.helper}>Turn this alert on or off.</Text>
                    </View>

                    <Switch
                        value={enabled}
                        onValueChange={setEnabled}
                        trackColor={{ false: "#374151", true: BRAND.accent }}
                        thumbColor="#FFF"
                    />
                    </View>

                    <View style={styles.inputBlock}>
                    <Text style={styles.inputLabel}>Alert when price is above</Text>
                    <TextInput
                        value={abovePrice}
                        onChangeText={setAbovePrice}
                        placeholder="Example: 25.00"
                        placeholderTextColor={BRAND.muted}
                        keyboardType="decimal-pad"
                        returnKeyType="next"
                        editable={enabled}
                        onSubmitEditing={() => belowRef.current?.focus()}
                        style={[styles.input, !enabled && styles.inputDisabled]}
                    />
                    </View>

                    <View style={styles.inputBlock}>
                    <Text style={styles.inputLabel}>Alert when price is below</Text>
                    <TextInput
                        ref={belowRef}
                        value={belowPrice}
                        onChangeText={setBelowPrice}
                        placeholder="Example: 18.50"
                        placeholderTextColor={BRAND.muted}
                        keyboardType="decimal-pad"
                        returnKeyType="default"
                        editable={enabled}
                        onSubmitEditing={() => Keyboard.dismiss()}
                        style={[styles.input, !enabled && styles.inputDisabled]}
                    />
                    </View>
                    {enabled && !hasValidInput ? (
                    <Text style={styles.validationText}>
                        Enter at least one price level to activate alert.
                    </Text>
                    ) : null}

                    {enabled && aboveDistancePct !== null ? (
                    <Text style={styles.previewText}>
                        Alert will trigger ABOVE current price (
                        {aboveDistancePct >= 0 ? "+" : ""}
                        {aboveDistancePct.toFixed(1)}%)
                    </Text>
                    ) : null}

                    {enabled && belowDistancePct !== null ? (
                    <Text style={styles.previewText}>
                        Alert will trigger BELOW current price (
                        {belowDistancePct >= 0 ? "+" : ""}
                        {belowDistancePct.toFixed(1)}%)
                    </Text>
                    ) : null}

                    <Pressable
                    style={({ pressed }) => [
                        styles.saveBtn,
                        (!hasValidInput || saving) && styles.saveDisabled,
                        pressed && hasValidInput && !saving && { opacity: 0.65 },
                    ]}
                    onPress={saveAlert}
                    disabled={!hasValidInput || saving}
                    >
                    <Text style={styles.saveText}>
                        {saving
                        ? "Saving Alert…"
                        : savedAlert && !enabled
                        ? "Disable Alert"
                        : savedAlert
                        ? "Update Alert"
                        : "Save Alert"}
                    </Text>
                    </Pressable>
                </>
                )}

            <View style={styles.footerWrap}>
            <Text style={styles.footerText}>
                Powered by <Text style={styles.footerBrand}>Alphaclara</Text>
            </Text>

            <Text style={styles.note}>
                Alerts are informational only and not financial, investment,
                trading, or tax advice.
            </Text>
            </View>
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
  paddingTop: 18,
  paddingBottom: 60,
},


  card: {
    backgroundColor: BRAND.card,
    borderWidth: 1,
    borderColor: BRAND.border,
    borderRadius: 22,
    padding: 18,
  },

  iconWrap: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: "rgba(0,227,150,0.08)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "rgba(0,227,150,0.24)",
  },

  title: {
    color: BRAND.text,
    fontSize: 24,
    fontWeight: "900",
  },

  subtitle: {
    color: BRAND.sub,
    fontSize: 13,
    marginTop: 6,
    lineHeight: 19,
  },

  row: {
    marginTop: 22,
    marginBottom: 16,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 16,
    backgroundColor: BRAND.card2,
    borderWidth: 1,
    borderColor: BRAND.softBorder,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },

  label: {
    color: BRAND.text,
    fontSize: 14,
    fontWeight: "800",
  },

  helper: {
    color: BRAND.muted,
    fontSize: 11,
    marginTop: 3,
    fontWeight: "700",
  },

  inputBlock: {
    marginBottom: 14,
  },

  inputLabel: {
    color: BRAND.sub,
    fontSize: 12,
    marginBottom: 7,
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

  saveBtn: {
    marginTop: 10,
    backgroundColor: BRAND.accent,
    borderRadius: 16,
    paddingVertical: 15,
    alignItems: "center",
  },

  saveDisabled: {
  backgroundColor: "#374151",
  opacity: 0.8,
},

  saveText: {
    color: BRAND.bg,
    fontSize: 15,
    fontWeight: "900",
  },

  note: {
    color: BRAND.muted,
    fontSize: 11,
    lineHeight: 16,
    marginTop: 14,
    textAlign: "center",
  },
  inputDisabled: {
  opacity: 0.45,
},
savedAlertCard: {
  marginTop: 18,
  backgroundColor: BRAND.card2,
  borderWidth: 1,
  borderColor: BRAND.border,
  borderRadius: 18,
  padding: 14,
},

savedTopRow: {
  flexDirection: "row",
  justifyContent: "space-between",
  alignItems: "center",
},

savedTitle: {
  color: BRAND.text,
  fontSize: 15,
  fontWeight: "900",
},

savedMeta: {
  color: BRAND.muted,
  fontSize: 11.5,
  marginTop: 3,
  fontWeight: "700",
},

statusPill: {
  paddingHorizontal: 9,
  paddingVertical: 4,
  borderRadius: 999,
  borderWidth: 1,
},

statusOn: {
  backgroundColor: "rgba(0,227,150,0.10)",
  borderColor: "rgba(0,227,150,0.35)",
},

statusOff: {
  backgroundColor: "rgba(107,114,128,0.10)",
  borderColor: "rgba(107,114,128,0.30)",
},

statusText: {
  fontSize: 10.5,
  fontWeight: "900",
},

savedLevels: {
  marginTop: 12,
  rowGap: 5,
},

savedLevelText: {
  color: BRAND.sub,
  fontSize: 12,
  fontWeight: "700",
},

savedLevelValue: {
  color: BRAND.text,
  fontWeight: "900",
},

savedActions: {
  flexDirection: "row",
  columnGap: 10,
  marginTop: 14,
},

editAlertBtn: {
  flex: 1,
  paddingVertical: 10,
  borderRadius: 999,
  backgroundColor: "rgba(0,227,150,0.10)",
  borderWidth: 1,
  borderColor: "rgba(0,227,150,0.35)",
  alignItems: "center",
},

editAlertText: {
  color: BRAND.accent,
  fontSize: 13,
  fontWeight: "900",
},

deleteAlertBtn: {
  flex: 1,
  paddingVertical: 10,
  borderRadius: 999,
  backgroundColor: "rgba(239,68,68,0.10)",
  borderWidth: 1,
  borderColor: "rgba(239,68,68,0.35)",
  alignItems: "center",
},

deleteAlertText: {
  color: BRAND.red,
  fontSize: 13,
  fontWeight: "900",
},

formTitle: {
  color: BRAND.text,
  fontSize: 15,
  fontWeight: "900",
  marginTop: 20,
  marginBottom: 4,
},
livePriceCard: {
  marginTop: 16,
  backgroundColor: BRAND.card2,
  borderWidth: 1,
  borderColor: BRAND.border,
  borderRadius: 18,
  padding: 14,
  flexDirection: "row",
  justifyContent: "space-between",
  alignItems: "center",
},

liveLabel: {
  color: BRAND.muted,
  fontSize: 11,
  fontWeight: "900",
  textTransform: "uppercase",
  letterSpacing: 0.4,
  marginBottom: 4,
},

liveCompany: {
  color: BRAND.sub,
  fontSize: 12,
  fontWeight: "700",
},

liveRight: {
  alignItems: "flex-end",
  marginLeft: 12,
},

livePrice: {
  color: BRAND.text,
  fontSize: 18,
  fontWeight: "900",
},

liveChange: {
  fontSize: 12,
  fontWeight: "900",
  marginTop: 3,
},

liveSession: {
  color: BRAND.muted,
  fontSize: 10.5,
  fontWeight: "800",
  marginTop: 2,
},

validationText: {
  color: BRAND.red,
  fontSize: 11,
  marginTop: 2,
  marginBottom: 8,
  fontWeight: "700",
},

divider: {
  height: 1,
  backgroundColor: BRAND.border,
  marginTop: 18,
  marginBottom: 10,
},
previewText: {
  color: BRAND.sub,
  fontSize: 11.5,
  lineHeight: 16,
  marginTop: 2,
  marginBottom: 6,
  fontWeight: "700",
},

footerWrap: {
  marginTop: 18,
  alignItems: "center",
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
});