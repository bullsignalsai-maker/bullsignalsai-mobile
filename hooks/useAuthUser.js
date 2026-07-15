import { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "../firebaseConfig";

// auth.currentUser is a synchronous, non-reactive snapshot — on cold
// start it can still be null while Firebase's AsyncStorage-backed
// persistence is rehydrating, even though the user is actually logged
// in. This hook stays in sync via onAuthStateChanged instead of
// freezing whatever auth.currentUser happened to be at first render.
export function useAuthUser() {
  const [user, setUser] = useState(() => auth.currentUser);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => setUser(u));
    return unsubscribe;
  }, []);

  return user;
}
