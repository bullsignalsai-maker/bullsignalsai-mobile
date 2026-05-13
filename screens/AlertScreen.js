import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  TextInput,
  Pressable,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Haptics from "expo-haptics";
import { BRAND } from "../constants/theme";
import { TYPO } from "../constants/typography";
const STORAGE_KEY = "@bullsignals_alerts";

export default function AlertScreen({ navigation }) {
  const [alerts, setAlerts] = useState([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [symbol, setSymbol] = useState("");
  const [price, setPrice] = useState("");
  const [sortOpen, setSortOpen] = useState(false);
  const [sortKey, setSortKey] = useState("status");
  const [lastSyncedAt, setLastSyncedAt] = useState(Date.now());
  const refreshTimer = useRef(null);

  useEffect(() => {
    loadAlerts();
    refreshTimer.current = setInterval(loadAlerts, 60_000);
    return () => clearInterval(refreshTimer.current);
  }, []);

  const loadAlerts = async () => {
    const saved = await AsyncStorage.getItem(STORAGE_KEY);
    const parsed = saved ? JSON.parse(saved) : [];
    setAlerts(
      parsed.map((a) => ({ ...a, createdAt: a.createdAt || Date.now() })),
    );
    setLastSyncedAt(Date.now());
  };

  const saveAlerts = async (data) => {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  };

  const addAlert = async () => {
    if (!symbol.trim() || !price.trim()) return;
    const newAlert = {
      id: Date.now().toString(),
      symbol: symbol.trim().toUpperCase(),
      target: Number(price),
      status: "Active",
      confidence: Math.floor(60 + Math.random() * 30),
      message: "AI detects strong trend potential.",
      created: new Date().toLocaleDateString(),
      createdAt: Date.now(),
    };
    const updated = [newAlert, ...alerts];
    setAlerts(updated);
    await saveAlerts(updated);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setShowAddModal(false);
    setSymbol("");
    setPrice("");
  };

  const removeAlert = async (id) => {
    const updated = alerts.filter((a) => a.id !== id);
    setAlerts(updated);
    await saveAlerts(updated);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
  };

  const toggleStatus = async (id) => {
    const updated = alerts.map((a) =>
      a.id === id
        ? {
            ...a,
            status:
              a.status === "Active"
                ? "Triggered"
                : a.status === "Triggered"
                  ? "Expired"
                  : "Active",
          }
        : a,
    );
    setAlerts(updated);
    await saveAlerts(updated);
  };

  const statusOrder = { Active: 0, Triggered: 1, Expired: 2 };
  const sortedAlerts = useMemo(() => {
    const copy = [...alerts];
    switch (sortKey) {
      case "symbol":
        copy.sort((a, b) => a.symbol.localeCompare(b.symbol));
        break;
      case "date":
        copy.sort((a, b) => b.createdAt - a.createdAt);
        break;
      default:
        copy.sort((a, b) => statusOrder[a.status] - statusOrder[b.status]);
    }
    return copy;
  }, [alerts, sortKey]);

  const counts = {
    total: alerts.length,
    active: alerts.filter((a) => a.status === "Active").length,
    triggered: alerts.filter((a) => a.status === "Triggered").length,
    expired: alerts.filter((a) => a.status === "Expired").length,
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case "Active":
        return "flash-outline";
      case "Triggered":
        return "notifications-outline";
      case "Expired":
        return "time-outline";
      default:
        return "alert-circle-outline";
    }
  };

  const timeAgo = (t) => {
    const s = Math.floor((Date.now() - t) / 1000);
    if (s < 60) return `${s}s ago`;
    const m = Math.floor(s / 60);
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    return `${h}h ago`;
  };

  return (
    <View style={styles.container}>
      {/* HEADER: < Main | AI Alerts */}
      <View style={styles.headerBar}>
        <TouchableOpacity
          style={styles.headerLeft}
          onPress={() => navigation.goBack()}
        >
          <Ionicons
            name="chevron-back-outline"
            size={22}
            color={BRAND.accent}
          />
          <Text style={styles.mainText}></Text>
        </TouchableOpacity>

        <View style={styles.headerTitleWrap}>
          <Ionicons
            name="notifications-outline"
            size={20}
            color={BRAND.accent}
            style={{ marginRight: 6 }}
          />
          <Text style={styles.headerTitle}>AI Alerts</Text>
        </View>

        <View style={{ width: 30 }} />
      </View>

      {/* SUBHEADER */}
      <View style={styles.headerInfo}>
        <Text style={styles.headerSubtitle}>
          Smart Price Triggers & Watchpoints
        </Text>
        <Text style={styles.syncText}>
          Synced {timeAgo(lastSyncedAt)} • {counts.active} Active Alerts
        </Text>
      </View>

      {/* ADD ALERT BUTTON */}
      <TouchableOpacity
        style={styles.addRow}
        onPress={() => setShowAddModal(true)}
        activeOpacity={0.85}
      >
        <Ionicons
          name="add-circle-outline"
          size={20}
          color={BRAND.accent}
          style={{ marginRight: 8 }}
        />
        <Text style={styles.addText}>Add New Alert</Text>
      </TouchableOpacity>

      {/* SORT + ALERTS */}
      <View style={styles.sortRow}>
        <Text style={styles.sortLabel}>Sort by</Text>
        <TouchableOpacity onPress={() => setSortOpen(true)}>
          <Ionicons name="swap-vertical-outline" size={20} color={BRAND.text} />
        </TouchableOpacity>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 120 }}
      >
        {sortedAlerts.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons
              name="notifications-off-outline"
              size={48}
              color={BRAND.sub}
            />
            <Text style={styles.emptyTitle}>No Alerts Yet</Text>
            <Text style={styles.emptyText}>
              Tap “Add New Alert” to get started.
            </Text>
          </View>
        ) : (
          sortedAlerts.map((a) => {
            const color =
              a.status === "Active"
                ? BRAND.accent
                : a.status === "Triggered"
                  ? BRAND.amber
                  : BRAND.red;
            return (
              <View
                key={a.id}
                style={[styles.card, { borderLeftColor: color }]}
              >
                <View style={styles.cardHeader}>
                  <View>
                    <Text style={styles.symbol}>{a.symbol}</Text>
                    <Text style={styles.subText}>Set on {a.created}</Text>
                  </View>
                  <View style={{ alignItems: "flex-end" }}>
                    <Text style={styles.target}>${a.target.toFixed(2)}</Text>
                    <View
                      style={[styles.statusPill, { backgroundColor: color }]}
                    >
                      <Ionicons
                        name={getStatusIcon(a.status)}
                        size={12}
                        color="#000"
                        style={{ marginRight: 4 }}
                      />
                      <Text style={styles.statusText}>{a.status}</Text>
                    </View>
                  </View>
                </View>
                <Text style={styles.aiText}>
                  {a.message} Confidence: {a.confidence}%
                </Text>
                <View style={styles.actionsRow}>
                  <TouchableOpacity onPress={() => toggleStatus(a.id)}>
                    <Ionicons
                      name="refresh-circle"
                      size={22}
                      color={BRAND.accent}
                    />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => removeAlert(a.id)}>
                    <Ionicons
                      name="trash-outline"
                      size={22}
                      color={BRAND.red}
                    />
                  </TouchableOpacity>
                </View>
              </View>
            );
          })
        )}
      </ScrollView>

      {/* SUMMARY PILL */}
      <View style={styles.summaryPill}>
        <Text style={styles.summaryText}>
          Total: {counts.total} • Active: {counts.active} • Triggered:{" "}
          {counts.triggered} • Expired: {counts.expired}
        </Text>
      </View>

      {/* SORT MENU */}
      <Modal transparent visible={sortOpen} animationType="fade">
        <Pressable
          style={styles.sortOverlay}
          onPress={() => setSortOpen(false)}
        >
          <View style={styles.sortMenu}>
            <Text style={styles.sortTitle}>Sort by</Text>
            {[
              {
                key: "status",
                label: "Status (Active → Expired)",
                icon: "flash-outline",
              },
              { key: "symbol", label: "Symbol (A–Z)", icon: "text-outline" },
              { key: "date", label: "Date (Newest)", icon: "time-outline" },
            ].map((opt) => (
              <TouchableOpacity
                key={opt.key}
                style={[
                  styles.sortItem,
                  sortKey === opt.key && styles.sortItemActive,
                ]}
                onPress={() => {
                  setSortKey(opt.key);
                  setSortOpen(false);
                }}
              >
                <Ionicons name={opt.icon} size={16} color={BRAND.accent} />
                <Text style={styles.sortLabelText}>{opt.label}</Text>
                {sortKey === opt.key && (
                  <Ionicons name="checkmark" size={16} color={BRAND.accent} />
                )}
              </TouchableOpacity>
            ))}
          </View>
        </Pressable>
      </Modal>

      {/* ADD ALERT MODAL */}
      <Modal transparent visible={showAddModal} animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Add Price Alert</Text>
            <TextInput
              style={styles.input}
              placeholder="Symbol (e.g., TSLA)"
              placeholderTextColor="#666"
              value={symbol}
              onChangeText={setSymbol}
              autoCapitalize="characters"
            />
            <TextInput
              style={styles.input}
              placeholder="Target Price (e.g., 200)"
              placeholderTextColor="#666"
              keyboardType="numeric"
              value={price}
              onChangeText={setPrice}
            />
            <View style={styles.modalActions}>
              <TouchableOpacity onPress={() => setShowAddModal(false)}>
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={addAlert}>
                <Text style={styles.addBtnText}>Add</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

/* === Styles === */
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BRAND.bg, paddingHorizontal: 16 },
  headerBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 56,
    paddingBottom: 12,
  },
  headerLeft: { flexDirection: "row", alignItems: "center" },
  mainText: { color: BRAND.text, fontSize: 15, marginLeft: 4 },
  headerTitleWrap: { flexDirection: "row", alignItems: "center" },
  headerInfo: { alignItems: "center", marginBottom: 10 },
  headerTitle: {
    color: BRAND.text,
    fontSize: 24,
    fontFamily: TYPO.fontFamily.extrabold,
    letterSpacing: -0.3,
  },

  headerSubtitle: {
    color: BRAND.sub,
    fontSize: 12,
    marginTop: 2,
    fontFamily: TYPO.fontFamily.medium,
  },

  syncText: {
    color: BRAND.muted,
    fontSize: 11,
    marginTop: 4,
    fontFamily: TYPO.fontFamily.semibold,
  },

  addRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    paddingVertical: 12,
    marginVertical: 12,
  },

  addText: {
    color: "#0A0A0A",
    fontSize: 14,
    fontFamily: TYPO.fontFamily.bold,
  },

  sortRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "center",
    marginBottom: 8,
  },
  sortLabel: { color: BRAND.sub, fontSize: 13, marginRight: 6 },

  emptyState: { alignItems: "center", marginTop: 100 },
  emptyTitle: {
    color: BRAND.text,
    fontSize: 16,
    fontWeight: "700",
    marginTop: 10,
  },
  emptyText: { color: BRAND.sub, fontSize: 13, marginTop: 4 },

  card: {
    backgroundColor: BRAND.card,
    borderRadius: 18,
    borderWidth: 1,
    borderLeftWidth: 3,
    borderColor: BRAND.border,
    padding: 14,
    marginBottom: 10,
  },
  Header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  symbol: {
    color: BRAND.text,
    fontSize: 17,
    fontFamily: TYPO.fontFamily.extrabold,
  },
  target: {
    color: BRAND.text,
    fontSize: 15,
    fontFamily: TYPO.fontFamily.bold,
  },
  statusPill: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 8,
    paddingVertical: 2,
    paddingHorizontal: 8,
    marginTop: 4,
  },
  statusText: {
    color: "#000",
    fontSize: 11,
    fontFamily: TYPO.fontFamily.bold,
  },
  subText: {
    color: BRAND.muted,
    fontSize: 11,
    marginTop: 2,
    fontFamily: TYPO.fontFamily.medium,
  },

  aiText: {
    color: BRAND.sub,
    fontSize: 12.5,
    lineHeight: 18,
    marginTop: 7,
    fontFamily: TYPO.fontFamily.medium,
  },
  actionsRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginTop: 10,
    gap: 16,
  },

  summaryPill: {
    position: "absolute",
    bottom: 16,
    alignSelf: "center",
    backgroundColor: "rgba(17,24,39,0.9)",
    borderRadius: 16,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: BRAND.border,
  },
  summaryText: { color: BRAND.sub, fontSize: 12 },

  sortOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-start",
    alignItems: "flex-end",
    paddingTop: 80,
    paddingRight: 12,
  },
  sortMenu: {
    backgroundColor: BRAND.card,
    borderWidth: 1,
    borderColor: BRAND.border,
    borderRadius: 12,
    width: 240,
    paddingVertical: 8,
  },
  sortTitle: {
    color: BRAND.sub,
    fontSize: 12,
    paddingHorizontal: 12,
    paddingBottom: 6,
  },
  sortItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 12,
    justifyContent: "space-between",
  },
  sortItemActive: { backgroundColor: "#0f1220" },
  sortLabelText: { color: BRAND.text, fontSize: 14, flex: 1, marginLeft: 8 },

  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  modalBox: {
    backgroundColor: BRAND.card,
    borderWidth: 1,
    borderColor: BRAND.border,
    borderRadius: 14,
    width: "100%",
    padding: 16,
  },
  modalTitle: {
    color: BRAND.text,
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 10,
  },
  input: {
    backgroundColor: "#0A0A0A",
    color: BRAND.text,
    borderRadius: 10,
    padding: 10,
    fontSize: 15,
    borderWidth: 1,
    borderColor: BRAND.border,
    marginBottom: 10,
  },
  modalActions: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 10,
  },
  cancelText: { color: BRAND.sub, fontSize: 14, fontWeight: "600" },
  addBtnText: { color: BRAND.accent, fontSize: 14, fontWeight: "700" },
});
