import { API_BASE_URL } from "../config/apiKeys";

/* ============================
   RAW FETCH
============================ */
export async function fetchStockDetail(symbol) {
  if (!symbol) throw new Error("Symbol required");

  const res = await fetch(`${API_BASE_URL}/stockdetail/${symbol}`);
  const json = await res.json();

  if (!res.ok || json?.error) {
    console.warn("❌ stockdetail error:", json?.error || res.status);
    throw new Error("Failed to fetch stock detail");
  }

  return json;
}

/* ============================
   UI VIEW MODEL ADAPTER
============================ */
export function mapStockDetailToUI(data) {
  if (!data) return null;

  const ui = data.ui || {};
  const insights = data.insights || {};
  const features = data.features_meta || {};
  const bullbrain = data.bullbrain || {};

  /* ---------- Quote (Header) ---------- */
  const quote = {
    symbol: data.symbol,
    name: data.company_name,
    current: data.quote?.price ?? null,
    changePct: data.quote?.changePct ?? null,
    open: features.open ?? null,
    high: features.high ?? null,
    low: features.low ?? null,
    volume: features.volume ?? null,
    prevClose:
      features.close && features.return_1d != null
        ? features.close / (1 + features.return_1d / 100)
        : null,
    updatedAt: data.quote?.updated_at ?? null,
  };

  /* ---------- Hybrid Signal ---------- */
  const hybridSignal = ui.signalStrength?.signal ?? bullbrain.signal ?? "NEUTRAL";
  const hybridScore = ui.confidence?.value ?? bullbrain.confidence ?? null;
  const hybridProbUp = bullbrain.prob_up ?? null;
  const hybridProbDown = bullbrain.prob_down ?? null;
  const riskLevel = ui.risk?.level ?? "Unknown";

  /* ---------- Sparkline ---------- */
  const sparkline = {
    path: ui.sparkline?.path ?? null,
    min: ui.sparkline?.min ?? null,
    max: ui.sparkline?.max ?? null,
    direction: ui.sparkline?.direction ?? "flat",
  };

  /* ---------- Narrative / Insight ---------- */
  const hybridNarrative = [
    insights.trendSummary,
    insights.momentumSummary,
    insights.volumeSummary,
    insights.volatilitySummary,
  ]
    .filter(Boolean)
    .join(" ");

  /* ---------- Technical Snapshot ---------- */
  const technical = {
    trend: {
      summary: data.technical?.trend?.comment ?? null,
      label: data.technical?.trend?.label ?? null,
      price_vs_sma20_pct: features.price_vs_sma20_pct ?? null,
      distance_from_20d_high: features.distance_from_20d_high ?? null,
    },
    momentum: {
      rsi14: features.rsi14 ?? null,
      summary_rsi: data.technical?.rsi?.comment ?? null,
      summary_macd: data.technical?.macd?.comment ?? null,
    },
    volatility: {
      summary: data.technical?.volatility?.comment ?? null,
      atr14: features.atr14 ?? null,
    },
    volume: {
      summary: data.technical?.volume?.comment ?? null,
      volume_vs_ma20_pct: features.volume_vs_ma20_pct ?? null,
    },
    candle: {
      intraday_range_pct: features.intraday_range_pct ?? null,
      gap_pct: features.gap_pct ?? null,
      body_pct: features.body_pct ?? null,
      upper_shadow_pct: features.upper_shadow_pct ?? null,
      lower_shadow_pct: features.lower_shadow_pct ?? null,
    },
  };

  /* ---------- Smart Pattern ---------- */
  const smartPattern = ui.patternInsight?.pattern
    ? {
        pattern: ui.patternInsight.pattern,
        confidencePct: ui.patternInsight.confidencePct,
        label: ui.patternInsight.label,
        explanation: ui.patternInsight.explanation,
        current: ui.patternInsight.current,
        history: ui.patternInsight.history,
      }
    : null;

  /* ---------- Probability Cone ---------- */
  const probabilityCone = ui.probabilityCone ?? null;

  /* ---------- News ---------- */
  const news = (data.news || []).map((n) => ({
    title: n.headline,
    summary: n.summary,
    source: n.source,
    pubDate: n.datetime,
    image: n.image,
    url: n.url,
  }));

  /* ---------- Final UI Model ---------- */
  return {
    symbol: data.symbol,
    quote,
    sparkline,
    hybridSignal,
    hybridScore,
    hybridProbUp,
    hybridProbDown,
    riskLevel,
    hybridNarrative,
    technical,
    smartPattern,
    probabilityCone,
    candles: data.candles?.candles ?? [],
    news,
    freshness: ui.freshness ?? null,
    computedAt: data.computed_at ?? null,
  };
}

/* ============================
   CONVENIENCE EXPORT
============================ */
export async function getStockDetailUI(symbol) {
  const raw = await fetchStockDetail(symbol);
  return mapStockDetailToUI(raw);
}
