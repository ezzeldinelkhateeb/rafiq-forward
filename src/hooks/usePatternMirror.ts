/**
 * usePatternMirror — fetches a weekly behavioral insight at session start.
 * Shows once per week. Stores last_shown timestamp in localStorage.
 */

import { useState, useEffect } from "react";
import { useServerFn } from "@tanstack/react-start";
import { fetchPatternMirror } from "@/functions/pattern-mirror.fn";

const LAST_SHOWN_KEY = "rafiq.pattern_mirror.last_shown";

export function usePatternMirror(userId: string, isReady: boolean) {
  const callFetchMirror = useServerFn(fetchPatternMirror);

  const [mirror, setMirror] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (!isReady || !userId || dismissed) return;

    // Check if we showed it this week
    const lastShown = typeof window !== "undefined"
      ? localStorage.getItem(LAST_SHOWN_KEY)
      : null;

    if (lastShown) {
      const daysSince = (Date.now() - new Date(lastShown).getTime()) / (1000 * 60 * 60 * 24);
      if (daysSince < 7) return; // too soon
    }

    // Fetch the mirror insight
    callFetchMirror({ data: { userId } })
      .then(({ mirror }) => {
        if (mirror) {
          setMirror(mirror);
          // Record when we showed it
          localStorage.setItem(LAST_SHOWN_KEY, new Date().toISOString());
        }
      })
      .catch(() => {}); // silent fail — not critical
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isReady, userId]);

  const dismiss = () => {
    setMirror(null);
    setDismissed(true);
  };

  return { mirror, dismiss };
}
