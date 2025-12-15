import { API_BASE_URL } from "../config/apiKeys";

export async function fetchMarketMood() {
  try {
    const res = await fetch(`${API_BASE_URL}/market-mood`);
    const json = await res.json();

    if (json?.data) return json.data;

    return {
      fearGreed: { value: 50, label: "Neutral" },
      vix: 15.0,
    };
  } catch (err) {
    console.warn("⚠️ MoodService backend error:", err.message);
    return {
      fearGreed: { value: 50, label: "Neutral" },
      vix: 15.0,
    };
  }
}
