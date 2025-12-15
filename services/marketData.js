// services/marketData.js
// ✅ Backend-only version – App Store safe, no external API calls

import AsyncStorage from "@react-native-async-storage/async-storage";
import { getCachedSummary, saveCachedSummary } from "../firebaseConfig";

const API_BASE = "https://bullbrain-api.onrender.com";

/* ---------- Backend Fetch Helper ---------- */
export async function apiFetch(path, options = {}) {
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      method: options.method || "GET",
      headers: {
        "Content-Type": "application/json",
        ...(options.headers || {}),
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
    });

    const text = await res.text();

    if (!res.ok) {
      console.warn(`⚠️ Backend HTTP ${res.status}: ${path}`);
      return null;
    }

    if (!text) return null;

    try {
      return JSON.parse(text);
    } catch (_) {
      console.warn("⚠️ Backend returned non-JSON:", path);
      return null;
    }
  } catch (err) {
    console.warn("apiFetch error:", path, "-", err.message || err);
    return null;
  }
}

/* ---------------------------------------------------------
   ✅ NEW — HOME SUMMARY (BullBrain v2 + S&P500 + SmartPattern)
---------------------------------------------------------- */
export async function getHomeSummary() {
  try {
    const json = await apiFetch("/home-summary");

    if (!json) {
      console.warn("⚠️ home-summary returned null");
      return null;
    }

    return {
      status: json.status,
      version: json.version,
      ai_picks: json.ai_picks || [],
      smart_pattern: json.smart_pattern || null,
      market_mood: json.market_mood || "Neutral",
      ai_market_insights: json.ai_market_insights || "",
      sector_mood: json.sector_mood || [],
      raw: json.raw || [],
    };
  } catch (err) {
    console.warn("getHomeSummary error:", err);
    return null;
  }
}

/* ---------- Real-time Quote (via backend) ---------- */
export async function getQuote(symbol) {
  if (!symbol) return null;

  const data = await apiFetch(`/quote/${encodeURIComponent(symbol)}`);
  if (!data || data.error) return null;

  return {
    price: data.price ?? null,
    change: data.change ?? null,
    changePct: data.changePct ?? null,
    high: data.high ?? null,
    low: data.low ?? null,
    open: data.open ?? null,
    prevClose: data.prevClose ?? null,
    timestamp: data.timestamp ?? null,
  };
}

/* ---------- Analyst Recommendations ---------- */
export async function getRecommendations(symbol) {
  if (!symbol) return null;

  try {
    const payload = await apiFetch(`/recommendations/${encodeURIComponent(symbol)}`);
    const data = Array.isArray(payload) ? payload : payload?.data;

    if (!Array.isArray(data) || !data.length) return null;

    const latest = data[0];
    const total =
      (latest.buy ?? 0) +
      (latest.hold ?? 0) +
      (latest.sell ?? 0) +
      (latest.strongBuy ?? 0) +
      (latest.strongSell ?? 0);

    if (!total) return null;

    const confidence = ((latest.buy + latest.strongBuy) / total) * 100;
    let signal = "HOLD";
    if (confidence >= 60) signal = "BUY";
    else if (confidence <= 40) signal = "SELL";

    return { confidence: Math.round(confidence), signal, latest };
  } catch (err) {
    console.warn("getRecommendations error:", err);
    return null;
  }
}

/* ---------- Grok Summary with Cache ---------- */
export async function getTickerSummary({ symbol, name, price, changePct, recommendation }) {
  if (!symbol) return null;

  // 1️⃣ Firestore cache
  const cached = await getCachedSummary(symbol);
  if (cached?.summary) {
    const ageHrs = (Date.now() - new Date(cached.updatedAt).getTime()) / 3600000;
    if (ageHrs < 24) return cached.summary;
  }

  // 2️⃣ Local cache
  const localKey = `summary_${symbol}`;
  const localSummary = await AsyncStorage.getItem(localKey);
  if (localSummary) return localSummary;

  // 3️⃣ Backend → Grok
  try {
    const payload = {
      model: "grok-4-fast",
      messages: [
        {
          role: "system",
          content:
            "You are a factual equity analyst. Use only provided data. " +
            "Summarize the stock tone in ≤12 words.",
        },
        {
          role: "user",
          content: JSON.stringify(
            { symbol, name, price, changePct, recommendation },
            null,
            2
          ),
        },
      ],
      temperature: 0.2,
    };

    const json = await apiFetch("/grok-summary", {
      method: "POST",
      body: payload,
    });

    const summary = json?.choices?.[0]?.message?.content?.trim();
    if (summary) {
      await saveCachedSummary(symbol, summary);
      await AsyncStorage.setItem(localKey, summary);
      return summary;
    }

    return null;
  } catch (err) {
    console.warn("getTickerSummary error:", err);
    return null;
  }
}

/* ---------- Full Ticker Data (Detail Screen) ---------- */
export async function getFullTickerData(symbol) {
  try {
    const [quote, recommendation] = await Promise.all([
      getQuote(symbol),
      getRecommendations(symbol),
    ]);

    if (!quote || quote.price == null) return null;

    const summary = await getTickerSummary({
      symbol,
      name: `${symbol} Corp.`,
      price: quote.price,
      changePct: quote.changePct,
      recommendation,
    });

    return {
      symbol,
      name: `${symbol} Corp.`,
      price: quote.price,
      changePct: quote.changePct,
      signal: recommendation?.signal ?? "HOLD",
      confidence: recommendation?.confidence ?? 50,
      summary:
        summary ??
        (recommendation?.signal === "BUY"
          ? "Analysts show strong buy trend."
          : recommendation?.signal === "SELL"
          ? "Analysts suggest caution."
          : "Neutral market tone."),
      lastUpdated: new Date().toISOString(),
    };
  } catch (err) {
    console.warn("getFullTickerData error:", err);
    return null;
  }
}

/* ---------- BullBrain v1 (Legacy) ---------- */
export async function getBullSignal(symbol) {
  try {
    const res = await apiFetch(`/predict/${encodeURIComponent(symbol)}`);
    if (!res || res.error) return null;

    const model = res.model || {};
    const features = res.features || {};

    return {
      symbol: (res.symbol || symbol).toUpperCase(),
      price: res.price,
      signal: model.signal || "HOLD",
      confidence: model.confidence ?? 70,
      probabilityUp: model.probability_up ?? 0,
      probabilityDown: model.probability_down ?? 0,
      features,
      raw: res,
    };
  } catch (err) {
    console.warn("getBullSignal error:", err);
    return null;
  }
}

/* ---------- Batch Quotes (Watchlist/Portfolio) ---------- */
export async function getQuotesForSymbols(symbols = []) {
  if (!Array.isArray(symbols) || symbols.length === 0) return [];

  try {
    const results = [];
    for (const s of symbols) {
      const info = await getFullTickerData(s);
      if (info) results.push(info);
    }

    if (symbols.length === 1) {
      return { [results[0]?.symbol]: results[0] };
    }

    return results;
  } catch (err) {
    console.warn("getQuotesForSymbols error:", err);
    return [];
  }
}

/* ---------- Batch Price API ---------- */
import { API_BASE_URL } from "../config/apiKeys";

export async function getBatchPrices(symbolsCSV) {
  try {
    const url = `${API_BASE_URL}/prices?symbols=${symbolsCSV}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error("Bad batch price response");

    return await res.json();
  } catch (err) {
    console.warn("getBatchPrices error:", err.message);
    return {};
  }
}
