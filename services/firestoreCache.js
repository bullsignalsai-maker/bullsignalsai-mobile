// services/firestoreCache.js
import { db } from "../firebaseConfig";
import { doc, getDoc, setDoc } from "firebase/firestore";

export async function saveToFirestoreCache(docId, data) {
  try {
    const ref = doc(db, "bullsignals_ai", docId);
    await setDoc(ref, { data, updated_at: new Date().toISOString() });
    console.log(`✅ Firestore cache saved: ${docId}`);
  } catch (err) {
    console.warn("saveToFirestoreCache error:", err.message);
  }
}

export async function getFromFirestoreCache(docId, maxAgeHours = 3) {
  try {
    const ref = doc(db, "bullsignals_ai", docId);
    const snap = await getDoc(ref);
    if (!snap.exists()) return null;

    const { data, updated_at } = snap.data();
    if (!updated_at) return data;

    const ageHours = (Date.now() - new Date(updated_at).getTime()) / 3600000;
    if (ageHours > maxAgeHours) {
      console.log(`⏰ Firestore cache expired (${ageHours.toFixed(1)}h)`);
      return null;
    }

    console.log(`💾 Using cached data (${ageHours.toFixed(2)}h old)`);
    return data;
  } catch (err) {
    console.warn("getFromFirestoreCache error:", err.message);
    return null;
  }
}
