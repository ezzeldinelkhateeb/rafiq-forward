/**
 * Proactive Server Functions — proactive nudge retrieval and interaction tracking.
 * Called once per session on page open.
 */

import { createServerFn } from "@tanstack/react-start";
import { buildProactiveNudge } from "@/engine/proactive/initiative-engine";
import { logEvent } from "@/engine/events/event-logger";
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

// ─── Nudge Interaction Logging ─────────────────────────────────────────────

/**
 * Called when user replies to a nudge (accepted it).
 * This is a strong trust signal — user engaged with Rafiq's initiative.
 */
export const logNudgeAccepted = createServerFn({ method: "POST" })
  .inputValidator((input: { userId: string; nudgeType: string; nudgeText?: string }) => input)
  .handler(async ({ data }) => {
    void logEvent(data.userId, "nudge_accepted", {
      nudgeType: data.nudgeType,
      nudgeText: data.nudgeText ?? "",
    });
    return { ok: true };
  });

/**
 * Called when user dismisses a nudge (ignored it).
 * Feeds into nudge timing optimization — if ignored frequently, back off.
 */
export const logNudgeIgnored = createServerFn({ method: "POST" })
  .inputValidator((input: { userId: string; nudgeType: string }) => input)
  .handler(async ({ data }) => {
    void logEvent(data.userId, "nudge_ignored", {
      nudgeType: data.nudgeType,
    });
    return { ok: true };
  });

