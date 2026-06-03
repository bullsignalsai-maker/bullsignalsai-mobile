import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Animated,
  ActivityIndicator,
  Modal,
  Image,
} from "react-native";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import Svg, { Circle } from "react-native-svg";
import { LinearGradient as ExpoLinearGradient } from "expo-linear-gradient";
import { getDecisionDetail } from "../services/decisionDetailService";
import { BRAND } from "../constants/theme";
import { TYPO } from "../constants/typography";
import { displayRating, signalColor } from "../utils/signalUtils";

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
  return v == null || Number.isNaN(Number(v))
    ? "—"
    : `$${Number(v).toFixed(2)}`;
}

function fmtPct(v) {
  if (v == null || Number.isNaN(Number(v))) return "—";
  const n = Number(v);
  return `${n >= 0 ? "+" : ""}${n.toFixed(2)}%`;
}

function metricValue(gates, gateName, label) {
  const gate = gates.find((g) => g.gate === gateName);
  const metric = gate?.metrics?.find((m) => m.label === label);
  if (!metric || metric.value == null || metric.value === "") return null;
  return `${metric.value}${metric.unit || ""}`;
}

function getGateIcon(gateName) {
  const map = {
    Liquidity: "water-outline",
    "Market Regime": "trending-up-outline",
    "Feature Consensus": "analytics-outline",
    "Pattern Quality": "sparkles-outline",
    "Pattern Alignment": "git-compare-outline",
    "Expected Value": "scale-outline",
    "Exhaustion / Fragility": "shield-checkmark-outline",
  };
  return map[gateName] || "checkmark-circle-outline";
}

function getGateInfo(gateName) {
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
}

function ConfidenceMini({ value = 0, color = BRAND.amber }) {
  return (
    <View style={styles.confidenceMiniWrap}>
      <Text style={[styles.confidenceMiniValue, { color }]}>
        {Number(value || 0).toFixed(1)}%
      </Text>
      <Text style={styles.confidenceMiniLabel}>Confidence</Text>
    </View>
  );
}

export default function SignalDetailScreen({ route, navigation }) {
  const symbol = route?.params?.symbol || route?.params?.ticker || "TSLA";
  const logoUrl = route?.params?.logoUrl || null;
  const routeDisplayIntel = route?.params?.displayIntelligence || null;
  const routeHybridSignal = route?.params?.hybridSignal || null;
  const routeHybridScore = route?.params?.hybridScore ?? null;

  const [infoModal, setInfoModal] = useState(null);
  const [detail, setDetail] = useState(null);
  const [expandedGate, setExpandedGate] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);

  const fadeAnim = useRef(new Animated.Value(0)).current;

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

  const computed = useMemo(() => {
    if (!detail) return null;

    const gates = detail.decisionLadder || [];
    const failed = gates.filter(
      (x) => String(x.status).toLowerCase() === "failed",
    );
    const passed = gates.filter(
      (x) => String(x.status).toLowerCase() === "passed",
    );
    const displaySignal =
      routeDisplayIntel?.displaySignal ||
      routeDisplayIntel?.signal ||
      routeHybridSignal ||
      detail.finalSignal;

    const displayScore =
      typeof routeDisplayIntel?.score === "number"
        ? routeDisplayIntel.score
        : typeof routeHybridScore === "number"
          ? routeHybridScore
          : detail.confidence;

    const signal = displayRating(displaySignal);
    const color = signalColor(displaySignal);

    const headline =
      routeDisplayIntel?.headline ||
      detail.summary?.headline?.replace(detail.finalSignal, signal) ||
      `${signal} rating context`;

    const cleanWhy =
      routeDisplayIntel?.whyNow?.[0] ||
      routeDisplayIntel?.headline ||
      detail.summary?.why ||
      "Rating is based on current market context, technical structure, and model confirmation.";
    const badges = detail.raw?.header?.badges || [];
    const regime = metricValue(gates, "Market Regime", "Regime");
    const liquidity = metricValue(gates, "Liquidity", "Liquidity Quality");
    const pattern = detail.raw?.header?.pattern?.name || badges?.[2];

    const expectedGate = gates.find((g) => g.gate === "Expected Value");
    const regimeGate = gates.find((g) => g.gate === "Market Regime");
    const edgeMetrics = [
      {
        label: "5D Avg Return",
        value: expectedGate?.metrics?.find((m) => m.label === "5D Avg Return"),
        tone: "green",
        sub: "Average",
      },
      {
        label: "5D Best Return",
        value: expectedGate?.metrics?.find((m) => m.label === "5D Best Return"),
        tone: "green",
        sub: "Upside",
      },
      {
        label: "5D Worst Return",
        value: expectedGate?.metrics?.find(
          (m) => m.label === "5D Worst Return",
        ),
        tone: "red",
        sub: "Downside",
      },
      {
        label: "Volatility 20D",
        value: regimeGate?.metrics?.find((m) => m.label === "Volatility 20D"),
        tone: "purple",
        sub: "Volatility",
      },
    ].filter((x) => x.value?.value != null);

    return {
      gates,
      failed,
      passed,

      signal,
      color,

      // NEW
      displaySignal,
      displayScore,
      displayIntel: routeDisplayIntel,
      cleanWhy,
      headline,
      badges,
      regime,
      liquidity,
      pattern,
      edgeMetrics,
    };
  }, [detail]);

  if (loading) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator color={BRAND.accent} />
        <Text style={styles.loadingText}>Loading rating details...</Text>
      </View>
    );
  }

  if (err || !detail || !computed) {
    return (
      <View style={[styles.container, styles.center]}>
        <Ionicons name="warning-outline" size={24} color={BRAND.amber} />
        <Text style={styles.loadingText}>{err || "No decision data."}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        <Animated.View style={{ opacity: fadeAnim }}>
          <ExpoLinearGradient
            colors={["#050B12", "#07111F", "#020617"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.heroCard}
          >
            <View style={styles.heroMainRow}>
              <View style={styles.logoBox}>
                {logoUrl ? (
                  <Image
                    source={{ uri: logoUrl }}
                    style={styles.tickerLogo}
                    resizeMode="contain"
                  />
                ) : (
                  <Text style={styles.logoText}>
                    {detail.symbol?.slice(0, 1)}
                  </Text>
                )}
              </View>

              <View style={{ flex: 1 }}>
                <Text style={styles.heroSymbol}>{detail.symbol}</Text>
                <Text style={styles.heroName} numberOfLines={1}>
                  {detail.companyName}
                </Text>

                <View style={styles.heroMetaPills}>
                  {(computed.badges || []).slice(1, 3).map((b, i) => (
                    <Text key={`${b}-${i}`} style={styles.heroMetaText}>
                      {b}
                    </Text>
                  ))}
                </View>
              </View>
            </View>

            <View style={styles.heroPriceRow}>
              <View>
                <Text style={styles.heroPrice}>
                  {fmtMoney(detail.quote.current)}
                </Text>
                <Text
                  style={[
                    styles.heroChange,
                    (detail.quote.changePct ?? 0) >= 0
                      ? styles.pos
                      : styles.neg,
                  ]}
                >
                  {fmtMoney(detail.quote.change)} (
                  {fmtPct(detail.quote.changePct)})
                </Text>
              </View>

              <View style={styles.heroSideMetrics}>
                <Text style={styles.heroSideMetric}>
                  Rating{" "}
                  <Text style={styles.heroSideValue}>{computed.signal}</Text>
                </Text>
                <Text style={styles.heroSideMetric}>
                  Confidence{" "}
                  <Text style={styles.heroSideValue}>
                    {computed.displayScore != null
                      ? computed.displayScore.toFixed(1)
                      : "—"}
                    %
                  </Text>
                </Text>
                <Text style={styles.heroSideMetric}>
                  Status{" "}
                  <Text style={styles.heroSideValue}>
                    {detail.confidenceLabel || "—"}
                  </Text>
                </Text>
              </View>
            </View>
          </ExpoLinearGradient>

          <View style={styles.ratingCompactCard}>
            <View style={styles.ratingTopLine}>
              <View
                style={[
                  styles.signalMiniPill,
                  {
                    backgroundColor:
                      computed.color === BRAND.red
                        ? "rgba(239,68,68,0.13)"
                        : computed.color === BRAND.accent
                          ? "rgba(0,227,150,0.13)"
                          : "rgba(250,204,21,0.13)",
                    borderColor: computed.color,
                  },
                ]}
              >
                <Text
                  style={[styles.signalMiniText, { color: computed.color }]}
                >
                  {computed.signal}
                </Text>
              </View>

              <Text style={styles.ratingHeadline}>{computed.headline}</Text>

              <Text style={styles.ratingWhy}>{computed.cleanWhy}</Text>
            </View>

            <View style={styles.summaryTilesRow}>
              <View style={styles.summaryTile}>
                <Text style={styles.summaryTileValue}>
                  {computed.passed.length}
                </Text>
                <Text style={styles.summaryTileLabel}>Passed</Text>
              </View>

              <View style={styles.summaryTile}>
                <Text style={[styles.summaryTileValue, { color: BRAND.amber }]}>
                  {computed.failed.length}
                </Text>
                <Text style={styles.summaryTileLabel}>Attention</Text>
              </View>

              <View style={styles.summaryTile}>
                <Text
                  style={[styles.summaryTileValue, { color: computed.color }]}
                >
                  {computed.displayScore != null
                    ? computed.displayScore.toFixed(1)
                    : "—"}
                  %
                </Text>
                <Text style={styles.summaryTileLabel}>Confidence</Text>
              </View>
            </View>
          </View>

          {computed.failed.length > 0 && (
            <View style={styles.attentionCardLarge}>
              <View style={styles.attentionIconBox}>
                <Ionicons name="warning" size={22} color="#FF6B7A" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.attentionTitle}>Key Attention</Text>
                <Text style={styles.attentionGate}>
                  {computed.failed[0].gate}
                </Text>
                <Text style={styles.attentionText} numberOfLines={2}>
                  {computed.failed[0].evidenceSummary?.[0] ||
                    computed.failed[0].explanation}
                </Text>
              </View>
            </View>
          )}

          <View style={styles.logicCard}>
            <View style={styles.logicHeader}>
              <Ionicons name="sparkles" size={15} color={BRAND.sub} />
              <Text style={styles.logicTitle}>RATING LOGIC BREAKDOWN</Text>
            </View>

            {computed.gates.map((gate, idx) => {
              const color = statusColor(gate.status);
              const failed =
                String(gate.status || "").toLowerCase() === "failed";
              const expanded = expandedGate === gate.gate;

              return (
                <TouchableOpacity
                  key={`${gate.gate}-${idx}`}
                  activeOpacity={0.85}
                  style={styles.logicRow}
                  onPress={() => setExpandedGate(expanded ? null : gate.gate)}
                >
                  <View style={styles.logicNumber}>
                    <Text style={styles.logicNumberText}>{idx + 1}</Text>
                  </View>

                  <View
                    style={[
                      styles.logicIcon,
                      {
                        backgroundColor: failed
                          ? "rgba(255,69,96,0.12)"
                          : "rgba(0,227,150,0.10)",
                      },
                    ]}
                  >
                    <Ionicons
                      name={getGateIcon(gate.gate)}
                      size={18}
                      color={color}
                    />
                  </View>

                  <View style={styles.logicMain}>
                    <View style={styles.logicNameRow}>
                      <Text style={styles.logicGateTitle}>{gate.gate}</Text>
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
                          size={15}
                          color={BRAND.sub}
                        />
                      </TouchableOpacity>
                    </View>
                    <Text
                      style={styles.logicExplanation}
                      numberOfLines={expanded ? 3 : 1}
                    >
                      {gate.explanation || "No explanation available."}
                    </Text>

                    {expanded && gate.metrics?.length > 0 && (
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
                                {m.unit || ""}
                              </Text>
                            </View>
                          ))}
                      </View>
                    )}
                  </View>

                  <View style={styles.logicRight}>
                    <View
                      style={[
                        styles.statusPill,
                        {
                          backgroundColor: failed
                            ? "rgba(255,69,96,0.13)"
                            : "rgba(0,227,150,0.12)",
                        },
                      ]}
                    >
                      <Text style={[styles.statusPillText, { color }]}>
                        {failed ? "Needs Attention" : "Passed"}
                      </Text>
                    </View>
                    <Ionicons
                      name={expanded ? "chevron-up" : "chevron-down"}
                      size={17}
                      color={BRAND.sub}
                    />
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>

          {detail.whatWouldChange.length > 0 && (
            <View style={styles.changeCard}>
              <View style={styles.changeHeader}>
                <Ionicons name="bulb" size={17} color="#C084FC" />
                <Text style={styles.changeTitle}>
                  WHAT COULD CHANGE THIS RATING
                </Text>
              </View>
              {detail.whatWouldChange.map((line, idx) => (
                <View key={idx} style={styles.changeLine}>
                  <Text style={styles.bullet}>•</Text>
                  <Text style={styles.changeText}>{line}</Text>
                </View>
              ))}
            </View>
          )}

          {computed.edgeMetrics.length > 0 && (
            <View style={styles.edgeCard}>
              {computed.edgeMetrics.map((m, idx) => {
                const toneColor =
                  m.tone === "red"
                    ? BRAND.red
                    : m.tone === "purple"
                      ? "#C084FC"
                      : BRAND.accent;
                return (
                  <View key={`${m.label}-${idx}`} style={styles.edgeBox}>
                    <Text style={styles.edgeLabel}>
                      {cleanMetricLabel(m.label)}
                    </Text>
                    <Text style={[styles.edgeValue, { color: toneColor }]}>
                      {m.value.value}
                      {m.value.unit || ""}
                    </Text>
                    <Text style={styles.edgeSub}>{m.sub}</Text>
                  </View>
                );
              })}
            </View>
          )}

          <View style={styles.disclaimerCard}>
            <Ionicons
              name="shield-checkmark-outline"
              size={20}
              color={BRAND.sub}
            />
            <View style={{ flex: 1 }}>
              <Text style={styles.disclaimerTitle}>Disclaimer</Text>
              <Text style={styles.disclaimerText}>
                This analysis is generated by AI using historical data,
                technical indicators, probability signals, pattern quality, and
                market conditions. Informational only — not financial advice.
              </Text>
            </View>
          </View>

          <View style={styles.footerWrap}>
            <Text style={styles.powered}>
              Powered by <Text style={styles.brandText}>Alphaclara</Text>
            </Text>
          </View>
        </Animated.View>
      </ScrollView>

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
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BRAND.bg,
  },
  scrollContent: {
    paddingHorizontal: 12,
    paddingTop: 4,
    paddingBottom: 34,
  },
  center: { justifyContent: "center", alignItems: "center" },
  loadingText: {
    color: BRAND.sub,
    marginTop: 10,
    fontFamily: TYPO.fontFamily.medium,
  },

  quoteCard: {
    backgroundColor: BRAND.card,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: BRAND.border,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  stockLogo: {
    width: 58,
    height: 58,
    borderRadius: 29,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.16)",
    backgroundColor: "rgba(255,255,255,0.04)",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 13,
  },
  stockLogoText: {
    color: BRAND.text,
    fontSize: 25,
    fontFamily: TYPO.fontFamily.extrabold,
  },
  quoteMiddle: { flex: 1, minWidth: 0 },
  symbol: {
    color: BRAND.text,
    fontSize: 24,
    fontFamily: TYPO.fontFamily.extrabold,
    letterSpacing: -0.4,
  },
  company: {
    color: BRAND.sub,
    fontSize: 12.5,
    marginTop: 2,
    fontFamily: TYPO.fontFamily.medium,
  },
  badgeRowCompact: {
    flexDirection: "row",
    gap: 6,
    marginTop: 8,
  },
  miniBadge: {
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    backgroundColor: "rgba(255,255,255,0.04)",
  },
  miniBadgeText: {
    color: BRAND.sub,
    fontSize: 10,
    fontFamily: TYPO.fontFamily.bold,
  },
  priceWrap: { alignItems: "flex-end", marginLeft: 8, maxWidth: 132 },
  price: {
    color: BRAND.text,
    fontSize: 23,
    fontFamily: TYPO.fontFamily.extrabold,
    fontVariant: ["tabular-nums"],
  },
  change: {
    fontSize: 12.5,
    fontFamily: TYPO.fontFamily.bold,
    marginTop: 3,
    fontVariant: ["tabular-nums"],
  },
  updatedText: {
    color: BRAND.muted || BRAND.sub,
    fontSize: 9.5,
    marginTop: 8,
    textAlign: "right",
    fontFamily: TYPO.fontFamily.medium,
  },
  pos: { color: BRAND.accent },
  neg: { color: BRAND.red },

  ratingHeroCard: {
    backgroundColor: BRAND.card,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: BRAND.border,
    padding: 12,
    marginBottom: 10,
  },
  ratingHeroTop: {
    flexDirection: "row",
    alignItems: "center",
  },
  ringBox: {
    width: 132,
    height: 132,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 14,
  },
  ringCenter: {
    position: "absolute",
    alignItems: "center",
  },
  ringSignal: {
    fontSize: 22,
    fontFamily: TYPO.fontFamily.extrabold,
    letterSpacing: -0.4,
  },
  ringConfidence: {
    color: BRAND.text,
    fontSize: 19,
    marginTop: 5,
    fontFamily: TYPO.fontFamily.extrabold,
  },
  ringCaption: {
    color: BRAND.text,
    fontSize: 9.5,
    marginTop: 1,
    fontFamily: TYPO.fontFamily.bold,
  },
  ratingHeroTextWrap: {
    flex: 1,
    minWidth: 0,
  },
  ratingHeadline: {
    color: BRAND.text,
    fontSize: 18,
    lineHeight: 24,
    fontFamily: TYPO.fontFamily.extrabold,
  },
  ratingWhy: {
    color: BRAND.sub,
    fontSize: 12.2,
    lineHeight: 17,
    marginTop: 6,
    fontFamily: TYPO.fontFamily.medium,
  },
  summaryTilesRow: {
    flexDirection: "row",
    gap: 7,
    marginTop: 12,
  },
  summaryTile: {
    flex: 1,
    minHeight: 54,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    backgroundColor: BRAND.card2,
    paddingHorizontal: 8,
    paddingVertical: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },
  summaryTileValue: {
    color: BRAND.accent,
    fontSize: 14,
    fontFamily: TYPO.fontFamily.extrabold,
  },
  summaryTileValueSmall: {
    color: BRAND.text,
    fontSize: 10.5,
    lineHeight: 13,
    fontFamily: TYPO.fontFamily.extrabold,
  },
  summaryTileLabel: {
    color: BRAND.sub,
    fontSize: 8.5,
    marginTop: 1,
    fontFamily: TYPO.fontFamily.bold,
  },
  contextChipsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    gap: 8,
    marginTop: 14,
  },
  contextChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    maxWidth: "48%",
  },
  purpleChip: {
    backgroundColor: "rgba(168,85,247,0.10)",
    borderColor: "rgba(168,85,247,0.22)",
  },
  amberChip: {
    backgroundColor: "rgba(254,176,25,0.10)",
    borderColor: "rgba(254,176,25,0.24)",
  },
  greenChip: {
    backgroundColor: "rgba(0,227,150,0.10)",
    borderColor: "rgba(0,227,150,0.20)",
  },
  contextChipText: {
    fontSize: 10.3,
    fontFamily: TYPO.fontFamily.bold,
  },

  attentionCardLarge: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(255,69,96,0.32)",
    backgroundColor: "rgba(255,69,96,0.10)",
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  attentionIconBox: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: "rgba(255,69,96,0.16)",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  attentionTitle: {
    color: "#FF6B7A",
    fontSize: 12.5,
    fontFamily: TYPO.fontFamily.bold,
  },
  attentionGate: {
    color: BRAND.text,
    fontSize: 15,
    marginTop: 2,
    fontFamily: TYPO.fontFamily.extrabold,
  },
  attentionText: {
    color: BRAND.sub,
    fontSize: 12.2,
    lineHeight: 17,
    marginTop: 2,
    fontFamily: TYPO.fontFamily.medium,
  },

  logicCard: {
    backgroundColor: BRAND.card,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: BRAND.border,
    overflow: "hidden",
    marginBottom: 12,
  },
  logicHeader: {
    height: 42,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.08)",
  },
  logicTitle: {
    color: BRAND.sub,
    fontSize: 12,
    letterSpacing: 0.5,
    fontFamily: TYPO.fontFamily.extrabold,
  },
  logicRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.06)",
  },
  logicNumber: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.22)",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 9,
  },
  logicNumberText: {
    color: BRAND.text,
    fontSize: 12,
    fontFamily: TYPO.fontFamily.bold,
  },
  logicIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },
  logicMain: {
    flex: 1,
    minWidth: 0,
  },
  logicNameRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  logicGateTitle: {
    color: BRAND.text,
    fontSize: 13.5,
    fontFamily: TYPO.fontFamily.bold,
    flexShrink: 1,
  },
  infoBtn: { paddingHorizontal: 5, paddingVertical: 2 },
  logicExplanation: {
    color: BRAND.sub,
    fontSize: 11.7,
    lineHeight: 16,
    marginTop: 2,
    fontFamily: TYPO.fontFamily.medium,
  },
  logicRight: {
    alignItems: "flex-end",
    marginLeft: 8,
    gap: 7,
  },
  statusPill: {
    minWidth: 72,
    height: 26,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 8,
  },
  statusPillText: {
    fontSize: 10.4,
    fontFamily: TYPO.fontFamily.bold,
  },
  metricsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 7,
    marginTop: 9,
  },
  metricChip: {
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 6,
    minWidth: "46%",
  },
  metricLabel: {
    color: BRAND.sub,
    fontSize: 9.5,
    marginBottom: 3,
    fontFamily: TYPO.fontFamily.medium,
  },
  metricValue: {
    color: BRAND.text,
    fontSize: 12.2,
    fontFamily: TYPO.fontFamily.bold,
  },

  changeCard: {
    backgroundColor: BRAND.card,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(168,85,247,0.20)",
    padding: 14,
    marginBottom: 12,
  },
  changeHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 10,
  },
  changeTitle: {
    color: "#C084FC",
    fontSize: 12.5,
    fontFamily: TYPO.fontFamily.extrabold,
    letterSpacing: 0.4,
  },
  changeLine: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  bullet: {
    color: BRAND.sub,
    fontSize: 18,
  },
  changeText: {
    color: BRAND.text,
    flex: 1,
    fontSize: 12.8,
    lineHeight: 18,
    fontFamily: TYPO.fontFamily.medium,
  },

  edgeCard: {
    backgroundColor: BRAND.card,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: BRAND.border,
    paddingVertical: 13,
    flexDirection: "row",
    marginBottom: 14,
  },
  edgeBox: {
    flex: 1,
    alignItems: "center",
    borderRightWidth: 1,
    borderRightColor: "rgba(255,255,255,0.08)",
    paddingHorizontal: 4,
  },
  edgeLabel: {
    color: BRAND.sub,
    fontSize: 9.2,
    textAlign: "center",
    fontFamily: TYPO.fontFamily.bold,
  },
  edgeValue: {
    fontSize: 17,
    marginTop: 7,
    fontFamily: TYPO.fontFamily.extrabold,
  },
  edgeSub: {
    color: BRAND.text,
    fontSize: 9.5,
    marginTop: 4,
    textAlign: "center",
    fontFamily: TYPO.fontFamily.medium,
  },

  disclaimerCard: {
    flexDirection: "row",
    gap: 10,
    backgroundColor: "transparent",
    paddingHorizontal: 12,
    marginBottom: 14,
  },
  disclaimerTitle: {
    color: BRAND.sub,
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: 0.4,
    fontFamily: TYPO.fontFamily.bold,
  },
  disclaimerText: {
    color: BRAND.sub,
    fontSize: 11.2,
    lineHeight: 16,
    marginTop: 3,
    fontFamily: TYPO.fontFamily.regular,
  },

  footerWrap: {
    alignItems: "center",
    marginTop: 4,
    marginBottom: 12,
  },
  powered: {
    color: BRAND.sub,
    fontSize: 12,
    fontFamily: TYPO.fontFamily.medium,
  },
  brandText: {
    color: BRAND.text,
    fontSize: 13.5,
    fontFamily: TYPO.fontFamily.brand,
    letterSpacing: -0.45,
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.68)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  infoModalCard: {
    width: "100%",
    backgroundColor: BRAND.card,
    borderRadius: 18,
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
    fontFamily: TYPO.fontFamily.extrabold,
  },
  infoModalText: {
    color: BRAND.sub,
    fontSize: 13.5,
    lineHeight: 20,
    fontFamily: TYPO.fontFamily.regular,
  },
  ratingCompactTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },

  signalMiniPill: {
    alignSelf: "flex-start",
    minHeight: 32,
    borderRadius: 999,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 11,
    paddingVertical: 6,
    marginBottom: 10,
  },

  signalMiniText: {
    fontSize: 11,
    fontFamily: TYPO.fontFamily.extrabold,
    letterSpacing: 0.5,
    textTransform: "uppercase",
    textAlign: "center",
  },

  confidenceMiniWrap: {
    width: 70,
    alignItems: "flex-end",
  },

  confidenceMiniValue: {
    fontSize: 15,
    fontFamily: TYPO.fontFamily.extrabold,
  },

  confidenceMiniLabel: {
    color: BRAND.sub,
    fontSize: 9,
    marginTop: 2,
    fontFamily: TYPO.fontFamily.bold,
  },
  heroCard: {
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    paddingHorizontal: 13,
    paddingTop: 11,
    paddingBottom: 11,
    marginBottom: 8,
  },

  heroMainRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },

  logoBox: {
    width: 46,
    height: 46,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
  },

  logoText: {
    color: BRAND.text,
    fontSize: 21,
    fontFamily: TYPO.fontFamily.extrabold,
  },

  heroSymbol: {
    color: BRAND.text,
    fontSize: 22,
    fontFamily: TYPO.fontFamily.extrabold,
    letterSpacing: -0.35,
  },

  heroName: {
    color: BRAND.sub,
    fontSize: 12.5,
    fontFamily: TYPO.fontFamily.bold,
    marginTop: 1,
  },

  heroMetaPills: {
    flexDirection: "row",
    gap: 8,
    marginTop: 5,
  },

  heroMetaText: {
    color: BRAND.muted,
    fontSize: 10.8,
    fontFamily: TYPO.fontFamily.bold,
  },

  heroPriceRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
  },

  heroPrice: {
    color: BRAND.text,
    fontSize: 32,
    fontFamily: TYPO.fontFamily.extrabold,
    letterSpacing: -1,
  },

  heroChange: {
    fontSize: 14,
    fontFamily: TYPO.fontFamily.extrabold,
    marginTop: 1,
  },

  heroSideMetrics: {
    minWidth: 96,
    paddingLeft: 9,
    borderLeftWidth: 1,
    borderLeftColor: "rgba(255,255,255,0.08)",
  },

  heroSideMetric: {
    color: BRAND.muted,
    fontSize: 10.5,
    fontFamily: TYPO.fontFamily.bold,
    marginBottom: 4,
  },

  heroSideValue: {
    color: BRAND.text,
    fontFamily: TYPO.fontFamily.extrabold,
  },

  ratingCompactCard: {
    backgroundColor: BRAND.card,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: BRAND.border,
    padding: 12,
    marginBottom: 10,
  },

  ratingTopLine: {
    alignItems: "flex-start",
  },
  signalMiniPill: {
    minWidth: 70,
    height: 42,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
  },

  signalMiniText: {
    fontSize: 18,
    fontFamily: TYPO.fontFamily.extrabold,
  },

  ratingHeadline: {
    color: BRAND.text,
    fontSize: 15.2,
    lineHeight: 20,
    fontFamily: TYPO.fontFamily.extrabold,
    marginBottom: 5,
  },

  ratingWhy: {
    color: BRAND.sub,
    fontSize: 12.4,
    lineHeight: 18,
    fontFamily: TYPO.fontFamily.medium,
  },
  tickerLogo: {
    width: 34,
    height: 34,
    borderRadius: 17,
  },
});
