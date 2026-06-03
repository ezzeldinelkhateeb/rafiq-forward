/**
 * Onboarding Server Functions — saves the 5-question behavioral onboarding
 * answers to Supabase.
 *
 * Saves:
 * - display_name → users table (user's real first name)
 * - goals, struggles, sleep_target, small_pleasures, onboarding_done → identity_memory table
 */

import { createServerFn } from "@tanstack/react-start";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

// ─── Types ─────────────────────────────────────────────────────────────────

export interface OnboardingData {
  userId: string;
  name: string;          // Question 1 — user's name
  blocker: string;       // Question 2 — main distraction/struggle
  goal: string;          // Question 3 — main goal they haven't started
  sleepTime: string;     // Question 4 — when they sleep
  smallPleasure: string; // Question 5 — favorite small reward
}

// ─── Save Onboarding Data ──────────────────────────────────────────────────

export const saveOnboardingData = createServerFn({ method: "POST" })
  .inputValidator((input: OnboardingData) => input)
  .handler(async ({ data }): Promise<{ ok: boolean }> => {
    const { userId, name, blocker, goal, sleepTime, smallPleasure } = data;

    // Run both writes in parallel
    await Promise.allSettled([
      // 1. Update display_name in users table
      supabaseAdmin
        .from("users")
        .update({ display_name: name.trim() })
        .eq("id", userId),

      // 2. Upsert identity_memory with onboarding answers
      supabaseAdmin
        .from("identity_memory")
        .upsert(
          {
            user_id: userId,
            goals: [goal.trim()],
            struggles: [blocker.trim()],
            sleep_target: sleepTime.trim(),
            small_pleasures: [smallPleasure.trim()],
            onboarding_done: true,
            updated_at: new Date().toISOString(),
          },
          {
            onConflict: "user_id",
            ignoreDuplicates: false,
          }
        ),
    ]);

    return { ok: true };
  });

// ─── Check Onboarding Status ───────────────────────────────────────────────

export const checkOnboardingDone = createServerFn({ method: "POST" })
  .inputValidator((input: { userId: string }) => input)
  .handler(async ({ data }): Promise<{ done: boolean }> => {
    const { userId } = data;

    const { data: identity } = await supabaseAdmin
      .from("identity_memory")
      .select("onboarding_done, goals")
      .eq("user_id", userId)
      .single();

    // Done if explicitly marked OR if goals exist (backward compat)
    const done = !!(identity?.onboarding_done || (identity?.goals && identity.goals.length > 0));

    return { done };
  });
