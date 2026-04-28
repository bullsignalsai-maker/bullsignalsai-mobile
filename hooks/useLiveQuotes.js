import { useFocusEffect } from "@react-navigation/native";
import { useRef, useState, useCallback } from "react";
import { API_BASE_URL } from "../config/apiKeys";

export function useLiveQuotes(symbols = [], intervalMs = 15000) {
  const [quotes, setQuotes] = useState({});
  const timerRef = useRef(null);

  const fetchQuotes = async () => {
    if (!symbols.length) return;

    try {
      const res = await fetch(
        `${API_BASE_URL}/quotes-bulk?symbols=${symbols.join(",")}`
      );
      if (!res.ok) return;

      const json = await res.json();
      setQuotes(json.quotes || {});
    } catch (e) {
      console.warn("Live quote fetch failed");
    }
  };

  useFocusEffect(
    useCallback(() => {
      // 🔥 fetch immediately when screen opens
      fetchQuotes();

      // 🔄 keep refreshing while focused
      timerRef.current = setInterval(fetchQuotes, intervalMs);

      return () => {
        if (timerRef.current) {
          clearInterval(timerRef.current);
          timerRef.current = null;
        }
      };
    }, [symbols.join(",")])
  );

  return quotes;
}
