// services/getBullSignal.js
import { API_BASE_URL } from "../config/apiKeys";
import { isSP500 } from "./sp500";

// Shorter cache for fresher signals (3 minutes)
const CACHE = {};
const CACHE_HOURS = 0.05; // ~3 minutes

export default async function getBullSignal(symbol) {
  try {
    const sym = (symbol || "").trim().toUpperCase();
    if (!sym) return null;

    // -----------------------------------------------------
    // 1️⃣ NON-SP500 → GROK-ONLY (no BullBrain, no hybrid)
    // -----------------------------------------------------
    if (!isSP500(sym)) {
      return {
        isSP500: false,
        symbol: sym,

        // no bullbrain for non-sp500
        signal: null,
        confidence: null,
        probabilities: null,
        features: null,
        bullbrain: null,
        model: null,

        // hybrid disabled for non-sp500
        hybridSignal: null,
        hybridScore: null,

        // grok fields will be filled by watchlist-item backend
        grokProbUp: null,
        grokSummary: null,
      };
    }

    // -----------------------------------------------------
    // 2️⃣ CACHE CHECK
    // -----------------------------------------------------
    const now = Date.now();
    const cached = CACHE[sym];
    if (cached) {
      const ageHours = (now - cached.time) / (1000 * 60 * 60);
      if (ageHours < CACHE_HOURS) {
        return cached.data;
      }
    }

    // -----------------------------------------------------
    // 3️⃣ BACKEND CALL — hybrid + bullbrain + grok + features
    // -----------------------------------------------------
    const res = await fetch(
      `${API_BASE_URL}/predict/${encodeURIComponent(sym)}`
    );
    const data = await res.json();

    if (!data || data.error) {
      console.warn("getBullSignal backend error:", data?.error);

      const stub = {
        isSP500: true,
        symbol: sym,
        signal: null,
        confidence: null,
        probabilities: null,
        features: null,
        bullbrain: null,
        model: null,

        hybridSignal: null,
        hybridScore: null,
        grokProbUp: null,
        grokSummary: null,
      };

      CACHE[sym] = { time: now, data: stub };
      return stub;
    }

    // -----------------------------------------------------
    // 4️⃣ Extract BullBrain values
    // -----------------------------------------------------
    const bb = data.bullbrain || {};
    const modelLegacy = data.model || {};

    const bullSignal =
      bb.signal ||
      modelLegacy.signal ||
      null;

    const bullConfidence =
      bb.confidence ??
      modelLegacy.confidence ??
      null;

    const probabilities =
      bb.probabilities ||
      (modelLegacy.probability_up != null
        ? {
            BUY: modelLegacy.probability_up,
            SELL: modelLegacy.probability_down,
            HOLD: 0,
          }
        : null);

    // -----------------------------------------------------
    // 5️⃣ Extract HYBRID Outputs
    // -----------------------------------------------------
    const hybridSignal = data.hybridSignal || bullSignal;
    const hybridScore = data.hybridScore || bullConfidence;

    // -----------------------------------------------------
    // 6️⃣ Extract GROK extras
    // -----------------------------------------------------
    const grokProbUp = data.grokProbUp ?? null;
    const grokSummary = data.grokSummary ?? null;

    const payload = {
      isSP500: true,
      symbol: sym,

      // 🔮 HYBRID values (USE THESE IN THE UI)
      hybridSignal,
      hybridScore,

      // 🧠 Grok sentiment
      grokProbUp,
      grokSummary,

      // 📈 BullBrain values (secondary)
      signal: bullSignal,
      confidence: bullConfidence,
      probabilities,
      features: data.features || null,
      bullbrain: bb || null,
      model: modelLegacy || null,
    };

    CACHE[sym] = { time: now, data: payload };
    return payload;
  } catch (err) {
    console.warn("getBullSignal fatal:", err);
    return null;
  }
}
