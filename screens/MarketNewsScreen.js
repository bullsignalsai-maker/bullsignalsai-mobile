import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Linking,
  RefreshControl,
  StatusBar,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { getMarketNews } from "../services/MarketPulseService";
import { BRAND } from "../constants/theme";
import { TYPO } from "../constants/typography";
import { LinearGradient } from "expo-linear-gradient";

function timeAgoFromUtc(iso) {
  if (!iso) return "Just now";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "Just now";
  const diff = Math.floor((Date.now() - d.getTime()) / 1000);
  if (diff < 60) return "Just now";
  if (diff < 3600) return `${Math.floor(diff / 60)} min ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} hr ago`;
  return `${Math.floor(diff / 86400)} day ago`;
}

function groupNewsByDate(news = []) {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const week = new Date(today);
  week.setDate(week.getDate() - 7);

  return news.reduce(
    (acc, n) => {
      const d = new Date(n.pubDate);
      if (Number.isNaN(d.getTime())) return acc;
      if (d >= today) acc.today.push(n);
      else if (d >= yesterday) acc.yesterday.push(n);
      else if (d >= week) acc.week.push(n);
      else acc.older.push(n);
      return acc;
    },
    { today: [], yesterday: [], week: [], older: [] },
  );
}

export default function MarketNewsScreen({ navigation }) {
  const [news, setNews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadNews = useCallback(async () => {
    try {
      const data = await getMarketNews();
      setNews(Array.isArray(data?.news) ? data.news : []);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadNews();
  }, [loadNews]);

  const grouped = groupNewsByDate(news);

  const openNews = (n) => {
    if (!n.link) return;
    Alert.alert(
      "Open External Link",
      "You are leaving Alphaclara to view this market news article.",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Continue", onPress: () => Linking.openURL(n.link) },
      ],
    );
  };

  const renderGroup = (title, items) => {
    if (!items?.length) return null;

    return (
      <LinearGradient
        colors={["rgba(0,227,150,0.055)", "rgba(17,24,39,0.94)"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.group}
      >
        <Text style={styles.groupTitle}>{title}</Text>

        {items.map((n, i) => {
          const rowKey =
            n.id ||
            n.link ||
            `${title}-${n.source || "news"}-${n.pubDate || "date"}-${i}`;

          return (
            <View key={rowKey} style={styles.newsRow}>
              <View style={styles.newsAccent} />

              <TouchableOpacity
                style={[
                  styles.newsItem,
                  i === items.length - 1 && styles.lastNewsItem,
                ]}
                activeOpacity={0.85}
                onPress={() => openNews(n)}
              >
                <Text style={styles.newsTitle} numberOfLines={2}>
                  {n.title}
                </Text>

                {!!n.summary && (
                  <Text style={styles.newsSummary} numberOfLines={2}>
                    {n.summary}
                  </Text>
                )}

                <Text style={styles.newsMeta}>
                  {n.source} · {timeAgoFromUtc(n.pubDate)} ↗
                </Text>
              </TouchableOpacity>
            </View>
          );
        })}
      </LinearGradient>
    );
  };

  return (
    <View style={styles.wrapper}>
      <View style={styles.topGlow} />
      <StatusBar barStyle="light-content" backgroundColor={BRAND.bg} />

      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={navigation.goBack}>
          <Ionicons name="chevron-back" size={23} color={BRAND.text} />
        </TouchableOpacity>

        <View>
          <Text style={styles.title}>Market News</Text>
          <Text style={styles.subtitle}>Latest market headlines</Text>
        </View>
      </View>

      {loading ? (
        <View style={styles.loading}>
          <ActivityIndicator color={BRAND.green} />
          <Text style={styles.loadingText}>Loading market news…</Text>
        </View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.content}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              tintColor={BRAND.green}
              onRefresh={() => {
                setRefreshing(true);
                loadNews();
              }}
            />
          }
        >
          {renderGroup("Yesterday", grouped.yesterday)}
          {renderGroup("Last 7 Days", grouped.week)}
          {renderGroup("Older", grouped.older)}

          <View style={styles.footerWrap}>
            <View style={styles.footerBrandRow}>
              <Text style={styles.footerText}>
                Powered by <Text style={styles.footerBrand}>Alphaclara</Text>
              </Text>
            </View>

            <Text style={styles.disclaimer}>
              Market news is provided for informational and educational purposes
              only. Not financial or investment advice.
            </Text>
          </View>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
    backgroundColor: BRAND.bg,
  },

  header: {
    paddingTop: 56,
    paddingHorizontal: 18,
    paddingBottom: 16,
    flexDirection: "row",
    alignItems: "center",
  },

  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: "rgba(17,24,39,0.9)",
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.22)",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },

  title: {
    color: BRAND.text,
    fontSize: 28,
    fontFamily: TYPO.fontFamily.extrabold,
    letterSpacing: -0.8,
  },

  subtitle: {
    color: BRAND.sub,
    fontSize: 13,
    fontFamily: TYPO.fontFamily.semibold,
    marginTop: 3,
  },

  content: {
    paddingHorizontal: 16,
    paddingBottom: 120,
  },

  group: {
    backgroundColor: "rgba(17,24,39,0.9)",
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.22)",
    padding: 16,
    marginBottom: 16,
  },

  groupTitle: {
    color: BRAND.muted,
    fontSize: 12,
    fontFamily: TYPO.fontFamily.extrabold,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 8,
  },

  newsItem: {
    paddingVertical: 13,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(148,163,184,0.12)",
  },

  newsTitle: {
    color: BRAND.text,
    fontSize: 15,
    lineHeight: 21,
    fontFamily: TYPO.fontFamily.bold,
  },

  newsSummary: {
    color: BRAND.sub,
    fontSize: 13,
    lineHeight: 19,
    marginTop: 5,
  },

  newsMeta: {
    color: BRAND.muted,
    fontSize: 12,
    marginTop: 7,
    fontFamily: TYPO.fontFamily.semibold,
  },

  loading: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },

  loadingText: {
    color: BRAND.sub,
    marginTop: 8,
    fontSize: 13,
  },
  content: {
    paddingHorizontal: 16,
    paddingBottom: 130,
  },

  group: {
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.18)",
    padding: 16,
    marginBottom: 16,
    overflow: "hidden",
  },

  groupTitle: {
    color: BRAND.text,
    fontSize: 12,
    fontFamily: TYPO.fontFamily.extrabold,
    textTransform: "uppercase",
    letterSpacing: 0.65,
    marginBottom: 8,
  },

  newsItem: {
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(148,163,184,0.10)",
  },

  newsTitle: {
    color: BRAND.text,
    fontSize: 15.2,
    lineHeight: 21,
    fontFamily: TYPO.fontFamily.extrabold,
    letterSpacing: -0.15,
  },

  newsSummary: {
    color: "rgba(156,163,175,0.92)",
    fontSize: 12.5,
    lineHeight: 18,
    marginTop: 5,
    fontFamily: TYPO.fontFamily.regular,
  },

  newsMeta: {
    color: BRAND.green,
    fontSize: 11.5,
    marginTop: 8,
    fontFamily: TYPO.fontFamily.semibold,
  },

  footerWrap: {
    marginTop: 10,
    marginBottom: 28,
    paddingHorizontal: 16,
    paddingVertical: 18,
    borderRadius: 22,
    backgroundColor: "rgba(17,24,39,0.76)",
    borderWidth: 1,
    borderColor: "rgba(0,227,150,0.14)",
    alignItems: "center",
  },

  footerBrandRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },

  footerText: {
    color: BRAND.sub,
    fontSize: 12,
    fontFamily: TYPO.fontFamily.semibold,
  },

  footerBrand: {
    color: BRAND.text,
    fontSize: 14,
    fontFamily: TYPO.fontFamily.brand,
    letterSpacing: -0.45,
  },

  disclaimer: {
    color: BRAND.muted,
    fontSize: 10.8,
    lineHeight: 16,
    textAlign: "center",
    fontFamily: TYPO.fontFamily.regular,
  },
  topGlow: {
    position: "absolute",
    top: -120,
    left: -40,
    right: -40,
    height: 260,
    backgroundColor: "rgba(0,227,150,0.10)",
    borderRadius: 260,

    shadowColor: BRAND.green,
    shadowOpacity: 0.35,
    shadowRadius: 90,
    shadowOffset: { width: 0, height: 0 },

    zIndex: 0,
  },
  newsRow: {
    flexDirection: "row",
    alignItems: "stretch",
  },

  newsAccent: {
    width: 3,
    borderRadius: 99,
    backgroundColor: "rgba(0,227,150,0.75)",
    marginRight: 10,
    marginVertical: 14,
  },
  lastNewsItem: {
    borderBottomWidth: 0,
    paddingBottom: 2,
  },
});
