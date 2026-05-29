/**
 * Journey Server Functions — aggregates user achievements (wins) chronologically
 * across habits, focus sessions, and completed plan steps.
 */

import { createServerFn } from "@tanstack/react-start";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export interface WinItem {
  id: string;
  type: "step" | "habit" | "focus";
  title: string;
  subtitle: string;
  completedAt: string;
  metadata?: {
    planId?: string;
    habitId?: string;
    durationMinutes?: number;
  };
}

export const fetchWinsTimeline = createServerFn({ method: "POST" })
  .inputValidator((input: { userId: string }) => input)
  .handler(async ({ data }): Promise<{ wins: WinItem[] }> => {
    const { userId } = data;

    // 1. Fetch completed plan steps (by first getting the user's plans)
    const { data: plans } = await supabaseAdmin
      .from("plans")
      .select("id, title")
      .eq("user_id", userId);

    let stepWins: WinItem[] = [];
    if (plans && plans.length > 0) {
      const planMap = new Map(plans.map((p) => [p.id, p.title]));
      const planIds = plans.map((p) => p.id);

      const { data: completedSteps } = await supabaseAdmin
        .from("plan_steps")
        .select("id, title, plan_id, completed_at")
        .eq("status", "completed")
        .in("plan_id", planIds);

      if (completedSteps) {
        stepWins = completedSteps.map((step) => ({
          id: step.id,
          type: "step" as const,
          title: step.title,
          subtitle: `من خطة: ${planMap.get(step.plan_id) || "خطة عامة"}`,
          completedAt: step.completed_at || new Date().toISOString(),
          metadata: { planId: step.plan_id },
        }));
      }
    }

    // 2. Fetch completed habits logs (joining with habits)
    const { data: habits } = await supabaseAdmin
      .from("habits")
      .select("id, name")
      .eq("user_id", userId);

    let habitWins: WinItem[] = [];
    if (habits && habits.length > 0) {
      const habitMap = new Map(habits.map((h) => [h.id, h.name]));
      const habitIds = habits.map((h) => h.id);

      const { data: logs } = await supabaseAdmin
        .from("habit_logs")
        .select("id, habit_id, completed_at")
        .in("habit_id", habitIds);

      if (logs) {
        habitWins = logs.map((log) => ({
          id: log.id,
          type: "habit" as const,
          title: `أنجزت عادة: ${habitMap.get(log.habit_id) || "عادة مفيدة"}`,
          subtitle: "إنجاز يومي البطل 💪",
          completedAt: log.completed_at || new Date().toISOString(),
          metadata: { habitId: log.habit_id },
        }));
      }
    }

    // 3. Fetch completed focus sessions
    const { data: focusSessions } = await supabaseAdmin
      .from("focus_sessions")
      .select("id, duration_minutes, focus_topic, completed_at")
      .eq("user_id", userId);

    let focusWins: WinItem[] = [];
    if (focusSessions) {
      focusWins = focusSessions.map((session) => ({
        id: session.id,
        type: "focus" as const,
        title: `جلسة تركيز: ${session.focus_topic || "جلسة عامة"}`,
        subtitle: `أنجزت ${session.duration_minutes} دقيقة تركيز بنجاح ⏱`,
        completedAt: session.completed_at || new Date().toISOString(),
        metadata: { durationMinutes: session.duration_minutes },
      }));
    }

    // 4. Merge all wins and sort by completedAt descending
    const allWins = [...stepWins, ...habitWins, ...focusWins].sort(
      (a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime()
    );

    return { wins: allWins };
  });
