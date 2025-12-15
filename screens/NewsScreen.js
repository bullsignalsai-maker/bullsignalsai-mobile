import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  TextInput,
  LayoutAnimation,
  Platform,
  UIManager,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { getMarketNews } from "../services/newsData";

if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

export default function NewsScreen({ navigation }) {
  const [news, setNews] = useState([]);
  const [filteredNews, setFilteredNews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [lastUpdated, setLastUpdated] = useState(null);
  const intervalRef = useRef(null);

  const loadNews = async (force = false) => {
    try {
      if (!force) setLoading(true);
      const data = await getMarketNews(force);
      const sorted = data.sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate));

      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);

      if (sorted.length && sorted[0]?.id !== news[0]?.id) {
        console.log("🆕 New headline detected:", sorted[0].headline);
        sorted[0].isNew = true;
      } else {
        console.log("No new headlines this round.");
      }

      setNews(sorted);
      setLastUpdated(new Date().toLocaleTimeString());
    } catch (err) {
      console.warn("Load failed:", err);
      setNews([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadNews(true);
    intervalRef.current = setInterval(() => {
      console.log("Auto-refresh every 60s...");
      loadNews(true);
    }, 60000);
    return () => clearInterval(intervalRef.current);
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadNews(true);
    setRefreshing(false);
  }, []);

  useEffect(() => {
    let filtered = [...news];
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(
        n => n.headline.toLowerCase().includes(q) || n.summary.toLowerCase().includes(q)
      );
    }
    filtered.sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate));
    setFilteredNews(filtered);
  }, [news, searchQuery]);

  const renderItem = ({ item }) => (
    <TouchableOpacity
      style={styles.card}
      onPress={() => navigation.navigate("NewsDetailScreen", { item })}
    >
      {item.isNew && <Text style={styles.newBadge}>NEW</Text>}
      <Text style={styles.time}>{item.timeAgo}</Text>
      <Text style={styles.headline}>
        {item.headline.split(" ").map((word, i) =>
          /^[A-Z]{1,5}$/.test(word) ? (
            <Text key={i} style={{ color: "#00E396", fontWeight: "700" }}>
              {word + " "}
            </Text>
          ) : (
            <Text key={i} style={styles.headline}>
              {word + " "}
            </Text>
          )
        )}
      </Text>
      <Text style={styles.summary}>{item.summary}</Text>
      <Text style={styles.sourceTag}>{item.source}</Text>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" color="#00E396" />
        <Text style={styles.loadingText}>Loading news...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Live Market News</Text>
        <Text style={styles.subtitle}>
          Auto-refresh every 60s • Updated {lastUpdated || "--:--:--"}
        </Text>
      </View>

      <View style={styles.searchContainer}>
        <View style={styles.searchBar}>
          <Ionicons name="search" size={20} color="#9CA3AF" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search headlines..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholderTextColor="#9CA3AF"
          />
          {searchQuery ? (
            <TouchableOpacity onPress={() => setSearchQuery("")}>
              <Ionicons name="close" size={20} color="#9CA3AF" />
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      <FlatList
        data={filteredNews}
        renderItem={renderItem}
        keyExtractor={item => item.id}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={["#00E396"]}
            tintColor="#00E396"
            progressBackgroundColor="#111827"
          />
        }
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>No news found.</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000" },
  header: { paddingTop: 60, paddingHorizontal: 20, marginBottom: 10, alignItems: "center", },
  title: { color: "#00E396", fontSize: 22, fontWeight: "700" },
  subtitle: { color: "#9CA3AF", fontSize: 13, marginTop: 4 },
  searchContainer: { paddingHorizontal: 20, marginBottom: 10 },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#111827",
    borderRadius: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: "#1F2937",
  },
  searchInput: { flex: 1, color: "#FFF", fontSize: 16, marginLeft: 8, paddingVertical: 12 },
  list: { paddingBottom: 20 },
  card: {
    backgroundColor: "#111827",
    marginHorizontal: 20,
    marginBottom: 12,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: "#1F2937",
  },
  newBadge: {
    position: "absolute",
    top: 10,
    right: 10,
    backgroundColor: "#00E396",
    color: "#000",
    fontSize: 10,
    fontWeight: "700",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  time: { color: "#9CA3AF", fontSize: 12, marginBottom: 6 },
  headline: { color: "#FFF", fontSize: 17, fontWeight: "600", marginBottom: 6 },
  summary: { color: "#A3A3A3", fontSize: 14, lineHeight: 20 },
  sourceTag: { color: "#00E396", fontSize: 12, marginTop: 8, alignSelf: "flex-end", opacity: 0.8 },
  loader: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#000" },
  loadingText: { color: "#9CA3AF", marginTop: 10, fontSize: 14 },
  empty: { flex: 1, justifyContent: "center", alignItems: "center", paddingTop: 100 },
  emptyText: { color: "#9CA3AF", fontSize: 16, textAlign: "center" },
});
