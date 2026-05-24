/**
 * Companion types — core domain types for Rafiq's brain.
 * These flow through the entire engine stack.
 */

// ─── Persona ────────────────────────────────────────────────────────────────

export type Persona = "sage" | "coach" | "friend";

// ─── Response Modes ─────────────────────────────────────────────────────────

/**
 * How Rafiq chooses to respond in a given moment.
 * The mode is selected BEFORE the LLM call — it shapes the entire prompt.
 * This is what breaks template fatigue.
 */
export type ResponseMode =
  | "validate_reframe_act"   // Core: validate feeling → reframe → micro-action
  | "question_only"          // Just one sharp, curious question. No advice
  | "observation"            // "لاحظت إنك..." — surfacing a pattern they haven't seen
  | "reconnect"              // After absence: acknowledge the gap first, then engage
  | "celebrate"              // A win happened — warm, brief, forward-looking
  | "challenge"              // Coach mode: push back, don't coddle
  | "followup"               // Reference an unfinished action from last session
  | "silence_breaking";      // Rafiq initiates after prolonged inactivity

// ─── Rafiq Reply ─────────────────────────────────────────────────────────────

/**
 * The structured output of a companion response.
 * Not all fields are populated for every mode.
 */
export interface RafiqReply {
  id: string;
  mode: ResponseMode;
  /** Primary response text — always present */
  text: string;
  /** Secondary reframe/insight — present for validate_reframe_act */
  reframe?: string;
  /** Suggested micro-action button text — present when applicable */
  action?: string;
  /** Detected emotional tag for logging */
  emotionalTag?: string;
}

// ─── Session & User ──────────────────────────────────────────────────────────

export interface RafiqUser {
  id: string;
  preferredPersona: Persona;
  displayName?: string;
  createdAt: string;
  lastSeenAt: string;
}

export interface RafiqSession {
  id: string;
  userId: string;
  createdAt: string;
  messageCount: number;
}

// ─── Proactive System ────────────────────────────────────────────────────────

export type ProactiveTrigger =
  | "return_after_absence"   // > 48h since last session
  | "unfinished_action"      // Last action_done = false, session > 24h ago
  | "streak_momentum"        // 3+ actions completed in past week
  | "prolonged_stagnation"   // No sessions in 5+ days
  | "relapse_signal"         // Current time matches historical collapse_hour
  | "none";                  // No nudge needed

export interface ProactiveNudge {
  type: ProactiveTrigger;
  text: string;
  subtext?: string;
  action?: string;
}

// ─── Streak / Stats ──────────────────────────────────────────────────────────

export interface StreakStats {
  done: number;
  total: number;
  weeklyDone: number;
}
