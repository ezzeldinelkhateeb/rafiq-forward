/**
 * Behavioral types — state machine and analysis types.
 */

// ─── User Behavioral State ───────────────────────────────────────────────

/**
 * The detected behavioral state of the user at this moment.
 * Determined by keyword analysis, time of day, history, and pattern data.
 * NOT sent to the LLM as a label — used to SELECT prompt strategy.
 */
export type UserBehaviorState =
  | "digital_escape"       // Currently in scroll/binge/avoidance mode
  | "productive_momentum"  // On a good streak, building
  | "emotional_collapse"   // Overwhelmed, anxious, drained
  | "rebuilding"           // Coming back after a collapse
  | "stuck"                // Stagnant — no movement for days
  | "present"              // Clear, engaged, not in distress
  | "unknown";             // Insufficient signals to determine

// ─── Behavioral Analysis Result ──────────────────────────────────────────

export interface BehavioralAnalysis {
  state: UserBehaviorState;
  confidence: number; // 0–1
  signals: string[]; // What evidence led to this state
  hourOfDay: number;
  isLateNight: boolean; // 23:00–04:00 local time
  isFirstMessageOfDay: boolean;
}

// ─── Session Context ─────────────────────────────────────────────────────

export interface SessionContext {
  userId: string;
  sessionId: string;
  persona: import("./companion").Persona;
  userMessage: string;
  behaviorState: UserBehaviorState;
  hoursSinceLastSession: number;
  lastActionDone: boolean;
  hasReturnedAfterAbsence: boolean; // > 48h gap
}
