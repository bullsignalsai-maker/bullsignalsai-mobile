// firebaseConfig.js
import { initializeApp } from "firebase/app";
import { initializeAuth, getReactNativePersistence } from "firebase/auth";
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  getDocs,
  collection,
  deleteDoc,
} from "firebase/firestore";
import AsyncStorage from "@react-native-async-storage/async-storage";

const firebaseConfig = {
  apiKey: "AIzaSyD1rEkrjJY2weDbjHp7zumB27GOlh0hOIk",
  authDomain: "bullsignalsai.firebaseapp.com",
  projectId: "bullsignalsai",
  storageBucket: "bullsignalsai.firebasestorage.app",
  messagingSenderId: "461742866193",
  appId: "1:461742866193:web:d60f038702adf5e2aa56b0",
  measurementId: "G-DQNXSWGL1P",
};

const app = initializeApp(firebaseConfig);
const auth = initializeAuth(app, {
  persistence: getReactNativePersistence(AsyncStorage),
});
const db = getFirestore(app);

// === Existing Ticker Summary ===
export async function getCachedSummary(symbol) {
  try {
    const user = auth.currentUser;
    if (!user) return null;
    const ref = doc(db, "users", user.uid, "summaries", symbol);
    const snap = await getDoc(ref);
    if (snap.exists()) return snap.data();
    return null;
  } catch (err) {
    console.warn("getCachedSummary error:", err);
    return null;
  }
}

export async function saveCachedSummary(symbol, summary) {
  try {
    const user = auth.currentUser;
    if (!user) return;
    const ref = doc(db, "users", user.uid, "summaries", symbol);
    await setDoc(
      ref,
      { summary, updatedAt: new Date().toISOString() },
      { merge: true },
    );
  } catch (err) {
    console.warn("saveCachedSummary error:", err);
  }
}

// -------------------------------------------------------------
// PORTFOLIO CRUD (Firestore) — Lot-Based, FIFO
// -------------------------------------------------------------

// 🔹 Helper: normalize lots + migrate old schema (shares + avgCost)
function normalizeLots(data) {
  let lots = Array.isArray(data?.lots)
    ? data.lots.filter((l) => l && Number(l.shares) > 0)
    : [];

  // 🔁 Migration path: old docs with { shares, avgCost } only
  if (
    (!lots || lots.length === 0) &&
    typeof data?.shares === "number" &&
    typeof data?.avgCost === "number" &&
    data.shares > 0
  ) {
    lots = [
      {
        shares: data.shares,
        price: data.avgCost,
        timestamp: data.updatedAt || new Date().toISOString(),
      },
    ];
  }

  return lots;
}

// 🔹 Helper: recompute totals from lots
function recalcFromLots(lots) {
  let totalShares = 0;
  let totalCost = 0;

  (lots || []).forEach((lot) => {
    const sh = Number(lot.shares) || 0;
    const pr = Number(lot.price) || 0;
    totalShares += sh;
    totalCost += sh * pr;
  });

  const avgCost = totalShares > 0 ? totalCost / totalShares : 0;
  return { totalShares, avgCost };
}

// 🔹 Helper: FIFO sell on lots
function applyFifoSell(lots, sharesToSell) {
  let remaining = sharesToSell;
  const newLots = [];

  for (const lot of lots) {
    let sh = Number(lot.shares) || 0;
    if (remaining <= 0) {
      newLots.push(lot);
      continue;
    }

    if (sh <= remaining) {
      // sell the full lot
      remaining -= sh;
    } else {
      // partial lot sell
      const updated = { ...lot, shares: sh - remaining };
      remaining = 0;
      newLots.push(updated);
    }
  }

  if (remaining > 0) {
    // tried to sell more than we have
    return { ok: false, lots };
  }

  return {
    ok: true,
    lots: newLots.filter((l) => Number(l.shares) > 0),
  };
}

// 🔹 BUY helper — append FIFO lot & recalc totals
export async function buyShares(userId, symbol, shares, price, logoUrl = null) {
  try {
    const sym = symbol.toUpperCase();
    const ref = doc(db, "users", userId, "portfolio", sym);
    const snap = await getDoc(ref);

    let data = snap.exists() ? snap.data() : { symbol: sym };
    let lots = normalizeLots(data);

    lots.push({
      shares: Number(shares),
      price: Number(price),
      timestamp: new Date().toISOString(),
    });

    const { totalShares, avgCost } = recalcFromLots(lots);

    await setDoc(
      ref,
      {
        symbol: sym,

        profile: {
          logoUrl,
        },

        lots,
        shares: totalShares,
        avgCost,
        updatedAt: new Date().toISOString(),
      },
      { merge: true },
    );
  } catch (err) {
    console.warn("buyShares error:", err.message || err);
    throw err;
  }
}

// 🔹 SELL helper — FIFO reduction & recalc totals
export async function sellShares(userId, symbol, sharesToSell) {
  try {
    const sym = symbol.toUpperCase();
    const ref = doc(db, "users", userId, "portfolio", sym);
    const snap = await getDoc(ref);

    if (!snap.exists()) {
      throw new Error("No existing position to sell");
    }

    let data = snap.data();
    let lots = normalizeLots(data);
    const { totalShares } = recalcFromLots(lots);

    const qty = Number(sharesToSell) || 0;
    if (qty <= 0) throw new Error("Shares to sell must be positive");
    if (qty > totalShares) {
      throw new Error("Cannot sell more shares than you hold");
    }

    const res = applyFifoSell(lots, qty);
    if (!res.ok) {
      throw new Error("FIFO sell failed");
    }

    lots = res.lots;
    const { totalShares: newShares, avgCost } = recalcFromLots(lots);

    if (newShares <= 0) {
      // fully closed position
      await deleteDoc(ref);

      return;
    }

    await setDoc(
      ref,
      {
        symbol: sym,
        lots,
        shares: newShares,
        avgCost,
        updatedAt: new Date().toISOString(),
      },
      { merge: true },
    );
  } catch (err) {
    console.warn("sellShares error:", err.message || err);
    throw err;
  }
}

// 🔸 Keep existing API used by screens — alias addPosition → BUY
export async function addPosition(
  userId,
  symbol,
  shares,
  avgCost,
  logoUrl = null,
) {
  return buyShares(userId, symbol, shares, avgCost, logoUrl);
}

// UPDATE PARTIAL FIELDS (if you still use it anywhere)
export async function updatePosition(userId, symbol, updates) {
  try {
    const ref = doc(db, "users", userId, "portfolio", symbol.toUpperCase());
    await setDoc(
      ref,
      {
        ...updates,
        updatedAt: Date.now(),
      },
      { merge: true },
    );
  } catch (err) {
    console.warn("updatePosition error:", err.message);
  }
}

// DELETE HOLDING
export async function deletePosition(userId, symbol) {
  try {
    const ref = doc(db, "users", userId, "portfolio", symbol.toUpperCase());
    await deleteDoc(ref);
  } catch (err) {
    console.warn("deletePosition error:", err.message);
  }
}

// GET ALL HOLDINGS (now returns lots-aware data)
export async function getPortfolio(userId) {
  try {
    const colRef = collection(db, "users", userId, "portfolio");
    const snap = await getDocs(colRef);

    let list = [];
    snap.forEach((d) => {
      const data = d.data() || {};
      let lots = normalizeLots(data);
      const { totalShares, avgCost } = recalcFromLots(lots);

      list.push({
        symbol: data.symbol || d.id,
        profile: data.profile || {},
        lots,
        shares: totalShares,
        avgCost,
        updatedAt: data.updatedAt || null,
      });
    });

    return list;
  } catch (err) {
    console.warn("getPortfolio error:", err.message);
    return [];
  }
}

// === NEW: AI Pulse Cache for InsightsScreen ===

/**
 * Save generic AI Pulse data to Firestore (global, not per-user)
 * Used for things like /ai-pulse, overall market AI views, etc.
 */
export async function saveToFirestoreCache(docId, data) {
  try {
    const ref = doc(db, "bullsignals_ai", docId);
    await setDoc(ref, {
      data,
      updated_at: new Date().toISOString(),
    });
  } catch (err) {
    console.warn("saveToFirestoreCache error:", err.message);
  }
}

/**
 * Retrieve generic AI Pulse data from Firestore.
 * Returns `data` payload if exists and not older than `maxAgeHours`.
 */
export async function getFromFirestoreCache(docId, maxAgeHours = 3) {
  try {
    const ref = doc(db, "bullsignals_ai", docId);
    const snap = await getDoc(ref);
    if (!snap.exists()) return null;

    const { data, updated_at } = snap.data();
    if (!updated_at) return data;

    const ageHours = (Date.now() - new Date(updated_at).getTime()) / 3600000;

    if (ageHours > maxAgeHours) {
      return null;
    }

    return data;
  } catch (err) {
    console.warn("getFromFirestoreCache error:", err.message);
    return null;
  }
}

// === HOTLIST CACHE (BullBrain v2, GLOBAL) ===
// Backend writes docs with shape:
// { count, hotlist, updated_at }
export async function saveHotlistCache(data) {
  try {
    const ref = doc(db, "bullsignals_ai", "market_hotlist");
    await setDoc(
      ref,
      {
        ...data, // expect { count, hotlist }
        updated_at: new Date().toISOString(),
      },
      { merge: true },
    );
  } catch (err) {
    console.warn("saveHotlistCache error:", err.message);
  }
}

export async function getHotlistCache(maxAgeMinutes = 5) {
  try {
    const ref = doc(db, "bullsignals_ai", "market_hotlist");
    const snap = await getDoc(ref);
    if (!snap.exists()) return null;

    const raw = snap.data() || {};
    const updated_at = raw.updated_at;
    const { updated_at: _ignore, ...data } = raw; // strip timestamp, keep { count, hotlist }

    if (!updated_at) return data;

    const ageMinutes = (Date.now() - new Date(updated_at).getTime()) / 60000;

    if (ageMinutes > maxAgeMinutes) {
      return null;
    }

    return data;
  } catch (err) {
    console.warn("getHotlistCache error:", err.message);
    return null;
  }
}

// === BEARWATCH CACHE (BullBrain v2, GLOBAL) ===
// Backend writes docs with shape:
// { count, bearwatch, updated_at }
export async function saveBearwatchCache(data) {
  try {
    const ref = doc(db, "bullsignals_ai", "market_bearwatch");
    await setDoc(
      ref,
      {
        ...data, // expect { count, bearwatch }
        updated_at: new Date().toISOString(),
      },
      { merge: true },
    );
  } catch (err) {
    console.warn("saveBearwatchCache error:", err.message);
  }
}

export async function getBearwatchCache(maxAgeMinutes = 5) {
  try {
    const ref = doc(db, "bullsignals_ai", "market_bearwatch");
    const snap = await getDoc(ref);
    if (!snap.exists()) return null;

    const raw = snap.data() || {};
    const updated_at = raw.updated_at;
    const { updated_at: _ignore, ...data } = raw; // strip timestamp

    if (!updated_at) return data;

    const ageMinutes = (Date.now() - new Date(updated_at).getTime()) / 60000;

    if (ageMinutes > maxAgeMinutes) {
      return null;
    }

    return data;
  } catch (err) {
    console.warn("getBearwatchCache error:", err.message);
    return null;
  }
}

export { app, auth, db };
