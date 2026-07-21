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
