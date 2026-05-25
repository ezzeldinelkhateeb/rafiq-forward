/**
 * Dashboard Server Functions — pulls aggregated behavioral insights
 * and emotional timelines to display on the client dashboard.
 */

import { createServerFn } from "@tanstack/react-start";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export interface DashboardData {
  identity: {
    goals: string[];
    struggles: string[];
    personality: string | null;
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

export const fetchDashboardData = createServerFn({ method: "POST" })
  .inputValidator((input: { userId: string }) => input)
  .handler(async ({ data }): Promise<DashboardData> => {
    const { userId } = data;

    const [identityResult, snapshotResult, patternsResult, emotionalResult] =
      await Promise.allSettled([
        supabaseAdmin
          .from("identity_memory")
          .select("goals, struggles, personality")
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
