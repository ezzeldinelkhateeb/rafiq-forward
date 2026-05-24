/**
 * Action Server Functions — action confirmation and streak stats.
 */

import { createServerFn } from "@tanstack/react-start";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { StreakStats } from "@/types/companion";

// ─── Confirm Action Done ────────────────────────────────────────────────────

export const confirmActionDone = createServerFn({ method: "POST" })
  .inputValidator(
    (input: { interactionId: string; userId: string }) => input
  )
  .handler(async ({ data }) => {
    const { error } = await supabaseAdmin
      .from("interactions")
      .update({
        action_done: true,
        action_done_at: new Date().toISOString(),
      })
      .eq("id", data.interactionId)
      .eq("user_id", data.userId);

    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ─── Get Streak Stats ───────────────────────────────────────────────────────

export const getStreakStats = createServerFn({ method: "POST" })
  .inputValidator((input: { userId: string }) => input)
  .handler(async ({ data }): Promise<StreakStats> => {
    const weekAgo = new Date(
      Date.now() - 7 * 24 * 60 * 60 * 1000
    ).toISOString();

    const [doneResult, totalResult, weeklyResult] = await Promise.all([
      supabaseAdmin
        .from("interactions")
        .select("id", { count: "exact", head: true })
        .eq("user_id", data.userId)
        .eq("action_done", true),
      supabaseAdmin
        .from("interactions")
        .select("id", { count: "exact", head: true })
        .eq("user_id", data.userId),
      supabaseAdmin
        .from("interactions")
        .select("id", { count: "exact", head: true })
        .eq("user_id", data.userId)
        .eq("action_done", true)
        .gte("created_at", weekAgo),
    ]);

    return {
      done: doneResult.count ?? 0,
      total: totalResult.count ?? 0,
      weeklyDone: weeklyResult.count ?? 0,
    };
  });
