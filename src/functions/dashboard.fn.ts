/**
 * Dashboard Server Functions — pulls aggregated behavioral insights
 * and emotional timelines to display on the client dashboard.
 * Supports updating personal settings like sleep target and rewards.
 */

import { createServerFn } from "@tanstack/react-start";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export interface DashboardData {
  identity: {
    goals: string[];
    struggles: string[];
    personality: string | null;
    sleep_target: string | null;
    small_pleasures: string[];
  } | null;
  latestSnapshot: string | null;
  patterns: Array<{
    pattern_type: string;
    description: string;
    occurrence_count: number;
    last_seen_at: string;
  }>;
  emotionalTimeline: Array<{
    emotional_state: string;
    created_at: string;
    source_text: string | null;
  }>;
}

// ─── Fetch Dashboard Data ──────────────────────────────────────────────────

export const fetchDashboardData = createServerFn({ method: "POST" })
  .inputValidator((input: { userId: string }) => input)
  .handler(async ({ data }): Promise<DashboardData> => {
    const { userId } = data;

    const [identityResult, snapshotResult, patternsResult, emotionalResult] =
      await Promise.allSettled([
        supabaseAdmin
          .from("identity_memory")
          .select("goals, struggles, personality, sleep_target, small_pleasures")
          .eq("user_id", userId)
          .single(),
        supabaseAdmin
          .from("memory_snapshots")
          .select("content")
          .eq("user_id", userId)
          .eq("snapshot_type", "relationship")
          .order("created_at", { ascending: false })
          .limit(1)
          .single(),
        supabaseAdmin
          .from("behavioral_patterns")
          .select("pattern_type, description, occurrence_count, last_seen_at")
          .eq("user_id", userId)
          .order("last_seen_at", { ascending: false })
          .limit(3),
        supabaseAdmin
          .from("emotional_timeline")
          .select("emotional_state, created_at, source_text")
          .eq("user_id", userId)
          .order("created_at", { ascending: false })
          .limit(8),
      ]);

    const identity =
      identityResult.status === "fulfilled" && identityResult.value.data
        ? {
            goals: identityResult.value.data.goals || [],
            struggles: identityResult.value.data.struggles || [],
            personality: identityResult.value.data.personality || null,
            sleep_target: identityResult.value.data.sleep_target || null,
            small_pleasures: identityResult.value.data.small_pleasures || [],
          }
        : null;

    const latestSnapshot =
      snapshotResult.status === "fulfilled" && snapshotResult.value.data
        ? snapshotResult.value.data.content
        : null;

    const patterns =
      patternsResult.status === "fulfilled" && patternsResult.value.data
        ? patternsResult.value.data
        : [];

    const emotionalTimeline =
      emotionalResult.status === "fulfilled" && emotionalResult.value.data
        ? emotionalResult.value.data
        : [];

    return {
      identity,
      latestSnapshot,
      patterns,
      emotionalTimeline,
    };
  });

// ─── Update Sleep Target & Small Pleasures ───────────────────────────────

export const updateDashboardConfig = createServerFn({ method: "POST" })
  .inputValidator(
    (input: {
      userId: string;
      sleepTarget: string | null;
      smallPleasures: string[];
    }) => input
  )
  .handler(async ({ data }) => {
    const { userId, sleepTarget, smallPleasures } = data;

    const { error } = await supabaseAdmin
      .from("identity_memory")
      .upsert({
        user_id: userId,
        sleep_target: sleepTarget,
        small_pleasures: smallPleasures,
        updated_at: new Date().toISOString(),
      });

    if (error) throw new Error(error.message);
    return { success: true };
  });
