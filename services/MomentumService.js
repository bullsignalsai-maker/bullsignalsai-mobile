import { API_BASE_URL } from "../config/apiKeys";

/* =========================================================
   MOMENTUM MOVERS SERVICE
   Frontend is a visual reader only.
========================================================= */
async function fetchBulkQuotes(symbols = []) {
  const symbolsParam = [...new Set(symbols.filter(Boolean))].join(",");
  if (!symbolsParam) return {};

  try {
    const res = await fetch(
      `${API_BASE_URL}/quotes-bulk?scope=momentum&symbols=${symbolsParam}`,
    );

    if (!res.ok) return {};

    const json = await res.json();
    return json?.quotes || {};
  } catch (err) {
    console.warn("Momentum live quotes error:", err.message);
    return {};
  }
}

export async function getMarketMomentum() {
  try {
    const res = await fetch(`${API_BASE_URL}/market-momentum`);
    if (!res.ok) return emptyMomentum();

    const json = await res.json();
    const normalized = normalizeMomentumPayload(json);

    const symbols = collectMomentumSymbols(normalized);
    const quotes = await fetchBulkQuotes(symbols);

    return mergeMomentumLiveQuotes(normalized, quotes);
  } catch (err) {
    console.warn("MomentumService error:", err.message);
    return emptyMomentum();
  }
}
function collectMomentumSymbols(data = {}) {
  return [
    ...(data.continuousMovers || []),
    ...(data.pullbackWatch || []),
  ]
    .map((x) => x?.symbol)
    .filter(Boolean);
}

function mergeQuoteIntoItem(item, quotes = {}) {
  if (!item?.symbol) return item;

  const sym = item.symbol.toUpperCase();
  const q = quotes?.[sym];

  if (!q) return item;

  return {
    ...item,
    price: q.price ?? item.price,
    change: q.change ?? item.change,
    changePct: q.changePct ?? item.changePct,
    quote_updated_at: q.updated_at ?? item.quote_updated_at,
    lastUpdated: q.updated_at ?? item.lastUpdated,
    needsRefresh: q.needs_refresh === true,
    session: q.needs_refresh ? "LAST" : "LIVE",
  };
}

function mergeMomentumLiveQuotes(data, quotes = {}) {
  return {
    ...data,
    continuousMovers: (data.continuousMovers || []).map((x) =>
      mergeQuoteIntoItem(x, quotes),
    ),
    pullbackWatch: (data.pullbackWatch || []).map((x) =>
      mergeQuoteIntoItem(x, quotes),
    ),
    meta: {
      ...(data.meta || {}),
      quotes_source: "quotes_collection",
      live_refreshed_at: new Date().toISOString(),
    },
  };
}

export async function refreshMarketMomentum() {
  try {
    const res = await fetch(`${API_BASE_URL}/market-momentum/refresh`, {
      method: "POST",
    });

    if (!res.ok) {
      console.warn("Momentum refresh failed:", res.status);
      return emptyMomentum();
    }

    const json = await res.json();

    return normalizeMomentumPayload(json);
  } catch (err) {
    console.warn("Momentum refresh error:", err.message);
    return emptyMomentum();
  }
}

/* =========================================================
   NORMALIZERS
========================================================= */
function normalizeMomentumPayload(json = {}) {
  return {
    status: json.status || "empty",
    screen: json.screen || "market_momentum",
    schemaVersion: json.schema_version || "market_momentum_v3",
    updatedAt: json.updated_at || null,
    lookbackSnapshots: Number(json.lookbackSnapshots || 12),

    pulse: normalizePulse(json.pulse),

    continuousMovers: normalizeMomentumMovers(json.continuousMovers || []),

    pullbackWatch: normalizePullbacks(json.pullbackWatch || []),
  };
}

function normalizePulse(pulse = {}) {
  return {
    marketBias: pulse.marketBias || "Mixed",
    marketRegime: pulse.marketRegime || "UNKNOWN",
    momentumScore: toNum(pulse.momentumScore),
    repeatedMovers: toNum(pulse.repeatedMovers),
    positiveContinuation: toNum(pulse.positiveContinuation),
    pullbackNames: toNum(pulse.pullbackNames),
    repeatedAlphaNames: toNum(pulse.repeatedAlphaNames),
    confirmedMomentumCount: toNum(pulse.confirmedMomentumCount),
    avgUpsideMovePct: toNum(pulse.avgUpsideMovePct),
    topTheme: pulse.topTheme || "Mixed",
    topCatalyst: pulse.topCatalyst || "Mixed",
    summary:
      cleanText(pulse.summary) ||
      "Market momentum is being tracked across repeated movers and pullbacks.",
  };
}

function normalizeMomentumMovers(items = []) {
  return dedupeBySymbol(items)
    .slice(0, 20)
    .map((item, idx) => ({
      rank: idx + 1,
      symbol: cleanSymbol(item.symbol),
      companyName: item.companyName || item.company || item.symbol,
      logoUrl: item.logoUrl || item.profile?.logoUrl || null,
      price: toNullableNum(item.price),
      change: toNullableNum(item.change),
      changePct: toNullableNum(item.changePct),

      direction: item.direction || "up",
      appearances: toNum(item.appearances),
      lookbackSnapshots: toNum(item.lookbackSnapshots || item.windowDays || 12),
      windowDays: toNum(item.windowDays || item.lookbackSnapshots || 12),

      avgMovePct: toNullableNum(item.avgMovePct),
      latestMovePct: toNullableNum(item.latestMovePct),

      momentumScore: toNum(item.momentumScore),
      momentumLabel: item.momentumLabel || item.label || "Positive Momentum",

      sparkline: normalizeSparkline(item.sparkline),

      source: item.source || "daily_movers",
      lastUpdated: item.quote_updated_at || null,
      netMovePct: toNullableNum(item.netMovePct),
      positiveSessions: toNum(item.positiveSessions),
      negativeSessions: toNum(item.negativeSessions),
      sector: item.sector || null,
      moverQuality: item.moverQuality || null,
      riskLevel: item.riskLevel || null,
    }));
}

function normalizePullbacks(items = []) {
  return dedupeBySymbol(items)
    .slice(0, 12)
    .map((item, idx) => ({
      rank: idx + 1,
      symbol: cleanSymbol(item.symbol),
      companyName: item.companyName || item.company || item.symbol,
      logoUrl: item.logoUrl || item.profile?.logoUrl || null,
      price: toNullableNum(item.price),
      change: toNullableNum(item.change),
      changePct: toNullableNum(item.changePct),

      direction: item.direction || "down",
      appearances: toNum(item.appearances),
      lookbackSnapshots: toNum(item.lookbackSnapshots || item.windowDays || 12),
      windowDays: toNum(item.windowDays || item.lookbackSnapshots || 12),

      avgMovePct: toNullableNum(item.avgMovePct),
      latestMovePct: toNullableNum(item.latestMovePct),

      momentumScore: toNum(item.momentumScore),
      momentumLabel: item.momentumLabel || item.label || "Pullback Watch",

      sparkline: normalizeSparkline(item.sparkline),

      source: item.source || "daily_movers",
      lastUpdated: item.quote_updated_at || null,
      netMovePct: toNullableNum(item.netMovePct),
      positiveSessions: toNum(item.positiveSessions),
      negativeSessions: toNum(item.negativeSessions),
    }));
}

/* =========================================================
   HELPERS
========================================================= */

function emptyMomentum() {
  return {
    status: "empty",
    screen: "market_momentum",
    schemaVersion: "market_momentum_v3",
    updatedAt: null,
    lookbackSnapshots: 12,
    pulse: normalizePulse(),
    continuousMovers: [],
    pullbackWatch: [],
  };
}

function dedupeBySymbol(items = []) {
  const seen = new Set();

  return items.filter((item) => {
    const symbol = cleanSymbol(item?.symbol);
    if (!symbol || seen.has(symbol)) return false;
    seen.add(symbol);
    return true;
  });
}

function cleanSymbol(symbol) {
  return String(symbol || "")
    .trim()
    .toUpperCase();
}

function toNum(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function toNullableNum(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function normalizeSparkline(values = []) {
  if (!Array.isArray(values)) return [];

  return values
    .map((v) => Number(v))
    .filter((v) => Number.isFinite(v))
    .slice(-10);
}

function cleanText(text) {
  if (typeof text !== "string") return "";

  return text
    .replace(/\.{2,}/g, ".")
    .replace("â", "'")
    .replace("â", '"')
    .replace("â", '"')
    .replace(/\s+/g, " ")
    .trim();
}
