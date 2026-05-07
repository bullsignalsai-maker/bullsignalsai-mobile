import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Animated,
  ActivityIndicator,
  Modal,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { getDecisionDetail } from "../services/decisionDetailService";
import { BRAND } from "../constants/theme";

function signalColor(signal) {
  const s = String(signal || "").toUpperCase();
  if (s.includes("BUY")) return BRAND.accent;
  if (s.includes("SELL")) return BRAND.red;
  return BRAND.amber;
}
function displayRatingLabel(signal) {
  const s = String(signal || "").toUpperCase();
  if (s.includes("BUY")) return "Bullish";
  if (s.includes("SELL")) return "Bearish";
  return "Neutral";
}
function cleanMetricLabel(label) {
  if (label === "5D Worst Return") return "5D Downside Range";
  if (label === "5D Best Return") return "5D Upside Range";
  if (label === "5D Avg Return") return "5D Average Return";
  return label;
}
function statusColor(status) {
  const s = String(status || "").toLowerCase();
  if (s === "passed") return BRAND.accent;
  if (s === "failed") return BRAND.red;
  return BRAND.amber;
}

function fmtMoney(v) {
  return v == null ? "—" : `$${Number(v).toFixed(2)}`;
}

function fmtPct(v) {
  return v == null ? "—" : `${Number(v).toFixed(2)}%`;
}

export default function SignalDetailScreen({ route, navigation }) {
  const symbol = route?.params?.symbol || route?.params?.ticker || "TSLA";

  const [infoModal, setInfoModal] = useState(null);

  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const getGateInfo = (gateName) => {
    const info = {
      Liquidity:
        "Liquidity checks whether trading volume is strong enough to trust the current price movement. Weak liquidity can make signals less reliable.",
      "Market Regime":
        "Market regime explains whether the stock is trading in normal, high-volatility, or unstable conditions. High volatility can reduce signal reliability.",
      "Feature Consensus":
        "Feature consensus checks whether trend, momentum, volume, and other technical indicators are pointing in the same direction.",
      "Pattern Quality":
        "Pattern quality reviews historical performance of the current chart pattern, including win rate and sample count.",
      "Pattern Alignment":
        "Pattern alignment checks whether the detected pattern bias supports or conflicts with the model signal.",
      "Expected Value":
        "Expected value compares historical upside and downside outcomes to judge whether the reward is worth the risk.",
      "Exhaustion / Fragility":
        "Exhaustion checks whether the stock looks stretched, unstable, or vulnerable to reversal after a strong move.",
    };

    return (
      info[gateName] ||
      "This gate explains one part of the model decision process."
    );
  };

  useEffect(() => {
    let mounted = true;

    async function load() {
      try {
        setLoading(true);
        setErr(null);
        const data = await getDecisionDetail(symbol);
        if (mounted) setDetail(data);
      } catch (e) {
        console.warn("Decision detail load failed:", e);
        if (mounted) setErr("Decision details unavailable.");
      } finally {
        if (mounted) setLoading(false);
      }
    }

    load();

    return () => {
      mounted = false;
    };
  }, [symbol]);

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 450,
      useNativeDriver: true,
    }).start();
  }, [fadeAnim]);

  if (loading) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator color={BRAND.accent} />
        <Text style={styles.loadingText}>Loading rating details...</Text>
      </View>
    );
  }

  if (err || !detail) {
    return (
      <View style={[styles.container, styles.center]}>
        <Ionicons name="warning-outline" size={24} color={BRAND.amber} />
        <Text style={styles.loadingText}>{err || "No decision data."}</Text>
      </View>
    );
  }

  const failedGates = detail.decisionLadder.filter(
    (x) => String(x.status).toLowerCase() === "failed",
  );

  const passedGates = detail.decisionLadder.filter(
    (x) => String(x.status).toLowerCase() === "passed",
  );

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingBottom: 36 }}
    >
      <Animated.View style={{ opacity: fadeAnim }}>
        <View style={styles.headerCard}>
          <View style={styles.headerRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.symbol}>{detail.symbol}</Text>
              <Text style={styles.company}>{detail.companyName}</Text>
            </View>

            <View style={{ alignItems: "flex-end" }}>
              <Text style={styles.price}>{fmtMoney(detail.quote.current)}</Text>
              <Text
                style={[
                  styles.change,
                  (detail.quote.changePct ?? 0) >= 0 ? styles.pos : styles.neg,
                ]}
              >
                {fmtPct(detail.quote.changePct)}
              </Text>
            </View>
          </View>

          <View style={styles.signalBox}>
            <Text
              style={[
                styles.signal,
                { color: signalColor(detail.finalSignal) },
              ]}
            >
              {displayRatingLabel(detail.finalSignal)}
            </Text>
            <Text style={styles.confidence}>
              {detail.confidence == null
                ? "Confidence unavailable"
                : `${detail.confidence.toFixed(1)}% confidence • ${detail.confidenceLabel}`}
            </Text>
          </View>

          <Text style={styles.headline}>
            {detail.summary?.headline
              ? detail.summary.headline.replace(
                  detail.finalSignal,
                  displayRatingLabel(detail.finalSignal),
                )
              : `${displayRatingLabel(detail.finalSignal)} rating context`}
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Rating Gate Summary</Text>
          {failedGates.length > 0 ? (
            <>
              <Text style={styles.sectionHelper}>
                {failedGates.length} quality check
                {failedGates.length > 1 ? "s" : ""} need attention before this
                rating becomes stronger.
              </Text>

              <View style={styles.attentionWrap}>
                {failedGates.map((g, idx) => (
                  <View key={`attention-${idx}`} style={styles.attentionChip}>
                    <Ionicons
                      name="alert-circle-outline"
                      size={13}
                      color={BRAND.amber}
                      style={{ marginRight: 5 }}
                    />

                    <Text style={styles.attentionChipText}>{g.gate}</Text>
                  </View>
                ))}
              </View>
            </>
          ) : (
            <Text style={styles.sectionHelper}>
              All major quality checks currently support the rating context.
            </Text>
          )}
          <View style={styles.statRow}>
            <View style={styles.statBox}>
              <Text style={styles.statValue}>{passedGates.length}</Text>
              <Text style={styles.statLabel}>Passed</Text>
            </View>

            <View style={styles.statBox}>
              <Text style={[styles.statValue, { color: BRAND.red }]}>
                {failedGates.length}
              </Text>
              <Text style={styles.statLabel}>Needs Attention</Text>
            </View>

            <View style={styles.statBox}>
              <Text
                style={[
                  styles.statValue,
                  { color: signalColor(detail.finalSignal) },
                ]}
              >
                {displayRatingLabel(detail.finalSignal)}
              </Text>
              <Text style={styles.statLabel}>Final Rating</Text>
            </View>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Rating Logic</Text>
          <Text style={styles.sectionHelper}>
            Each gate explains one quality check used to form the rating
            context.
          </Text>

          {detail.decisionLadder.map((gate, idx) => {
            const color = statusColor(gate.status);

            return (
              <View key={`${gate.gate}-${idx}`} style={styles.gateCard}>
                <View style={styles.gateHeader}>
                  <View
                    style={[styles.statusDot, { backgroundColor: color }]}
                  />

                  <Text style={styles.gateTitle}>{gate.gate}</Text>

                  <TouchableOpacity
                    onPress={() =>
                      setInfoModal({
                        title: gate.gate,
                        text: getGateInfo(gate.gate),
                      })
                    }
                    style={styles.infoBtn}
                  >
                    <Ionicons
                      name="help-circle-outline"
                      size={17}
                      color={BRAND.sub}
                    />
                  </TouchableOpacity>

                  <Text style={[styles.statusText, { color }]}>
                    {String(gate.status || "").toLowerCase() === "passed"
                      ? "PASSED"
                      : "NEEDS ATTENTION"}
                  </Text>
                </View>

                <Text style={styles.gateExplanation}>
                  {gate.explanation || "No explanation available."}
                </Text>
                {Array.isArray(gate.metrics) && gate.metrics.length > 0 && (
                  <View style={styles.metricsGrid}>
                    {gate.metrics
                      .filter(
                        (m) =>
                          m?.value !== null &&
                          m?.value !== undefined &&
                          m?.value !== "",
                      )
                      .map((m, i) => (
                        <View
                          key={`${gate.gate}-metric-${i}`}
                          style={styles.metricChip}
                        >
                          <Text style={styles.metricLabel}>
                            {cleanMetricLabel(m.label)}
                          </Text>

                          <Text style={styles.metricValue}>
                            {String(m.value)}
                            {m.unit ? m.unit : ""}
                          </Text>
                        </View>
                      ))}
                  </View>
                )}
                {Array.isArray(gate.evidenceSummary) &&
                  gate.evidenceSummary.length > 0 && (
                    <View style={{ marginTop: 8 }}>
                      {gate.evidenceSummary.slice(0, 0).map((line, i) => (
                        <Text key={i} style={styles.evidenceText}>
                          • {line}
                        </Text>
                      ))}
                    </View>
                  )}
              </View>
            );
          })}
        </View>

        {detail.whatWouldChange.length > 0 && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>
              What Could Change This Rating?
            </Text>
            {detail.whatWouldChange.map((line, idx) => (
              <Text key={idx} style={styles.evidenceText}>
                • {line}
              </Text>
            ))}
          </View>
        )}

        <View style={styles.disclaimerCard}>
          <View style={styles.disclaimerHeader}>
            <Ionicons
              name="shield-checkmark-outline"
              size={17}
              color={BRAND.amber}
            />
            <Text style={styles.disclaimerTitle}>
              Educational info only • Not financial advice
            </Text>
          </View>

          <Text style={styles.disclaimerText}>
            Model decisions are based on historical data, technical indicators,
            probability signals, pattern quality, and market conditions. They do
            not guarantee future results. This information is for educational
            and research purposes only and should not be treated as financial
            advice.
          </Text>
        </View>
        <View style={styles.footerWrap}>
          <Text style={styles.powered}>
            Powered by <Text style={styles.brandText}>Alphaclara</Text>
          </Text>

          <Text style={styles.footerDisclaimer}>
            Ratings, confidence scores, and model explanations are provided for
            informational and educational purposes only and do not constitute
            financial or investment advice.
          </Text>
        </View>
        {infoModal && (
          <Modal transparent animationType="fade" visible>
            <View style={styles.modalOverlay}>
              <View style={styles.infoModalCard}>
                <View style={styles.infoModalHeader}>
                  <Text style={styles.infoModalTitle}>{infoModal.title}</Text>

                  <TouchableOpacity onPress={() => setInfoModal(null)}>
                    <Ionicons name="close" size={20} color={BRAND.sub} />
                  </TouchableOpacity>
                </View>

                <Text style={styles.infoModalText}>{infoModal.text}</Text>
              </View>
            </View>
          </Modal>
        )}
      </Animated.View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BRAND.bg,
    paddingHorizontal: 8,
    paddingTop: 8,
  },
  center: {
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    color: BRAND.sub,
    marginTop: 10,
  },
  headerCard: {
    backgroundColor: "#020617",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: BRAND.border,
    padding: 12,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
  },

  symbol: {
    color: BRAND.text,
    fontSize: 25,
    fontWeight: "900",
  },
  company: {
    color: BRAND.sub,
    fontSize: 13,
    marginTop: 2,
  },
  price: {
    color: BRAND.text,
    fontSize: 20,
    fontWeight: "800",
  },
  change: {
    fontSize: 13,
    fontWeight: "700",
    marginTop: 2,
  },
  pos: { color: BRAND.accent },
  neg: { color: BRAND.red },

  signalBox: {
    marginTop: 14,
    borderTopWidth: 1,
    borderTopColor: BRAND.border,
    paddingTop: 12,
  },
  signal: {
    fontSize: 30,
    fontWeight: "900",
  },
  confidence: {
    color: BRAND.sub,
    fontSize: 13,
    marginTop: 2,
  },
  headline: {
    color: BRAND.text,
    fontSize: 15,
    fontWeight: "800",
    marginTop: 10,
  },
  summaryText: {
    color: BRAND.sub,
    fontSize: 13,
    lineHeight: 19,
    marginTop: 4,
  },
  card: {
    backgroundColor: BRAND.card,
    borderRadius: 12,
    borderWidth: 0.6,
    borderColor: BRAND.border,
    padding: 12,
    marginTop: 8,
  },
  sectionTitle: {
    color: BRAND.accent,
    fontSize: 15,
    fontWeight: "800",
    marginBottom: 10,
  },
  statRow: {
    flexDirection: "row",
    gap: 8,
  },
  statBox: {
    flex: 1,
    backgroundColor: "#020617",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: BRAND.border,
    padding: 10,
  },
  statValue: {
    color: BRAND.text,
    fontSize: 18,
    fontWeight: "900",
  },
  statLabel: {
    color: BRAND.sub,
    fontSize: 11,
    marginTop: 3,
  },
  gateCard: {
    backgroundColor: "#020617",
    borderRadius: 10,
    borderWidth: 0.6,
    borderColor: BRAND.border,

    paddingHorizontal: 10,
    paddingTop: 10,
    paddingBottom: 7,

    marginBottom: 5,
  },
  gateHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 6,
  },
  statusDot: {
    width: 9,
    height: 9,
    borderRadius: 99,
    marginRight: 8,
  },
  gateTitle: {
    color: BRAND.text,
    fontSize: 14,
    fontWeight: "800",
    flex: 1,
  },
  statusText: {
    fontSize: 11,
    fontWeight: "900",
  },
  gateExplanation: {
    color: BRAND.text,
    fontSize: 13,
    lineHeight: 17,
  },
  evidenceText: {
    color: BRAND.sub,
    fontSize: 12.5,
    lineHeight: 18,
    marginTop: 2,
  },
  disclaimerCard: {
    backgroundColor: "#020617",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: BRAND.border,
    paddingHorizontal: 12,
    paddingVertical: 12,
    marginTop: 12,
    marginBottom: 20,
  },
  disclaimerHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 6,
  },
  disclaimerTitle: {
    color: BRAND.amber,
    fontSize: 14,
    fontWeight: "800",
    marginLeft: 8,
  },
  disclaimerText: {
    color: BRAND.sub,
    fontSize: 12.5,
    lineHeight: 18,
  },
  metricsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 7,
  },

  metricChip: {
    backgroundColor: "#111827",
    borderWidth: 0.6,
    borderColor: BRAND.border,
    borderRadius: 9,
    paddingHorizontal: 8,
    paddingVertical: 6,
    minWidth: "47%",
    flexGrow: 1,
  },

  metricLabel: {
    color: BRAND.sub,
    fontSize: 11,
    marginBottom: 3,
  },

  metricValue: {
    color: BRAND.text,
    fontSize: 13,
    fontWeight: "800",
  },
  infoBtn: {
    paddingHorizontal: 6,
    paddingVertical: 2,
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.65)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },

  infoModalCard: {
    width: "100%",
    backgroundColor: "#020617",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: BRAND.border,
    padding: 16,
  },

  infoModalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },

  infoModalTitle: {
    color: BRAND.text,
    fontSize: 16,
    fontWeight: "800",
  },

  infoModalText: {
    color: BRAND.sub,
    fontSize: 13.5,
    lineHeight: 20,
  },
  sectionHelper: {
    color: BRAND.muted,
    fontSize: 11.5,
    lineHeight: 16,
    fontWeight: "700",
    marginTop: -4,
    marginBottom: 10,
  },
  footerWrap: {
    alignItems: "center",
    marginTop: 10,
    marginBottom: 24,
    paddingHorizontal: 12,
  },

  powered: {
    color: BRAND.sub,
    fontSize: 12,
    marginBottom: 8,
  },

  brandText: {
    color: BRAND.accent,
    fontWeight: "700",
  },

  footerDisclaimer: {
    color: BRAND.muted,
    fontSize: 10.5,
    lineHeight: 16,
    textAlign: "center",
  },
  attentionWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginTop: 2,
    marginBottom: 10,
  },

  attentionChip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(250,204,21,0.10)",
    borderWidth: 1,
    borderColor: "rgba(250,204,21,0.22)",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    marginRight: 8,
    marginBottom: 8,
  },

  attentionChipText: {
    color: BRAND.amber,
    fontSize: 11,
    fontWeight: "800",
  },
});
