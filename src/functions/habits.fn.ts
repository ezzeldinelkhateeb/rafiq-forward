/**
 * Habits and Focus Server Functions — handles habit creation, tracking,
 * logs, and Pomodoro focus session logging.
 */

import { createServerFn } from "@tanstack/react-start";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export interface HabitData {
  id: string;
  name: string;
  description: string | null;
  frequency: string;
  current_streak: number;
  max_streak: number;
  last_completed_at: string | null;
}

export interface HabitLogData {
  habit_id: string;
  completed_at: string;
}

export interface FocusSessionData {
  id: string;
  duration_minutes: number;
  completed_at: string;
  focus_topic: string | null;
}

// ─── Fetch Habits and Focus Data ──────────────────────────────────────────

export const getHabitsAndFocusData = createServerFn({ method: "POST" })
  .inputValidator((input: { userId: string }) => input)
  .handler(async ({ data }) => {
    const { userId } = data;

    const [habitsResult, logsResult, focusResult] = await Promise.allSettled([
      supabaseAdmin
        .from("habits")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: true }),
      supabaseAdmin
        .from("habit_logs")
        .select("habit_id, completed_at")
        .eq("user_id", userId)
        .order("completed_at", { ascending: false }),
      supabaseAdmin
        .from("focus_sessions")
        .select("*")
        .eq("user_id", userId)
        .order("completed_at", { ascending: false })
        .limit(10),
    ]);

    const habits =
      habitsResult.status === "fulfilled" && habitsResult.value.data
        ? (habitsResult.value.data as HabitData[])
        : [];

    const habitLogs =
      logsResult.status === "fulfilled" && logsResult.value.data
        ? (logsResult.value.data as HabitLogData[])
        : [];

    const focusSessions =
      focusResult.status === "fulfilled" && focusResult.value.data
        ? (focusResult.value.data as FocusSessionData[])
        : [];

    return { habits, habitLogs, focusSessions };
  });

// ─── Add Habit ─────────────────────────────────────────────────────────────

export const addHabit = createServerFn({ method: "POST" })
  .inputValidator(
    (input: { userId: string; name: string; description?: string }) => input
  )
  .handler(async ({ data }) => {
    const { userId, name, description = "" } = data;
    const { data: newHabit, error } = await supabaseAdmin
      .from("habits")
      .insert({
        user_id: userId,
        name,
        description,
        frequency: "daily",
      })
      .select("*")
      .single();

    if (error) throw new Error(error.message);
    return newHabit as HabitData;
  });

// ─── Delete Habit ──────────────────────────────────────────────────────────

export const deleteHabit = createServerFn({ method: "POST" })
  .inputValidator((input: { habitId: string; userId: string }) => input)
  .handler(async ({ data }) => {
    const { error } = await supabaseAdmin
      .from("habits")
      .delete()
      .eq("id", data.habitId)
      .eq("user_id", data.userId);

    if (error) throw new Error(error.message);
    return { success: true };
  });

// ─── Log Habit Completion ──────────────────────────────────────────────────

export const logHabitCompletion = createServerFn({ method: "POST" })
  .inputValidator((input: { habitId: string; userId: string }) => input)
  .handler(async ({ data }) => {
    const { habitId, userId } = data;

    // Fetch habit details to update streak
    const { data: habit, error: fetchErr } = await supabaseAdmin
      .from("habits")
      .select("*")
      .eq("id", habitId)
      .single();

    if (fetchErr || !habit) throw new Error("Habit not found");

    const now = new Date();
    const todayStr = now.toDateString();

    let newStreak = habit.current_streak || 0;
    const lastCompleted = habit.last_completed_at
      ? new Date(habit.last_completed_at)
      : null;

    if (lastCompleted) {
      if (lastCompleted.toDateString() === todayStr) {
        // Already completed today
        return { success: true, habit };
      }
      
      const yesterday = new Date();
      yesterday.setDate(now.getDate() - 1);
      
      if (lastCompleted.toDateString() === yesterday.toDateString()) {
        newStreak += 1;
      } else {
        newStreak = 1;
      }
    } else {
      newStreak = 1;
    }

    const maxStreak = Math.max(habit.max_streak || 0, newStreak);

    // Update habit and insert log
    const [, logResult] = await Promise.all([
      supabaseAdmin
        .from("habits")
        .update({
          current_streak: newStreak,
          max_streak: maxStreak,
          last_completed_at: now.toISOString(),
        })
        .eq("id", habitId),
      supabaseAdmin
        .from("habit_logs")
        .insert({
          habit_id: habitId,
          user_id: userId,
          completed_at: now.toISOString(),
        })
        .select("*")
        .single(),
    ]);

    if (logResult.error) throw new Error(logResult.error.message);

    // Log to emotional timeline as motivated (non-blocking)
    supabaseAdmin
      .from("emotional_timeline")
      .insert({
        user_id: userId,
        emotional_state: "motivated",
        intensity: 8,
        source_text: `[أنجز عادة: ${habit.name}]`,
      })
      .then(() => {})
      .catch(() => {});

    return { success: true, current_streak: newStreak };
  });

// ─── Log Focus Session ─────────────────────────────────────────────────────

export const logFocusSession = createServerFn({ method: "POST" })
  .inputValidator(
    (input: { userId: string; durationMinutes: number; focusTopic?: string }) => input
  )
  .handler(async ({ data }) => {
    const { userId, durationMinutes, focusTopic = "" } = data;

    const { data: session, error } = await supabaseAdmin
      .from("focus_sessions")
      .insert({
        user_id: userId,
        duration_minutes: durationMinutes,
        focus_topic: focusTopic,
      })
      .select("*")
      .single();

    if (error) throw new Error(error.message);

    // Log positive mood swing to timeline
    supabaseAdmin
      .from("emotional_timeline")
      .insert({
        user_id: userId,
        emotional_state: "motivated",
        intensity: 9,
        source_text: `[جلسة تركيز ${durationMinutes} دقيقة: ${focusTopic}]`,
      })
      .then(() => {})
      .catch(() => {});

    return session;
  });
