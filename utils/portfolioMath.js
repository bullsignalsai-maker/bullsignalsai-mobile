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

/**
 * Concentration of a fully-priced portfolio, from allocation percentages.
 *
 * Herfindahl-Hirschman Index across ALL positions, not just the top
 * holding — sum of squared allocation percentages (0-10,000 scale).
 * 10,000 / hhi is the portfolio's "effective number of equal positions".
 *
 * Thresholds deliberately depart from the DOJ/FTC merger guidelines
 * (1500/2500): those are calibrated for antitrust market concentration and
 * would need 7+ equal positions before a portfolio reads as Balanced,
 * flagging a typical 5-6 stock retail portfolio as a risk. Retail cutoffs:
 *   Balanced  hhi <= 2000  (behaves like 5+ equal positions)
 *   Moderate  hhi <= 3333  (3 to 5)
 *   High      otherwise    (fewer than 3)
 * Compared on the rounded hhi so float noise in allocations can't push an
 * exactly-equal portfolio (e.g. 5 x 20% = 2000) across a boundary.
 *
 * level and diversificationScore derive from the same cutoffs so they can
 * never disagree. The 58/74/88 scores are kept as-is because
 * PortfolioScreen's health-score blend was calibrated around them.
 * Only "Balanced" counts as diversified, i.e. is shown as a strength.
 */
export function classifyConcentration(allocationPcts = []) {
  const hhi = allocationPcts.reduce(
    (sum, pct) => sum + Math.pow(pct || 0, 2),
    0,
  );
  const rounded = Math.round(hhi);
  const level =
    rounded <= 2000 ? "Balanced" : rounded <= 3333 ? "Moderate" : "High";
  const diversificationScore =
    level === "Balanced" ? 88 : level === "Moderate" ? 74 : 58;
  return {
    hhi,
    level,
    diversificationScore,
    isDiversified: level === "Balanced",
  };
}
