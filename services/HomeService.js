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
      alphaWatch: buildAlphaWatch(homeJson.alpha_watch),
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

export async function getHomeMovers() {
  try {
    const res = await fetch(`${API_BASE_URL}/market-movers?mode=home`);
    if (!res.ok) return [];

    const json = await res.json();
    const movers = Array.isArray(json.movers) ? json.movers : [];

    return movers
      .filter((m) => {
        const pct = m.changePct ?? m.quote?.changePct ?? 0;
        const direction = String(m.direction || "").toLowerCase();

        return (
          direction === "up" ||
          direction === "gainer" ||
          direction === "gain" ||
          Number(pct) > 0
        );
      })
      .slice(0, 5)
      .map((m) => ({
        symbol: String(m.symbol || "").toUpperCase(),
        company: m.company || m.companyName || m.symbol,
        price: m.price ?? m.quote?.price ?? null,
        change: m.change ?? m.quote?.change ?? null,
        changePct: m.changePct ?? m.quote?.changePct ?? null,
        direction: "up",
        oneLiner: m.oneLiner || null,
        quote_updated_at: m.quote_updated_at || m.quote?.updated_at || null,
        lastUpdated: m.quote_updated_at || m.quote?.updated_at || null,
      }));
  } catch (err) {
    console.warn("Home movers error:", err.message);
    return [];
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

    const lastUpdated =
      q?.updated_at ||
      s.quote_updated_at ||
      s.lastUpdated ||
      s.updated_at ||
      null;
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

function buildAlphaWatch(alphaWatch = {}) {
  const items = Array.isArray(alphaWatch.items) ? alphaWatch.items : [];

  return {
    title: alphaWatch.title || "AI Opportunity Watch",
    subtitle:
      alphaWatch.subtitle ||
      "AI-ranked setups showing momentum, trend quality, pattern edge, and participation.",
    count: Number(alphaWatch.count ?? items.length ?? 0),
    marketRegime: alphaWatch.market_regime || alphaWatch.marketRegime || null,
    updatedAt: alphaWatch.updated_at || null,
    disclaimer:
      alphaWatch.disclaimer ||
      "AI Opportunity Watch is probabilistic and for informational purposes only.",
    items: items
      .filter((x) => x?.symbol)
      .slice(0, 8)
      .map((x, idx) => ({
        rank: idx + 1,
        symbol: String(x.symbol || "").toUpperCase(),
        companyName: x.companyName || x.company_name || x.symbol,
        price: x.price ?? null,
        change: x.change ?? null,
        changePct: x.changePct ?? null,
        score: Number(x.score ?? 0),
        opportunityScore: Number(x.opportunityScore ?? x.score ?? 0),
        confidence: Number(x.confidence ?? 0),
        signal: x.signal || "HOLD",
        setupLabel: x.setupLabel || "Opportunity Watch",
        reason: cleanAlphaText(x.reason),
        whyNow: Array.isArray(x.whyNow) ? x.whyNow.slice(0, 3) : [],
        riskLevel: x.riskLevel || "Controlled",
        riskFlags: Array.isArray(x.riskFlags) ? x.riskFlags : [],
        theme: x.theme || null,
        pattern: x.pattern || null,
        marketRegime: x.marketRegime || alphaWatch.market_regime || null,
        lastUpdated:
          x.quote_updated_at || x.computed_at || alphaWatch.updated_at || null,
      })),
  };
}

function cleanAlphaText(text) {
  if (typeof text !== "string") return "";

  return text
    .replace(/\.{2,}/g, ".")
    .replace("â", "'")
    .replace("â", '"')
    .replace("â", '"')
    .replace(/\s+/g, " ")
    .trim();
}
