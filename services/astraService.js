import { API_BASE_URL } from "../config/apiKeys";

const ASTRA_TIMEOUT_MS = 25000;

function cleanClaraText(text = "") {
  return String(text)
    .replace(/\bBUY\b/g, "Bullish Setup")
    .replace(/\bHOLD\b/g, "Neutral Setup")
    .replace(/\bSELL\b/g, "Risk Alert")
    .replace(/\bbuy\b/g, "bullish setup")
    .replace(/\bhold\b/g, "neutral setup")
    .replace(/\bsell\b/g, "risk alert")
    .replace(/rated Neutral Setup/g, "showing a Neutral Setup")
    .replace(/rated Bullish Setup/g, "showing a Bullish Setup")
    .replace(/rated Risk Alert/g, "showing a Risk Alert");
}

function cleanCards(cards = []) {
  return Array.isArray(cards)
    ? cards.map((card) => ({
        ...card,
        title: cleanClaraText(card?.title || ""),
        value: cleanClaraText(card?.value || ""),
        subtitle: cleanClaraText(card?.subtitle || ""),
      }))
    : [];
}

function withTimeout(promise, timeoutMs = ASTRA_TIMEOUT_MS) {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error("Clara request timed out")), timeoutMs),
    ),
  ]);
}

export async function askClara(payload) {
  try {
    const res = await withTimeout(
      fetch(`${API_BASE_URL}/astra-chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }),
    );

    const json = await res.json();

    if (!res.ok) {
      throw new Error(json?.error || "Clara request failed");
    }

    return {
      answer: cleanClaraText(
        json?.answer ||
          json?.message ||
          "Clara reviewed the data, but no clear answer was returned.",
      ),
      usedLLM: json?.used_llm === true,
      intent: json?.intent || null,
      contextSummary: json?.contextSummary || null,
      suggestedFollowups: Array.isArray(json?.suggestedFollowups)
        ? json.suggestedFollowups
        : [],
      cards: cleanCards(json?.cards),
      raw: json,
    };
  } catch (err) {
    console.warn("askClara error:", err.message);

    return {
      answer: "I could not reach Clara right now. Please try again shortly.",
      usedLLM: false,
      intent: null,
      contextSummary: null,
      suggestedFollowups: [],
      error: err.message,
      cards: [],
    };
  }
}

export const askAstra = askClara;
