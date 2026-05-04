// services/newsData.js
import { API_BASE_URL } from "../config/apiKeys";

// ===========================================================
// Fetch Market News — backend only, clean + simple
// ===========================================================
export async function getMarketNews(force = false) {
 

  const endpoint = `${API_BASE_URL}/market-news`;


  try {
    const res = await fetch(endpoint, { method: "GET" });
    const json = await res.json();

    if (!json || !json.data) {
      console.warn("⚠️ Backend returned no data");
      return [];
    }

    // Sort newest first (backend already sorted, but safe)
    const sorted = json.data.sort(
      (a, b) => new Date(b.pubDate) - new Date(a.pubDate)
    );

    // Return top 50 items
    return sorted.slice(0, 50);
  } catch (err) {
    console.warn("❌ Market news fetch failed:", err.message);
    return [];
  }
}
