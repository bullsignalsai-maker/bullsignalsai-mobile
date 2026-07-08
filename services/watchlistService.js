// services/watchlistService.js
import { API_BASE_URL } from "../config/apiKeys";

/* =========================================================
  RAW WATCHLIST (INTELLIGENCE ONLY)
  - Firestore snapshot
  - No quotes
========================================================= */
export async function fetchWatchlist(userId) {
  const res = await fetch(`${API_BASE_URL}/watchlist/${userId}`);
  if (!res.ok) throw new Error("Fetch failed");
  return res.json();
}

/* =========================================================
  WATCHLIST SCREEN DATA (INTELLIGENCE + LIVE QUOTES)
  - Read-only
  - Safe to poll every 30s
  - Quotes shared across users
========================================================= */
export async function getWatchlistScreen(userId) {
  try {
    // 1️⃣ Fetch watchlist intelligence
    const wlRes = await fetch(`${API_BASE_URL}/watchlist/${userId}`);
    if (!wlRes.ok) return null;

    const wlJson = await wlRes.json();
    const items = wlJson?.watchlist || wlJson?.items || [];

    if (!items.length) {
      return {
        items: [],
        meta: {
          refreshed_at: new Date().toISOString(),
          quotes_source: "quotes_collection",
        },
      };
    }

    // 2️⃣ Build symbol list (deduped)
    const symbols = [
      ...new Set(items.map((i) => i.symbol?.toUpperCase()).filter(Boolean)),
    ].join(",");

    // 3️⃣ Fetch LIVE quotes (symbol-level, shared)
    const quotesRes = await fetch(
      `${API_BASE_URL}/quotes-bulk?scope=watchlist&symbols=${symbols}`,
    );

    let quotes = {};
    if (quotesRes.ok) {
      const q = await quotesRes.json();
      quotes = q?.quotes || {};
    }

    // 4️⃣ Merge intelligence + quotes
    return {
      items: mergeWatchlistQuotes(items, quotes),
      meta: {
        refreshed_at: new Date().toISOString(),
        quotes_source: "quotes_collection",
      },
    };
  } catch (err) {
    console.warn("WatchlistService error:", err.message);
    return null;
  }
}

/* =========================================================
  MERGE LOGIC
  - Normalizes quote fields
  - Exposes freshness explicitly
========================================================= */
function mergeWatchlistQuotes(items = [], quotes = {}) {
  return items.map((s) => {
    const sym = (s.symbol || "").toUpperCase();
    const q = quotes?.[sym];

    const needsRefresh = q?.needs_refresh === true;

    const price = q?.price ?? null;
    const change = q?.change ?? null;
    const rawChangePct = q?.changePct ?? null;
    const changePct =
      rawChangePct !== null && rawChangePct !== undefined
        ? Number(rawChangePct)
        : null;

    const quoteUpdatedAt =
      q?.updated_at || s.quote_updated_at || s.quote?.updated_at || null;

    const displayIntelligence = s.displayIntelligence || null;

    const signal =
      displayIntelligence?.signal ||
      displayIntelligence?.displaySignal ||
      s.signal ||
      s.bullbrain?.signal ||
      "HOLD";

    const confidence =
      typeof displayIntelligence?.score === "number"
        ? displayIntelligence.score
        : typeof s.displayScore === "number"
          ? s.displayScore
          : typeof s.bullbrain?.confidence === "number"
            ? s.bullbrain.confidence
            : 0;
    const baseSummary =
      displayIntelligence?.headline ||
      s.displayHeadline ||
      s.watchlistSummary ||
      "";

    const contradictsLiveMove =
      typeof changePct === "number" &&
      ((changePct > 0 &&
        /down|under pressure|pulling back|bearish/i.test(baseSummary)) ||
        (changePct < 0 &&
          /up|moving higher|gaining traction|rallying|bullish/i.test(
            baseSummary,
          )));

    const watchlistSummary = contradictsLiveMove
      ? `${sym} is ${
          changePct >= 0 ? "moving higher" : "under pressure"
        } today, ${changePct >= 0 ? "up" : "down"} ${Math.abs(
          changePct,
        ).toFixed(2)}%.`
      : baseSummary;
    return {
      symbol: sym,
      companyName: s.companyName || sym,
      logoUrl: s.logoUrl || null,

      price,
      change,
      changePct,
      quote_updated_at: quoteUpdatedAt,
      needs_refresh: needsRefresh,

      session: price ? (needsRefresh ? "LAST" : "LIVE") : "PENDING",

      displayIntelligence,
      displayLabel: displayIntelligence?.label || s.displayLabel || null,
      displayHeadline:
        displayIntelligence?.headline || s.displayHeadline || null,

      bullbrain: {
        signal,
        confidence,
      },

      hybridSignal: signal,
      hybridScore: confidence,

      pattern: {
        name: s.pattern?.name || null,
        winRate: s.pattern?.winRate ?? null,
      },

      watchlistSummary,

      lastUpdated: quoteUpdatedAt,
    };
  });
}
/* =========================================================
  MUTATIONS (UNCHANGED)
========================================================= */
export async function addToWatchlist(userId, symbol) {
  const res = await fetch(`${API_BASE_URL}/watchlist/${userId}/add/${symbol}`, {
    method: "POST",
  });
  if (!res.ok) throw new Error("Add failed");
  return res.json();
}

export async function removeFromWatchlist(userId, symbol) {
  const res = await fetch(
    `${API_BASE_URL}/watchlist/${userId}/remove/${symbol}`,
    { method: "DELETE" },
  );
  if (!res.ok) throw new Error("Remove failed");
  return res.json();
}
