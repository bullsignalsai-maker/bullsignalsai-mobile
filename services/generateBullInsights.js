// services/generateBullInsights.js
// ------------------------------------------------------
// BullBrain Insights Generator (48 features + /technical + Option-C Smart Summary)
// ------------------------------------------------------

// Helper: safe number
const num = (v, fallback = null) =>
  typeof v === "number" && !Number.isNaN(v) ? v : fallback;

export default function generateBullInsights(bundleOrFeatures, maybeModel) {
  let features = null;
  let model = null;
  let technical = null;

  // New format: { features, model, technical }
  if (
    bundleOrFeatures &&
    typeof bundleOrFeatures === "object" &&
    bundleOrFeatures.features &&
    bundleOrFeatures.model
  ) {
    features = bundleOrFeatures.features;
    model = bundleOrFeatures.model;
    technical = bundleOrFeatures.technical || null;
  } else {
    // Backward compatible
    features = bundleOrFeatures;
    model = maybeModel;
    technical = null;
  }

  if (!features || !model) return null;

  // -----------------------------
  // 1. Extract important numbers
  // -----------------------------
  const close = num(features.close);
  const sma5 = num(features.sma5);
  const sma20 = num(features.sma20);
  const rsi14 = num(features.rsi14);
  const macd = num(features.macd);
  const macd_signal = num(features.macd_signal);
  const macd_hist = num(features.macd_hist);

  const pct_change = num(features.return_1d);
  const vol_change =
    num(features.volume_change_1d) ??
    num(technical?.volume?.volume_change_1d);

  const highlowrange_pct =
    num(features.intraday_range_pct) ??
    num(technical?.candle?.intraday_range_pct);

  const vol_z = num(features.volume_zscore_20);
  const vol_vs_ma20 = num(features.volume_vs_ma20_pct);
  const vol20 = num(features.volatility_20d);

  const trend_strength_20 = num(features.trend_strength_20);
  const price_vs_sma20 = num(features.price_vs_sma20_pct);
  const dist_high = num(features.distance_from_20d_high);
  const dist_low = num(features.distance_from_20d_low);

  const signal = model.signal || model?.bullbrain?.signal || null;
  const confidence = num(model.confidence);

  const probabilities =
    model.probabilities || model?.bullbrain?.probabilities || null;

  const probBuy = probabilities?.BUY ?? null;
  const probHold = probabilities?.HOLD ?? null;
  const probSell = probabilities?.SELL ?? null;

  // ------------------------------------------------------
  // 2. FULL One-Liner Library (YOU REQUESTED TO KEEP THIS)
  // ------------------------------------------------------
  const ONE_LINERS = {
    BUY: [
      "Buying strength is building with improving trend — may favor a bullish stance.",
      "Momentum looks constructive as buyers step in — upside continuation is possible.",
      "Price action leans positive, with buyers gradually taking control.",
      "Trend is tilting upward and buyers are active — conditions support a bullish bias.",
      "Bulls are gaining traction as price stabilizes and begins to push higher.",
    ],
    SELL: [
      "Stock is losing strength as sellers press the trend downward.",
      "Downward pressure is building — caution is warranted for long positions.",
      "Bearish momentum is forming below key trend levels.",
      "Selling activity is elevated — risk of further downside remains.",
      "Weak structure and downward drift suggest protecting capital or trimming risk.",
    ],
    HOLD: [
      "Stock is consolidating with no clear directional edge.",
      "Momentum is neutral and price is in a wait-and-see zone.",
      "Market appears indecisive with balanced buying and selling.",
      "Trend is calm and stable — no strong entry or exit signal yet.",
      "Price is in a consolidation phase — monitoring for a breakout makes sense.",
    ],
    VOLATILITY: [
      "Large intraday swings — risk management becomes critical.",
      "Volatility is elevated — entries and exits should be handled carefully.",
      "Uncertain sharp moves suggest smaller position sizing.",
      "Volatile conditions — waiting for clearer structure may help.",
      "Fast, choppy price action — consider a more defensive approach.",
    ],
    REVERSAL_UP: [
      "Price may be turning upward from a weaker phase — early opportunity for patient buyers.",
      "Momentum is starting to shift upward, hinting at a potential bullish reversal.",
      "Downtrend is losing strength as buyers begin to absorb selling.",
      "Recovery signals are emerging from recent lows.",
      "Pressure from the downside is easing, opening room for a bounce.",
    ],
    REVERSAL_DOWN: [
      "Uptrend is losing steam — locking in profits or tightening stops can be wise.",
      "Momentum is cooling from elevated levels, hinting at a possible pullback.",
      "Bullish phase appears to be fading — short-term caution is reasonable.",
      "Signs of a potential top are emerging after a strong run.",
      "Recent strength is softening, suggesting a possible near-term correction.",
    ],
  };

  const pick = (list) => list[Math.floor(Math.random() * list.length)];

  // ------------------------------------------------------
  // 3. Full BullBrain One-Liner (classic)
  // ------------------------------------------------------
  let oneLiner = "";

  const isVolatile = highlowrange_pct != null && highlowrange_pct > 4;

  if (isVolatile) {
    oneLiner = pick(ONE_LINERS.VOLATILITY);
  } else if (macd_hist > 0.5 && signal === "BUY") {
    oneLiner = pick(ONE_LINERS.REVERSAL_UP);
  } else if (macd_hist < -0.5 && signal === "SELL") {
    oneLiner = pick(ONE_LINERS.REVERSAL_DOWN);
  } else if (signal === "BUY") {
    oneLiner = pick(ONE_LINERS.BUY);
  } else if (signal === "SELL") {
    oneLiner = pick(ONE_LINERS.SELL);
  } else {
    oneLiner = pick(ONE_LINERS.HOLD);
  }

  // ------------------------------------------------------
  // 4. TREND SUMMARY (improved)
  // ------------------------------------------------------
  let trendSummary = "";
  if (sma5 != null && sma20 != null) {
    if (sma5 > sma20) {
      trendSummary =
        "Short-term trend leans bullish with prices holding above key averages.";
    } else if (sma5 < sma20) {
      trendSummary =
        "Short-term trend leans bearish with prices below the mid-term average.";
    } else {
      trendSummary = "Trend is neutral with aligned short- and mid-term averages.";
    }
  }

  // /technical trend summary override (higher quality)
  if (technical?.trend?.summary) {
    trendSummary = technical.trend.summary;
  }

  // ------------------------------------------------------
  // 5. MOMENTUM SUMMARY (RSI + MACD)
  // ------------------------------------------------------
  let momentumSummary = "Momentum mixed with no dominant direction.";

  if (rsi14 < 30) momentumSummary = "Momentum oversold; potential rebound zone.";
  else if (rsi14 > 70) momentumSummary = "Momentum overbought; risk of pullback.";
  else if (macd > macd_signal && macd_hist > 0)
    momentumSummary = "Momentum strengthening via positive MACD crossover.";
  else if (macd < macd_signal && macd_hist < 0)
    momentumSummary = "Momentum weakening via negative MACD crossover.";

  if (technical?.momentum?.summary_rsi)
    momentumSummary = `${technical.momentum.summary_rsi}.`;

  // ------------------------------------------------------
  // 6. VOLUME SUMMARY
  // ------------------------------------------------------
  let volumeSummary = "Volume sits near typical levels.";

  if (vol_z > 2) volumeSummary = "Strong volume spike confirms high participation.";
  else if (vol_z > 1) volumeSummary = "Volume elevated above 20-day average.";
  else if (vol_z < -1) volumeSummary = "Volume unusually low.";

  if (technical?.volume?.summary) {
    volumeSummary = technical.volume.summary;
  }

  // ------------------------------------------------------
  // 7. VOLATILITY SUMMARY
  // ------------------------------------------------------
  let volatilitySummary = "Volatility stable within normal range.";

  if (highlowrange_pct > 4)
    volatilitySummary = "High intraday volatility with wide price swings.";
  else if (highlowrange_pct > 2)
    volatilitySummary = "Moderate intraday volatility.";

  if (technical?.volatility?.summary) {
    volatilitySummary = technical.volatility.summary;
  }

  // ------------------------------------------------------
  // ⭐ 8. OPTION-C SMART TECHNICAL ONE-LINER (Final Hybrid Line)
  // ------------------------------------------------------
  let summaryLine = "";

  if (trend_strength_20 > 0.3 && macd_hist > 0) {
    summaryLine =
      "Uptrend gaining strength with improving momentum and supportive volume.";
  } else if (trend_strength_20 < -0.3 && macd_hist < 0) {
    summaryLine =
      "Downtrend firming with weakening momentum and elevated volatility risk.";
  } else if (vol20 > 3) {
    summaryLine =
      "Market tone volatile; trend signals mixed — caution recommended.";
  } else {
    summaryLine =
      "Trend and momentum balanced; watching for next directional move.";
  }

  // Technical overrides
  if (technical?.trend?.summary) {
    summaryLine = technical.trend.summary;
  }

  // ------------------------------------------------------
  // 9. Combined summary (detail screen)
  // ------------------------------------------------------
  const combinedTechnicalSummary = [
    trendSummary,
    momentumSummary,
    volumeSummary,
    volatilitySummary,
  ]
    .filter(Boolean)
    .join("\n");

  return {
    oneLiner, // full BullBrain library (for StockDetailScreen)
    summaryLine, // final Option-C premium line (for Watchlist)
    trendSummary,
    momentumSummary,
    volumeSummary,
    volatilitySummary,
    combinedTechnicalSummary,
  };
}
