import { API_BASE_URL } from "../config/apiKeys";

function safeNum(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export async function getTechnicalDetail(symbol) {
  if (!symbol) throw new Error("Missing symbol");

  const res = await fetch(`${API_BASE_URL}/stockdetail/${symbol}/technical`);
  const raw = await res.json();

  if (!res.ok || raw?.status === "not_ready") {
    throw new Error("Technical detail not available");
  }

  const header = raw?.header || {};
  const quote = header?.quote || {};
  const overview = raw?.technicalOverview || {};
  const groups = raw?.indicatorGroups || {};
  const evidence = raw?.featureEvidence || {};
  const summary = raw?.summary || {};

  const trend = overview?.trend || {};
  const momentum = overview?.momentum || {};
  const volume = overview?.volume || {};
  const volatility = overview?.volatility || {};
  const pricePosition = overview?.pricePosition || {};

  const findIndicator = (arr = [], name = "") =>
    Array.isArray(arr)
      ? arr.find((x) =>
          String(x?.name || "")
            .toLowerCase()
            .includes(name.toLowerCase()),
        )
      : null;

  const rsi = findIndicator(groups.momentumIndicators, "RSI");
  const macd = findIndicator(groups.momentumIndicators, "MACD");
  const sma20 = findIndicator(groups.trendIndicators, "SMA");
  const trendStrength = findIndicator(groups.trendIndicators, "Trend");
  const volumeVsMa20 = findIndicator(groups.volumeIndicators, "Volume");
  const atr = findIndicator(groups.volatilityIndicators, "ATR");

  return {
    symbol: header?.symbol || symbol,
    companyName: header?.companyName || symbol,

    quote: {
      symbol: header?.symbol || symbol,
      name: header?.companyName || symbol,
      current: quote?.price ?? null,
      price: quote?.price ?? null,
      change: quote?.change ?? null,
      changePct: quote?.changePct ?? null,
      open: quote?.open ?? null,
      high: quote?.high ?? null,
      low: quote?.low ?? null,
      prevClose: quote?.prevClose ?? null,
      updated_at: quote?.updated_at ?? null,
      source: quote?.source ?? null,
    },

    technical: {
      summary: summary?.headline || "Technical signals are mixed.",

      rsi: {
        label: momentum?.label || rsi?.bias || null,
        value: safeNum(momentum?.value ?? rsi?.value),
        comment: momentum?.comment || rsi?.comment || null,
      },

      macd: {
        label: macd?.bias || null,
        value: safeNum(macd?.value),
        signal: null,
        comment: macd?.comment || null,
      },

      trend: {
        label: trend?.label || null,
        trend_strength_20: safeNum(
          trend?.trend_strength_20 ?? trendStrength?.value,
        ),
        comment: trend?.comment || trendStrength?.comment || null,
      },

      volume: {
        label: volume?.label || null,
        volume_vs_ma20_pct: safeNum(
          volume?.volume_vs_ma20_pct ?? volumeVsMa20?.value,
        ),
        comment: volume?.comment || volumeVsMa20?.comment || null,
      },

      volatility: {
        label: volatility?.label || null,
        volatility_20d: safeNum(volatility?.volatility_20d),
        atr14: safeNum(atr?.value),
        comment: volatility?.comment || atr?.comment || null,
      },

      pricePosition: {
        label: pricePosition?.label || null,
        price_vs_sma20_pct: safeNum(pricePosition?.price_vs_sma20_pct),
      },
    },

    featuresMeta: {
      ...(raw?.featuresMeta || {}),

      rsi14: safeNum(raw?.featuresMeta?.rsi14 ?? momentum?.value ?? rsi?.value),
      macd: safeNum(raw?.featuresMeta?.macd ?? macd?.value),
      macd_signal: safeNum(raw?.featuresMeta?.macd_signal),
      macd_hist: safeNum(raw?.featuresMeta?.macd_hist),

      trend_strength_20: safeNum(
        raw?.featuresMeta?.trend_strength_20 ??
          trend?.trend_strength_20 ??
          trendStrength?.value,
      ),

      price_vs_sma20_pct: safeNum(
        raw?.featuresMeta?.price_vs_sma20_pct ??
          pricePosition?.price_vs_sma20_pct,
      ),

      sma20: safeNum(raw?.featuresMeta?.sma20 ?? sma20?.value),
      sma50: safeNum(raw?.featuresMeta?.sma50),
      sma200: safeNum(raw?.featuresMeta?.sma200),

      volume_vs_ma20_pct: safeNum(
        raw?.featuresMeta?.volume_vs_ma20_pct ??
          volume?.volume_vs_ma20_pct ??
          volumeVsMa20?.value,
      ),

      volatility_20d: safeNum(
        raw?.featuresMeta?.volatility_20d ?? volatility?.volatility_20d,
      ),
      atr14: safeNum(raw?.featuresMeta?.atr14 ?? atr?.value),

      return_1d: safeNum(raw?.featuresMeta?.return_1d),
      return_5d: safeNum(raw?.featuresMeta?.return_5d),
      return_10d: safeNum(raw?.featuresMeta?.return_10d),

      body_pct: safeNum(raw?.featuresMeta?.body_pct),
      upper_shadow_pct: safeNum(raw?.featuresMeta?.upper_shadow_pct),
      lower_shadow_pct: safeNum(raw?.featuresMeta?.lower_shadow_pct),
      intraday_range_pct: safeNum(raw?.featuresMeta?.intraday_range_pct),
      gap_pct: safeNum(raw?.featuresMeta?.gap_pct),
    },

    indicatorGroups: groups,
    featureEvidence: evidence,

    summary: {
      headline: summary?.headline || "Technical signals are mixed.",
      whatItMeans: summary?.whatItMeans || "",
      riskNote: summary?.riskNote || "",
    },

    meta: raw?.meta || {},
    raw,
  };
}
