import type { ResponseMode } from "@/types/companion";
import type { UserBehaviorState } from "@/types/behavioral";
import type { Persona } from "@/types/companion";
import { selectBestModeByRhythm } from "./conversation-rhythm";

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
  isActionCompletion?: boolean;
  recentModes: ResponseMode[];
}

/**
 * Selects the response mode for this turn.
 * 
 * Logic flow:
 * 1. Immediate priority triggers (reconnect, celebrate, followup).
 * 2. Collect candidates based on user behavior state, late-night hours, and persona.
 * 3. Consult the conversation rhythm engine to select the best candidate.
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
    isActionCompletion,
    recentModes,
  } = input;

  // ── Priority 1: Reconnect after absence ─────────────────────────
  if (hoursSinceLastSession > 48 && recentMessageCount === 0) {
    return "reconnect";
  }

  // ── Priority 2: Prolonged silence-breaking ───────────────────────────
  if (hoursSinceLastSession > 120 && recentMessageCount === 0) {
    return "silence_breaking";
  }

  // ── Priority 3: Action Completion Celebration ──────────────────────
  if (isActionCompletion || (lastActionDone && recentMessageCount === 0)) {
    return "celebrate";
  }

  // ── Priority 4: Follow up on unfinished action ───────────────────────
  if (hasUnfinishedAction && recentMessageCount === 0) {
    return "followup";
  }

  // List of candidate strategies suited for this turn
  const candidates: ResponseMode[] = [];

  // ── Late Night Modifier ──────────────────────────────────────────────
  const hour = new Date().getHours();
  const isLate = hour >= 23 || hour <= 4;
  if (isLate) {
    candidates.push("late_night_softness");
  }

  // ── State-Based Strategy Routing ─────────────────────────────────────
  if (behaviorState === "digital_escape") {
    candidates.push("interruption_pattern");
    candidates.push("tough_love");
  } else if (behaviorState === "emotional_collapse") {
    candidates.push("emotional_mirroring");
    candidates.push("deep_reflection");
    candidates.push("quiet_presence");
  } else if (behaviorState === "stuck") {
    candidates.push("relapse_detection");
    candidates.push("tough_love");
    candidates.push("question_only");
  } else if (behaviorState === "productive_momentum" || behaviorState === "rebuilding") {
    candidates.push("momentum_push");
    candidates.push("micro_story");
  }

  // ── Persona Preferences ──────────────────────────────────────────────
  if (persona === "sage") {
    candidates.push("deep_reflection");
    candidates.push("observation");
  } else if (persona === "coach") {
    candidates.push("tough_love");
    candidates.push("challenge");
  } else if (persona === "friend") {
    candidates.push("playful_observation");
    candidates.push("micro_story");
  }

  // ── Generic Fallbacks ────────────────────────────────────────────────
  if (userMessageLength < 12) {
    candidates.push("question_only");
    candidates.push("quiet_presence");
  }

  candidates.push("validate_reframe_act");
  candidates.push("question_only");

  // ── Rhythm & Pacing Selection ────────────────────────────────────────
  return selectBestModeByRhythm(candidates, recentModes);
}

/**
 * Human-readable description of mode — used in debug/logging only.
 */
export const MODE_DESCRIPTIONS: Record<ResponseMode, string> = {
  validate_reframe_act: "احتواء المشاعر + إعادة الإطار + اقتراح حركة",
  question_only: "سؤال واحد حاد، بدون نصيحة",
  observation: "ملاحظة نمط رآه رفيق في المحادثات السابقة",
  reconnect: "استقبال العودة بعد غياب — الأولوية للعلاقة",
  celebrate: "الاحتفال بخطوة أُنجزت",
  challenge: "دفع المستخدم للأمام — كسر المنطقة الآمنة",
  followup: "متابعة خطوة لم تُنفَّذ من الجلسة السابقة",
  silence_breaking: "رفيق يبدأ الحديث بعد صمت طويل",
  playful_observation: "ملاحظة لطيفة ومرحة بمصرية تلطف الجو",
  deep_reflection: "تحليل فلسفي هادئ وعميق",
  interruption_pattern: "مقاطعة فورية وحاسمة لدوامة الموبايل",
  late_night_softness: "طبطبة هادئة ودافئة متناسبة مع الليل والسهر",
  momentum_push: "زقة تشجيع قوية للاستمرار في الحركة",
  relapse_detection: "ملاحظة دلائل تراجع سريعة بدون إشعار بالذنب",
  emotional_mirroring: "عكس مشاعره بالضبط لإظهار التعاطف والاحتواء",
  micro_story: "قصة أو تشبيه مصري سريع يوصل المعنى",
  tough_love: "مواجهة صريحة ودافئة لكن حاسمة (حب حازم)",
  quiet_presence: "حضور هادئ بدون تقديم نصائح أو توجيهات",
};
