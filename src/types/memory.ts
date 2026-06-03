/**
 * Memory types — the 5-layer memory architecture.
 */

import type { BehavioralScores } from "@/engine/events/event-types";

// ─── Layer 1: Identity Memory ─────────────────────────────────────────────

export interface IdentityMemory {
  userId: string;
  goals: string[];
  struggles: string[];
  personality?: string;
  preferredTone: "direct" | "warm" | "philosophical";
  triggerWords: string[];
  onboardingDone: boolean;
  updatedAt: string;
}

// ─── Layer 2: Behavioral Pattern ─────────────────────────────────────────

export type BehavioralPatternType =
  | "doomscroll"       // Repeated digital escape mentions
  | "collapse_hour"    // Consistently messages late at night in distress
  | "focus_window"     // Consistently productive at certain times
  | "avoidance"        // Repeatedly avoids completing actions
  | "relapse_cycle";   // Good streak → disappears → returns struggling

export interface BehavioralPattern {
  id: string;
  userId: string;
  patternType: BehavioralPatternType;
  description: string;
  confidence: number; // 0–1
  firstSeenAt: string;
  lastSeenAt: string;
  occurrenceCount: number;
}

// ─── Layer 3: Emotional Timeline Entry ───────────────────────────────────

export type EmotionalState =
  | "drained"
  | "scattered"
  | "motivated"
  | "anxious"
  | "rebuilding"
  | "numb"
  | "present"
  | "unknown";

export interface EmotionalTimelineEntry {
  id: string;
  userId: string;
  sessionId?: string;
  emotionalState: EmotionalState;
  intensity: number; // 1–10
  sourceText?: string;
  createdAt: string;
}

// ─── Layer 4: Memory Snapshot (Narrative) ────────────────────────────────

export type SnapshotType = "relationship" | "weekly" | "emotional_arc";

export interface MemorySnapshot {
  id: string;
  userId: string;
  snapshotType: SnapshotType;
  /** The actual narrative — written by Rafiq, for Rafiq to read later.
   *  Format: 2–3 Arabic paragraph summary of the relationship/period.
   *  "Rafiq remembers stories, not just states." */
  content: string;
  coversFrom: string;
  coversTo: string;
  createdAt: string;
}

// ─── Assembled Memory (what the Orchestrator sees) ───────────────────────

/**
 * The fully assembled memory context that the Prompt Builder receives.
 * This is the single input to prompt construction — never raw DB rows.
 */
export interface AssembledMemory {
  /** Narrative summary of who this user is */
  identityNarrative: string;
  /** Last 4–6 interactions compressed to key signals */
  recentHistoryNarrative: string;
  /** Relationship memory — "we" story: what happened, what was promised */
  relationshipNarrative: string;
  /** Detected behavioral patterns as a human-readable description */
  patternsNarrative: string;
  /** Detected emotional state of THIS message */
  currentEmotionalSignal: EmotionalState;
  /** Time since last session (for reconnect logic) */
  hoursSinceLastSession: number;
  /** Last action and whether it was completed */
  lastAction?: { text: string; done: boolean; daysAgo: number };
  /** Raw user count data for streak display */
  streakStats: { done: number; total: number };
  /** Recent emotional history array for trend analysis */
  recentEmotions: EmotionalState[];
  /** Recent response modes history to avoid repetition */
  recentModes: import("./companion").ResponseMode[];
  /** The user's sleep target (e.g. "11:00 PM") */
  sleepTarget?: string | null;
  /** List of favorite rewards */
  smallPleasures?: string[];
  /** Recent Rafiq response texts for anti-AI-smell detection */
  recentRafiqTexts?: string[];
  /** Behavioral scores computed from events (Phase 2) */
  behavioralScores?: BehavioralScores;
  /** Open loops / promises / avoidances currently pending */
  openLoops?: string[];
  /** User's real name from onboarding — used to address them personally */
  userName?: string | null;
  /**
   * Identity evolution level — computed from total completed actions:
   * 0 = no signal yet (< 3 done)
   * 1 = emerging identity (3–9 done)
   * 2 = established identity (10–19 done)
   * 3 = transformed identity (20+ done)
   */
  identityLevel?: 0 | 1 | 2 | 3;
}
