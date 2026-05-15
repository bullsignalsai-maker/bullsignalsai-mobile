// services/watchlistService.js
import { API_BASE_URL } from "../config/apiKeys";

/* =========================================================
   RAW WATCHLIST (INTELLIGENCE ONLY)
   - Firestore snapshot
   - No quotes
   - Useful for admin / debug
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

    const price = q?.price ?? s.quote?.price ?? null;
    const change = q?.change ?? s.quote?.change ?? null;
    const changePct = q?.changePct ?? s.quote?.changePct ?? null;

    const quoteUpdatedAt =
      q?.updated_at ?? s.quote?.updated_at ?? s.updated_at ?? null;

    return {
      /* ---------- identity ---------- */
      symbol: sym,
      companyName: s.company_name,

      /* ---------- quote (flattened) ---------- */
      price,
      change,
      changePct,
      quote_updated_at: quoteUpdatedAt,
      needs_refresh: needsRefresh,

      // explicit session for UI
      session: needsRefresh ? "LAST" : "LIVE",

      /* ---------- intelligence ---------- */
      bullbrain: s.bullbrain || {},
      authoritativeSignal: s.bullbrain?.signal || s.signal || "HOLD",
      hybridSignal: s.bullbrain?.signal || s.signal || "HOLD",
      hybridScore: s.hybridScore ?? 0,

      sparkline: Array.isArray(s.sparkline) ? s.sparkline : [],

      pattern: s.pattern || null,
      watchlistSummary: s.watchlistSummary || s.insight || "",

      /* ---------- timestamps ---------- */
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
