/**
 * Proactive Server Function — returns the proactive nudge for this session load.
 * Called once per session on page open.
 */

import { createServerFn } from "@tanstack/react-start";
import { buildProactiveNudge } from "@/engine/proactive/initiative-engine";
import type { ProactiveNudge } from "@/types/companion";

export const getProactiveNudge = createServerFn({ method: "POST" })
  .inputValidator((input: { userId: string }) => input)
  .handler(async ({ data }): Promise<ProactiveNudge | null> => {
    try {
      return await buildProactiveNudge(data.userId);
    } catch {
      // Non-critical — never block the UI on proactive failure
      return null;
    }
  });
