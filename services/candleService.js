// services/candleService.js
import { API_BASE_URL } from "../config/apiKeys";

const toNum = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

const toISO = (t) => {
  if (!t) return null;
  // backend already returns ISO strings like "2025-01-08T05:00:00Z"
  // keep as-is, but ensure it's a string
  return String(t);
};

/**
 * Full 1Y daily candles (≈252) for FullChartScreen ONLY
 * GET /candles/:symbol
 */
export async function getFullYearCandles(symbol) {
  if (!symbol) throw new Error("Missing symbol");

  const url = `${API_BASE_URL}/candles/${encodeURIComponent(symbol)}`;

  const res = await fetch(url, {
    method: "GET",
    headers: { Accept: "application/json" },
  });

  let raw = null;
  try {
    raw = await res.json();
  } catch {
    // ignore
  }

  if (!res.ok || raw?.error) {
    const msg = raw?.error || `Failed to load candles (${res.status})`;
    throw new Error(msg);
  }

  return normalizeCandles(raw);
}

/**
 * 🔒 HARD CONTRACT
 * UI can rely on these fields ALWAYS existing.
 */
function normalizeCandles(raw) {
  const list = Array.isArray(raw?.candles) ? raw.candles : [];

  const candles = list
    .map((c) => ({
      t: toISO(c?.t),
      open: toNum(c?.open),
      high: toNum(c?.high),
      low: toNum(c?.low),
      close: toNum(c?.close),
      volume: toNum(c?.volume),
    }))
    .filter((c) => !!c.t && c.close != null);

  // sort ascending by time
  candles.sort((a, b) => {
    const ta = Date.parse(a.t);
    const tb = Date.parse(b.t);
    if (!Number.isFinite(ta) || !Number.isFinite(tb)) return 0;
    return ta - tb;
  });

  return {
    symbol: raw?.symbol ? String(raw.symbol).toUpperCase() : null,
    count: raw?.count ?? candles.length,
    source: raw?.source || null,
    candles,
  };
}
