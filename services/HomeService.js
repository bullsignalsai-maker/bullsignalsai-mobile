// services/HomeService.js
import { API_BASE_URL } from "../config/apiKeys";

/* =========================================================
   TODAY STRIP (Portfolio Today / Watchlist Performance)
   - One combined quotes-bulk call for whatever symbol union
     the caller passes in (owned + watchlisted), instead of a
     separate call per section.
========================================================= */
export async function fetchHomeQuotes(symbols = []) {
  try {
    const symbolsParam = [...new Set(symbols.filter(Boolean))].join(",");
    if (!symbolsParam) return {};

    const res = await fetch(
      `${API_BASE_URL}/quotes-bulk?scope=home&symbols=${symbolsParam}`,
    );
    if (!res.ok) return {};

    const json = await res.json();
    return json?.quotes || {};
  } catch (err) {
    console.warn("fetchHomeQuotes error:", err.message);
    return {};
  }
}

/* =========================================================
   PUBLIC API
========================================================= */
export async function getHomeScreen() {
  try {
    const homeRes = await fetch(`${API_BASE_URL}/homescreen-data`);
    if (!homeRes.ok) return null;

    const homeJson = await homeRes.json();

    const coreSignals = Array.isArray(homeJson.core_signals)
      ? homeJson.core_signals
      : [];

    const coreUniverse = Array.isArray(homeJson.core_universe)
      ? homeJson.core_universe
      : coreSignals.map((s) => s.symbol).filter(Boolean);

    const symbolsParam = coreUniverse.join(",");

    let quotesJson = {};

    if (symbolsParam) {
      const quotesRes = await fetch(
        `${API_BASE_URL}/quotes-bulk?scope=home&symbols=${symbolsParam}`,
      );

      if (quotesRes?.ok) {
        const q = await quotesRes.json();
        quotesJson = q?.quotes || {};
      }
    }

    return {
      header: buildHeader(homeJson),
      alphaWatch: buildAlphaWatch(homeJson.alpha_watch),
      signals: buildHomeSignals(coreSignals, quotesJson),
      meta: {
        version: homeJson.schema_version || homeJson.version || "home_v2",
        refreshed_at: new Date().toISOString(),
        quotes_source: "quotes_collection",
      },
    };
  } catch (err) {
    console.warn("HomeService error:", err.message);
    return null;
  }
}

export async function getHomeMovers() {
  try {
    const res = await fetch(`${API_BASE_URL}/market-movers?mode=home`);
    if (!res.ok) return [];

    const json = await res.json();
    const movers = Array.isArray(json.movers) ? json.movers : [];

    return movers
      .filter((m) => {
        const pct = m.changePct ?? m.quote?.changePct ?? 0;
        const direction = String(m.direction || "").toLowerCase();

        return (
          direction === "up" ||
          direction === "gainer" ||
          direction === "gain" ||
          Number(pct) > 0
        );
      })
      .slice(0, 5)
      .map((m) => ({
        symbol: String(m.symbol || "").toUpperCase(),
        company: m.company || m.companyName || m.symbol,
        logoUrl: m.logoUrl || m.profile?.logoUrl || null,
        price: m.price ?? m.quote?.price ?? null,
        change: m.change ?? m.quote?.change ?? null,
        changePct: m.changePct ?? m.quote?.changePct ?? null,
        direction: "up",
        oneLiner: m.oneLiner || null,
        quote_updated_at: m.quote_updated_at || m.quote?.updated_at || null,
        lastUpdated: m.quote_updated_at || m.quote?.updated_at || null,
        reason: m.reason || null,
        primaryCatalysts: m.primaryCatalysts || null,
        primaryCatalystFirst:
          typeof m.primaryCatalysts === "string"
            ? m.primaryCatalysts.split(",")[0]?.trim()
            : Array.isArray(m.primaryCatalysts)
              ? m.primaryCatalysts[0]
              : null,
        candidateType: m.candidateType || null,
        riskLevel: m.riskLevel || null,
        sessionType: m.sessionType || null,
      }));
  } catch (err) {
    console.warn("Home movers error:", err.message);
    return [];
  }
}

export async function getVerifiedAlpha() {
  try {
    const res = await fetch(`${API_BASE_URL}/verified-alpha`);
    if (!res.ok) return emptyVerifiedAlpha();

    const json = await res.json();

    return {
      status: json.status || "empty",
      source: json.source || null,
      updatedAt: json.updated_at || null,
      sessionType: json.session_type || null,
      marketSummary: json.market_summary || {},
      fallbackUsed: json.fallback_used === true,

      opportunities: normalizeVerifiedItems(json.alpha_opportunities || []),
      gainers: [],
      losers: [],
    };
  } catch (err) {
    console.warn("Verified alpha error:", err.message);
    return emptyVerifiedAlpha();
  }
}

function emptyVerifiedAlpha() {
  return {
    status: "empty",
    source: null,
    updatedAt: null,
    sessionType: null,
    marketSummary: {},
    fallbackUsed: true,
    opportunities: [],
    gainers: [],
    losers: [],
  };
}

function normalizeVerifiedItems(items = []) {
  const seen = new Set();

  return items
    .filter((x) => x?.symbol)
    .filter((x) => {
      const symbol = String(x.symbol || "").toUpperCase();
      if (seen.has(symbol)) return false;
      seen.add(symbol);
      return true;
    })
    .slice(0, 10)
    .map((x, idx) => {
      const quote = x.quote || {};

      const rawPrice = x.price ?? quote.price ?? null;
      const rawChange = x.change ?? quote.change ?? null;
      const rawChangePct = x.changePct ?? quote.changePct ?? null;

      const price = rawPrice != null ? Number(rawPrice) : null;
      const change = rawChange != null ? Number(rawChange) : null;
      const changePct = rawChangePct != null ? Number(rawChangePct) : null;

      return {
        rank: idx + 1,
        symbol: String(x.symbol || "").toUpperCase(),
        companyName: x.companyName || x.company || x.symbol,
        logoUrl: x.logoUrl || x.profile?.logoUrl || null,
        sector: x.sector || null,

        price: Number.isFinite(price) ? price : null,
        change: Number.isFinite(change) ? change : null,
        changePct: Number.isFinite(changePct) ? changePct : null,

        score: Number(x.score ?? x.opportunityScore ?? x.confidence ?? 0),
        opportunityScore: Number(x.opportunityScore ?? x.score ?? 0),
        marketMomentumBonus: Number(x.marketMomentumBonus ?? 0),
        probUp: Number(x.probUp ?? 0),
        confidence: Number(x.confidence ?? 0),

        signal: x.signal || "HOLD",

        setupLabel: x.setupLabel || x.pattern || "AI Opportunity",
        reason: cleanAlphaText(
          x.reason || "Verified catalyst-backed opportunity.",
        ),
        primaryCatalysts: x.primaryCatalysts || null,
        primaryCatalystFirst:
          typeof x.primaryCatalysts === "string"
            ? x.primaryCatalysts.split(",")[0]?.trim()
            : Array.isArray(x.primaryCatalysts)
              ? x.primaryCatalysts[0]
              : null,
        whyNow: Array.isArray(x.whyNow)
          ? x.whyNow.map(cleanAlphaText).filter(Boolean).slice(0, 3)
          : Array.isArray(x.primaryCatalysts)
            ? x.primaryCatalysts.map(cleanAlphaText).filter(Boolean).slice(0, 3)
            : typeof x.primaryCatalysts === "string"
              ? x.primaryCatalysts
                  .split(",")
                  .map((s) => cleanAlphaText(s))
                  .filter(Boolean)
                  .slice(0, 3)
              : [],
        riskLevel: x.riskLevel || "Medium",
        riskFlags: Array.isArray(x.riskFlags) ? x.riskFlags : [],
        theme: x.theme || x.sector || null,
        pattern: x.pattern || null,
        marketRegime: x.marketRegime || null,
        factorScores: x.factorScores || {},
        quoteVerified: x.quoteVerified === true,
        source: x.source || "verified_alpha",
        lastUpdated:
          x.quote_updated_at ||
          x.computed_at ||
          x.generatedAt ||
          x.generated_at ||
          x.updated_at ||
          null,
      };
    });
}

/* =========================================================
   ALPHACLARA PICKS (replaces Core Signals / core_universe)
========================================================= */
export async function getAlphaclaraTracking({ limit, windowDays = 3 } = {}) {
  try {
    const params = new URLSearchParams({ window_days: String(windowDays) });
    if (limit != null) params.set("limit", String(limit));

    const res = await fetch(
      `${API_BASE_URL}/alphaclara-tracking?${params.toString()}`,
    );
    if (!res.ok) return emptyAlphaclaraTracking();

    const json = await res.json();

    return {
      status: json.status || "empty",
      windowDays: Number(json.window_days ?? windowDays),
      counts: {
        total: Number(json.counts?.total ?? 0),
        tracking: Number(json.counts?.tracking ?? 0),
        checked: Number(json.counts?.checked ?? 0),
        unavailable: Number(json.counts?.unavailable ?? 0),
      },
      items: normalizeTrackingItems(json.items),
    };
  } catch (err) {
    console.warn("Alphaclara tracking error:", err.message);
    return emptyAlphaclaraTracking();
  }
}

function emptyAlphaclaraTracking() {
  return {
    status: "empty",
    windowDays: 3,
    counts: { total: 0, tracking: 0, checked: 0, unavailable: 0 },
    items: [],
  };
}

// Real duplicates are NOT merged — the same symbol can be picked more
// than once inside the window, and each pick is a distinct fact
// (different pick_price/date), so every item is kept and keyed on
// symbol + recorded_at instead of deduped by symbol.
function normalizeTrackingItems(items = []) {
  return (Array.isArray(items) ? items : [])
    .filter((x) => x?.symbol)
    .map((x, idx) => {
      const symbol = String(x.symbol || "").toUpperCase();

      return {
        key: `${symbol}-${x.recorded_at || x.pick_date || idx}`,
        symbol,
        companyName: x.companyName || x.company_name || symbol,
        logoUrl: x.logoUrl || x.profile?.logoUrl || null,
        pickDate: x.pick_date || null,
        pickPrice: x.pick_price != null ? Number(x.pick_price) : null,
        currentPrice:
          x.current_price != null ? Number(x.current_price) : null,
        currentPriceUpdatedAt: x.current_price_updated_at || null,
        livePct: x.livePct != null ? Number(x.livePct) : null,
        isChecked: x.isChecked === true,
        checkedReturn:
          x.checkedReturn != null ? Number(x.checkedReturn) : null,
        checkedHorizon: x.checkedHorizon ?? null,
        recordedAt: x.recorded_at || null,
      };
    });
}

/* =========================================================
   HEADER
========================================================= */
function buildHeader(homeJson) {
  const overview = homeJson.market_overview || {};

  return {
    marketStatus: overview.marketStatus || "Market Status Unknown",
    marketMood:
      overview.fearGreed?.label && overview.fearGreed?.value != null
        ? `${overview.fearGreed.label} (${overview.fearGreed.value})`
        : overview.marketMood || "Overview",
    lastUpdated: overview.updated_at || homeJson.updated_at || null,
  };
}

/* =========================================================
   HOME SIGNALS
========================================================= */
function buildHomeSignals(stocks = [], quotes = {}) {
  return stocks.map((s) => {
    const sym = String(s.symbol || "").toUpperCase();
    const q = quotes?.[sym] || {};

    const needsRefresh = q?.needs_refresh === true;

    const price = q?.price ?? s.price ?? s.quote?.price ?? null;
    const change = q?.change ?? s.change ?? s.quote?.change ?? null;
    const changePct = q?.changePct ?? s.changePct ?? s.quote?.changePct ?? null;

    const lastUpdated =
      q?.updated_at ||
      s.quote_updated_at ||
      s.lastUpdated ||
      s.updated_at ||
      null;
    return {
      symbol: sym,
      companyName: s.companyName || s.company_name || s.name || sym,
      logoUrl: s.logoUrl || s.profile?.logoUrl || null,
      price,
      change,
      changePct,

      signal: s.signal || s.bullbrain?.signal || "HOLD",
      confidence:
        s.confidence != null
          ? Number(s.confidence)
          : s.bullbrain?.confidence != null
            ? Number(s.bullbrain.confidence)
            : null,
      displayIntelligence: s.displayIntelligence || null,
      // Whether displayIntelligence has actually been computed for
      // this symbol yet — distinct from bullbrain (an older, separate
      // signal system) having a value. Gates the badge/confidence so
      // a freshly-added or not-yet-computed symbol never looks like
      // it has a real (if unremarkable) rating.
      hasIntelligence: typeof s.displayIntelligence?.score === "number",

      summary: getHomeInsight(s),
      marketAwareness: s.marketAwareness || null,

      pattern:
        typeof s.pattern === "string"
          ? s.pattern
          : s.pattern?.name || s.pattern?.pattern || null,

      patternWinRate:
        s.patternWinRate ?? s.pattern?.winRate ?? s.pattern?.winRate_5d ?? null,

      lastUpdated,
      needsRefresh,
    };
  });
}

function getHomeInsight(s) {
  const awareness = s.marketAwareness || {};

  if (typeof s.summary === "string" && s.summary.trim()) {
    return s.summary.trim();
  }

  if (typeof awareness.oneLiner === "string" && awareness.oneLiner.trim()) {
    return awareness.oneLiner.trim();
  }

  if (typeof s.insight === "string" && s.insight.trim()) {
    return s.insight.trim();
  }

  // Only the generic catch-all is replaced — s.summary/oneLiner/insight
  // above are real data from marketAwareness, a separate system from
  // displayIntelligence, so they're left untouched even when
  // displayIntelligence itself hasn't been computed yet. But if there's
  // truly no intelligence at all, don't show a confident-sounding
  // fabricated sentence — and if intelligence exists but just has no
  // generated text, don't say "Analyzing…" next to an already-real badge.
  const hasIntelligence = typeof s.displayIntelligence?.score === "number";
  return hasIntelligence
    ? "No additional commentary available."
    : "Analyzing…";
}

function buildAlphaWatch(alphaWatch = {}) {
  const items = Array.isArray(alphaWatch.items) ? alphaWatch.items : [];

  return {
    title: alphaWatch.title || "AI Opportunity Watch",
    subtitle:
      alphaWatch.subtitle ||
      "AI-ranked setups showing momentum, trend quality, pattern edge, and participation.",
    count: Number(alphaWatch.count ?? items.length ?? 0),
    marketRegime: alphaWatch.market_regime || alphaWatch.marketRegime || null,
    updatedAt: alphaWatch.updated_at || null,
    disclaimer:
      alphaWatch.disclaimer ||
      "AI Opportunity Watch is probabilistic and for informational purposes only.",
    items: items
      .filter((x) => x?.symbol)
      .slice(0, 8)
      .map((x, idx) => ({
        rank: idx + 1,
        symbol: String(x.symbol || "").toUpperCase(),
        companyName: x.companyName || x.company_name || x.symbol,
        logoUrl: x.logoUrl || x.profile?.logoUrl || null,
        price: x.price ?? null,
        change: x.change ?? null,
        changePct: x.changePct ?? null,
        score: Number(x.score ?? 0),
        opportunityScore: Number(x.opportunityScore ?? x.score ?? 0),
        confidence: Number(x.confidence ?? 0),
        signal: x.signal || "HOLD",
        setupLabel: x.setupLabel || "Opportunity Watch",
        reason: cleanAlphaText(x.reason),
        whyNow: Array.isArray(x.whyNow) ? x.whyNow.slice(0, 3) : [],
        riskLevel: x.riskLevel || "Controlled",
        riskFlags: Array.isArray(x.riskFlags) ? x.riskFlags : [],
        theme: x.theme || null,
        pattern: x.pattern || null,
        marketMomentumBonus: Number(x.marketMomentumBonus ?? 0),
        probUp: Number(x.probUp ?? 0),
        factorScores: x.factorScores || {},
        marketRegime: x.marketRegime || alphaWatch.market_regime || null,
        lastUpdated:
          x.quote_updated_at || x.computed_at || alphaWatch.updated_at || null,
      })),
  };
}

function cleanAlphaText(text) {
  if (typeof text !== "string") return "";

  return text
    .replace(/\.{2,}/g, ".")
    .replace("â", "'")
    .replace("â", '"')
    .replace("â", '"')
    .replace(/\s+/g, " ")
    .trim();
}
