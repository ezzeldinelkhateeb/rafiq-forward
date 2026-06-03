/**
 * Session Start Events — behavioral checks fired on every session open.
 *
 * Detects and logs:
 * 1. Sleep target violations (did user stay up past their target?)
 * 2. Absence patterns (how long since last session?)
 *
 * Called from session.fn.ts during resolveSession.
 * All writes are fire-and-forget, non-blocking.
 */

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { logEvent } from "@/engine/events/event-logger";

// ─── Main Session Start Check ──────────────────────────────────────────────

export async function runSessionStartEvents(userId: string): Promise<void> {
  try {
    const [sleepCheckDone, absenceCheckDone] = await Promise.allSettled([
      checkSleepTarget(userId),
      checkAbsence(userId),
    ]);

    if (sleepCheckDone.status === "rejected") {
      console.warn("[session-start] Sleep check failed:", sleepCheckDone.reason);
    }
    if (absenceCheckDone.status === "rejected") {
      console.warn("[session-start] Absence check failed:", absenceCheckDone.reason);
    }
  } catch (e) {
    // Never block session start on event logging failure
    console.warn("[session-start] Event check failed silently:", e);
  }
}

// ─── Sleep Target Check ────────────────────────────────────────────────────

/**
 * Checks if the user opened the app past their sleep target time.
 * If they have a sleep target configured (e.g. "23:00"), and the current
 * hour is past it, logs a sleep_target_missed event.
 * Otherwise logs sleep_target_met to gradually reduce sleep debt score.
 */
async function checkSleepTarget(userId: string): Promise<void> {
  // Fetch identity memory for sleep target
  const { data: identity } = await supabaseAdmin
    .from("identity_memory")
    .select("sleep_target")
    .eq("user_id", userId)
    .single();

  if (!identity?.sleep_target) return; // No target configured → skip

  const sleepTarget = identity.sleep_target as string; // e.g. "23:00"
  const [targetHourStr, targetMinStr] = sleepTarget.split(":");
  const targetHour = parseInt(targetHourStr ?? "23", 10);
  const targetMin = parseInt(targetMinStr ?? "0", 10);

  const now = new Date();
  const currentHour = now.getHours();
  const currentMin = now.getMinutes();

  // Only meaningful to check during late-night hours (21:00 - 05:00)
  const isLateWindow = currentHour >= 21 || currentHour <= 5;
  if (!isLateWindow) return;

  // Check if past target
  const isPastTarget =
    currentHour > targetHour ||
    (currentHour === targetHour && currentMin > targetMin);

  // Fetch recent sleep events to calculate debt days
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const { data: recentSleepEvents } = await (supabaseAdmin
    .from("events" as any)
    .select("event_type, created_at")
    .eq("user_id", userId)
    .in("event_type", ["sleep_target_missed", "sleep_miss"])
    .gte("created_at", weekAgo) as any);

  const debtDays = (recentSleepEvents ?? []).length;

  if (isPastTarget) {
    void logEvent(userId, "sleep_target_missed", {
      sleepTarget,
      currentHour,
      currentMinute: currentMin,
      debtDays,
    });

    // Also emit legacy sleep_miss for backward compat with old score logic
    void logEvent(userId, "sleep_miss", {
      sleepTarget,
      actualHour: currentHour,
    });
  } else {
    // They're up at a reasonable hour — slight debt reduction
    void logEvent(userId, "sleep_target_met", {
      sleepTarget,
      currentHour,
      currentMinute: currentMin,
      debtDays,
    });
  }
}

// ─── Absence Check ─────────────────────────────────────────────────────────

/**
 * Checks how long it's been since the user's last session.
 * Logs return_after_absence or long_absence accordingly.
 *
 * Thresholds:
 * - > 48h: return_after_absence (moderate — Rafiq warms up gently)
 * - > 72h: long_absence (strong signal — behavioral risk increases)
 */
async function checkAbsence(userId: string): Promise<void> {
  // Get last interaction before now
  const { data: lastInteraction } = await supabaseAdmin
    .from("interactions")
    .select("created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (!lastInteraction) return; // First session ever → no absence

  const lastAt = new Date(lastInteraction.created_at);
  const now = new Date();
  const hoursSince = (now.getTime() - lastAt.getTime()) / (1000 * 60 * 60);
  const daysSince = Math.floor(hoursSince / 24);

  if (hoursSince < 48) return; // Less than 2 days → no absence event

  const payload = {
    hoursSinceLastSession: Math.round(hoursSince),
    daysSinceLastSession: daysSince,
  };

  if (hoursSince >= 72) {
    // Long absence — strong behavioral risk signal
    void logEvent(userId, "long_absence", payload);
  }

  // Always log return_after_absence for > 48h (also for > 72h)
  void logEvent(userId, "return_after_absence", payload);
}
