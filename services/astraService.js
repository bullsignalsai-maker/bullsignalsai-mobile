import { API_BASE_URL } from "../config/apiKeys";

const ASTRA_TIMEOUT_MS = 25000;

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
      answer:
        json?.answer ||
        json?.message ||
        "Clara reviewed the data, but no clear answer was returned.",
      usedLLM: json?.used_llm === true,
      intent: json?.intent || null,
      contextSummary: json?.contextSummary || null,
      suggestedFollowups: Array.isArray(json?.suggestedFollowups)
        ? json.suggestedFollowups
        : [],
      cards: Array.isArray(json?.cards) ? json.cards : [],
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
