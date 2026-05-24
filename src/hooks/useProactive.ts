/**
 * useProactive — fetches the proactive nudge on session load.
 * Returns one nudge or null. Designed to be called once per session.
 */

import { useState, useEffect } from "react";
import { useServerFn } from "@tanstack/react-start";
import { getProactiveNudge } from "@/functions/proactive.fn";
import type { ProactiveNudge } from "@/types/companion";

export function useProactive(userId: string, isReady: boolean): {
  nudge: ProactiveNudge | null;
  dismiss: () => void;
} {
  const callGetNudge = useServerFn(getProactiveNudge);
  const [nudge, setNudge] = useState<ProactiveNudge | null>(null);

  useEffect(() => {
    if (!isReady || !userId) return;

    callGetNudge({ data: { userId } })
      .then((n) => setNudge(n))
      .catch(() => {}); // Non-critical — never block on proactive failure
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isReady, userId]);

  const dismiss = () => setNudge(null);

  return { nudge, dismiss };
}
