/**
 * Behavioral State Machine — detects the user's current behavioral state
 * from message signals, time of day, and pattern history.
 *
 * This runs BEFORE the LLM call and selects the response strategy.
 * The LLM never sees the state label — it sees a different prompt.
 */

import type { UserBehaviorState, BehavioralAnalysis } from "@/types/behavioral";

// ─── Signal Keywords ──────────────────────────────────────────────────────

const ESCAPE_SIGNALS = [
  "سوشيال", "موبايل", "يوتيوب", "تيك توك", "نت", "إنترنت",
  "بضيع وقت", "مستنزف", "تعبت من الشاشة", "دومسكرول",
  "ريلز", "فيسبوك", "أنستا", "فيديو", "ضيعت",
];

const COLLAPSE_SIGNALS = [
  "تعبت", "مش كويس", "مستنزف", "زهقت", "محتاج", "مش قادر",
  "كل ده", "دماغي زحمة", "مشوش", "مش عارف", "حابب أنام",
  "ماليش نفس", "ضغط", "مضغوط", "صعب", "مش تمام",
];

const MOMENTUM_SIGNALS = [
  "عملت", "خلصت", "أنجزت", "نجحت", "كملت", "تمام", "حلو",
  "زبالة", "تحسن", "أحسن", "قدرت", "ركزت", "بدأت",
];

const SCATTERED_SIGNALS = [
  "مش عارف أبدأ", "كتير", "ورايا حاجات", "مشتت", "مش قادر أركز",
  "كل حاجة", "أعمل إيه", "من فين أبدأ",
];

// ─── State Detection ──────────────────────────────────────────────────────

function countSignals(text: string, signals: string[]): number {
  const lower = text.toLowerCase();
  return signals.filter((s) => lower.includes(s)).length;
}

function isLateNight(hour: number): boolean {
  return hour >= 23 || hour <= 4;
}

/**
 * Analyzes the current message + context to determine behavioral state.
 * Rule-based — fast, no LLM call needed.
 */
export function analyzeBehavioralState(params: {
  userMessage: string;
  hourOfDay: number;
  hoursSinceLastSession: number;
  recentActionDoneRate: number; // 0–1: fraction of recent actions completed
  sessionCount: number;
}): BehavioralAnalysis {
  const {
    userMessage,
    hourOfDay,
    hoursSinceLastSession,
    recentActionDoneRate,
    sessionCount,
  } = params;

  const lateNight = isLateNight(hourOfDay);
  const signals: string[] = [];

  const escapeCount = countSignals(userMessage, ESCAPE_SIGNALS);
  const collapseCount = countSignals(userMessage, COLLAPSE_SIGNALS);
  const momentumCount = countSignals(userMessage, MOMENTUM_SIGNALS);
  const scatteredCount = countSignals(userMessage, SCATTERED_SIGNALS);

  // ── Determine state with confidence ────────────────────────────────────

  // Digital escape: explicit escape keywords OR late-night + low completion
  if (escapeCount >= 1 || (lateNight && recentActionDoneRate < 0.2)) {
    if (escapeCount >= 1) signals.push("ذُكرت كلمات الهروب الرقمي");
    if (lateNight) signals.push("وقت متأخر من الليل");
    if (recentActionDoneRate < 0.2) signals.push("نسبة إنجاز منخفضة جداً");

    return {
      state: "digital_escape",
      confidence: escapeCount >= 2 ? 0.9 : 0.65,
      signals,
      hourOfDay,
      isLateNight: lateNight,
      isFirstMessageOfDay: hoursSinceLastSession > 16,
    };
  }

  // Emotional collapse: multiple distress signals
  if (collapseCount >= 2 || (collapseCount >= 1 && lateNight)) {
    signals.push(`${collapseCount} علامة ضائقة عاطفية`);
    if (lateNight) signals.push("وقت متأخر من الليل");

    return {
      state: "emotional_collapse",
      confidence: collapseCount >= 3 ? 0.9 : 0.7,
      signals,
      hourOfDay,
      isLateNight: lateNight,
      isFirstMessageOfDay: hoursSinceLastSession > 16,
    };
  }

  // Productive momentum: positive completion signals
  if (momentumCount >= 1 && recentActionDoneRate >= 0.5) {
    signals.push("كلمات إيجابية ونسبة إنجاز عالية");

    return {
      state: "productive_momentum",
      confidence: 0.8,
      signals,
      hourOfDay,
      isLateNight: lateNight,
      isFirstMessageOfDay: hoursSinceLastSession > 16,
    };
  }

  // Stuck/stagnant: no sessions in 5+ days and low completion
  if (hoursSinceLastSession > 120 && recentActionDoneRate < 0.3) {
    signals.push(`${Math.round(hoursSinceLastSession / 24)} أيام بدون تواصل`);
    signals.push("نسبة إنجاز منخفضة");

    return {
      state: "stuck",
      confidence: 0.75,
      signals,
      hourOfDay,
      isLateNight: lateNight,
      isFirstMessageOfDay: true,
    };
  }

  // Rebuilding: returned after long absence with positive tone
  if (hoursSinceLastSession > 48 && momentumCount >= 1) {
    signals.push("عودة بعد غياب مع نبرة إيجابية");

    return {
      state: "rebuilding",
      confidence: 0.7,
      signals,
      hourOfDay,
      isLateNight: lateNight,
      isFirstMessageOfDay: true,
    };
  }

  // Scattered: can't focus/start signals
  if (scatteredCount >= 1) {
    signals.push("علامات التشتت والتقطع");

    return {
      state: "emotional_collapse", // treat scattered like collapse
      confidence: 0.6,
      signals,
      hourOfDay,
      isLateNight: lateNight,
      isFirstMessageOfDay: hoursSinceLastSession > 16,
    };
  }

  // First session ever — present and curious
  if (sessionCount <= 1) {
    return {
      state: "present",
      confidence: 0.5,
      signals: ["أول تواصل"],
      hourOfDay,
      isLateNight: lateNight,
      isFirstMessageOfDay: true,
    };
  }

  // Default: unknown — not enough signals
  return {
    state: "unknown",
    confidence: 0.3,
    signals: ["لا علامات واضحة"],
    hourOfDay,
    isLateNight: lateNight,
    isFirstMessageOfDay: hoursSinceLastSession > 16,
  };
}
