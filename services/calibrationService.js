import { API_BASE_URL } from "../config/apiKeys";
import { getCache, saveCache } from "./CacheManager";

// Calibration is backed by resolved-pick history, which moves slowly —
// cache for an hour rather than re-fetching on every screen visit.
const CALIBRATION_CACHE_TTL_SECONDS = 60 * 60;

function calibrationCacheKey(up, down, horizon) {
  return `calibration:${up.toFixed(3)}:${down.toFixed(3)}:${horizon}`;
}

function emptyCalibration() {
  return {
    insufficientData: true,
    lowConfidence: false,
    bucket: null,
    statedConfidencePct: null,
    actualHitRatePct: null,
    n: 0,
    headline: null,
    caveat: null,
    disclaimer: null,
  };
}

export async function getCalibrationCheck(up, down, horizon = "5d") {
  if (typeof up !== "number" || typeof down !== "number") {
    return emptyCalibration();
  }

  const cacheKey = calibrationCacheKey(up, down, horizon);
  const cached = await getCache(cacheKey);
  if (cached) return cached;

  try {
    const params = new URLSearchParams();
    params.set("up", up);
    params.set("down", down);
    params.set("horizon", horizon);

    const res = await fetch(
      `${API_BASE_URL}/alphaclara-calibration?${params.toString()}`,
    );
    if (!res.ok) return emptyCalibration();

    const json = await res.json();

    const result = {
      insufficientData: !!json.insufficient_data,
      lowConfidence: !!json.low_confidence,
      bucket: json.bucket ?? null,
      statedConfidencePct: json.stated_confidence_pct ?? null,
      actualHitRatePct: json.actual_hit_rate_pct ?? null,
      n: Number(json.n ?? 0),
      headline: json.headline || null,
      caveat: json.caveat || null,
      disclaimer: json.disclaimer || null,
    };

    await saveCache(cacheKey, result, CALIBRATION_CACHE_TTL_SECONDS);
    return result;
  } catch (err) {
    console.warn("getCalibrationCheck failed", err);
    return emptyCalibration();
  }
}
