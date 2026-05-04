// services/MarketPulseService.js
import { API_BASE_URL } from "../config/apiKeys";

/* ---------------------------------------------------------
   1) Fetch Market Pulse (Highlights + News)
--------------------------------------------------------- */
export async function getMarketPulse() {
  try {
    const url = `${API_BASE_URL}/market-pulse`;
    const res = await fetch(url);
    if (!res.ok) return null;

    const json = await res.json();

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
        } catch {
          clean.timeFormatted = "";
          clean.dateFormatted = "";
        }
        return clean;
      });

    return {
      highlights_grouped: highlights,
      news_grouped: {
        today: normalizeGroup(grouped.today),
        yesterday: normalizeGroup(grouped.yesterday),
        week: normalizeGroup(grouped.week),
        older: normalizeGroup(grouped.older),
      },
      updated_at: json.updated_at || null,
    };
  } catch {
    return null;
  }
}

/* ---------------------------------------------------------
   2) Fetch Market Overview (HomeScreen Context)
--------------------------------------------------------- */
export async function getMarketOverview() {
  try {
    const url = `${API_BASE_URL}/homescreen-context`;
    const res = await fetch(url);
    if (!res.ok) return null;

    const json = await res.json();

    return {
      market: json.market || {
        marketStatus: "Unknown",
        marketMood: "Unknown",
        risk_level: "Unknown",
        fearGreed: null,
      },
      carousel: Array.isArray(json.carousel) ? json.carousel : [],
      updated_at: json.updated_at || null,
      version: json.version || "v1",
    };
  } catch {
    return null;
  }
}

/* ---------------------------------------------------------
   3) Fetch Market Movers (UI-Trimmed Contract)
   🚀 Top Gainers + 📉 Top Losers
--------------------------------------------------------- */
export async function getMarketMovers() {
  try {
    const res = await fetch(`${API_BASE_URL}/market-movers`);
    if (!res.ok) return null;

    const json = await res.json();

    const movers = (json.movers || []).map((m) => {
      const price =
        typeof m.quote?.price === "number" ? m.quote.price : null;

      const change =
        typeof m.quote?.change === "number" ? m.quote.change : null;

      const changePct =
        typeof m.quote?.changePct === "number"
          ? m.quote.changePct
          : null;

      return {
        symbol: m.symbol,
        company: m.company,

        // ✅ normalized quote values
        price,
        change,
        changePct,

        direction: m.direction,

        trendLabel: m.trend?.label || null,

        pattern:
          m.pattern?.name &&
          m.pattern.name !== "NO CLEAR PATTERN"
            ? m.pattern.name
            : null,

        oneLiner: m.oneLiner || null,
      };
    });

    return {
      gainers: movers.filter((m) => m.direction === "up"),
      losers: movers.filter((m) => m.direction === "down"),
      updated_at: json.updated_at || null,
      as_of: json.as_of || null,
    };
  } catch (e) {
    console.warn("❌ getMarketMovers error:", e.message);
    return null;
  }
}

/* ---------------------------------------------------------
   4) Fetch Market News (Market Tab)
--------------------------------------------------------- */
export async function getMarketNews() {
  try {
    const res = await fetch(`${API_BASE_URL}/market-news`);
    if (!res.ok) return null;

    const json = await res.json();

    // 🔥 BACKEND RETURNS { data: [...] }
    const items = Array.isArray(json.data) ? json.data : [];

    const news = items.map((n) => {
      const d = new Date(n.pubDate);
      return {
        ...n,
        timeFormatted: isNaN(d)
          ? ""
          : d.toLocaleTimeString("en-US", {
              hour: "2-digit",
              minute: "2-digit",
            }),
      };
    });

    return {
      news,
      highlights: [], // backend not sending yet (safe default)
      updated_at: json.updated_at || null,
      source: "market-news",
    };
  } catch (e) {
    console.warn("❌ getMarketNews error:", e.message);
    return null;
  }
}
