// services/MarketPulseService.js
import { API_BASE_URL } from "../config/apiKeys";

/* ---------------------------------------------------------
   1) Fetch /market-pulse  (News + Overview)
--------------------------------------------------------- */
export async function getMarketPulse() {
  try {
    const url = `${API_BASE_URL}/market-pulse`;
    console.log("📡 Fetching Market Pulse:", url);

    const res = await fetch(url);
    if (!res.ok) {
      console.warn("❌ Market Pulse fetch failed:", res.status);
      return null;
    }

    const json = await res.json();

    console.log(
      "🔥 Backend delivered grouped market news:",
      Object.values(json.news_grouped || {}).reduce(
        (a, b) => a + b.length,
        0
      )
    );

    // Safety defaults
    const overview = json.market_overview || {};
    const highlights = json.highlights_grouped || {
      bullish: [],
      neutral: [],
      bearish: [],
    };
    const grouped = json.news_grouped || {
      today: [],
      yesterday: [],
      week: [],
      older: [],
    };

    // Normalized timestamps (backend already returns ET)
    const normalizeGroup = (arr) =>
      arr.map((n) => {
        const clean = { ...n };
        try {
          const iso = n.pubDateET || n.pubDate;
          const d = new Date(iso);

          clean.timeFormatted = d.toLocaleTimeString("en-US", {
            hour: "2-digit",
            minute: "2-digit",
          });

          clean.dateFormatted = d.toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
          });
        } catch (e) {
          clean.timeFormatted = "";
          clean.dateFormatted = "";
        }
        return clean;
      });

    return {
      market_overview: overview,
      highlights_grouped: highlights,
      news_grouped: {
        today: normalizeGroup(grouped.today),
        yesterday: normalizeGroup(grouped.yesterday),
        week: normalizeGroup(grouped.week),
        older: normalizeGroup(grouped.older),
      },
      updated_at: json.updated_at,
    };
  } catch (err) {
    console.warn("❌ MarketPulseService error:", err.message);
    return null;
  }
}

/* ---------------------------------------------------------
   2) Fetch Hotlist (Fast — Backend returns Firestore results)
--------------------------------------------------------- */
export async function getHotlist() {
  try {
    const url = `${API_BASE_URL}/market-hotlist`;
    console.log("📡 Fetching Hotlist:", url);

    const res = await fetch(url);
    if (!res.ok) {
      console.warn("❌ Hotlist fetch failed:", res.status);
      return null;
    }

    const json = await res.json(); // { count, hotlist }
    console.log(`🔥 Hotlist received (${json.count} items)`);

    return json;
  } catch (err) {
    console.warn("❌ getHotlist error:", err.message);
    return null;
  }
}

/* ---------------------------------------------------------
   3) Fetch BearWatch (Fast — Backend returns Firestore results)
--------------------------------------------------------- */
export async function getBearwatch() {
  try {
    const url = `${API_BASE_URL}/market-bearwatch`;
    console.log("📡 Fetching BearWatch:", url);

    const res = await fetch(url);
    if (!res.ok) {
      console.warn("❌ BearWatch fetch failed:", res.status);
      return null;
    }

    const json = await res.json(); // { count, bearwatch }
    console.log(`🔥 BearWatch received (${json.count} items)`);

    return json;
  } catch (err) {
    console.warn("❌ getBearwatch error:", err.message);
    return null;
  }
}
