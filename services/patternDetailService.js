// services/patternDetailService.js
import { API_BASE_URL } from "../config/apiKeys";

function safeNum(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

// aggregate stats from endpoint are already percent values:
// avg: 1.827 means 1.827%
function normalizeReturnStats(x = {}) {
  return {
    avg: safeNum(x.avg),
    median: safeNum(x.median),
    best: safeNum(x.best),
    worst: safeNum(x.worst),
    count: safeNum(x.count),
    winRate: safeNum(x.winRate),
  };
}

// samples fwd_5d/fwd_10d are decimal returns:
// 0.0139 means 1.39%
function normalizeSampleReturn(v) {
  const n = safeNum(v);
  return n == null ? null : n * 100;
}

function buildProbabilityCone({ quote, forwardReturns, pattern, occurrences }) {
  const anchorPrice = safeNum(quote?.price ?? quote?.current);

  if (!anchorPrice) {
    return null;
  }

  const buildRange = (stats) => {
    if (!stats) return null;

    const worst = safeNum(stats.worst);
    const avg = safeNum(stats.avg);
    const best = safeNum(stats.best);
    const count = safeNum(stats.count);
    const winRate = safeNum(stats.winRate);

    if (worst == null || avg == null || best == null) {
      return null;
    }

    return {
      low: Number((anchorPrice * (1 + worst / 100)).toFixed(2)),
      mid: Number((anchorPrice * (1 + avg / 100)).toFixed(2)),
      high: Number((anchorPrice * (1 + best / 100)).toFixed(2)),
      returnLow: worst,
      returnMid: avg,
      returnHigh: best,
      winRate,
      count,
      sampleQuality:
        count >= 20 ? "Strong sample" : count >= 5 ? "Limited sample" : "Very limited sample",
    };
  };

  return {
    anchorPrice,
    pattern: pattern?.pattern || pattern?.patternLabel || null,
    occurrences: safeNum(occurrences),
    note: "This range is derived from historical forward-return statistics for the current pattern.",
    ranges: {
      days5: buildRange(forwardReturns?.days5),
      days10: buildRange(forwardReturns?.days10),
    },
  };
}

function buildPatternExplanation({ pattern, days5, days10, occurrences }) {
  const name = pattern?.pattern || pattern?.patternLabel || "Pattern";
  const bias = pattern?.bias || pattern?.patternBias || "neutral";
  const headline = pattern?.headline;

  const winRate5 = safeNum(days5?.winRate);
  const avg5 = safeNum(days5?.avg);
  const best5 = safeNum(days5?.best);
  const worst5 = safeNum(days5?.worst);
  const count5 = safeNum(days5?.count);

  const lines = [];

  if (headline) {
    lines.push(headline);
  }

  lines.push(
    `${name} is currently tagged with a ${String(bias).toLowerCase()} bias, so it should be interpreted in that directional context.`
  );

  if (winRate5 != null) {
    lines.push(
      `Historically, this pattern has shown a ${Math.round(
        winRate5 * 100
      )}% five-day win rate across ${count5 ?? "available"} samples.`
    );
  }

  if (avg5 != null && best5 != null && worst5 != null) {
    lines.push(
      `The five-day historical range shows an average return of ${avg5.toFixed(
        2
      )}%, best case ${best5.toFixed(2)}%, and worst case ${worst5.toFixed(
        2
      )}%.`
    );
  }

  if (safeNum(occurrences) != null) {
    lines.push(
      `This pattern has appeared ${safeNum(
        occurrences
      )} times in the stored history, so the statistics are based on repeated occurrences rather than a single event.`
    );
  }

  return lines.join(" ");
}

export async function getPatternDetail(symbol) {
  if (!symbol) throw new Error("Missing symbol");

  const res = await fetch(`${API_BASE_URL}/stockdetail/${symbol}/pattern`);
  const raw = await res.json();

  if (!res.ok || raw?.status === "not_ready") {
    throw new Error("Pattern detail not available");
  }

  const header = raw?.header || {};
  const content = raw?.content || {};

  const quote = header?.quote || content?.quote || raw?.quote || {};
  const pattern = content?.pattern || {};
  const forwardReturnsRaw =
    content?.forwardReturns || content?.history?.forwardReturns || {};

  const forwardReturns = {
    days5: normalizeReturnStats(forwardReturnsRaw.days5 || {}),
    days10: normalizeReturnStats(forwardReturnsRaw.days10 || {}),
  };

  const occurrences = safeNum(content?.occurrences ?? content?.history?.occurrences);

  const samplesRaw = Array.isArray(content?.samples)
    ? content.samples
    : Array.isArray(content?.history?.samples)
    ? content.history.samples
    : [];

  const recentSamples = samplesRaw.map((s) => ({
    pattern: s?.pattern || s?.patternLabel || pattern?.pattern || pattern?.patternLabel,
    patternLabel: s?.patternLabel || s?.pattern || pattern?.patternLabel,
    bias: s?.bias ?? pattern?.bias ?? pattern?.patternBias ?? null,
    date: s?.date ?? null,
    headline: s?.headline ?? pattern?.headline ?? "",
    changePct: safeNum(s?.changePct),
    // IMPORTANT: convert decimal sample returns to percent
    fwd_5d: normalizeSampleReturn(s?.fwd_5d),
    fwd_10d: normalizeSampleReturn(s?.fwd_10d),
  }));

  const explanation = buildPatternExplanation({
    pattern,
    days5: forwardReturns.days5,
    days10: forwardReturns.days10,
    occurrences,
  });

  const confidencePct =
    forwardReturns.days5.winRate != null
      ? Math.round(forwardReturns.days5.winRate * 100)
      : header?.pattern?.winRate5d != null
      ? Math.round(header.pattern.winRate5d * 100)
      : null;

  const label =
    confidencePct == null
      ? "Pattern context"
      : confidencePct >= 70
      ? "Historically Strong"
      : confidencePct >= 55
      ? "Moderate Edge"
      : "Mixed / Neutral";

  const probabilityCone = buildProbabilityCone({
    quote,
    forwardReturns,
    pattern,
    occurrences,
  });

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
    },

    patternInsight: {
      pattern: pattern?.pattern || pattern?.patternLabel || "NO CLEAR PATTERN",
      confidencePct,
      label,
      explanation,
      current: {
        pattern: pattern?.pattern || pattern?.patternLabel || null,
        patternLabel: pattern?.patternLabel || pattern?.pattern || null,
        bias: pattern?.bias || pattern?.patternBias || null,
        changePct: safeNum(pattern?.changePct),
        date: pattern?.date || null,
        headline: pattern?.headline || "",
      },
      history: {
        forwardReturns,
        occurrences,
        recentSamples,
      },
    },

    smartPattern: {
      pattern: pattern?.pattern || pattern?.patternLabel || null,
      explanation,
    },

    patternStats: {
      currentPattern: {
        pattern: pattern?.pattern || pattern?.patternLabel || null,
        patternLabel: pattern?.patternLabel || pattern?.pattern || null,
        bias: pattern?.bias || pattern?.patternBias || null,
        changePct: safeNum(pattern?.changePct),
        date: pattern?.date || null,
        headline: pattern?.headline || "",
      },
      historyForCurrent: {
        forwardReturns,
        occurrences,
        samples: recentSamples,
      },
      allPatterns: [],
    },

    probabilityCone,
    raw,
  };
}