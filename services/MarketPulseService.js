// services/MarketPulseService.js
import { API_BASE_URL } from "../config/apiKeys";

/* ---------------------------------------------------------
   1) Fetch Market Pulse (Highlights + News)
   🔥 Firestore-backed, fast
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

    // Safety defaults
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

    // Normalize timestamps for UI
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
      highlights_grouped: highlights,
      highlights_numeric: json.highlights_numeric || {
        bull: 0,
        neutral: 0,
        bear: 0,
      },
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
   2) Fetch Market Overview (Live snapshot)
   🔥 Firestore-backed, very fast
--------------------------------------------------------- */
export async function getMarketOverview() {
  try {
    const url = `${API_BASE_URL}/market-overview`;
    console.log("📡 Fetching Market Overview:", url);

    const res = await fetch(url);
    if (!res.ok) {
      console.warn("❌ Market Overview fetch failed:", res.status);
      return null;
    }

    return await res.json();
  } catch (err) {
    console.warn("❌ getMarketOverview error:", err.message);
    return null;
  }
}

/* ---------------------------------------------------------
   3) Fetch Hotlist (Fast — Firestore)
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

    const json = await res.json();
    console.log(`🔥 Hotlist received (${json.count} items)`);

    return json;
  } catch (err) {
    console.warn("❌ getHotlist error:", err.message);
    return null;
  }
}

/* ---------------------------------------------------------
   4) Fetch BearWatch (Fast — Firestore)
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

    const json = await res.json();
    console.log(`🔥 BearWatch received (${json.count} items)`);

    return json;
  } catch (err) {
    console.warn("❌ getBearwatch error:", err.message);
    return null;
  }
}
