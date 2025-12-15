// screens/SignalDetailScreen.js
import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  TouchableOpacity,
  Alert,
  Animated, // ← ADDED
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function SignalDetailScreen({ route, navigation }) {
  const { ticker } = route.params;
  const [signal, setSignal] = useState(null);
  const [watchlist, setWatchlist] = useState([]);

  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 600,
      useNativeDriver: true,
    }).start();
  }, [fadeAnim]);

  useEffect(() => {
    const loadSignal = async () => {
      setSignal({
        ticker,
        signal: 'BUY',
        confidence: 78,
        sentiment: 0.8,
        trend: 0.9,
        volume: 0.7,
        insider: 0.5,
        news: ['Apple launches new iPhone', 'AAPL earnings beat expectations'],
        tweets: ['AAPL is crushing it! #stocks', 'Bullish on Apple future'],
      });
    };
    loadSignal();

    const loadWatchlist = async () => {
      const saved = await AsyncStorage.getItem('watchlist') || '[]';
      setWatchlist(JSON.parse(saved));
    };
    loadWatchlist();
  }, [ticker]);

  const addToWatchlist = async () => {
    if (watchlist.includes(ticker)) {
      Alert.alert('Already Added', `${ticker} is already in your watchlist`);
      return;
    }
    const updated = [...watchlist, ticker];
    await AsyncStorage.setItem('watchlist', JSON.stringify(updated));
    setWatchlist(updated);
    Alert.alert('Added!', `${ticker} added to watchlist`);
  };

  if (!signal) return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color="#22C55E" />
    </View>
  );

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backText}>Back</Text>
        </TouchableOpacity>
        <Image source={require('../assets/logo.png')} style={styles.logo} />
        <Text style={styles.title}>{signal.ticker} Detail</Text>
      </View>

      <Animated.View style={{ opacity: fadeAnim }}>
        <View style={styles.card}>
          <Text style={styles.signalType}>
            {signal.signal} • {signal.confidence}% confidence
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.breakdownTitle}>Signal Breakdown</Text>
          {[
            { label: 'Sentiment (40%)', value: signal.sentiment },
            { label: 'Trend Strength (30%)', value: signal.trend },
            { label: 'Volume Anomaly (20%)', value: signal.volume },
            { label: 'Insider Activity (10%)', value: signal.insider },
          ].map((item, i) => (
            <View key={i} style={styles.factorRow}>
              <Text style={styles.factorLabel}>{item.label}</Text>
              <Text style={styles.factorValue}>{(item.value * 100).toFixed(0)}%</Text>
            </View>
          ))}
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Latest News</Text>
          {signal.news?.map((news, i) => (
            <View key={i} style={styles.newsItem}>
              <Text style={styles.newsText}>{news}</Text>
            </View>
          ))}
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>X Tweets</Text>
          {signal.tweets?.map((tweet, i) => (
            <View key={i} style={styles.tweetItem}>
              <Text style={styles.tweetText}>{tweet}</Text>
            </View>
          ))}
        </View>
      </Animated.View>

      <TouchableOpacity style={styles.watchlistBtn} onPress={addToWatchlist}>
        <Text style={styles.watchlistBtnText}>Add to Watchlist</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000', padding: 20 },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  backBtn: { marginRight: 10 },
  backText: { color: '#22C55E', fontSize: 18, fontWeight: 'bold' },
  logo: { width: 50, height: 50, marginRight: 8 },
  title: { color: '#22C55E', fontSize: 24, fontWeight: 'bold' },
  card: { backgroundColor: '#111', padding: 16, borderRadius: 14, marginBottom: 12 },
  signalType: { color: '#fff', fontSize: 24, fontWeight: 'bold', textAlign: 'center' },
  breakdownTitle: { color: '#fff', fontSize: 20, fontWeight: 'bold', marginBottom: 12 },
  factorRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  factorLabel: { color: '#aaa', fontSize: 14 },
  factorValue: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  sectionTitle: { color: '#fff', fontSize: 18, fontWeight: 'bold', marginBottom: 12 },
  newsItem: { backgroundColor: '#000', padding: 12, borderRadius: 8, marginBottom: 8 },
  newsText: { color: '#fff', fontSize: 14 },
  tweetItem: { backgroundColor: '#000', padding: 12, borderRadius: 8, marginBottom: 8 },
  tweetText: { color: '#fff', fontSize: 14 },
  watchlistBtn: { backgroundColor: '#22C55E', padding: 16, borderRadius: 12, alignItems: 'center', marginTop: 20 },
  watchlistBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 18 },
});