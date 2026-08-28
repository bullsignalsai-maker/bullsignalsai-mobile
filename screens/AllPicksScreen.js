// screens/AllPicksScreen.js
import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import {
  getAlphaclaraTracking,
  getAlphaclaraAccuracyReport,
} from "../services/HomeService";
import {
  formatAlphaclaraStatsLine,
  getPickPerformanceDisplay,
} from "../utils/formatters";
import AlphaclaraPicksList from "../components/AlphaclaraPicksList";
import PicksStatRow from "../components/PicksStatRow";
import AstraChat from "../components/AstraChat";
import AstraAnimatedIcon from "../components/AstraAnimatedIcon";
import { BRAND } from "../constants/theme";
import { TYPO } from "../constants/typography";

const WINDOW_DAYS = 30;

// Same copy as Home's ALPHACLARA_PICKS_INFO — kept as a local duplicate
// per this codebase's per-screen convention (see MARKET_MOVERS_INFO on
// MarketMoversScreen), not imported cross-file.
const ALPHACLARA_PICKS_INFO = {
  title: "Alphaclara Picks",
  text: "Alphaclara records its own AI picks and tracks their real price performance for a rolling window — wins and losses shown as-is, nothing filtered or hidden. Once a pick's tracking window closes, it's marked Checked with its final result. This reflects a limited, recent tracking window — not a long-term track record, and not a guarantee of future results.",
  whyNow: [
    "Total Picks: how many distinct picks have completed at least one tracked outcome in this window.",
    "Win Rate: the share of those outcomes that were positive.",
    "Avg Return: the average price move across all tracked outcomes, wins and losses combined.",
  ],
};

// No "all" option — the backend's tier param is scoped to exactly one of
// these 3 values, and fetching stays scoped to whichever tab is active
// (see the fetch effect below) rather than falling back to an unscoped
// fetch for a 4th "All Tiers" option.
const TIER_TABS = [
  { value: "fresh", label: "Fresh Today" },
  { value: "tracking", label: "Still Tracking" },
  { value: "checked", label: "Checked" },
];

const DIRECTION_FILTERS = [
  { value: "all", label: "All" },
  { value: "up", label: "Up" },
  { value: "down", label: "Down" },
];

const SORT_MODES = [
  { value: "recent", label: "Recent" },
  { value: "change", label: "% Change" },
];

export default function AllPicksScreen({ navigation }) {
  const [accuracyReport, setAccuracyReport] = useState(null);
  const [astraVisible, setAstraVisible] = useState(false);
  const [infoModal, setInfoModal] = useState(null);
  const [activeTier, setActiveTier] = useState("tracking");
  const [directionFilter, setDirectionFilter] = useState("all");
  const [sortMode, setSortMode] = useState("recent");

  // One scoped fetch per tier, cached for the lifetime of this screen —
  // flipping between tabs re-reads the cache instead of re-fetching. No
  // TTL/invalidation: this screen already had no refresh mechanism before
  // this change (fetch-once-on-mount), so a session-lifetime cache adds no
  // new staleness beyond what was already true here.
  const [tierCache, setTierCache] = useState({
    fresh: null,
    tracking: null,
    checked: null,
  });
  const [tierCounts, setTierCounts] = useState({
    fresh: 0,
    tracking: 0,
    checked: 0,
  });
  const [tierLoading, setTierLoading] = useState(true);

  const tracking = tierCache[activeTier];

  useEffect(() => {
    let mounted = true;

    if (tierCache[activeTier]) {
      setTierLoading(false);
      return undefined;
    }

    setTierLoading(true);

    async function load() {
      try {
        const data = await getAlphaclaraTracking({
          windowDays: WINDOW_DAYS,
          tier: activeTier,
        });
        if (!mounted) return;
        setTierCache((prev) => ({ ...prev, [activeTier]: data }));
        setTierCounts(data.tierCounts);
      } finally {
        if (mounted) setTierLoading(false);
      }
    }

    load();

    return () => {
      mounted = false;
    };
    // tierCache intentionally excluded — reading it here decides whether to
    // skip the fetch, but it must not retrigger this effect on every cache
    // write or every tier would refetch itself immediately after caching.
  }, [activeTier]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    let mounted = true;
    getAlphaclaraAccuracyReport().then((report) => {
      if (mounted) setAccuracyReport(report);
    });
    return () => {
      mounted = false;
    };
  }, []);

  const statsLine = tracking
    ? formatAlphaclaraStatsLine(tracking.counts, tracking.windowDays)
    : null;

  // Backend fetches its own accuracy report + tiered picks list +
  // rankings server-side for this contextType (same pattern as
  // "market") — this payload deliberately doesn't bundle `tracking`/
  // `accuracyReport` state, since the backend ignores it anyway.
  const claraPicksContext = {
    contextType: "alphaclara_picks_overview",
    total_value: 0,
    total_gain: 0,
    today_gain: 0,
    positions: [],
  };

  const isFilterActive = directionFilter !== "all";

  // Tier is no longer filtered here — the fetch itself is already scoped
  // to activeTier, so every item in tracking.items already belongs to it.
  const filteredItems = (tracking?.items || []).filter((item) => {
    if (directionFilter !== "all") {
      const { pct } = getPickPerformanceDisplay(item);
      if (pct == null) return false;
      const isUp = Number(pct) >= 0;
      if (directionFilter === "up" && !isUp) return false;
      if (directionFilter === "down" && isUp) return false;
    }

    return true;
  });

  const displayedItems =
    sortMode === "change"
      ? [...filteredItems].sort((a, b) => {
          const pctA = getPickPerformanceDisplay(a).pct;
          const pctB = getPickPerformanceDisplay(b).pct;
          return Math.abs(Number(pctB) || 0) - Math.abs(Number(pctA) || 0);
        })
      : filteredItems;

  // Viewing a tab other than Checked means the Checked bucket is always
  // empty here as a side effect of which tier was fetched, not because
  // there's genuinely nothing checked yet — hide it rather than showing a
  // placeholder that would misrepresent which case this is.
  const hideEmptyCheckedTier = activeTier !== "checked";

  const emptyText = isFilterActive
    ? "No picks match these filters."
    : "No picks to show for this window.";

  // Only directionFilter can cause an otherwise-real checked item to
  // disappear from this tab, so that's the only thing that should trigger
  // the "filtered" wording here.
  const checkedEmptyText =
    directionFilter !== "all"
      ? "No checked picks match this filter."
      : "No completed picks yet — check back soon";

  return (
    <>
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingBottom: 40 }}
    >
      <View style={styles.titleRow}>
        <Text style={styles.screenTitle}>Alphaclara Picks</Text>
        <TouchableOpacity
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          onPress={() => setInfoModal(ALPHACLARA_PICKS_INFO)}
        >
          <Ionicons
            name="information-circle-outline"
            size={13}
            color={BRAND.sub}
          />
        </TouchableOpacity>
      </View>
      <Text style={styles.description}>
        AI-picked stocks, tracked live for real results
      </Text>
      {!!statsLine && <Text style={styles.statsLine}>{statsLine}</Text>}
      <PicksStatRow accuracyReport={accuracyReport} />

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterRow}
      >
        {TIER_TABS.map((tab) => {
          const active = activeTier === tab.value;
          return (
            <TouchableOpacity
              key={tab.value}
              onPress={() => setActiveTier(tab.value)}
              style={[styles.filterPill, active && styles.filterPillActive]}
              activeOpacity={0.85}
            >
              <Text
                style={[
                  styles.filterText,
                  active && styles.filterTextActive,
                ]}
              >
                {tab.label} ({tierCounts[tab.value]})
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterRow}
      >
        {DIRECTION_FILTERS.map((f) => {
          const active = directionFilter === f.value;
          return (
            <TouchableOpacity
              key={f.value}
              onPress={() => setDirectionFilter(f.value)}
              style={[styles.filterPill, active && styles.filterPillActive]}
              activeOpacity={0.85}
            >
              <Text
                style={[
                  styles.filterText,
                  active && styles.filterTextActive,
                ]}
              >
                {f.label}
              </Text>
            </TouchableOpacity>
          );
        })}

        <View style={styles.filterDivider} />

        {SORT_MODES.map((s) => {
          const active = sortMode === s.value;
          return (
            <TouchableOpacity
              key={s.value}
              onPress={() => setSortMode(s.value)}
              style={[styles.filterPill, active && styles.filterPillActive]}
              activeOpacity={0.85}
            >
              <Text
                style={[
                  styles.filterText,
                  active && styles.filterTextActive,
                ]}
              >
                {s.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {tierLoading && !tracking ? (
        <View style={styles.tierLoadingWrap}>
          <ActivityIndicator color={BRAND.accent} />
          <Text style={styles.loadingText}>Loading picks...</Text>
        </View>
      ) : (
        <AlphaclaraPicksList
          items={displayedItems}
          emptyText={emptyText}
          checkedEmptyText={checkedEmptyText}
          hideEmptyCheckedTier={hideEmptyCheckedTier}
          onPressItem={(item) => {
            navigation.navigate("PickDetailScreen", { item });
          }}
        />
      )}

      <View style={styles.footerWrap}>
        <Text style={styles.footerText}>
          Powered by <Text style={styles.footerBrand}>Alphaclara</Text>
        </Text>

        <Text style={styles.disclaimer}>
          Alphaclara Picks, ratings, and tracked performance are
          generated by Alphaclara's AI intelligence engine using market
          momentum, volatility, price action, and pattern analysis.
          Informational and educational use only — not financial,
          investment, trading, or tax advice.
        </Text>
      </View>
    </ScrollView>

    <TouchableOpacity
      style={styles.astraWrap}
      activeOpacity={0.9}
      onPress={() => setAstraVisible(true)}
    >
      <AstraAnimatedIcon size={52} />
    </TouchableOpacity>

    <AstraChat
      visible={astraVisible}
      onClose={() => setAstraVisible(false)}
      portfolioData={claraPicksContext}
    />

    {infoModal && (
      <Modal transparent animationType="fade" visible>
        <View style={styles.infoModalOverlay}>
          <View style={styles.infoModalCard}>
            <View style={styles.infoModalHeader}>
              <Text style={styles.infoModalTitle}>{infoModal.title}</Text>
              <TouchableOpacity onPress={() => setInfoModal(null)}>
                <Ionicons name="close" size={20} color={BRAND.sub} />
              </TouchableOpacity>
            </View>

            {!!infoModal.text && (
              <Text style={styles.infoModalText}>{infoModal.text}</Text>
            )}

            {infoModal.whyNow?.length > 0 && (
              <View style={styles.infoModalWhyNow}>
                {infoModal.whyNow.map((reason, idx) => (
                  <Text key={idx} style={styles.infoModalWhyNowText}>
                    • {reason}
                  </Text>
                ))}
              </View>
            )}
          </View>
        </View>
      </Modal>
    )}
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BRAND.bg,
    paddingTop: 14,
  },

  centered: {
    justifyContent: "center",
    alignItems: "center",
  },

  loadingText: {
    color: BRAND.sub,
    marginTop: 10,
    fontFamily: TYPO.fontFamily.medium,
  },

  tierLoadingWrap: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 48,
  },

  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginHorizontal: 12,
  },

  screenTitle: {
    color: BRAND.text,
    fontSize: 17,
    fontFamily: TYPO.fontFamily.extrabold,
    letterSpacing: -0.35,
  },

  description: {
    color: BRAND.muted,
    fontSize: 13,
    fontFamily: TYPO.fontFamily.medium,
    marginHorizontal: 12,
    marginTop: 2,
    marginBottom: 4,
  },

  statsLine: {
    color: BRAND.muted,
    fontSize: 11.5,
    fontFamily: TYPO.fontFamily.semibold,
    marginHorizontal: 12,
    marginBottom: 4,
  },


  filterRow: {
    gap: 8,
    paddingHorizontal: 12,
    paddingBottom: 10,
  },

  filterPill: {
    paddingHorizontal: 14,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.16)",
    backgroundColor: "rgba(17,24,39,0.62)",
    justifyContent: "center",
    alignItems: "center",
  },

  filterPillActive: {
    backgroundColor: "rgba(0,227,150,0.18)",
    borderColor: BRAND.accent,
    shadowColor: BRAND.accent,
    shadowOpacity: 0.35,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 0 },
  },

  filterText: {
    color: BRAND.text,
    fontSize: 12.5,
    fontFamily: TYPO.fontFamily.bold,
  },

  filterTextActive: {
    color: BRAND.accent,
  },

  filterDivider: {
    width: 1,
    height: 20,
    backgroundColor: "rgba(255,255,255,0.14)",
    alignSelf: "center",
    marginHorizontal: 2,
  },

  astraWrap: {
    position: "absolute",
    left: 20,
    bottom: 25,
    zIndex: 50,
  },

  infoModalOverlay: {
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
    borderColor: BRAND.softBorder,
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
    flex: 1,
    marginRight: 10,
  },

  infoModalText: {
    color: BRAND.sub,
    fontSize: 13.5,
    lineHeight: 20,
    fontFamily: TYPO.fontFamily.regular,
  },

  infoModalWhyNow: {
    marginTop: 12,
  },

  infoModalWhyNowText: {
    color: BRAND.sub,
    fontSize: 12.5,
    lineHeight: 18,
    fontFamily: TYPO.fontFamily.regular,
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
