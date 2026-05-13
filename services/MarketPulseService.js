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
    const carousel = Array.isArray(snapJson.carousel) ? snapJson.carousel : [];

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
        `${API_BASE_URL}/quotes-bulk?scope=market&symbols=${symbols.join(",")}`,
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
          quote: live ? normalizeQuote(live) : normalizeQuote(it.quote),
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
    const baseMovers = Array.isArray(json.movers) ? json.movers : [];

    // 1) Collect mover symbols
    const symbols = [
      ...new Set(
        baseMovers
          .map((m) =>
            String(m.symbol || "")
              .trim()
              .toUpperCase(),
          )
          .filter(Boolean),
      ),
    ];

    // 2) Fetch latest quote repo values, same strategy as Home
    let liveQuotes = {};

    if (symbols.length) {
      const qRes = await fetch(
        `${API_BASE_URL}/quotes-bulk?scope=movers&symbols=${symbols.join(",")}`,
      );

      if (qRes.ok) {
        const qJson = await qRes.json();
        liveQuotes = qJson?.quotes || {};
      }
    }

    // 3) Merge live quote over mover snapshot quote
    const movers = baseMovers.map((m) => {
      const sym = String(m.symbol || "")
        .trim()
        .toUpperCase();

      const snapshotQuote = normalizeQuote(m.quote || {});
      const liveQuote = normalizeQuote(liveQuotes[sym] || {});

      const q = liveQuotes[sym] ? liveQuote : snapshotQuote;

      const liveDirection =
        typeof q.changePct === "number"
          ? q.changePct >= 0
            ? "up"
            : "down"
          : m.direction;

      return {
        symbol: sym,
        company: m.company || sym,

        price: q.price,
        change: q.change,
        changePct: q.changePct,
        needs_refresh: q.needs_refresh,
        quote_updated_at: q.updated_at,

        // Recalculate direction from live quote
        direction: liveDirection,

        trendLabel: m.trend?.label || null,

        pattern:
          m.pattern?.name && m.pattern.name !== "NO CLEAR PATTERN"
            ? m.pattern.name
            : null,

        oneLiner: m.oneLiner || null,
      };
    });

    // 4) Re-split using latest quote direction
    const gainers = movers
      .filter((m) => m.direction === "up")
      .sort((a, b) => Number(b.changePct || 0) - Number(a.changePct || 0));

    const losers = movers
      .filter((m) => m.direction === "down")
      .sort((a, b) => Number(a.changePct || 0) - Number(b.changePct || 0));

    return {
      gainers,
      losers,
      updated_at: json.updated_at || null,
      as_of: json.as_of || null,
      quote_refreshed: true,
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
    const items = Array.isArray(json.news) ? json.news : [];

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
