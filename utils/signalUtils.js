import { BRAND } from "../constants/theme";

export function normalizeSignal(signal) {
  const s = String(signal || "HOLD").toUpperCase();

  if (s.includes("BUY")) return "BUY";
  if (s.includes("SELL")) return "SELL";
  return "HOLD";
}

export function displayRating(signal) {
  const s = normalizeSignal(signal);

  if (s === "BUY") return "Bullish";
  if (s === "SELL") return "Bearish";
  return "Neutral";
}

export function signalColor(signal) {
  const s = normalizeSignal(signal);

  if (s === "BUY") return BRAND.accent;
  if (s === "SELL") return BRAND.red;
  return BRAND.amber;
}

export function getAuthoritativeSignal(item) {
  const safeItem = item || {};

  return normalizeSignal(
    safeItem.authoritativeSignal ||
      safeItem.signal ||
      safeItem.bullbrain?.signal ||
      safeItem.finalSignal ||
      safeItem.decision?.finalSignal ||
      "HOLD",
  );
}
