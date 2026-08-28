// screens/PickDetailScreen.js
import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  Image,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Linking,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import ViewShot from "react-native-view-shot";
import * as Sharing from "expo-sharing";
import { LinearGradient } from "expo-linear-gradient";
import { BRAND } from "../constants/theme";
import { TYPO } from "../constants/typography";
import AppButton from "../components/AppButton";
import PickPriceHistoryChart from "../components/PickPriceHistoryChart";
import { getAlphaclaraPickHistory } from "../services/HomeService";
import {
  formatPickedDaysAgo,
  formatPickDateLong,
  formatModelViewSplit,
  formatMarketContextLine,
  formatSinceLastUpdatePct,
  getPickPerformanceDisplay,
  fmtPct,
  isQuoteStale,
} from "../utils/formatters";

const ALPHACLARA_LOGO = require("../assets/alpha-transparent.png");

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

// Same fresh/tracking/checked partitioning as AlphaclaraPicksList (keyed
// off the same item.tier the backend sends, defaulting to "tracking" —
// see HomeService.js) so this status can never drift from the tier a
// user already saw this same pick sorted into on Home/All Picks.
function getShareStatusDisplay(item) {
  const tier =
    item?.tier === "fresh" || item?.tier === "checked"
      ? item.tier
      : "tracking";

  if (tier === "checked") {
    const horizon = item?.checkedHorizon ? ` ${item.checkedHorizon}` : "";
    return {
      label: `✓ Checked — Final${horizon} Result`,
      color: BRAND.sub,
      bg: "rgba(156,163,175,0.14)",
      border: "rgba(156,163,175,0.35)",
    };
  }

  if (tier === "fresh") {
    return {
      label: "🟢 Picked Today — Still Tracking",
      color: BRAND.accent,
      bg: "rgba(0,227,150,0.14)",
      border: "rgba(0,227,150,0.35)",
    };
  }

  return {
    label: "🟡 Still Tracking — Live",
    color: BRAND.amber,
    bg: "rgba(250,204,21,0.14)",
    border: "rgba(250,204,21,0.35)",
  };
}

function getPickCountDisplay(pickCount, firstPickedDate) {
  const count = Number(pickCount) || 0;
  if (count <= 1) {
    return {
      primary: "First pick — Alphaclara has flagged this stock once.",
      secondary: null,
    };
  }
  const dateLabel = formatPickDateLong(firstPickedDate);
  return {
    // The raw count reads as independent buy decisions if it's the
    // lead fact — it's really the same signal being auto-reconfirmed
    // every cron cycle. Lead with persistence, demote the count to a
    // secondary caption that names the actual mechanism.
    primary: dateLabel
      ? `Continuously flagged since ${dateLabel}`
      : "Continuously flagged",
    secondary: `Re-confirmed every ~15 min · ${count} checks`,
  };
}

export default function PickDetailScreen({ route, navigation }) {
  const item = route?.params?.item || {};

  const pickedAgo = formatPickedDaysAgo(item.firstPickedDate);
  const { endPrice, priceLine, pctText, color: performanceColor } =
    getPickPerformanceDisplay(item);
  const shareStatus = getShareStatusDisplay(item);
  const quoteStale = isQuoteStale(item.currentPriceUpdatedAt);
  const sinceLastUpdatePct = formatSinceLastUpdatePct(item);
  const pickCountDisplay = getPickCountDisplay(item.pickCount, item.firstPickedDate);

  const shareCardRef = useRef(null);

  const sharePick = async () => {
    try {
      const uri = await shareCardRef.current?.capture?.();

      if (!uri) {
        console.warn("Share card capture failed: no URI");
        return;
      }

      const available = await Sharing.isAvailableAsync();

      if (!available) {
        console.warn("Sharing is not available on this device");
        return;
      }

      await Sharing.shareAsync(uri, {
        mimeType: "image/png",
        dialogTitle: "Share this Alphaclara Pick",
      });
    } catch (e) {
      console.warn("Share pick card error:", e?.message || e);
    }
  };

  const [history, setHistory] = useState(null);
  const [historyLoading, setHistoryLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function load() {
      if (!item.symbol) {
        setHistoryLoading(false);
        return;
      }
      try {
        const data = await getAlphaclaraPickHistory(item.symbol);
        if (mounted) setHistory(data);
      } finally {
        if (mounted) setHistoryLoading(false);
      }
    }

    load();

    return () => {
      mounted = false;
    };
  }, [item.symbol]);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingBottom: 40 }}
    >
      <View style={styles.hiddenShareCardWrap} pointerEvents="none">
        <ViewShot
          ref={shareCardRef}
          collapsable={false}
          options={{ format: "png", quality: 1, result: "tmpfile" }}
        >
          <View style={styles.shareCard}>
            <View style={styles.shareBrandRow}>
              <View style={styles.shareLogoWrap}>
                <Image
                  source={ALPHACLARA_LOGO}
                  style={styles.shareLogo}
                  resizeMode="contain"
                />
              </View>
              <View>
                <Text style={styles.shareCardTitle}>Alphaclara</Text>
                <Text style={styles.shareCardSubTitle}>Pick Result</Text>
              </View>
            </View>

            <View style={styles.shareStockRow}>
              <View style={styles.shareStockLeft}>
                <View style={styles.shareStockLogoWrap}>
                  {item.logoUrl ? (
                    <Image
                      source={{ uri: item.logoUrl }}
                      style={styles.shareStockLogo}
                      resizeMode="contain"
                    />
                  ) : (
                    <Text style={styles.shareStockLogoText}>
                      {String(item.symbol || "").slice(0, 4)}
                    </Text>
                  )}
                </View>
                <View style={styles.shareStockTextCol}>
                  <Text style={styles.shareSymbol}>{item.symbol}</Text>
                  <Text style={styles.shareCompanyName} numberOfLines={1}>
                    {item.companyName || item.symbol}
                  </Text>
                </View>
              </View>

              <View
                style={[
                  styles.shareStatusBadge,
                  {
                    backgroundColor: shareStatus.bg,
                    borderColor: shareStatus.border,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.shareStatusBadgeText,
                    { color: shareStatus.color },
                  ]}
                >
                  {shareStatus.label}
                </Text>
              </View>
            </View>

            {!!item.pickSetupLabel && (
              <View style={styles.setupTag}>
                <Text style={styles.setupTagText}>{item.pickSetupLabel}</Text>
              </View>
            )}

            <Text style={styles.sharePickedDate}>
              Picked {formatPickDateLong(item.firstPickedDate) || "—"}
            </Text>

            <Text style={styles.sharePriceLine}>{priceLine}</Text>

            <Text
              style={[styles.shareReturnValue, { color: performanceColor }]}
            >
              {pctText}
            </Text>

            {quoteStale && (
              <Text style={styles.shareStaleNote}>Quote may be delayed</Text>
            )}

            <Text style={styles.shareFooter}>
              Alphaclara · Real picks, tracked honestly
            </Text>
            <Text style={styles.shareDisclaimer}>
              Not financial advice. Past performance does not guarantee
              future results.
            </Text>
          </View>
        </ViewShot>
      </View>

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
            <TouchableOpacity
              style={styles.shareIconButton}
              activeOpacity={0.82}
              onPress={sharePick}
            >
              <Ionicons name="share-outline" size={16} color={BRAND.text} />
            </TouchableOpacity>
          </View>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.pickCountText}>{pickCountDisplay.primary}</Text>
        {!!pickCountDisplay.secondary && (
          <Text style={styles.pickCountSecondary}>
            {pickCountDisplay.secondary}
          </Text>
        )}
      </View>

      <View style={styles.card}>
        <View style={styles.sectionHeaderRow}>
          <View style={styles.sectionAccent} />
          <Text style={styles.sectionTitle}>Price History</Text>
        </View>

        {historyLoading ? (
          <View style={styles.chartLoadingWrap}>
            <Text style={styles.chartLoadingText}>Loading price history…</Text>
          </View>
        ) : (
          <PickPriceHistoryChart
            priceHistory={history?.priceHistory || []}
            isChecked={item.isChecked === true}
          />
        )}
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

          {!!item.pickNewsUrl && (
            <TouchableOpacity
              activeOpacity={0.75}
              style={styles.newsLink}
              onPress={() => Linking.openURL(item.pickNewsUrl)}
            >
              <Text style={styles.newsLinkText} numberOfLines={2}>
                📰{" "}
                {item.pickNewsSource ? `${item.pickNewsSource} — ` : ""}
                {item.pickNewsHeadline || "Read the source"}
              </Text>
            </TouchableOpacity>
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

      <View style={styles.card}>
        <View style={styles.sectionHeaderRow}>
          <View style={styles.sectionAccent} />
          <Text style={styles.sectionTitle}>What Happened</Text>
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

        {!item.isChecked && !!item.lastResolvedStatus && (
          <View style={styles.earlierResultBlock}>
            <Text style={styles.earlierResultLabel}>
              Earlier {item.lastResolvedHorizon || ""} Result
            </Text>
            {item.lastResolvedStatus === "checked" ? (
              <Text
                style={[
                  styles.earlierResultValue,
                  {
                    color:
                      item.lastResolvedReturnPct != null
                        ? Number(item.lastResolvedReturnPct) >= 0
                          ? BRAND.accent
                          : BRAND.red
                        : BRAND.sub,
                  },
                ]}
              >
                {item.lastResolvedReturnPct != null
                  ? `${Number(item.lastResolvedReturnPct) >= 0 ? "+" : ""}${Number(
                      item.lastResolvedReturnPct,
                    ).toFixed(2)}%`
                  : "—"}
                {!!item.lastResolvedAt &&
                  ` · resolved ${formatPickDateLong(
                    String(item.lastResolvedAt).slice(0, 10),
                  )}`}
              </Text>
            ) : (
              <Text style={styles.earlierResultValue}>
                Check unavailable
              </Text>
            )}
          </View>
        )}
      </View>

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

  newsLink: {
    marginTop: 8,
    alignSelf: "flex-start",
  },

  newsLinkText: {
    color: BRAND.accent,
    fontSize: 12,
    lineHeight: 17,
    fontFamily: TYPO.fontFamily.semibold,
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

  pickCountText: {
    color: BRAND.text,
    fontSize: 13,
    lineHeight: 18,
    fontFamily: TYPO.fontFamily.medium,
  },

  pickCountSecondary: {
    color: BRAND.muted,
    fontSize: 11,
    fontFamily: TYPO.fontFamily.medium,
    marginTop: 2,
  },

  chartLoadingWrap: {
    height: 80,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.04)",
    alignItems: "center",
    justifyContent: "center",
  },

  chartLoadingText: {
    color: BRAND.muted,
    fontSize: 11.5,
    fontFamily: TYPO.fontFamily.medium,
  },

  earlierResultBlock: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.08)",
  },

  earlierResultLabel: {
    color: BRAND.sub,
    fontSize: 11,
    fontFamily: TYPO.fontFamily.bold,
    textTransform: "uppercase",
    letterSpacing: 0.3,
    marginBottom: 3,
  },

  earlierResultValue: {
    fontSize: 13,
    fontFamily: TYPO.fontFamily.bold,
    fontVariant: ["tabular-nums"],
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

  shareIconButton: {
    marginTop: 8,
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },

  hiddenShareCardWrap: {
    position: "absolute",
    left: -9999,
    top: 0,
    opacity: 1,
  },

  shareCard: {
    width: 640,
    backgroundColor: BRAND.bg,
    paddingHorizontal: 34,
    paddingTop: 40,
    paddingBottom: 34,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: BRAND.border,
  },

  shareBrandRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 22,
  },

  shareLogoWrap: {
    width: 58,
    height: 58,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },

  shareLogo: {
    width: 46,
    height: 46,
  },

  shareCardTitle: {
    color: BRAND.text,
    fontSize: 34,
    fontFamily: TYPO.fontFamily.extrabold,
    letterSpacing: 0.2,
  },

  shareCardSubTitle: {
    color: BRAND.sub,
    fontSize: 18,
    fontFamily: TYPO.fontFamily.bold,
    marginTop: -2,
  },

  shareStockRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 18,
  },

  shareStockLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    flexShrink: 1,
    minWidth: 0,
    marginRight: 12,
  },

  shareStockTextCol: {
    flexShrink: 1,
    minWidth: 0,
  },

  shareStockLogoWrap: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 14,
  },

  shareStockLogo: {
    width: 48,
    height: 48,
  },

  shareStockLogoText: {
    color: BRAND.text,
    fontSize: 16,
    fontFamily: TYPO.fontFamily.extrabold,
  },

  shareSymbol: {
    color: BRAND.text,
    fontSize: 26,
    fontFamily: TYPO.fontFamily.extrabold,
  },

  shareCompanyName: {
    color: BRAND.sub,
    fontSize: 15,
    fontFamily: TYPO.fontFamily.semibold,
    maxWidth: 380,
  },

  sharePickedDate: {
    color: BRAND.sub,
    fontSize: 14,
    fontFamily: TYPO.fontFamily.semibold,
    marginBottom: 18,
  },

  sharePriceLine: {
    color: BRAND.text,
    fontSize: 20,
    fontFamily: TYPO.fontFamily.bold,
    marginBottom: 6,
  },

  shareStatusBadge: {
    maxWidth: 210,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },

  shareStatusBadgeText: {
    fontSize: 14,
    fontFamily: TYPO.fontFamily.bold,
  },

  shareReturnValue: {
    fontSize: 44,
    fontFamily: TYPO.fontFamily.extrabold,
    marginBottom: 10,
  },

  shareStaleNote: {
    color: BRAND.amber,
    fontSize: 12,
    fontFamily: TYPO.fontFamily.semibold,
    marginBottom: 4,
  },

  shareFooter: {
    color: BRAND.muted,
    textAlign: "center",
    marginTop: 22,
    fontSize: 13,
    fontWeight: "700",
  },

  shareDisclaimer: {
    color: BRAND.muted,
    textAlign: "center",
    marginTop: 6,
    fontSize: 10,
    fontFamily: TYPO.fontFamily.regular,
  },
});
