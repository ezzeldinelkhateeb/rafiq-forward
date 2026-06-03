/**
 * Event Scores — Pure functions computing behavioral scores from events.
 * No DB calls here; receives events as input.
 */

import type { RafiqEvent, BehavioralScores } from "./event-types";
import { DEFAULT_SCORES } from "./event-types";

/**
 * Compute all 7 behavioral scores from a set of recent events.
 * All scores are clamped to 0–1 range.
 */
export function computeBehavioralScores(
  events: RafiqEvent[],
  options?: { interactionStats?: { done: number; total: number } }
): BehavioralScores {
  if (events.length === 0) return { ...DEFAULT_SCORES };

  const now = Date.now();
  const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;

  const recentEvents = events.filter(
    (e) => new Date(e.created_at ?? now).getTime() > sevenDaysAgo
  );

  return {
    momentumScore: computeMomentum(recentEvents, now),
    relapseProbability: computeRelapseProbability(recentEvents, now),
    sleepDebtScore: computeSleepDebt(recentEvents),
    emotionalVolatility: computeEmotionalVolatility(recentEvents, now),
    recoveryVelocity: computeRecoveryVelocity(recentEvents, now),
    behavioralConsistency: computeConsistency(recentEvents, now),
    trustScore: computeTrustScore(
      recentEvents,
      options?.interactionStats
    ),
  };
}

// ─── Individual Score Computations ─────────────────────────────────────────

/**
 * Momentum = habit completion velocity × recency.
 * Also counts focus sessions and accepted actions.
 * More completions in the last 7 days = higher momentum.
 */
function computeMomentum(events: RafiqEvent[], now: number): number {
  const completions = events.filter(
    (e) =>
      e.event_type === "habit_complete" ||
      e.event_type === "action_done" ||
      e.event_type === "action_accepted" ||
      e.event_type === "pomodoro_done" ||
      e.event_type === "focus_completed"
  );

  if (completions.length === 0) return 0;

  // Weight by recency: more recent = higher weight
  let weightedScore = 0;
  for (const c of completions) {
    const age = now - new Date(c.created_at ?? now).getTime();
    const daysAgo = age / (24 * 60 * 60 * 1000);
    const recencyWeight = Math.max(0.1, 1 - daysAgo / 7);
    weightedScore += recencyWeight;
  }

  // Normalize: 10+ weighted completions in a week = max momentum
  return clamp(weightedScore / 10);
}

/**
 * Relapse probability = gap patterns + late-night signals + avoidance + absence.
 * Higher score = more likely to relapse.
 */
function computeRelapseProbability(events: RafiqEvent[], now: number): number {
  let score = 0;

  // Late night sessions increase relapse risk
  const lateNightSessions = events.filter(
    (e) => e.event_type === "late_night_session"
  );
  score += lateNightSessions.length * 0.1;

  // Explicit relapse signals
  const relapseSignals = events.filter(
    (e) => e.event_type === "relapse_signal"
  );
  score += relapseSignals.length * 0.25;

  // Long absence is a strong relapse signal
  const longAbsences = events.filter((e) => e.event_type === "long_absence");
  score += longAbsences.length * 0.2;

  // Aborted focus sessions indicate inability to sustain effort
  const abortedFocus = events.filter((e) => e.event_type === "focus_aborted");
  score += abortedFocus.length * 0.1;

  // Skipped actions accumulate risk
  const skippedActions = events.filter((e) => e.event_type === "action_skipped");
  score += skippedActions.length * 0.12;

  // Missed sleep targets
  const sleepMisses = events.filter(
    (e) => e.event_type === "sleep_miss" || e.event_type === "sleep_target_missed"
  );
  score += sleepMisses.length * 0.08;

  // Message gaps: if there are long pauses between messages
  const messages = events
    .filter((e) => e.event_type === "message_sent")
    .sort(
      (a, b) =>
        new Date(a.created_at ?? now).getTime() -
        new Date(b.created_at ?? now).getTime()
    );

  if (messages.length >= 2) {
    for (let i = 1; i < messages.length; i++) {
      const gap =
        new Date(messages[i].created_at ?? now).getTime() -
        new Date(messages[i - 1].created_at ?? now).getTime();
      const gapHours = gap / (60 * 60 * 1000);
      // Gaps > 24h between messages suggest disengagement
      if (gapHours > 24) score += 0.1;
    }
  }

  return clamp(score);
}

/**
 * Sleep debt = cumulative sleep target misses (both old and new event names).
 * Each miss adds to the score. Met nights slowly reduce the debt.
 */
function computeSleepDebt(events: RafiqEvent[]): number {
  const misses = events.filter(
    (e) => e.event_type === "sleep_miss" || e.event_type === "sleep_target_missed"
  );
  const mets = events.filter((e) => e.event_type === "sleep_target_met");
  // Each miss adds 0.15, each met reduces by 0.05, capped at 1
  const raw = misses.length * 0.15 - mets.length * 0.05;
  return clamp(raw);
}

/**
 * Emotional volatility = variation in emotional states over recent period.
 * Uses message_sent events with emotionalTag payloads.
 */
function computeEmotionalVolatility(events: RafiqEvent[], now: number): number {
  const emotionalEvents = events
    .filter(
      (e) =>
        e.event_type === "message_sent" &&
        e.payload?.emotionalTag &&
        e.payload.emotionalTag !== "unknown"
    )
    .sort(
      (a, b) =>
        new Date(a.created_at ?? now).getTime() -
        new Date(b.created_at ?? now).getTime()
    );

  if (emotionalEvents.length < 2) return 0;

  // Count transitions between different emotional states
  let transitions = 0;
  for (let i = 1; i < emotionalEvents.length; i++) {
    if (emotionalEvents[i].payload?.emotionalTag !== emotionalEvents[i - 1].payload?.emotionalTag) {
      transitions++;
    }
  }

  // High transition rate = high volatility
  const transitionRate = transitions / (emotionalEvents.length - 1);
  return clamp(transitionRate);
}

/**
 * Recovery velocity = how quickly user bounces back from collapse to action.
 * Also counts focus_completed and return_after_absence as recovery signals.
 * Lower time = higher score.
 */
function computeRecoveryVelocity(events: RafiqEvent[], now: number): number {
  // Look for collapse patterns followed by positive actions
  const sorted = [...events].sort(
    (a, b) =>
      new Date(a.created_at ?? now).getTime() -
      new Date(b.created_at ?? now).getTime()
  );

  const recoveryTimes: number[] = [];
  let lastCollapseTime: number | null = null;

  for (const e of sorted) {
    if (
      e.event_type === "relapse_signal" ||
      e.event_type === "long_absence" ||
      (e.event_type === "message_sent" &&
        (e.payload?.behavioralState === "emotional_collapse" ||
          e.payload?.behavioralState === "stuck"))
    ) {
      lastCollapseTime = new Date(e.created_at ?? now).getTime();
    } else if (
      lastCollapseTime &&
      (e.event_type === "action_done" ||
        e.event_type === "action_accepted" ||
        e.event_type === "habit_complete" ||
        e.event_type === "focus_completed" ||
        e.event_type === "return_after_absence" ||
        (e.event_type === "message_sent" &&
          e.payload?.behavioralState === "productive_momentum"))
    ) {
      const recoveryMs = new Date(e.created_at ?? now).getTime() - lastCollapseTime;
      const recoveryHours = recoveryMs / (60 * 60 * 1000);
      recoveryTimes.push(recoveryHours);
      lastCollapseTime = null;
    }
  }

  if (recoveryTimes.length === 0) return 0;

  // Average recovery time in hours; faster = higher score
  const avgRecoveryHours =
    recoveryTimes.reduce((a, b) => a + b, 0) / recoveryTimes.length;
  // 0h = 1.0, 24h = 0.5, 72h+ = 0.1
  return clamp(1 - avgRecoveryHours / 72);
}

/**
 * Behavioral consistency = habit completion consistency across the week.
 * Even distribution = high score; bursty = low score.
 */
function computeConsistency(events: RafiqEvent[], now: number): number {
  const completions = events.filter(
    (e) => e.event_type === "habit_complete"
  );

  if (completions.length < 2) return completions.length > 0 ? 0.3 : 0;

  // Group completions by day
  const dayBuckets: Record<string, number> = {};
  for (const c of completions) {
    const day = new Date(c.created_at ?? now).toISOString().slice(0, 10);
    dayBuckets[day] = (dayBuckets[day] ?? 0) + 1;
  }

  const counts = Object.values(dayBuckets);
  const daysActive = counts.length;

  // More days active out of 7 = more consistent
  return clamp(daysActive / 7);
}

/**
 * Trust score = actions accepted (done) / total actions suggested.
 * Also counts focus completions as high-trust signals.
 */
function computeTrustScore(
  events: RafiqEvent[],
  stats?: { done: number; total: number }
): number {
  // Prefer direct stats if available
  if (stats && stats.total > 0) {
    return clamp(stats.done / stats.total);
  }

  // Fallback: compute from events
  const done = events.filter(
    (e) => e.event_type === "action_done" || e.event_type === "action_accepted"
  ).length;
  const ignored = events.filter((e) => e.event_type === "action_ignored").length;
  const skipped = events.filter((e) => e.event_type === "action_skipped").length;
  const total = done + ignored + skipped;

  if (total === 0) return 0;
  return clamp(done / total);
}

// ─── Utility ───────────────────────────────────────────────────────────────

function clamp(value: number, min = 0, max = 1): number {
  return Math.min(max, Math.max(min, value));
}
