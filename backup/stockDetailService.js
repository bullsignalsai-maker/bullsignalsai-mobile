// services/stockDetailService.js
import { API_BASE_URL } from "../config/apiKeys";

/**
 * Used ONLY by StockDetailScreen
 * Light payload – header + summary + sparkline + news
 */
export async function getStockDetail(symbol, { fromUI = false } = {}) {
  if (!symbol) {
    throw new Error("Missing symbol");
  }

  const qs = fromUI ? "?source=ui" : "";
  const url = `${API_BASE_URL}/stockdetail/${symbol}${qs}`;

  const res = await fetch(url);
  const raw = await res.json();

  if (!res.ok || raw?.status === "not_ready") {
    throw new Error("Stock detail not available");
  }

  return normalizeStockDetail(raw);
}

/**
 * 🔒 HARD UI CONTRACT
 * This matches the NEW backend response exactly
 */
function normalizeStockDetail(raw) {
  const header = raw.header || {};
  const content = raw.content || {};
  const ui = content.ui || {};

  return {
    // =========================
    // HEADER (shared across screens)
    // =========================
    header: {
      symbol: header.symbol,
      companyName: header.companyName,

      quote: {
        price: header.quote?.price ?? null,
        change: header.quote?.change ?? null,
        changePct: header.quote?.changePct ?? null,
        updatedAt: header.quote?.updated_at ?? null,
      },

      signal: {
        final: header.signal?.final ?? null,
        confidence: header.signal?.confidence ?? null,
      },

      pattern: header.pattern ?? null,
      badges: header.badges || [],
    },

    // =========================
    // SCREEN CONTENT
    // =========================
    summary: {
      oneLiner: content.summary?.oneLiner ?? null,
      summaryLine: content.summary?.summaryLine ?? null,
    },

    risk: {
      level: content.risk?.level ?? null,
    },

    sparkline: content.sparkline ?? null,

    ui: {
      sentiment: ui.sentiment ?? null,
      freshness: ui.freshness ?? null,
    },

    // =========================
    // NEWS
    // =========================
    news: (content.news || []).map(n => ({
      title: n.headline,
      summary: n.summary,
      source: n.source,
      pubDate: n.datetime ? n.datetime * 1000 : null,
      url: n.url,
      image: n.image,
    })),

    computedAt: content.computed_at ?? null,
  };
}
