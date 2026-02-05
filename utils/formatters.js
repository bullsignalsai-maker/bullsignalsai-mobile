export function fmtPrice(v) {
  if (typeof v !== "number" || !isFinite(v)) return "—";
  return `$${v.toFixed(2)}`;
}

export function fmtPct(v) {
  if (typeof v !== "number" || !isFinite(v)) return "—";
  const sign = v > 0 ? "+" : "";
  return `${sign}${v.toFixed(2)}%`;
}
