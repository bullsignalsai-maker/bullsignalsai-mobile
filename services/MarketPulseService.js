// services/MarketPulseService.js
import { API_BASE_URL } from "../config/apiKeys";

/* ---------------------------------------------------------
   INTERNAL HELPERS
--------------------------------------------------------- */

/**
 * Extract ticker symbol from labels like:
 *  - "S&P 500 (SPY)" → SPY
 *  - "Gold (GLD)" → GLD
 *  - "BTC" → BTC
 */
function extractSymbol(label = "") {
  const m = String(label).match(/\(([^)]+)\)/);
  return (m?.[1] || label).trim().toUpperCase();
}

/**
 * Normalize quote fields safely
 */
function normalizeQuote(q = {}) {
  return {
    price: typeof q.price === "number" ? q.price : null,
    change: typeof q.change === "number" ? q.change : null,
    changePct: typeof q.changePct === "number" ? q.changePct : null,
    updated_at: q.updated_at || null,
    needs_refresh: q.needs_refresh === true,
    source: q.source || null,
  };
}

/* ---------------------------------------------------------
   1) MARKET OVERVIEW + LIVE QUOTES (CORE)
--------------------------------------------------------- */
export async function getMarketOverview() {
  try {
    // 1️⃣ Fetch snapshot (cron-backed, cheap)
    const snapRes = await fetch(`${API_BASE_URL}/homescreen-context`);
    if (!snapRes.ok) return null;

    const snapJson = await snapRes.json();
    const carousel = Array.isArray(snapJson.carousel)
      ? snapJson.carousel
      : [];

    // 2️⃣ Collect unique symbols from carousel
    const symbolsSet = new Set();

    carousel.forEach((card) => {
      card?.items?.forEach((it) => {
        const sym = extractSymbol(it.label);
        if (sym) symbolsSet.add(sym);
      });
    });

    const symbols = Array.from(symbolsSet);
    let liveQuotes = {};

    // 3️⃣ Fetch LIVE quotes in bulk (TTL + needs_refresh aware)
    if (symbols.length) {
      const qRes = await fetch(
        `${API_BASE_URL}/quotes-bulk?scope=market&symbols=${symbols.join(",")}`
      );

      if (qRes.ok) {
        const qJson = await qRes.json();
        liveQuotes = qJson?.quotes || {};
      }
    }

    // 4️⃣ Merge live quotes into carousel items
    const mergedCarousel = carousel.map((card) => ({
      ...card,
      items: (card.items || []).map((it) => {
        const sym = extractSymbol(it.label);
        const live = liveQuotes[sym];

        return {
          ...it,
          symbol: sym,
          quote: live
            ? normalizeQuote(live)
            : normalizeQuote(it.quote),
        };
      }),
    }));

    return {
      market: snapJson.market || {
        marketStatus: "Unknown",
        marketMood: "Unknown",
        risk_level: "Unknown",
        fearGreed: null,
      },
      carousel: mergedCarousel,
      updated_at: snapJson.updated_at || null,
      version: snapJson.version || "v1",
      meta: {
        symbols_count: symbols.length,
        quotes_source: "quotes_collection",
      },
    };
  } catch (e) {
    console.warn("❌ getMarketOverview error:", e.message);
    return null;
  }
}

/* ---------------------------------------------------------
   2) MARKET MOVERS (LIVE-QUOTE SAFE)
--------------------------------------------------------- */
export async function getMarketMovers() {
  try {
    const res = await fetch(`${API_BASE_URL}/market-movers`);
    if (!res.ok) return null;

    const json = await res.json();

    const movers = (json.movers || []).map((m) => {
      const q = normalizeQuote(m.quote || {});

      return {
        symbol: m.symbol,
        company: m.company || m.symbol,

        // live-safe quote
        price: q.price,
        change: q.change,
        changePct: q.changePct,
        needs_refresh: q.needs_refresh,

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
   3) MARKET NEWS
--------------------------------------------------------- */
export async function getMarketNews() {
  try {
    const res = await fetch(`${API_BASE_URL}/market-news`);
    if (!res.ok) return null;

    const json = await res.json();
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
      highlights: [], // future-proof
      updated_at: json.updated_at || null,
      source: "market-news",
    };
  } catch (e) {
    console.warn("❌ getMarketNews error:", e.message);
    return null;
  }
}
