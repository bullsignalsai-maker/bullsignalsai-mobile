// utils/todayStrip.js
// Pure math for Home's "Today" strip (Portfolio Today + Watchlist
// Performance), kept outside HomeScreen so the missing-quote paths can be
// exercised without a real gap in the quotes feed.
import { toRealNumber } from "./portfolioMath";

/**
 * Sum of shares × today's $ change across owned positions.
 * null unless EVERY owned symbol has a real `change` — a missing quote is
 * unknown, not "flat today", and a partial sum would understate the day.
 */
export function computePortfolioToday(
  ownedSymbols = [],
  positions = {},
  quotes = {},
) {
  if (!ownedSymbols.length) return null;

  let sum = 0;
  for (const sym of ownedSymbols) {
    const change = toRealNumber(quotes?.[sym]?.change);
    if (change == null) return null;
    sum += positions[sym].shares * change;
  }
  return sum;
}

/**
 * Up/down count + biggest mover across watchlisted symbols. Symbols with
 * no real changePct are excluded entirely (never counted as "up" via a
 * default 0%). hasData is false when none of them have a quote.
 */
export function computeWatchlistPerformance(symbols = [], quotes = {}) {
  if (!symbols.length) return null;

  const acc = { up: 0, down: 0, leader: null, counted: 0, missing: 0 };
  for (const sym of symbols) {
    const pct = toRealNumber(quotes?.[sym]?.changePct);
    if (pct == null) {
      acc.missing += 1;
      continue;
    }
    acc.counted += 1;
    if (pct >= 0) acc.up += 1;
    else acc.down += 1;
    if (acc.leader === null || Math.abs(pct) > Math.abs(acc.leader.changePct)) {
      acc.leader = { symbol: sym, changePct: pct };
    }
  }
  return { ...acc, hasData: acc.counted > 0 };
}
