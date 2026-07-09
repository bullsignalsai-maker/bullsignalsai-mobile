import { useEffect, useRef } from "react";

// tabPress fires only when the user taps THIS screen's own tab bar
// icon — switching in from another tab, or re-pressing while already
// on it. It does NOT fire on a stack pop from a detail screen pushed
// on top of the tab navigator, app backgrounding/foregrounding, or an
// in-screen Modal closing — none of those involve the tab bar, so
// this can't be done with useFocusEffect alone (which fires the same
// way for all of those). resetScroll is read via a ref so callers
// don't need to memoize it themselves.
export function useResetScrollOnTabPress(navigation, resetScroll) {
  const resetScrollRef = useRef(resetScroll);
  resetScrollRef.current = resetScroll;

  useEffect(() => {
    const unsubscribe = navigation.addListener("tabPress", () => {
      resetScrollRef.current?.();
    });

    return unsubscribe;
  }, [navigation]);
}
