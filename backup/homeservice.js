// services/HomeService.js
import { API_BASE_URL } from "../config/apiKeys";

/* =========================================================
   HOME SYMBOLS (UI-OWNED CONTRACT)
========================================================= */
const HOME_SYMBOLS = [
  "AAPL",
  "MSFT",
  "AMZN",
  "GOOGL",
  "META",
  "NVDA",
  "TSLA",
  "SPY",
  "QQQ",
];

/* =========================================================
   PUBLIC API
========================================================= */
export async function getHomeScreen() {
  try {
    const symbolsParam = HOME_SYMBOLS.join(",");

    const [mag7Res, carouselRes, quotesRes] = await Promise.all([
      fetch(`${API_BASE_URL}/homescreen-mag7`), // intelligence (cron)
      fetch(`${API_BASE_URL}/homescreen-carousel`),
      fetch(
        `${API_BASE_URL}/quotes-bulk?scope=home&symbols=${symbolsParam}`
      ), // 🔥 LIVE quotes
    ]);

    if (!mag7Res.ok || !carouselRes.ok) return null;

    const mag7Json = await mag7Res.json();
    const carouselJson = await carouselRes.json();

    let quotesJson = {};
    if (quotesRes?.ok) {
      const q = await quotesRes.json();
      quotesJson = q?.quotes || {};
    }

    return {
      header: buildHeader(carouselJson),
      carousel: buildCarousel(carouselJson.carousel || []),
      signals: buildMag7Signals(
        mag7Json.mag7 || [],
        quotesJson
      ),
      meta: {
        version: `mag7:${mag7Json.version} | carousel:${carouselJson.version}`,
        refreshed_at: new Date().toISOString(),
        quotes_source: "quotes_collection",
      },
    };
  } catch (err) {
    console.warn("HomeService error:", err.message);
    return null;
  }
}

/* =========================================================
   HEADER (Market Status + Mood)
========================================================= */
function buildHeader(carouselJson) {
  const carousel = carouselJson.carousel || [];

  const usMarket = carousel.find((c) => c.id === "us_market");
  const sentiment = carousel.find((c) => c.id === "sentiment");

  return {
    marketStatus: deriveMarketStatus(usMarket),
    marketMood: sentiment?.items?.[0]?.value || "Sentiment Unavailable",
    lastUpdated: carouselJson.updated_at,
  };
}

function deriveMarketStatus(usMarket) {
  if (!usMarket || !usMarket.items?.length)
    return "Market Status Unknown";

  const spy = usMarket.items.find((i) =>
    i.label?.toLowerCase().includes("s&p")
  );

  if (!spy || !spy.value) return "Market Open";

  return spy.value.startsWith("-")
    ? "Market Under Pressure"
    : "Market Positive";
}

/* =========================================================
   FEATURE CAROUSEL
========================================================= */
function buildCarousel(carousel) {
  return carousel.map((card) => ({
    id: card.id,
    icon: mapCarouselIcon(card.id),
    title: card.title,
    subtitle: card.subtitle || "",
    value: formatCarouselItems(card.items || [], card.id),
    updated_at: card.updated_at,
  }));
}

function shortenSector(label = "") {
  const map = {
    Technology: "Tech",
    Financials: "Fin",
    Finance: "Fin",
    Energy: "En",
    Healthcare: "Health",
    Consumer: "Cons",
    "Consumer Discretionary": "Cons",
  };
  return map[label] || label;
}

function formatCarouselItems(items, cardId) {
  if (!items.length) return "No data";

  const formatted = items.map((i) => {
    const label =
      cardId === "sectors" ? shortenSector(i.label) : i.label;

    const val = i.value || "";

    let indicator = "";
    if (val.startsWith("+")) indicator = "▲";
    else if (val.startsWith("-")) indicator = "▼";

    return `${label} ${indicator}${val}`;
  });

  if (cardId === "sectors") {
    const r1 = formatted.slice(0, 3).join(" · ");
    const r2 = formatted.slice(3).join(" · ");
    return r2 ? `${r1}\n${r2}` : r1;
  }

  return formatted.join(" · ");
}


/* =========================================================
   MAG7 SIGNALS (LIVE QUOTES MERGE + needs_refresh)
========================================================= */
function buildMag7Signals(stocks = [], quotes = {}) {
  return stocks.map((s) => {
    const sym = (s.symbol || "").toUpperCase();
    const q = quotes?.[sym];

    const needsRefresh = q?.needs_refresh === true;

    // ✅ ALWAYS show price if available
    const price =
      q?.price ??
      s.quote?.price ??
      null;

    const change =
      q?.change ??
      s.quote?.change ??
      null;

    const changePct =
      q?.changePct ??
      s.quote?.changePct ??
      null;

    // ✅ Timestamp logic: trust live only if not stale
    const lastUpdated =
      !needsRefresh
        ? q?.updated_at
        : s.quote?.updated_at ??
          q?.updated_at ??
          s.updated_at ??
          null;

    return {
      symbol: sym,
      companyName: s.company_name,

      price,
      change,
      changePct,

      sparkline: Array.isArray(s.sparkline) ? s.sparkline : [],

      signal: s.bullbrain?.signal || "HOLD",
      confidence: Number(s.bullbrain?.confidence ?? 0),

      summary:
        s.insight || "Market signal based on trend and momentum.",

      pattern: s.pattern?.name || null,
      patternWinRate: s.pattern?.winRate_5d ?? null,

      probabilities: {
        up: s.bullbrain?.prob_up,
        down: s.bullbrain?.prob_down,
      },

      lastUpdated,

      // exposed for UI (no animation if true)
      needsRefresh,
    };
  });
}


/* =========================================================
   ICON MAP
========================================================= */
function mapCarouselIcon(id) {
  switch (id) {
    case "crypto":
      return "logo-bitcoin";
    case "sentiment":
      return "speedometer-outline";
    case "sectors":
      return "stats-chart-outline";
    case "commodities":
      return "flame-outline";
    case "us_market":
      return "pulse-outline";
    default:
      return "stats-chart-outline";
  }
}
