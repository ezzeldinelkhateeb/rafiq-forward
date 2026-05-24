/**
 * useStreak — fetches and refreshes streak stats.
 * Wraps getStreakStats server fn via useServerFn (client-safe).
 */

import { useState, useEffect, useCallback } from "react";
import { useServerFn } from "@tanstack/react-start";
import { getStreakStats } from "@/functions/action.fn";
import type { StreakStats } from "@/types/companion";

export function useStreak(userId: string, isReady: boolean): {
  streak: StreakStats;
  refresh: () => void;
} {
  const fetchStreak = useServerFn(getStreakStats);
  const [streak, setStreak] = useState<StreakStats>({ done: 0, total: 0, weeklyDone: 0 });

  const refresh = useCallback(() => {
    if (!userId) return;
    fetchStreak({ data: { userId } })
      .then(setStreak)
      .catch(() => {});
  }, [userId, fetchStreak]);

  useEffect(() => {
    if (!isReady || !userId) return;
    refresh();
  }, [isReady, userId, refresh]);

  return { streak, refresh };
}
