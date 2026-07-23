// screens/AllPicksScreen.js
import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { getAlphaclaraTracking } from "../services/HomeService";
import {
  formatAlphaclaraStatsLine,
  getPickPerformanceDisplay,
} from "../utils/formatters";
import AlphaclaraPicksList from "../components/AlphaclaraPicksList";
import { BRAND } from "../constants/theme";
import { TYPO } from "../constants/typography";

const WINDOW_DAYS = 30;

const TIER_FILTERS = [
  { value: "all", label: "All Tiers" },
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

function matchesTierFilter(item, tierFilter) {
  if (tierFilter === "all") return true;
  if (tierFilter === "tracking") {
    return item.tier !== "fresh" && item.tier !== "checked";
  }
  return item.tier === tierFilter;
}

export default function AllPicksScreen({ navigation }) {
  const [tracking, setTracking] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tierFilter, setTierFilter] = useState("all");
  const [directionFilter, setDirectionFilter] = useState("all");
  const [sortMode, setSortMode] = useState("recent");

  useEffect(() => {
    let mounted = true;

    async function load() {
      try {
        const data = await getAlphaclaraTracking({ windowDays: WINDOW_DAYS });
        if (mounted) setTracking(data);
      } finally {
        if (mounted) setLoading(false);
      }
    }

    load();

    return () => {
      mounted = false;
    };
  }, []);

  if (loading && !tracking) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator color={BRAND.accent} />
        <Text style={styles.loadingText}>Loading picks...</Text>
      </View>
    );
  }

  const statsLine = tracking
    ? formatAlphaclaraStatsLine(tracking.counts, tracking.windowDays)
    : null;

  const isFilterActive = tierFilter !== "all" || directionFilter !== "all";

  const filteredItems = (tracking?.items || []).filter((item) => {
    if (!matchesTierFilter(item, tierFilter)) return false;

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

  // Isolating to a specific tier other than Checked means Checked will
  // always be empty in this view as a side effect of the filter, not
  // because there's genuinely nothing checked yet — hide it rather than
  // showing a placeholder that would misrepresent which case this is.
  const hideEmptyCheckedTier = tierFilter !== "all" && tierFilter !== "checked";

  const emptyText = isFilterActive
    ? "No picks match these filters."
    : "No picks to show for this window.";

  // Isolating tierFilter to "checked" doesn't exclude any checked items —
  // it just narrows which other sections render. Only directionFilter can
  // actually cause an otherwise-real checked item to disappear, so that's
  // the only thing that should trigger the "filtered" wording here.
  const checkedEmptyText =
    directionFilter !== "all"
      ? "No checked picks match this filter."
      : "No completed picks yet — check back soon";

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingBottom: 40 }}
    >
      <Text style={styles.description}>
        AI-picked stocks, tracked live for real results
      </Text>
      {!!statsLine && <Text style={styles.statsLine}>{statsLine}</Text>}

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterRow}
      >
        {TIER_FILTERS.map((f) => {
          const active = tierFilter === f.value;
          return (
            <TouchableOpacity
              key={f.value}
              onPress={() => setTierFilter(f.value)}
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

      <AlphaclaraPicksList
        items={displayedItems}
        emptyText={emptyText}
        checkedEmptyText={checkedEmptyText}
        hideEmptyCheckedTier={hideEmptyCheckedTier}
        onPressItem={(item) => {
          navigation.navigate("PickDetailScreen", { item });
        }}
      />
    </ScrollView>
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

  description: {
    color: BRAND.muted,
    fontSize: 13,
    fontFamily: TYPO.fontFamily.medium,
    marginHorizontal: 12,
    marginBottom: 4,
  },

  statsLine: {
    color: BRAND.muted,
    fontSize: 11.5,
    fontFamily: TYPO.fontFamily.semibold,
    marginHorizontal: 12,
    marginBottom: 16,
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
});
