// services/aiClient.js
import { API_BASE_URL } from "../config/apiKeys";

/**
 * Ask backend to generate Grok/XAI summary.
 * No API keys stored in frontend.
 */
export async function askGrokForMarketSummary(promptObj) {
  try {
    const res = await fetch(`${API_BASE_URL}/grok-summary`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "grok-4-fast",
        messages: [
          {
            role: "system",
            content:
              "You are a concise equity analyst. Use professional tone. Keep under 12 words.",
          },
          {
            role: "user",
            content: JSON.stringify(promptObj, null, 2),
          },
        ],
        temperature: 0.2,
      }),
    });

    const json = await res.json();
    const summary =
      json?.choices?.[0]?.message?.content?.trim() ||
      json?.output_text?.trim() ||
      "Market sentiment steady.";

    return summary.replace(/[\n\r]+/g, " ").trim();
  } catch (err) {
    console.warn("[AIClient] Backend Grok error:", err);
    return "Market sentiment stable.";
  }
}
