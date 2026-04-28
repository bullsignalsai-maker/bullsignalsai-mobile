// services/stockDetailService.js
import { API_BASE_URL } from "../config/apiKeys";

export async function getStockDetail(symbol, { fromUI = false } = {}) {
  if (!symbol) throw new Error("Missing symbol");

  const qs = fromUI ? "?source=ui" : "";
  const url = `${API_BASE_URL}/stockdetail/${symbol}${qs}`;

  const res = await fetch(url);
  const raw = await res.json();

  if (!res.ok || raw?.status === "not_ready") {
    throw new Error("Stock detail not available");
  }

  return normalizeStockDetail(raw);
}

function normalizeStockDetail(raw) {
  const header = raw?.header || {};
  const content = raw?.content || {};

  const quoteSrc = header?.quote || {};
  const headerSignal = header?.signal || {};
  const signal = content?.signal || {};
  const probability = content?.probability || {};
  const pattern = content?.pattern || header?.pattern || {};
  const tech = content?.technicalSnapshot || {};
  const featureInsight = content?.featureInsight || {};
  const outlook = content?.outlook || {};
  const tradeIdea = content?.tradeIdea || {};
  const risksOpportunities = content?.risksOpportunities || {};
  const finalRecommendation = content?.finalRecommendation || {};
  const sparkline = content?.sparkline || null;

  const currentPrice = quoteSrc.price ?? null;
  const prevClose = quoteSrc.prevClose ?? null;

  const change =
    quoteSrc.change ??
    (currentPrice != null && prevClose != null ? currentPrice - prevClose : null);

  let changePct = quoteSrc.changePct;
  if (changePct != null && !isNaN(changePct)) {
    // Finnhub/header already sends percent value like -0.6453, keep as percent.
    changePct = Number(changePct);
  } else if (change != null && prevClose != null) {
    changePct = (change / prevClose) * 100;
  } else {
    changePct = null;
  }

  const hybridProbUp =
    typeof probability?.up === "number" && !isNaN(probability.up)
      ? Math.max(0, Math.min(1, probability.up))
      : null;

  const hybridSignal =
    signal?.value ||
    headerSignal?.final ||
    finalRecommendation?.signal ||
    "HOLD";

  const hybridScore =
    typeof signal?.confidence === "number"
      ? signal.confidence
      : typeof headerSignal?.confidence === "number"
      ? headerSignal.confidence
      : null;

  const patternInsight =
    pattern && pattern.name
      ? {
          pattern: pattern.name,
          confidencePct:
            typeof pattern.winRate5d === "number"
              ? Math.round(pattern.winRate5d * 100)
              : null,
          label: pattern.patternState || pattern.edgeState || null,
          explanation: pattern.explanation || "",
        }
      : null;

  const technical = {
    summary: tech?.summary || "",

    trend: {
      ...(tech?.trend || {}),
      summary: tech?.trend?.explanation || tech?.summary || "",
    },

    momentum: {
      ...(tech?.momentum || {}),
      rsi14: tech?.momentum?.rsi ?? null,
      summary_rsi:
        tech?.momentum?.rsiLabel && tech?.momentum?.rsi != null
          ? `RSI is ${tech.momentum.rsiLabel} at ${Number(tech.momentum.rsi).toFixed(1)}.`
          : null,
      summary_macd:
        tech?.momentum?.macdLabel && tech?.momentum?.macd != null
          ? `MACD is ${tech.momentum.macdLabel}.`
          : null,
      summary: tech?.momentum?.explanation || "",
    },

    volatility: {
      ...(tech?.volatility || {}),
      summary: tech?.volatility?.explanation || "",
    },

    volume: {
      ...(tech?.volume || {}),
      summary: tech?.volume?.explanation || "",
      volume_vs_ma20_pct: tech?.volume?.volumeVsMa20Pct ?? null,
      volume_zscore_20: tech?.volume?.volumeZscore20 ?? null,
    },

    candle: {
      intraday_range_pct: null,
      gap_pct: null,
      body_pct: null,
      upper_shadow_pct: null,
      lower_shadow_pct: null,
    },
  };

  const explanations = {
    groups: {
      technical_outlook: {
        short: tech?.summary || "",
        medium: featureInsight?.summary || "",
        long: [
          tech?.trend?.explanation,
          tech?.momentum?.explanation,
          tech?.volatility?.explanation,
          tech?.volume?.explanation,
        ].filter(Boolean),
      },

      risks_opportunities: {
        risks: Array.isArray(risksOpportunities?.risks)
          ? risksOpportunities.risks
          : [],
        opportunities: Array.isArray(risksOpportunities?.opportunities)
          ? risksOpportunities.opportunities
          : [],
      },

      trade_idea: {
        stance: tradeIdea?.stance || hybridSignal,
        summary: tradeIdea?.explanation || "",
        note: "This is not financial advice. Use proper risk management.",
      },

      final_recommendation: {
        signal: finalRecommendation?.signal || hybridSignal,
        confidence:
          typeof finalRecommendation?.confidence === "number"
            ? finalRecommendation.confidence
            : hybridScore,
        text: finalRecommendation?.text || signal?.explanation || "",
      },
    },
  };

  return {
    symbol: header?.symbol || null,
    companyName: header?.companyName || null,

    quote: {
      symbol: header?.symbol || null,
      name: header?.companyName || null,
      current: currentPrice,
      change,
      changePct,
      open: quoteSrc.open ?? null,
      high: quoteSrc.high ?? null,
      low: quoteSrc.low ?? null,
      prevClose,
      volume: quoteSrc.volume ?? null,
    },

    asOf: quoteSrc.updated_at ?? null,

    sparkline: sparkline?.path ? sparkline : null,

    bullbrain: {
      signal: hybridSignal,
      confidence: hybridScore,
    },

    hybridSignal,
    hybridProbUp,
    hybridScore,

    signal,
    probability,
    technical,

    featureInsight,
    outlook,
    tradeIdea,
    risksOpportunities,
    finalRecommendation,

    patternInsight,
    smartPattern: pattern || null,
    patternStats: pattern?.stats || null,
    probabilityCone: null,

    insights: {
      combinedTechnicalSummary:
        featureInsight?.summary ||
        outlook?.mediumTerm?.summary ||
        tech?.summary ||
        "",
    },

    explanations,

    news: Array.isArray(content?.news)
      ? content.news.map((n) => ({
          title: n?.headline || "",
          summary: n?.summary || "",
          source: n?.source || "",
          pubDate: n?.datetime ? n.datetime * 1000 : null,
          url: n?.url || "",
          image: n?.image || null,
        }))
      : [],

    computedAt: content?.computed_at || null,

    raw: content,
  };
}