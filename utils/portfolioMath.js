// utils/portfolioMath.js
// Pure P/L math for PortfolioScreen, kept outside the component so the
// missing-quote paths can be exercised without waiting for a real gap in
// the live price feed.

// Explicit null/undefined/"" check first: Number(null) === 0 and
// Number("") === 0 would otherwise pass as a real zero. Number.isFinite
// then only filters junk like "n/a".
export const toRealNumber = (v) =>
  v == null || v === "" || !Number.isFinite(Number(v)) ? null : Number(v);

const firstFinite = (...values) => {
  for (const v of values) {
    const n = toRealNumber(v);
    if (n != null) return n;
  }
  return null;
};

/**
 * positions: [{ symbol, shares, avgCost, profile, ... }] (from getPortfolio)
 * prices:    { [symbol]: { price | c, prevClose | pc } } (from quotes-bulk)
 *
 * No avgCost fallback anywhere: a missing price must read as "--", never
 * as a real 0% gain (price = avgCost), and a missing prevClose must never
 * turn total unrealized P/L into "today's" gain (prev = avgCost).
 * Portfolio-level totals/allocation are only computed when every position
 * has the input they need — a partial sum would silently misstate them.
 */
export function buildPortfolioView(positions = [], prices = {}) {
  const rows = positions.map((pos) => {
    const live = prices?.[pos.symbol] || {};
    const price = firstFinite(live.price, live.c);
    const prev = firstFinite(live.prevClose, live.pc);
    const cost = pos.shares * pos.avgCost;

    const hasQuote = price != null;
    const currValue = hasQuote ? pos.shares * price : null;
    const gain = hasQuote ? currValue - cost : null;
    const gainPct = hasQuote && cost > 0 ? (gain / cost) * 100 : null;
    const today = hasQuote && prev != null ? pos.shares * (price - prev) : null;

    return {
      ...pos,
      logoUrl: pos.profile?.logoUrl || null,
      price,
      prev,
      cost,
      currValue,
      gain,
      gainPct,
      today,
      hasQuote,
      allocationPct: null,
    };
  });

  const quotesComplete = rows.every((r) => r.hasQuote);
  const dayComplete = rows.every((r) => r.today != null);

  const totalCost = rows.reduce((sum, r) => sum + r.cost, 0);
  const totalValue = quotesComplete
    ? rows.reduce((sum, r) => sum + r.currValue, 0)
    : null;
  const totalGain = totalValue != null ? totalValue - totalCost : null;
  const totalGainPct =
    totalGain != null && totalCost > 0 ? (totalGain / totalCost) * 100 : null;
  const todayGain = dayComplete
    ? rows.reduce((sum, r) => sum + r.today, 0)
    : null;

  if (totalValue != null && totalValue > 0) {
    rows.forEach((r) => {
      r.allocationPct = (r.currValue / totalValue) * 100;
    });
  }

  return {
    rows,
    totalValue,
    totalCost,
    totalGain,
    totalGainPct,
    todayGain,
    quotesComplete,
    dayComplete,
  };
}
