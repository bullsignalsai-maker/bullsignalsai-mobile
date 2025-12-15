// services/MarketStatsService.js
export async function fetchLiveMarketStats() {
  try {
    // 🔥 Call your backend instead of RapidAPI or Yahoo directly
    const res = await fetch("https://bullbrain-api.onrender.com/stats/live");
    const json = await res.json();

    return {
      fearGreed: json.fearGreed || { value: 50, label: "Neutral" },
      vix: json.vix ?? 15,
      sp500_change: json.sp500_change ?? 0,
    };
  } catch (err) {
    console.warn("fetchLiveMarketStats error:", err.message);
    return {
      fearGreed: { value: 50, label: "Neutral" },
      vix: 14.0,
      sp500_change: 0.2,
    };
  }
}
