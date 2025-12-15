// services/CacheManager.js
import AsyncStorage from "@react-native-async-storage/async-storage";

export async function saveCache(key, data, ttlSeconds) {
  const record = { data, expiry: Date.now() + ttlSeconds * 1000 };
  await AsyncStorage.setItem(key, JSON.stringify(record));
}

export async function getCache(key) {
  const recordStr = await AsyncStorage.getItem(key);
  if (!recordStr) return null;
  const record = JSON.parse(recordStr);
  if (Date.now() > record.expiry) {
    await AsyncStorage.removeItem(key);
    return null;
  }
  return record.data;
}
