// screens/AllPicksScreen.js
import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, ActivityIndicator } from "react-native";
import { getAlphaclaraTracking } from "../services/HomeService";
import { formatAlphaclaraStatsLine } from "../utils/formatters";
import AlphaclaraPicksList from "../components/AlphaclaraPicksList";
import { BRAND } from "../constants/theme";
import { TYPO } from "../constants/typography";

const WINDOW_DAYS = 30;

export default function AllPicksScreen({ navigation }) {
  const [tracking, setTracking] = useState(null);
  const [loading, setLoading] = useState(true);

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

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingBottom: 40 }}
    >
      <Text style={styles.description}>
        AI-picked stocks, tracked live for real results
      </Text>
      {!!statsLine && <Text style={styles.statsLine}>{statsLine}</Text>}

      <AlphaclaraPicksList
        items={tracking?.items || []}
        emptyText="No picks to show for this window."
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
});
