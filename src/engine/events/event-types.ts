/**
 * Event Types — Unified event system for behavioral tracking.
 *
 * Every significant user action emits an event. Events feed into
 * the behavioral score computation engine (event-scores.ts).
 */

// ─── Event Type Enum ───────────────────────────────────────────────────────

export type RafiqEventType =
  | "message_sent"          // User sent a chat message
  | "action_done"           // User confirmed an action as done (legacy — keep for compat)
  | "action_accepted"       // User tapped the action button (confirmed)
  | "action_ignored"        // Action suggested but never completed (after timeout)
  | "action_skipped"        // User explicitly skipped the action ("مش قادر")
  | "habit_complete"        // Habit marked as done
  | "habit_missed"          // Habit not completed for a day (detected at session start)
  | "focus_started"         // Focus/Pomodoro session started
  | "focus_completed"       // Focus/Pomodoro session completed successfully
  | "focus_aborted"         // Focus/Pomodoro session started but abandoned
  | "pomodoro_done"         // Focus/Pomodoro session completed (legacy alias)
  | "sleep_target_met"      // User active before or at sleep target
  | "sleep_target_missed"   // User active past sleep target
  | "sleep_miss"            // User active past sleep target (legacy alias)
  | "late_night_session"    // Session started after 23:00
  | "long_absence"          // User was absent > 72h before this session
  | "return_after_absence"  // User returned after > 48h absence
  | "session_start"         // New session opened
  | "nudge_accepted"        // User replied to a proactive nudge
  | "nudge_ignored"         // User dismissed a proactive nudge
  | "relapse_signal"        // Behavioral state machine detected relapse
  | "celebrate"             // Celebration event (action completion flow)
  | "persona_change"        // User switched persona
  | "plan_created";         // User created a plan from an action

// ─── Event Payload ─────────────────────────────────────────────────────────

export interface RafiqEvent {
  id?: string;
  user_id: string;
  event_type: RafiqEventType;
  payload: Record<string, unknown>;
  created_at?: string;
}

// ─── Event Payload Types ───────────────────────────────────────────────────

export interface MessageSentPayload {
  sessionId: string;
  messageLength: number;
  behavioralState: string;
  emotionalTag?: string;
  responseMode: string;
}

export interface ActionDonePayload {
  interactionId: string;
  actionText: string;
  daysSinceSuggested?: number;
}

export interface HabitCompletePayload {
  habitId: string;
  habitName: string;
  streak: number;
}

export interface PomodoroDonePayload {
  durationMinutes: number;
  focusTopic?: string;
}

export interface FocusSessionPayload {
  durationMinutes: number;
  focusTopic?: string;
  /** For aborted sessions: how many minutes completed before abort */
  minutesCompleted?: number;
}

export interface SleepMissPayload {
  sleepTarget: string;
  actualHour: number;
}

export interface SleepCheckPayload {
  sleepTarget: string;    // e.g. "23:00"
  currentHour: number;
  currentMinute: number;
  debtDays: number;       // how many consecutive nights missed
}

export interface NudgePayload {
  nudgeType: string;
  nudgeText: string;
}

export interface AbsencePayload {
  hoursSinceLastSession: number;
  daysSinceLastSession: number;
}

// ─── Behavioral Scores ─────────────────────────────────────────────────────

export interface BehavioralScores {
  /** 0–1: habit completion velocity × recency */
  momentumScore: number;
  /** 0–1: probability of relapse based on gap patterns + avoidance */
  relapseProbability: number;
  /** 0–1: cumulative sleep target misses */
  sleepDebtScore: number;
  /** 0–1: emotional state standard deviation over recent period */
  emotionalVolatility: number;
  /** 0–1: time between collapse and first positive action */
  recoveryVelocity: number;
  /** 0–1: habit completion consistency across week */
  behavioralConsistency: number;
  /** 0–1: actions accepted / actions suggested ratio */
  trustScore: number;
}

export const DEFAULT_SCORES: BehavioralScores = {
  momentumScore: 0,
  relapseProbability: 0,
  sleepDebtScore: 0,
  emotionalVolatility: 0,
  recoveryVelocity: 0,
  behavioralConsistency: 0,
  trustScore: 0,
};
