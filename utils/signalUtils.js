import { BRAND } from "../constants/theme";

export function normalizeSignal(signal) {
  const s = String(signal || "HOLD")
    .toUpperCase()
    .trim();

  if (s.includes("STRONG_BULLISH")) return "STRONG_BULLISH";
  if (s.includes("BULLISH_WATCH")) return "BULLISH_WATCH";
  if (s.includes("MOMENTUM_WATCH")) return "MOMENTUM_WATCH";
  if (s.includes("HIGH_RISK_MOMENTUM")) return "HIGH_RISK_MOMENTUM";
  if (s.includes("CAUTION")) return "CAUTION";
  if (s.includes("BEARISH_WATCH")) return "BEARISH_WATCH";

  if (s.includes("BUY")) return "BUY";
  if (s.includes("SELL")) return "SELL";

  return "HOLD";
}

export function displayRating(signal) {
  const s = normalizeSignal(signal);

  if (s === "STRONG_BULLISH") return "Strong Bullish";
  if (s === "BULLISH_WATCH") return "Bullish Watch";
  if (s === "MOMENTUM_WATCH") return "Momentum Building";
  if (s === "HIGH_RISK_MOMENTUM") return "Momentum Surge";
  if (s === "CAUTION") return "Caution";
  if (s === "BEARISH_WATCH") return "Bearish Watch";

  if (s === "BUY") return "Bullish";
  if (s === "SELL") return "Bearish";

  return "Neutral";
}

export function signalColor(signal) {
  const s = normalizeSignal(signal);

  if (
    [
      "STRONG_BULLISH",
      "BULLISH_WATCH",
      "MOMENTUM_WATCH",
      "HIGH_RISK_MOMENTUM",
      "BUY",
    ].includes(s)
  ) {
    return BRAND.accent;
  }

  if (["CAUTION", "HOLD"].includes(s)) {
    return BRAND.amber;
  }

  if (["BEARISH_WATCH", "SELL"].includes(s)) {
    return BRAND.red;
  }

  return BRAND.amber;
}

export function getAuthoritativeSignal(item) {
  const safeItem = item || {};

  return normalizeSignal(
    safeItem.displayIntelligence?.displaySignal ||
      safeItem.displayIntelligence?.signal ||
      safeItem.displaySignal ||
      safeItem.signal ||
      safeItem.authoritativeSignal ||
      safeItem.bullbrain?.signal ||
      safeItem.finalSignal ||
      safeItem.decision?.finalSignal ||
      "HOLD",
  );
}
