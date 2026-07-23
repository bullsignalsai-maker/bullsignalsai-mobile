import { BRAND } from "../constants/theme";

export function fmtPrice(v) {
  if (typeof v !== "number" || !isFinite(v)) return "—";
  return `$${v.toFixed(2)}`;
}

export function fmtPct(v) {
  if (typeof v !== "number" || !isFinite(v)) return "—";
  const sign = v > 0 ? "+" : "";
  return `${sign}${v.toFixed(2)}%`;
}

// Never renders "0 checked" — that reads as broken, not as "no picks
// have finished tracking yet." Returns null if there's nothing to show.
export function formatAlphaclaraStatsLine(counts, windowDays) {
  const tracking = Number(counts?.tracking || 0);
  const checked = Number(counts?.checked || 0);
  if (tracking === 0 && checked === 0) return null;

  const parts = [`${tracking} live`];
  if (checked > 0) parts.push(`${checked} checked`);

  const days = Number(windowDays) || 0;
  return `${parts.join(" · ")} over ${days} day${days === 1 ? "" : "s"}`;
}

// modelView.up/.down are fractions (0-1), not percentages — matches
// the shape confirmed live from displayIntelligence.modelView.
export function formatModelViewSplit(modelView) {
  if (!modelView) return null;
  const up = Number(modelView.up);
  const down = Number(modelView.down);
  if (!Number.isFinite(up) || !Number.isFinite(down)) return null;

  return `${(up * 100).toFixed(1)}% up / ${(down * 100).toFixed(1)}% down`;
}

export function formatMarketContextLine(marketContext) {
  if (!marketContext) return null;
  const pct = Number(marketContext.changePct);
  if (!Number.isFinite(pct)) return null;

  return `${pct >= 0 ? "+" : ""}${pct.toFixed(2)}% today`;
}

// Quotes older than this read as potentially stale rather than live —
// kept as a soft, non-alarmist note, not an error state.
export function isQuoteStale(updatedAt, thresholdMinutes = 20) {
  if (!updatedAt) return false;
  const updated = new Date(updatedAt).getTime();
  if (Number.isNaN(updated)) return false;

  return Date.now() - updated > thresholdMinutes * 60 * 1000;
}

export function formatPickedDaysAgo(pickDate) {
  if (!pickDate) return null;

  const picked = new Date(pickDate);
  if (Number.isNaN(picked.getTime())) return null;

  const startOfDay = (d) =>
    new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const days = Math.round(
    (startOfDay(new Date()) - startOfDay(picked)) / 86400000,
  );

  if (days <= 0) return "Picked today";
  if (days === 1) return "Picked yesterday";
  return `Picked ${days} days ago`;
}

// "· {checkedHorizon}" already disambiguates a graduated/final return, so
// " since pick" is only appended for the still-live case — matches the
// truncation-safe layout already shipped in AlphaclaraPicksList.
export function formatPickPerformancePct(item) {
  const displayPct = item?.isChecked
    ? item?.checkedReturn
    : item?.livePctSinceFirstPick;
  if (displayPct == null) return "--";

  const sign = Number(displayPct) >= 0 ? "+" : "";
  const suffix =
    item.isChecked && item.checkedHorizon != null
      ? ` · ${item.checkedHorizon}`
      : " since first pick";

  return `${sign}${Number(displayPct).toFixed(2)}%${suffix}`;
}

// Single source of truth for a pick's primary performance display —
// price pairing, percentage, formatted text, and color all computed
// together so PickRow and PickDetailScreen can never independently
// drift out of sync again (today's bug: PEGA showed green in one, red
// in the other, from two separately-maintained copies of this logic).
export function getPickPerformanceDisplay(item) {
  const isChecked = item?.isChecked === true;
  const pct = isChecked ? item?.checkedReturn : item?.livePctSinceFirstPick;
  const color =
    pct != null ? (Number(pct) >= 0 ? BRAND.accent : BRAND.red) : BRAND.sub;
  const pctText = formatPickPerformancePct(item);

  const firstPickedPrice = item?.firstPickedPrice ?? null;
  const currentPrice = item?.currentPrice ?? null;
  const priceLine =
    firstPickedPrice != null && currentPrice != null
      ? `$${Number(firstPickedPrice).toFixed(2)} → $${Number(
          currentPrice,
        ).toFixed(2)}`
      : currentPrice != null
        ? `$${Number(currentPrice).toFixed(2)}`
        : "--";

  return { firstPickedPrice, currentPrice, priceLine, pct, pctText, color };
}

// The old, misleading number — stays near-zero for a symbol re-recorded
// every cron cycle. Only meaningful alongside the honest since-first-pick
// primary metric above, never shown alone. Null for checked/graduated
// picks — checkedReturn is already the single final number there.
export function formatSinceLastUpdatePct(item) {
  if (item?.isChecked) return null;
  const pct = item?.livePctSinceLastUpdate;
  if (pct == null) return null;

  const sign = Number(pct) >= 0 ? "+" : "";
  return `${sign}${Number(pct).toFixed(2)}%`;
}
