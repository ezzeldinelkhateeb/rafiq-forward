/**
 * Response Strategy Selector — the core of response diversity.
 *
 * This is what breaks template fatigue.
 * Selects HOW Rafiq responds BEFORE the LLM is called.
 * The LLM gets different instructions depending on the selected mode.
 */

import type { ResponseMode } from "@/types/companion";
import type { UserBehaviorState } from "@/types/behavioral";
import type { Persona } from "@/types/companion";

export interface StrategyInput {
  behaviorState: UserBehaviorState;
  persona: Persona;
  hoursSinceLastSession: number;
  hasUnfinishedAction: boolean;
  lastActionDone: boolean;
  recentMessageCount: number; // in this session so far
  userMessageLength: number; // character count
  consecutiveAdviceCount: number; // how many validate_reframe_act in a row
  hasRelationshipMemory: boolean;
}

/**
 * Selects the response mode for this turn.
 *
 * Priority order:
 * 1. Return after long absence → reconnect
 * 2. Unfinished action from last session → followup
 * 3. Very short/vague message → question_only
 * 4. Advice fatigue (3+ in a row) → rotate to observation/question
 * 5. Win just happened → celebrate
 * 6. Coach + collapse → challenge
 * 7. Default → validate_reframe_act
 */
export function selectResponseMode(input: StrategyInput): ResponseMode {
  const {
    behaviorState,
    persona,
    hoursSinceLastSession,
    hasUnfinishedAction,
    lastActionDone,
    recentMessageCount,
    userMessageLength,
    consecutiveAdviceCount,
    hasRelationshipMemory,
  } = input;

  // ── Priority 1: Reconnect after long absence ─────────────────────────
  if (hoursSinceLastSession > 48 && recentMessageCount === 0) {
    return "reconnect";
  }

  // ── Priority 2: Follow up on unfinished action ───────────────────────
  if (hasUnfinishedAction && recentMessageCount === 0) {
    return "followup";
  }

  // ── Priority 3: Prolonged silence-breaking ───────────────────────────
  if (hoursSinceLastSession > 120 && recentMessageCount === 0) {
    return "silence_breaking";
  }

  // ── Priority 4: Very short/vague message → just ask ─────────────────
  // "مش كويس" or "لأ" — not enough to work with, ask first
  if (userMessageLength < 15 && recentMessageCount < 2) {
    return "question_only";
  }

  // ── Priority 5: Just completed an action → celebrate ────────────────
  if (lastActionDone && recentMessageCount === 0) {
    return "celebrate";
  }

  // ── Priority 6: Advice fatigue rotation ─────────────────────────────
  if (consecutiveAdviceCount >= 3) {
    // Rotate: observation → question → observation → ...
    return consecutiveAdviceCount % 2 === 0 ? "observation" : "question_only";
  }

  // ── Priority 7: Coach persona + rebuilding/collapse → challenge ──────
  if (
    persona === "coach" &&
    (behaviorState === "rebuilding" || behaviorState === "productive_momentum")
  ) {
    return "challenge";
  }

  // ── Priority 8: Pattern observation (sage prefers this) ─────────────
  if (
    persona === "sage" &&
    hasRelationshipMemory &&
    recentMessageCount >= 2 &&
    consecutiveAdviceCount >= 2
  ) {
    return "observation";
  }

  // ── Default ──────────────────────────────────────────────────────────
  return "validate_reframe_act";
}

/**
 * Human-readable description of mode — used in debug/logging only.
 */
export const MODE_DESCRIPTIONS: Record<ResponseMode, string> = {
  validate_reframe_act:
    "احتواء المشاعر + إعادة الإطار + اقتراح حركة",
  question_only:
    "سؤال واحد حاد، بدون نصيحة",
  observation:
    "ملاحظة نمط رآه رفيق في المحادثات السابقة",
  reconnect:
    "استقبال العودة بعد غياب — الأولوية للعلاقة",
  celebrate:
    "الاحتفال بخطوة أُنجزت",
  challenge:
    "دفع المستخدم للأمام — كسر المنطقة الآمنة",
  followup:
    "متابعة خطوة لم تُنفَّذ من الجلسة السابقة",
  silence_breaking:
    "رفيق يبدأ الحديث بعد صمت طويل",
};
