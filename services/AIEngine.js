// services/AIEngine.js
import { fetchMarketNews } from "./NewsFeedService";
import { fetchLiveMarketStats } from "./MarketStatsService";
import { saveToFirestoreCache, getFromFirestoreCache } from "./firestoreCache";
import { API_BASE_URL } from "../config/apiKeys";

// --- CLEAN HELPERS ---
function cleanText(str = "") {
  return str
    .replace(/&apos;|&quot;|&#39;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/[\u2018-\u201F\u2026]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

// --- Local headline sentiment (for grouping) ---
function analyzeHeadlineSentiment(headlines = []) {
  const bullishWords = [
    "gain","gains","rise","rises","soar","soars","beat","beats",
    "growth","surge","surges","optimism","rebound","rebounds",
    "strong","rally","record high","expands","up","advance",
    "higher","jumps","spikes"
  ];

  const bearishWords = [
    "drop","drops","fall","falls","slip","plunge","plunges",
    "loss","losses","slowdown","decline","declines","cut","cuts",
    "layoff","layoffs","weak","selloff","tumbles","down","pressure",
    "warning","downgrade","guidance cut"
  ];

  return headlines.map((h) => {
    const title = cleanText(h.title || h);
    const lower = title.toLowerCase();

    let tag = "⚖️";
    if (bullishWords.some((w) => lower.includes(w))) tag = "📈";
    if (bearishWords.some((w) => lower.includes(w))) tag = "📉";

    return { title, tag };
  });
}

// --- Optional Macro-Watch (backend may not exist) ---
async function fetchMacroWatch() {
  try {
    const res = await fetch(`${API_BASE_URL}/macro-watch`);
    const json = await res.json();
    return Array.isArray(json?.data) ? json.data : [];
  } catch (err) {
    console.warn("MacroWatch backend error:", err.message);
    return [];
  }
}

// === MAIN ORCHESTRATOR ======================================================
export async function getAIPulseData(useGrok = false, forceRefresh = false) {
  try {
    // 1) Load cache (unless force refresh)
    if (!forceRefresh) {
      const cached = await getFromFirestoreCache("market_pulse");
      if (cached) return cached;
    }

    // 2) Parallel fetches (no sector, no earnings)
    const [newsRes, statsRes, macroRes] = await Promise.allSettled([
      fetchMarketNews(),
      fetchLiveMarketStats(),
      fetchMacroWatch(),
    ]);

    const newsData = newsRes.value || [];
    const liveStats =
      statsRes.value || {
        fearGreed: { value: 50, label: "Neutral" },
        vix: 15,
        sp500_change: 0,
      };
    const macro_watch = macroRes.value || [];

    // ===============================================================
    // SUPER CLEAN FINANCIAL FILTER (updated with financial verbs)
    // ===============================================================

    const badStarts = [
      "how ","why ","what ","when ","where ","who ",
      "should ","could ","would ","is ","are ","will ",
      "does ","do ","did ","can ","i am","i'm","here's","how to"
    ];

    const badWords = [
      "opinion","explained","?", "!", "you need to",
      "must see","what this means","analysis:","my ","your ",
      "we "," worry "
    ];

    const irrelevant = [
      "celebrity","hollywood","bollywood",
      "music","movie","football","soccer","nba","nfl",
      "cricket","politics","election","trump"
    ];

    const financialKeywords = [
      "stock","market","shares","ipo","earnings","revenue",
      "profit","loss","guidance","forecast","growth",
      "futures","dow","nasdaq","s&p","bond","treasury",
      "inflation","rate","fed","sector","oil","gold",
      "commodity","currency","upgrade","downgrade",
      "price target"
    ];

    // NEW: allow headlines with obvious financial action verbs
    const financialVerbs = [
      "soars","surges","tumbles","plunges","rises","falls",
      "drops","spikes","jumps","slumps","crashes","rockets",
      "slides","retreats","advances"
    ];

    const tickerPattern = /\b[A-Z]{2,5}\b/;

    const relevant = newsData
      .slice(0, 60)
      .map((n) => cleanText(n.title || ""))
      .filter((t) => {
        if (!t || t.length < 15) return false;
        const lower = t.toLowerCase();

        // Remove question types
        if (badStarts.some((w) => lower.startsWith(w))) return false;

        // Remove clickbait
        if (badWords.some((w) => lower.includes(w))) return false;

        // Remove irrelevant topics
        if (irrelevant.some((w) => lower.includes(w))) return false;

        // allow financial verbs (NEW FIX)
        if (financialVerbs.some((w) => lower.includes(w))) return true;

        // allow if tickers appear
        if (tickerPattern.test(t)) return true;

        // require at least one real financial context keyword
        if (!financialKeywords.some((w) => lower.includes(w))) return false;

        return true;
      })
      .map((title) => ({ title }));

    // 3) Sentiment classification
    const analyzed = analyzeHeadlineSentiment(relevant);

    const bullishRaw = analyzed.filter((x) => x.tag === "📈").map((x) => x.title);
    const bearishRaw = analyzed.filter((x) => x.tag === "📉").map((x) => x.title);
    const neutralRaw = analyzed.filter((x) => x.tag === "⚖️").map((x) => x.title);

    // 4) Ensure 5 per category
    const fallback_sentences = {
      bullish: [
        "Markets show improving breadth across key sectors.",
        "Investor risk appetite firms during the early session.",
        "Equities strengthen as buying momentum builds.",
        "Positive flows support upside stability.",
        "Growth stocks continue their leadership trend."
      ],
      neutral: [
        "Markets remain steady as traders await key catalysts.",
        "Equities trade sideways amid balanced sentiment.",
        "Mixed sector rotation keeps indexes stable.",
        "Traders monitor macro signals for direction.",
        "Volatility holds near average levels."
      ],
      bearish: [
        "Market participants show caution amid uncertainty.",
        "Risk-off flows build as volatility edges higher.",
        "Selling pressure emerges in selective sectors.",
        "Equities pull back as momentum cools.",
        "Weakness appears across multiple asset groups."
      ]
    };

    function ensureFive(arr, type) {
      if (arr.length >= 5) return arr.slice(0, 5);
      return arr.concat(
        fallback_sentences[type].slice(0, 5 - arr.length)
      );
    }

    const bullish = ensureFive(bullishRaw, "bullish");
    const neutral = ensureFive(neutralRaw, "neutral");
    const bearish = ensureFive(bearishRaw, "bearish");

    const highlights_grouped = { bullish, neutral, bearish };

    const highlights = [
      ...bullish.map((t) => `📈 ${t}`),
      ...neutral.map((t) => `⚖️ ${t}`),
      ...bearish.map((t) => `📉 ${t}`)
    ];

    const ai_digest =
      `Market tone is driven by headlines: ${bullish.length} bullish, ${neutral.length} neutral, ${bearish.length} bearish.`;

    const pulseData = {
      ai_pulse_headline: "AI Market Pulse",
      ai_digest,
      mood: liveStats,
      macro_watch,
      risk_level: liveStats.vix < 15 ? "Low Risk" :
                  liveStats.vix > 20 ? "High Risk" : "Moderate Risk",
      highlights,
      highlights_grouped,
      updated_at: new Date().toLocaleString(),
    };

    await saveToFirestoreCache("market_pulse", pulseData);
    return pulseData;

  } catch (err) {
    console.warn("AIEngine error:", err.message);
    return {
      ai_digest: "Awaiting market data...",
      highlights: [],
      highlights_grouped: { bullish: [], neutral: [], bearish: [] },
      macro_watch: [],
      mood: {
        fearGreed: { value: 50, label: "Neutral" },
        vix: 15,
        sp500_change: 0
      },
      risk_level: "Moderate Risk",
      updated_at: new Date().toLocaleString(),
    };
  }
}
