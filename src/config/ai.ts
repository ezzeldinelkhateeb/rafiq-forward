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
    COMPANION: 300,
    /** Proactive nudge — very short */
    PROACTIVE: 120,
    /** Classification — just a label */
    CLASSIFY: 50,
    /** Narrative snapshot — a paragraph or two */
    NARRATIVE: 600,
  },

  /**
   * Google AI Studio REST endpoint (used as fallback or for direct calls).
   * The @google/genai SDK handles this internally; kept here for reference.
   */
  API_BASE: "https://generativelanguage.googleapis.com/v1beta",
} as const;

export type AIModel = typeof AI_CONFIG.PRIMARY_MODEL;
