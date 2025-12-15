// services/NewsFeedService.js
import { XMLParser } from "fast-xml-parser";

/**
 * Fetch and merge U.S. market-moving headlines
 * using multiple free RSS sources.
 */
export async function fetchMarketNews() {
  const rssFeeds = [
    "https://feeds.finance.yahoo.com/rss/2.0/headline?s=AAPL,MSFT,NVDA,TSLA,AMZN&region=US&lang=en-US",
    "https://www.cnbc.com/id/10000664/device/rss/rss.html",
    "https://www.investing.com/rss/news_25.rss",
    "https://www.marketwatch.com/feeds/topstories",
    "https://www.reuters.com/rssFeed/businessNews",
  ];

  const includeKeywords = [
    // 📊 Major Indexes & Market Terms
    "Dow", "Nasdaq", "S&P", "Wall Street", "stock", "market", "futures", "indexes", "indices",

    // 🏦 Economic Indicators & Fed Policy
    "Fed", "Federal Reserve", "rate hike", "rate cut", "interest rate", "inflation", "CPI",
    "PPI", "jobs data", "employment", "unemployment", "nonfarm payrolls", "consumer spending",
    "GDP", "core inflation", "economic growth", "recession", "soft landing", "bond yields", "Treasury",

    // 💼 Corporate / Earnings News
    "earnings", "guidance", "quarterly results", "profits", "losses", "revenue", "forecast",
    "dividend", "buyback", "IPO", "merger", "acquisition", "SEC filing",

    // 🧠 Technology & AI Sector
    "AI stocks", "artificial intelligence", "semiconductors", "chip", "Nvidia", "AMD", "Intel",
    "Apple", "Microsoft", "Google", "Alphabet", "Meta", "Amazon", "Tesla", "OpenAI", "ChatGPT",

    // ⚙️ Industry Sectors
    "energy", "oil", "crude", "gas", "OPEC", "renewables", "utilities",
    "bank", "financial", "insurance", "healthcare", "biotech", "pharma", "retail", "real estate",

    // 🏛️ Policy, Politics & Global Factors
    "Trump", "Biden", "White House", "Congress", "tariff", "trade war", "China", "Ukraine", "Middle East",
    "sanctions", "election", "policy", "stimulus", "shutdown", "budget", "deficit", "Treasury Secretary",

    // 🌎 Market Movers & Other Macro Drivers
    "VIX", "volatility", "credit", "housing", "consumer confidence", "jobless claims",
    "debt ceiling", "inflation data", "rate decision", "ECB", "BoJ", "OPEC", "commodity prices",
  ];

  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "",
    textNodeName: "text",
  });

  const results = [];

  // --- Fetch from multiple feeds ---
  for (const feed of rssFeeds) {
    try {
      const res = await fetch(feed);
      const xml = await res.text();
      const json = parser.parse(xml);

      const items = json?.rss?.channel?.item || json?.feed?.entry || [];
      items.slice(0, 20).forEach((i) => {
        const rawTitle = i.title?.text || i.title || "";
        const cleanTitle = rawTitle
          .replace(/<\/?[^>]+(>|$)/g, "") // strip HTML tags
          .replace(/[^\x20-\x7E]/g, "") // remove non-ASCII / emoji
          .replace(/&quot;|&apos;|&#39;|&amp;/g, "")
          .trim();

        results.push({
          title: cleanTitle,
          link: i.link?.href || i.link || "",
          pubDate: i.pubDate || i.updated || new Date().toISOString(),
          source:
            json?.rss?.channel?.title ||
            i.source?.text ||
            i.source ||
            "Unknown",
        });
      });
    } catch (err) {
      console.warn("RSS fetch error:", feed, err.message);
    }
  }

  // --- Filter strictly U.S. market related news ---
  const filtered = results.filter((n) => {
    const t = n.title.toLowerCase();
    return includeKeywords.some((k) => t.includes(k.toLowerCase()));
  });

  // --- Deduplicate and sort by recency ---
  const seen = new Set();
  const deduped = filtered.filter((n) => {
    const key = n.title.slice(0, 60).toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  deduped.sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate));

  // --- Ensure at least 20 items ---
  const finalNews = deduped.slice(0, 25);
  console.log(`📰 Loaded ${finalNews.length} U.S. market-moving headlines`);
  return finalNews;
}
