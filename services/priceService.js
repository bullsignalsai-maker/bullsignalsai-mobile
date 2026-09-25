import { API_BASE_URL } from "../config/apiKeys";

// Reads the cached Firestore quote via quotes-bulk (same endpoint Home,
// Watchlist, Market and Momentum use) instead of /prices, which calls
// Finnhub/FMP live on every request. Keeps Portfolio's prices from ever
// disagreeing with Home's, and stops a per-user 20s poll from hitting an
// external quote provider on every tick.
export async function getPortfolioQuotes(symbols = []) {
  try {
    const symbolsParam = [...new Set(symbols.filter(Boolean))].join(",");
    if (!symbolsParam) return {};

    const res = await fetch(
      `${API_BASE_URL}/quotes-bulk?scope=portfolio&symbols=${symbolsParam}`,
    );
    if (!res.ok) return {};

    const json = await res.json();
    return json?.quotes || {};
  } catch (err) {
    console.warn("getPortfolioQuotes error:", err?.message || err);
    return {};
  }
}
