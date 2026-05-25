/**
 * AI Configuration — single source of truth for all model references.
 * To switch models: change PRIMARY_MODEL here. Nothing else needs touching.
 *
 * Current model: gemini-3.5-flash (latest stable as of May 2026)
 * SDK: @google/genai (official Google GenAI JS SDK)
 * Docs: https://ai.google.dev/gemini-api/docs/quickstart
 */

export const AI_CONFIG = {
  /**
   * Primary model for all Rafiq companion responses.
   * gemini-3.5-flash: fast, cost-effective, excellent for Arabic conversation.
   */
  PRIMARY_MODEL: "gemini-3.5-flash",

  /**
   * Model for lightweight classification tasks (emotional state, pattern tags).
   * Same model — small prompts stay cheap. Swap to a local model in Phase 3.
   */
  CLASSIFIER_MODEL: "gemini-3.5-flash",

  /**
   * Model for generating narrative memory snapshots.
   * These run infrequently (weekly) and need higher coherence.
   */
  NARRATIVE_MODEL: "gemini-3.5-flash",

  /**
   * Temperature settings per use case.
   * Lower = more consistent/reliable. Higher = more human/varied.
   */
  TEMPERATURE: {
    /** Main companion response — varied but grounded */
    COMPANION: 0.85,
    /** Proactive nudges — warm but predictable */
    PROACTIVE: 0.75,
    /** Emotional classification — deterministic */
    CLASSIFY: 0.2,
    /** Narrative memory generation — coherent storytelling */
    NARRATIVE: 0.6,
  },

  /**
   * Max output tokens per use case.
   */
  MAX_TOKENS: {
    /** Companion reply — kept short by design ("Minimum Words") */
    COMPANION: 1500,
    /** Proactive nudge — very short */
    PROACTIVE: 120,
    /** Classification — just a label */
    CLASSIFY: 50,
    /** Narrative snapshot — a paragraph or two */
    NARRATIVE: 600,
  },

  /**
   * Mode-specific temperature settings for all 18 response strategies.
   * Higher = more creative/varried (e.g. stories). Lower = more consistent (e.g. silence, followups).
   */
  COMPANION_TEMPERATURES: {
    validate_reframe_act: 0.8,
    question_only: 0.85,
    observation: 0.8,
    reconnect: 0.75,
    celebrate: 0.8,
    challenge: 0.85,
    followup: 0.7,
    silence_breaking: 0.75,
    playful_observation: 0.95,
    deep_reflection: 0.7,
    interruption_pattern: 0.85,
    late_night_softness: 0.6,
    momentum_push: 0.85,
    relapse_detection: 0.7,
    emotional_mirroring: 0.75,
    micro_story: 1.0,
    tough_love: 0.9,
    quiet_presence: 0.5,
  } as Record<import("@/types/companion").ResponseMode, number>,

  /**
   * Google AI Studio REST endpoint (used as fallback or for direct calls).
   * The @google/genai SDK handles this internally; kept here for reference.
   */
  API_BASE: "https://generativelanguage.googleapis.com/v1beta",
} as const;

export type AIModel = typeof AI_CONFIG.PRIMARY_MODEL;
