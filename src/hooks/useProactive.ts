/**
 * useProactive — fetches the proactive nudge on session load.
 * Returns one nudge or null. Designed to be called once per session.
 */

import { useState, useEffect } from "react";
import { useServerFn } from "@tanstack/react-start";
import { getProactiveNudge, logNudgeAccepted, logNudgeIgnored } from "@/functions/proactive.fn";
import type { ProactiveNudge } from "@/types/companion";

export function useProactive(userId: string, isReady: boolean): {
  nudge: ProactiveNudge | null;
  dismiss: () => void;
  accept: (replyText?: string) => void;
} {
  const callGetNudge = useServerFn(getProactiveNudge);
  const callLogNudgeAccepted = useServerFn(logNudgeAccepted);
  const callLogNudgeIgnored = useServerFn(logNudgeIgnored);
  const [nudge, setNudge] = useState<ProactiveNudge | null>(null);

  useEffect(() => {
    if (!isReady || !userId) return;

    callGetNudge({ data: { userId } })
      .then((n) => setNudge(n))
      .catch(() => {}); // Non-critical — never block on proactive failure
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isReady, userId]);

  const dismiss = () => {
    if (nudge && userId) {
      callLogNudgeIgnored({ data: { userId, nudgeType: nudge.type } }).catch(() => {});
    }
    setNudge(null);
  };

  const accept = (replyText?: string) => {
    if (nudge && userId) {
      callLogNudgeAccepted({
        data: { userId, nudgeType: nudge.type, nudgeText: replyText ?? nudge.text },
      }).catch(() => {});
    }
    setNudge(null);
  };

  return { nudge, dismiss, accept };
}
