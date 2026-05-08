import { API_BASE_URL } from "../config/apiKeys";

export async function getBatchPrices(symbolsCSV) {
  try {
    const url = `${API_BASE_URL}/prices?symbols=${symbolsCSV}`;
    const res = await fetch(url);

    if (!res.ok) {
      throw new Error("Bad batch price response");
    }

    return await res.json();
  } catch (err) {
    console.warn("getBatchPrices error:", err?.message || err);
    return {};
  }
}
