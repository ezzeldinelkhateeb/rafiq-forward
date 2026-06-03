import type { ResponseMode } from "@/types/companion";
import type { UserBehaviorState } from "@/types/behavioral";
import type { DynamicStance } from "./dynamic-stance";
import { selectBestModeByRhythm } from "./conversation-rhythm";

export interface StrategyInput {
  behaviorState: UserBehaviorState;
  stance: DynamicStance;
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
 * 2. Collect candidates based on user behavior state, late-night hours, and dynamic stance.
 * 3. Consult the conversation rhythm engine to select the best candidate.
 */
export function selectResponseMode(input: StrategyInput): ResponseMode {
  const {
    behaviorState,
    stance,
    hoursSinceLastSession,
    hasUnfinishedAction,
    lastActionDone,
    recentMessageCount,
    userMessageLength,
    isActionCompletion,
    recentModes,
  } = input;

  // ── Priority 1: Prolonged silence-breaking (>5 days) ─────────────────
  if (hoursSinceLastSession > 120 && recentMessageCount === 0) {
    return "silence_breaking";
  }

  // ── Priority 2: Reconnect after absence (>48h) ──────────────────────
  if (hoursSinceLastSession > 48 && recentMessageCount === 0) {
    return "reconnect";
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
    candidates.push("challenge");
  } else if (behaviorState === "productive_momentum" || behaviorState === "rebuilding") {
    candidates.push("momentum_push");
    candidates.push("micro_story");
    candidates.push("celebrate");
  } else if (behaviorState === "present") {
    candidates.push("question_only");
    candidates.push("observation");
    candidates.push("micro_story");
  } else if (behaviorState === "unknown") {
    candidates.push("quiet_presence");
    candidates.push("question_only");
  }

  // ── Stance-Based Preferences ─────────────────────────────────────────
  if (stance.depth > 0.6) {
    candidates.push("deep_reflection");
    candidates.push("observation");
  }
  if (stance.pressure > 0.6) {
    candidates.push("tough_love");
    candidates.push("challenge");
  }
  if (stance.playfulness > 0.6) {
    candidates.push("playful_observation");
    candidates.push("micro_story");
  }
  if (stance.warmth > 0.7) {
    candidates.push("emotional_mirroring");
    candidates.push("quiet_presence");
  }

  // ── Generic Fallbacks ────────────────────────────────────────────────
  if (userMessageLength < 12) {
    candidates.push("question_only");
    candidates.push("quiet_presence");
  }

  candidates.push("validate_reframe_act");
  candidates.push("question_only");

  // Consecutive Advice Fatigue Guard
  if (input.consecutiveAdviceCount >= 2) {
    const idx = candidates.indexOf("validate_reframe_act");
    if (idx !== -1) candidates.splice(idx, 1);
    if (!candidates.includes("question_only")) candidates.push("question_only");
    if (!candidates.includes("observation")) candidates.push("observation");
    if (!candidates.includes("playful_observation")) candidates.push("playful_observation");
    if (!candidates.includes("micro_story")) candidates.push("micro_story");
  }

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
