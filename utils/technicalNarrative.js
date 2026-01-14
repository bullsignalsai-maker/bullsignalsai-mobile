// utils/technicalNarrative.js

export function buildTechnicalNarrative({ technical, features, quote }) {
  if (!technical) {
    return {
      summary:
        "Technical data is currently limited. Indicators may update after the next market refresh.",
      sections: {},
    };
  }

  const sections = {};

  /* =========================
     TREND & STRUCTURE
  ========================= */
  const trendSummary = technical.trend?.summary;
  const priceVsSMA = technical.trend?.price_vs_sma20_pct;

  sections.trend = {
    title: "Trend & Structure",
    narrative:
      trendSummary
        ? `The stock ${trendSummary.toLowerCase()}. ${
            priceVsSMA != null
              ? `Price is trading about ${Math.abs(priceVsSMA).toFixed(1)}% ${
                  priceVsSMA > 0 ? "above" : "below"
                } its 20-day moving average, confirming short-term trend alignment.`
              : ""
          }`
        : "Trend direction is forming based on recent price structure and moving averages.",
    bias:
      priceVsSMA > 0 ? "Bullish" : priceVsSMA < 0 ? "Bearish" : "Neutral",
  };

  /* =========================
     MOMENTUM (RSI + MACD)
  ========================= */
  const rsi = technical.momentum?.rsi14;
  const macdSummary = technical.momentum?.summary_macd;

  sections.momentum = {
    title: "Momentum",
    narrative:
      rsi != null
        ? rsi >= 70
          ? `Momentum is elevated with RSI near ${rsi.toFixed(
              1
            )}, indicating overbought conditions. This reflects strong buying pressure, but also raises the risk of short-term pullbacks.`
          : rsi <= 30
          ? `RSI near ${rsi.toFixed(
              1
            )} suggests oversold conditions, where selling pressure may be exhausting.`
          : `RSI around ${rsi.toFixed(
              1
            )} reflects balanced momentum without extreme conditions.`
        : macdSummary || "Momentum indicators describe the speed and strength of recent price movement.",
    bias:
      rsi >= 70
        ? "Overbought"
        : rsi <= 30
        ? "Oversold"
        : "Neutral",
  };

  /* =========================
     VOLUME
  ========================= */
  const volVsMA = technical.volume?.volume_vs_ma20_pct;

  sections.volume = {
    title: "Volume & Participation",
    narrative:
      volVsMA != null
        ? `Trading volume is ${
            volVsMA > 0 ? "above" : "below"
          } its 20-day average by ${Math.abs(volVsMA).toFixed(
            1
          )}%. ${
            volVsMA > 0
              ? "This suggests increased market participation, often associated with institutional activity."
              : "Lower volume suggests reduced conviction behind recent price moves."
          }`
        : "Volume compares current participation to recent trading norms.",
    bias:
      volVsMA > 0 ? "High Participation" : "Low Participation",
  };

  /* =========================
     VOLATILITY & RISK
  ========================= */
  const atr = technical.volatility?.atr14;

  sections.volatility = {
    title: "Volatility & Risk",
    narrative:
      atr != null
        ? `Average True Range (ATR) near ${atr.toFixed(
            2
          )} indicates wider daily price swings. Higher volatility increases opportunity for active traders, but also raises risk and stop-loss requirements.`
        : "Volatility measures how widely prices fluctuate on a daily basis.",
    bias: atr > 0 ? "Elevated" : "Normal",
  };

  /* =========================
     CANDLE PSYCHOLOGY
  ========================= */
  const candle = technical.candle;

  sections.candle = {
    title: "Price Action Psychology",
    narrative:
      candle?.body_pct != null
        ? `Today’s candlestick shows a ${
            candle.body_pct > 0 ? "bullish" : "bearish"
          } body, reflecting ${
            candle.body_pct > 0
              ? "buyers closing the session in control"
              : "selling pressure dominating the session"
          }. ${
            candle.lower_shadow_pct > candle.upper_shadow_pct
              ? "Longer lower wicks suggest dip-buying interest."
              : "Upper wicks indicate selling pressure near highs."
          }`
        : "Candlestick anatomy reflects the intraday battle between buyers and sellers.",
    bias:
      candle?.body_pct > 0 ? "Bullish Bias" : "Bearish Bias",
  };

  /* =========================
     MASTER SUMMARY
  ========================= */
  const summary = `
This stock is currently displaying ${
    sections.trend.bias.toLowerCase()
  } trend characteristics with ${
    sections.momentum.bias.toLowerCase()
  } momentum. ${
    sections.volume.bias === "High Participation"
      ? "Strong participation supports the move."
      : "Participation is moderate, reducing conviction."
  } Volatility remains ${
    sections.volatility.bias.toLowerCase()
  }, suggesting ${
    sections.volatility.bias === "Elevated"
      ? "higher risk and opportunity."
      : "stable price behavior."
  }
`.trim();

  return { summary, sections };
}
