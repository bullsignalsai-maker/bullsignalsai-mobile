// services/HomeService.js
import { API_BASE_URL } from "../config/apiKeys";

/* =========================================================
   PUBLIC API
========================================================= */
export async function getHomeScreen() {
  try {
    const homeRes = await fetch(`${API_BASE_URL}/homescreen-data`);
    if (!homeRes.ok) return null;

    const homeJson = await homeRes.json();

    const coreSignals = Array.isArray(homeJson.core_signals)
      ? homeJson.core_signals
      : [];

    const coreUniverse = Array.isArray(homeJson.core_universe)
      ? homeJson.core_universe
      : coreSignals.map((s) => s.symbol).filter(Boolean);

    const symbolsParam = coreUniverse.join(",");

    let quotesJson = {};

    if (symbolsParam) {
      const quotesRes = await fetch(
        `${API_BASE_URL}/quotes-bulk?scope=home&symbols=${symbolsParam}`,
      );

      if (quotesRes?.ok) {
        const q = await quotesRes.json();
        quotesJson = q?.quotes || {};
      }
    }

    return {
      header: buildHeader(homeJson),
      signals: buildHomeSignals(coreSignals, quotesJson),
      meta: {
        version: homeJson.schema_version || homeJson.version || "home_v2",
        refreshed_at: new Date().toISOString(),
        quotes_source: "quotes_collection",
      },
    };
  } catch (err) {
    console.warn("HomeService error:", err.message);
    return null;
  }
}

/* =========================================================
   HEADER
========================================================= */
function buildHeader(homeJson) {
  const overview = homeJson.market_overview || {};

  return {
    marketStatus: overview.marketStatus || "Market Status Unknown",
    marketMood:
      overview.fearGreed?.label && overview.fearGreed?.value != null
        ? `${overview.fearGreed.label} (${overview.fearGreed.value})`
        : overview.marketMood || "Overview",
    lastUpdated: overview.updated_at || homeJson.updated_at || null,
  };
}

/* =========================================================
   HOME SIGNALS
========================================================= */
function buildHomeSignals(stocks = [], quotes = {}) {
  return stocks.map((s) => {
    const sym = String(s.symbol || "").toUpperCase();
    const q = quotes?.[sym] || {};

    const needsRefresh = q?.needs_refresh === true;

    const price = q?.price ?? s.price ?? s.quote?.price ?? null;
    const change = q?.change ?? s.change ?? s.quote?.change ?? null;
    const changePct = q?.changePct ?? s.changePct ?? s.quote?.changePct ?? null;

    const lastUpdated = !needsRefresh
      ? q?.updated_at || s.lastUpdated || s.updated_at
      : s.lastUpdated || s.updated_at || q?.updated_at || null;

    return {
      symbol: sym,
      companyName: s.companyName || s.company_name || s.name || sym,

      price,
      change,
      changePct,

      signal: s.signal || s.bullbrain?.signal || "HOLD",
      confidence: Number(s.confidence ?? s.bullbrain?.confidence ?? 0),

      summary: getHomeInsight(s),
      marketAwareness: s.marketAwareness || null,

      pattern:
        typeof s.pattern === "string"
          ? s.pattern
          : s.pattern?.name || s.pattern?.pattern || null,

      patternWinRate:
        s.patternWinRate ?? s.pattern?.winRate ?? s.pattern?.winRate_5d ?? null,

      lastUpdated,
      needsRefresh,
    };
  });
}

function getHomeInsight(s) {
  const awareness = s.marketAwareness || {};

  if (typeof s.summary === "string" && s.summary.trim()) {
    return s.summary.trim();
  }

  if (typeof awareness.oneLiner === "string" && awareness.oneLiner.trim()) {
    return awareness.oneLiner.trim();
  }

  if (typeof s.insight === "string" && s.insight.trim()) {
    return s.insight.trim();
  }

  return "Market signal based on trend, price action, and momentum.";
}
