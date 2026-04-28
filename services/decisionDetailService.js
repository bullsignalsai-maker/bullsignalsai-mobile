import { API_BASE_URL } from "../config/apiKeys";

export async function getDecisionDetail(symbol) {
  if (!symbol) throw new Error("Missing symbol");

  const res = await fetch(`${API_BASE_URL}/stockdetail/${symbol}/decision`);
  const raw = await res.json();

  if (!res.ok || raw?.status === "not_ready") {
    throw new Error("Decision detail not available");
  }

  const header = raw?.header || {};
  const md = raw?.modelDecision || {};

  return {
    symbol: header.symbol || symbol,
    companyName: header.companyName || symbol,
    quote: {
      current: header.quote?.price ?? null,
      change: header.quote?.change ?? null,
      changePct: header.quote?.changePct ?? null,
      updated_at: header.quote?.updated_at ?? null,
    },
    finalSignal: md.finalSignal || header.signal?.final || "HOLD",
    confidence: md.confidence ?? header.signal?.confidence ?? null,
    confidenceLabel: md.confidenceLabel || "Moderate",
    summary: md.summary || {},
    decisionLadder: Array.isArray(md.decisionLadder)
  ? md.decisionLadder.map((gate) => ({
      ...gate,
      metrics: Array.isArray(gate.metrics) ? gate.metrics : [],
      evidenceSummary: Array.isArray(gate.evidenceSummary)
        ? gate.evidenceSummary
        : [],
    }))
  : [],
    whatWouldChange: Array.isArray(md.whatWouldChange) ? md.whatWouldChange : [],
    meta: raw.meta || {},
    raw,
  };
}