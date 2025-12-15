// services/MarketFeedService.js
// SAFE VERSION — frontend no longer calls FMP or Finnhub directly.

import { API_BASE_URL } from "../config/apiKeys";

/**
 * Fetch market sector performance from your backend
 * Backend handles:
 *  - FMP API
 *  - Finnhub fallback
 *  - Stub fallback
 */
export async function fetchMarketOverview() {
  try {
    const res = await fetch(`${API_BASE_URL}/market-overview`);
    const json = await res.json();

    if (json?.data) {
      return json.data;  // includes sector_performance, top_gainers, top_losers
    }

    console.warn("⚠️ Backend returned empty data. Using local fallback.");
  } catch (err) {
    console.warn("fetchMarketOverview backend error →", err.message);
  }

  // ⚠️ Final frontend stub fallback (offline safety only)
  const stub = [
    { sector: "Technology", change: 1.2 },
    { sector: "Finance", change: 0.8 },
    { sector: "Healthcare", change: 0.3 },
    { sector: "Energy", change: -0.6 },
    { sector: "Consumer Goods", change: 0.4 },
  ];

  return {
    sector_performance: stub,
    top_gainers: ["Technology +1.2%", "Finance +0.8%", "Consumer +0.4%"],
    top_losers: ["Energy -0.6%"],
  };
}
