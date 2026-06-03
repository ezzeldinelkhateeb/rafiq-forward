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
  | "silence_breaking"       // Rafiq initiates after prolonged inactivity
  | "playful_observation"    // Witty Egyptian teasing about a habit
  | "deep_reflection"        // Quiet, philosophical validation
  | "interruption_pattern"   // Interrupting a negative doom loop immediately
  | "late_night_softness"    // Gentle, low-energy support for late hours
  | "momentum_push"          // Encouraging push to keep going
  | "relapse_detection"      // Noticing signs of slipping back
  | "emotional_mirroring"    // Reflecting back their current state to show empathy
  | "micro_story"            // Sharing a 1-sentence Egyptian analogy/story
  | "tough_love"             // Direct, warm, but firm pushback
  | "quiet_presence";        // Ultra-short comforting silence (just validation, no advice)

// ─── Rafiq Reply ─────────────────────────────────────────────────────────────

/**
 * The structured output of a companion response.
 * Not all fields are populated for every mode.
 */
export interface RafiqReply {
  id: string;
  mode: ResponseMode | string;
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
  | "relapse_signal"         // Signs of slipping back/relapsing
  | "late_night_awareness"   // Messaging late at night (slowing down/slowing)
  | "none";                  // No nudge needed

export interface ProactiveNudge {
  type: ProactiveTrigger;
  text: string;
  subtext?: string;
  action?: string;
  interruptionConfidence?: number;
}

// ─── Streak / Stats ──────────────────────────────────────────────────────────

export interface StreakStats {
  done: number;
  total: number;
  weeklyDone: number;
}
