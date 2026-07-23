// screens/PickDetailScreen.js
import React from "react";
import { View, Text, Image, StyleSheet, ScrollView } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { BRAND } from "../constants/theme";
import { TYPO } from "../constants/typography";
import AppButton from "../components/AppButton";
import {
  formatPickedDaysAgo,
  formatModelViewSplit,
  formatMarketContextLine,
  formatSinceLastUpdatePct,
  getPickPerformanceDisplay,
  fmtPct,
  isQuoteStale,
} from "../utils/formatters";

const FACTOR_BREAKDOWN_ROWS = [
  { key: "momentum", label: "Momentum" },
  { key: "pattern", label: "Pattern Quality" },
  { key: "volume", label: "Volume" },
  { key: "bullbrain", label: "BullBrain Signal" },
  { key: "early_expansion", label: "Early Expansion" },
  { key: "trend", label: "Trend" },
];

// Fixed, universal thresholds — the same score means the same thing for
// every factor and every stock, never scaled relative to other symbols
// or customized per-factor (that would just relocate the same
// inconsistency this app has been removing all session).
function factorScoreColor(score) {
  if (score < 40) return BRAND.amber;
  if (score <= 70) return BRAND.sub;
  return BRAND.accent;
}

const REGIME_LABELS = {
  RISK_ON: "Risk On",
  RISK_OFF: "Risk Off",
  NEUTRAL: "Neutral",
  HIGH_VOL: "High Volatility",
};

function regimeColor(regime) {
  if (regime === "RISK_ON") return BRAND.accent;
  if (regime === "RISK_OFF") return BRAND.red;
  return BRAND.amber; // NEUTRAL, HIGH_VOL, or anything unrecognized — caution, not alarm
}

export default function PickDetailScreen({ route, navigation }) {
  const item = route?.params?.item || {};

  const pickedAgo = formatPickedDaysAgo(item.firstPickedDate);
  const { endPrice, priceLine, pctText, color: performanceColor } =
    getPickPerformanceDisplay(item);
  const quoteStale = isQuoteStale(item.currentPriceUpdatedAt);
  const sinceLastUpdatePct = formatSinceLastUpdatePct(item);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingBottom: 40 }}
    >
      <View style={styles.heroStyleCard}>
        <LinearGradient
          pointerEvents="none"
          colors={[
            "rgba(212,166,58,0.08)",
            "rgba(212,166,58,0.02)",
            "rgba(0,0,0,0)",
          ]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.heroStyleGlow}
        />
        <View style={styles.header}>
          <View style={styles.logoCircle}>
            {item.logoUrl ? (
              <Image
                source={{ uri: item.logoUrl }}
                style={styles.logoImage}
                resizeMode="contain"
              />
            ) : (
              <Text style={styles.logoText}>
                {String(item.symbol || "").slice(0, 4)}
              </Text>
            )}
          </View>

          <View style={styles.headerBody}>
            <Text style={styles.symbol}>{item.symbol}</Text>
            <Text style={styles.companyName} numberOfLines={1}>
              {item.companyName || item.symbol}
            </Text>
            <View style={styles.headerMetaRow}>
              {!!pickedAgo && (
                <Text style={styles.pickedAgo}>{pickedAgo}</Text>
              )}
              {!!item.pickMarketRegime && (
                <View
                  style={[
                    styles.regimePill,
                    { borderColor: regimeColor(item.pickMarketRegime) },
                  ]}
                >
                  <Text
                    style={[
                      styles.regimePillText,
                      { color: regimeColor(item.pickMarketRegime) },
                    ]}
                  >
                    {REGIME_LABELS[item.pickMarketRegime] ||
                      item.pickMarketRegime}
                  </Text>
                </View>
              )}
            </View>
          </View>

          <View style={styles.headerRight}>
            <Text style={styles.currentPrice}>
              {endPrice != null ? `$${Number(endPrice).toFixed(2)}` : "--"}
            </Text>
          </View>
        </View>
      </View>

      {(!!item.pickSetupLabel ||
        !!item.pickReason ||
        item.pickWhyNow?.length > 0) && (
        <View style={styles.heroStyleCard}>
          <LinearGradient
            pointerEvents="none"
            colors={[
              "rgba(212,166,58,0.08)",
              "rgba(212,166,58,0.02)",
              "rgba(0,0,0,0)",
            ]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.heroStyleGlow}
          />
          <View style={styles.sectionHeaderRow}>
            <View style={styles.sectionAccent} />
            <Text style={styles.sectionTitle}>Why We Picked This</Text>
          </View>

          {!!item.pickSetupLabel && (
            <View style={styles.setupTag}>
              <Text style={styles.setupTagText}>{item.pickSetupLabel}</Text>
            </View>
          )}

          {!!item.pickReason && (
            <Text style={styles.reasonText}>{item.pickReason}</Text>
          )}

          {item.pickWhyNow?.length > 0 && (
            <View style={styles.whyNowList}>
              {item.pickWhyNow.map((reason, idx) => (
                <Text key={idx} style={styles.whyNowText}>
                  • {reason}
                </Text>
              ))}
            </View>
          )}
        </View>
      )}

      {!!item.pickModelView && (
        <View style={styles.card}>
          <View style={styles.sectionHeaderRow}>
            <View style={styles.sectionAccent} />
            <Text style={styles.sectionTitle}>Model's Directional View</Text>
          </View>

          <Text style={styles.primaryValue}>{item.pickModelView.label}</Text>
          <Text style={styles.secondaryValue}>
            {formatModelViewSplit(item.pickModelView)}
          </Text>
        </View>
      )}

      {!!item.pickMarketContext && (
        <View style={styles.card}>
          <View style={styles.sectionHeaderRow}>
            <View style={styles.sectionAccent} />
            <Text style={styles.sectionTitle}>
              Today's Market Context at Pick Time
            </Text>
          </View>

          <Text style={styles.primaryValue}>
            {item.pickMarketContext.label}
          </Text>
          <Text style={styles.secondaryValue}>
            {formatMarketContextLine(item.pickMarketContext)}
          </Text>
        </View>
      )}

      {!!item.pickFactorScores && (
        <View style={styles.card}>
          <View style={styles.sectionHeaderRow}>
            <View style={styles.sectionAccent} />
            <Text style={styles.sectionTitle}>Factor Breakdown</Text>
          </View>

          {FACTOR_BREAKDOWN_ROWS.map(({ key, label }, index) => {
            const raw = item.pickFactorScores[key];
            if (raw == null) return null;
            const pct = Math.max(0, Math.min(100, Number(raw)));
            const color = factorScoreColor(pct);
            const isLast = index === FACTOR_BREAKDOWN_ROWS.length - 1;

            return (
              <View
                key={key}
                style={[styles.factorRow, isLast && styles.factorRowLast]}
              >
                <View style={styles.factorLabelRow}>
                  <Text style={styles.factorLabel}>{label}</Text>
                  <Text style={[styles.factorValue, { color }]}>
                    {pct.toFixed(0)}
                  </Text>
                </View>
                <View style={styles.factorBarTrack}>
                  <View
                    style={[
                      styles.factorBarFill,
                      { width: `${pct}%`, backgroundColor: color },
                    ]}
                  />
                </View>
              </View>
            );
          })}
        </View>
      )}

      {!!item.pickPatternStats && (
        <View style={styles.card}>
          <View style={styles.sectionHeaderRow}>
            <View style={styles.sectionAccent} />
            <Text style={styles.sectionTitle}>
              Historical Pattern Evidence
            </Text>
          </View>

          <Text style={styles.patternDisclaimer}>
            Based on this pattern's historical occurrences across the
            market — not a forecast for {item.symbol}'s future price.
          </Text>

          <View style={styles.statChipRow}>
            <View style={styles.statChip}>
              <Text style={styles.statChipLabel}>Win Rate</Text>
              <Text style={styles.statChipValue}>
                {item.pickPatternStats.winRate != null
                  ? `${(Number(item.pickPatternStats.winRate) * 100).toFixed(
                      1,
                    )}%`
                  : "—"}
              </Text>
            </View>

            <View style={styles.statChip}>
              <Text style={styles.statChipLabel}>Avg Return</Text>
              <Text style={styles.statChipValue}>
                {/* Assumed already-percentage-scaled (e.g. 3.2 = 3.2%),
                    matching changePct/livePct convention elsewhere in
                    this app — verify against a live payload. */}
                {item.pickPatternStats.avg != null
                  ? fmtPct(Number(item.pickPatternStats.avg))
                  : "—"}
              </Text>
            </View>

            <View style={styles.statChip}>
              <Text style={styles.statChipLabel}>Sample Size</Text>
              <Text style={styles.statChipValue}>
                {item.pickPatternStats.count != null
                  ? String(item.pickPatternStats.count)
                  : "—"}
              </Text>
            </View>
          </View>
        </View>
      )}

      <View style={styles.card}>
        <View style={styles.sectionHeaderRow}>
          <View style={styles.sectionAccent} />
          <Text style={styles.sectionTitle}>Performance Since Pick</Text>
        </View>

        <Text style={styles.performancePriceLine} numberOfLines={1}>
          {priceLine}
        </Text>

        <View style={styles.performanceMetricRow}>
          <Text style={styles.performanceMetricLabel} numberOfLines={1}>
            Since first tracked
          </Text>
          <Text
            style={[
              styles.performanceMetricValuePrimary,
              { color: performanceColor },
            ]}
            numberOfLines={1}
          >
            {pctText}
          </Text>
        </View>

        {!!sinceLastUpdatePct && (
          <View style={styles.performanceMetricRow}>
            <Text style={styles.performanceMetricLabel} numberOfLines={1}>
              Since last update
            </Text>
            <Text
              style={styles.performanceMetricValueSecondary}
              numberOfLines={1}
            >
              {sinceLastUpdatePct}
            </Text>
          </View>
        )}

        {quoteStale && (
          <Text style={styles.staleNote}>Quote may be delayed</Text>
        )}
      </View>

      <View style={styles.viewStockBtnWrap}>
        <AppButton
          title="View Stock Details"
          variant="outline"
          onPress={() =>
            navigation.navigate("StockDetailScreen", {
              symbol: item.symbol,
              name: item.companyName || item.symbol,
              source: "ui",
            })
          }
        />
      </View>

      <View style={styles.footerWrap}>
        <Text style={styles.footerText}>
          Powered by <Text style={styles.footerBrand}>Alphaclara</Text>
        </Text>

        <Text style={styles.disclaimer}>
          This pick's rating, pattern evidence, and tracked performance
          are generated by Alphaclara's AI intelligence engine using
          market momentum, volatility, price action, and pattern
          analysis. Informational and educational use only — not
          financial, investment, trading, or tax advice.
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BRAND.bg,
    paddingTop: 14,
  },

  heroStyleCard: {
    backgroundColor: "#07111F",
    borderRadius: 26,
    paddingHorizontal: 14,
    paddingTop: 14,
    paddingBottom: 12,
    marginHorizontal: 14,
    marginBottom: 14,
    borderWidth: 1.5,
    borderColor: "rgba(212,166,58,0.42)",
    shadowColor: "#D4A63A",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 26,
    elevation: 14,
    overflow: "hidden",
    position: "relative",
  },

  heroStyleGlow: {
    position: "absolute",
    right: -90,
    top: -100,
    width: 200,
    height: 200,
    borderRadius: 100,
    opacity: 0.22,
  },

  header: {
    flexDirection: "row",
    alignItems: "center",
  },

  logoCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: "rgba(255,255,255,0.045)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.07)",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },

  logoImage: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },

  logoText: {
    color: "rgba(255,255,255,0.92)",
    fontSize: 13,
    fontFamily: TYPO.fontFamily.extrabold,
    letterSpacing: -0.25,
  },

  headerBody: {
    flex: 1,
  },

  symbol: {
    color: BRAND.text,
    fontSize: 20,
    fontFamily: TYPO.fontFamily.extrabold,
    letterSpacing: -0.4,
  },

  companyName: {
    color: BRAND.sub,
    fontSize: 12.5,
    fontFamily: TYPO.fontFamily.medium,
    marginTop: 1,
  },

  headerMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 3,
  },

  pickedAgo: {
    color: BRAND.muted,
    fontSize: 11,
    fontFamily: TYPO.fontFamily.medium,
  },

  regimePill: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },

  regimePillText: {
    fontSize: 9.5,
    fontFamily: TYPO.fontFamily.bold,
    textTransform: "uppercase",
    letterSpacing: 0.3,
  },

  headerRight: {
    alignItems: "flex-end",
  },

  currentPrice: {
    color: BRAND.text,
    fontSize: 20,
    fontFamily: TYPO.fontFamily.extrabold,
    fontVariant: ["tabular-nums"],
  },

  card: {
    backgroundColor: "#070D15",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(212,166,58,0.18)",
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginHorizontal: 14,
    marginBottom: 12,
  },

  sectionHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },

  sectionAccent: {
    width: 3,
    height: 15,
    borderRadius: 999,
    backgroundColor: "rgba(212,166,58,0.75)",
    marginRight: 8,
  },

  sectionTitle: {
    color: BRAND.text,
    fontSize: 14.5,
    fontFamily: TYPO.fontFamily.extrabold,
    letterSpacing: -0.15,
  },

  setupTag: {
    alignSelf: "flex-start",
    backgroundColor: "rgba(0,227,150,0.14)",
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 3,
    marginBottom: 8,
  },

  setupTagText: {
    color: BRAND.accent,
    fontSize: 10.5,
    fontFamily: TYPO.fontFamily.bold,
  },

  reasonText: {
    color: BRAND.text,
    fontSize: 13.5,
    lineHeight: 19,
    fontFamily: TYPO.fontFamily.medium,
  },

  whyNowList: {
    marginTop: 8,
  },

  whyNowText: {
    color: BRAND.sub,
    fontSize: 12.5,
    lineHeight: 18,
    fontFamily: TYPO.fontFamily.regular,
  },

  primaryValue: {
    color: BRAND.text,
    fontSize: 15,
    fontFamily: TYPO.fontFamily.bold,
  },

  secondaryValue: {
    color: BRAND.sub,
    fontSize: 12,
    fontFamily: TYPO.fontFamily.medium,
    marginTop: 3,
  },

  factorRow: {
    marginBottom: 10,
  },

  factorRowLast: {
    marginBottom: 0,
  },

  factorLabelRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 4,
  },

  factorLabel: {
    color: BRAND.sub,
    fontSize: 12,
    fontFamily: TYPO.fontFamily.medium,
  },

  factorValue: {
    fontSize: 12,
    fontFamily: TYPO.fontFamily.bold,
    fontVariant: ["tabular-nums"],
  },

  factorBarTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: "rgba(255,255,255,0.08)",
    overflow: "hidden",
  },

  factorBarFill: {
    height: 6,
    borderRadius: 3,
  },

  patternDisclaimer: {
    color: BRAND.sub,
    fontSize: 11.5,
    lineHeight: 16,
    fontFamily: TYPO.fontFamily.medium,
    fontStyle: "italic",
    marginBottom: 10,
  },

  statChipRow: {
    flexDirection: "row",
    gap: 8,
  },

  statChip: {
    flex: 1,
    backgroundColor: BRAND.card2,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: BRAND.softBorder,
    paddingVertical: 9,
    paddingHorizontal: 10,
  },

  statChipLabel: {
    color: BRAND.muted,
    fontSize: 10,
    fontFamily: TYPO.fontFamily.bold,
    textTransform: "uppercase",
    letterSpacing: 0.35,
    marginBottom: 4,
  },

  statChipValue: {
    color: BRAND.text,
    fontSize: 13,
    fontFamily: TYPO.fontFamily.extrabold,
  },

  performancePriceLine: {
    color: BRAND.text,
    fontSize: 14,
    fontFamily: TYPO.fontFamily.bold,
    fontVariant: ["tabular-nums"],
    marginBottom: 8,
  },

  performanceMetricRow: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    marginTop: 6,
  },

  performanceMetricLabel: {
    color: BRAND.sub,
    fontSize: 12,
    fontFamily: TYPO.fontFamily.medium,
  },

  performanceMetricValuePrimary: {
    fontSize: 14,
    fontFamily: TYPO.fontFamily.extrabold,
    fontVariant: ["tabular-nums"],
  },

  performanceMetricValueSecondary: {
    color: BRAND.muted,
    fontSize: 12,
    fontFamily: TYPO.fontFamily.semibold,
    fontVariant: ["tabular-nums"],
  },

  staleNote: {
    color: BRAND.muted,
    fontSize: 10.5,
    fontFamily: TYPO.fontFamily.medium,
    marginTop: 6,
  },

  viewStockBtnWrap: {
    marginHorizontal: 14,
    marginTop: 4,
  },

  footerWrap: {
    marginTop: 28,
    marginBottom: 30,
    paddingHorizontal: 18,
    alignItems: "center",
  },

  footerText: {
    color: BRAND.sub,
    fontSize: 12,
    marginBottom: 8,
    fontFamily: TYPO.fontFamily.semibold,
  },

  footerBrand: {
    color: BRAND.text,
    fontSize: 13.5,
    fontFamily: TYPO.fontFamily.brand,
    letterSpacing: -0.45,
  },

  disclaimer: {
    color: BRAND.muted,
    fontSize: 11,
    lineHeight: 16,
    textAlign: "center",
    fontFamily: TYPO.fontFamily.regular,
  },
});
