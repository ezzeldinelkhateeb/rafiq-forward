import type { UserBehaviorState, BehavioralAnalysis } from "@/types/behavioral";
import type { EmotionalState } from "@/types/memory";

// ─── Signal Keywords ──────────────────────────────────────────────────────

const ESCAPE_SIGNALS = [
  "سوشيال", "موبايل", "يوتيوب", "تيك توك", "نت", "إنترنت",
  "بضيع وقت", "مستنزف", "تعبت من الشاشة", "دومسكرول",
  "ريلز", "فيسبوك", "أنستا", "فيديو", "ضيعت", "تيكتوك",
];

const COLLAPSE_SIGNALS = [
  "تعبت", "مش كويس", "مستنزف", "زهقت", "محتاج", "مش قادر",
  "كل ده", "دماغي زحمة", "مشوش", "مش عارف", "حابب أنام",
  "ماليش نفس", "ضغط", "مضغوط", "صعب", "مش تمام", "حزين", "مكتئب",
];

const MOMENTUM_SIGNALS = [
  "عملت", "خلصت", "أنجزت", "نجحت", "كملت", "تمام", "حلو",
  "تحسن", "أحسن", "قدرت", "ركزت", "بدأت", "فقت", "صحيت",
];

const SCATTERED_SIGNALS = [
  "مش عارف أبدأ", "كتير", "ورايا حاجات", "مشتت", "مش قادر أركز",
  "كل حاجة", "أعمل إيه", "من فين أبدأ", "تايه", "مش مركز",
];

const STUCK_SIGNALS = [
  "مش عارف أتحرك", "واقف", "مكسل", "مش قادر أعمل حاجة",
  "قعدت مكاني", "مش لاقي", "تعبان أبدأ", "مش عايز",
  "مفيش فايدة", "سيبني", "مش فارق", "زهقت من كل حاجة",
  "مش حاسس بحاجة", "نفس الحاجة", "مش بيتغير",
];

const REBUILDING_SIGNALS = [
  "رجعت", "حاولت تاني", "ببدأ من جديد", "قمت", "فقت",
  "رجعت تاني", "هحاول", "مش هسيب", "عايز أبدأ",
  "محتاج أتحرك", "عايز أتغير", "بفكر أبدأ", "جاهز",
  "يلا بينا", "نبدأ", "مستعد", "عايز أحاول",
];

function countSignals(text: string, signals: string[]): number {
  const lower = text.toLowerCase();
  return signals.filter((s) => lower.includes(s)).length;
}

function isLateNight(hour: number): boolean {
  return hour >= 23 || hour <= 4;
}

interface StateMachineParams {
  userMessage: string;
  hourOfDay: number;
  hoursSinceLastSession: number;
  recentActionDoneRate: number;
  sessionCount: number;
  recentEmotions?: EmotionalState[];
}

/**
 * State Machine V2 — computes user behavioral state using weighted scoring
 * and emotional inertia (moving average over recent history).
 */
export function analyzeBehavioralState(params: StateMachineParams): BehavioralAnalysis {
  const {
    userMessage,
    hourOfDay,
    hoursSinceLastSession,
    recentActionDoneRate,
    sessionCount,
    recentEmotions = [],
  } = params;

  const lateNight = isLateNight(hourOfDay);
  const signals: string[] = [];

  // 1. Calculate base signal counts
  const escapeCount = countSignals(userMessage, ESCAPE_SIGNALS);
  const collapseCount = countSignals(userMessage, COLLAPSE_SIGNALS);
  const momentumCount = countSignals(userMessage, MOMENTUM_SIGNALS);
  const scatteredCount = countSignals(userMessage, SCATTERED_SIGNALS);
  const stuckCount = countSignals(userMessage, STUCK_SIGNALS);
  const rebuildingCount = countSignals(userMessage, REBUILDING_SIGNALS);

  // 2. Initialize scores for each state
  const scores: Record<UserBehaviorState, number> = {
    digital_escape: 0,
    emotional_collapse: 0,
    productive_momentum: 0,
    rebuilding: 0,
    stuck: 0,
    present: 0,
    unknown: 0,
  };

  // 3. Keyword Scoring Weights
  if (escapeCount > 0) {
    scores.digital_escape += escapeCount * 3.5;
    signals.push(`كلمات هروب رقمي (${escapeCount})`);
  }
  if (collapseCount > 0) {
    scores.emotional_collapse += collapseCount * 3.0;
    signals.push(`كلمات ضائقة عاطفية (${collapseCount})`);
  }
  if (momentumCount > 0) {
    scores.productive_momentum += momentumCount * 3.0;
    signals.push(`كلمات زخم وإنجاز (${momentumCount})`);
  }
  if (scatteredCount > 0) {
    scores.stuck += scatteredCount * 2.0;
    scores.emotional_collapse += scatteredCount * 1.0;
    signals.push(`كلمات تشتت (${scatteredCount})`);
  }
  if (stuckCount > 0) {
    scores.stuck += stuckCount * 3.0;
    signals.push(`كلمات شلل وحيرة (${stuckCount})`);
  }
  if (rebuildingCount > 0) {
    scores.rebuilding += rebuildingCount * 3.0;
    scores.productive_momentum += rebuildingCount * 1.5;
    signals.push(`كلمات عودة ونهوض (${rebuildingCount})`);
  }

  // 4. Context Modifier Weights
  if (lateNight) {
    scores.digital_escape += 2.0;
    scores.emotional_collapse += 1.5;
    signals.push("وقت متأخر من الليل");
  }

  // Action completion rate modifiers (including action avoidance detection)
  if (recentActionDoneRate >= 0.6) {
    scores.productive_momentum += 3.0;
    signals.push(`إنجاز عالي (${Math.round(recentActionDoneRate * 100)}%)`);
  } else if (recentActionDoneRate < 0.3 && recentActionDoneRate > 0) {
    scores.stuck += 2.5;
    scores.digital_escape += 1.0;
    signals.push(`تهرب من الخطوات (${Math.round(recentActionDoneRate * 100)}%)`);
  } else if (recentActionDoneRate === 0 && sessionCount >= 3) {
    scores.stuck += 3.0;
    signals.push("مفيش ولا خطوة اتعملت من أكتر من ٣ جلسات");
  }

  // Time absence modifiers
  if (hoursSinceLastSession > 120) {
    scores.stuck += 4.0;
    signals.push("غياب طويل (> 5 أيام)");
  } else if (hoursSinceLastSession > 48) {
    if (momentumCount >= 1) {
      scores.rebuilding += 3.0;
      signals.push("عودة إيجابية بعد غياب");
    } else {
      scores.stuck += 1.5;
    }
  }

  // Message length modifiers (very short messages imply stuck or low engagement)
  if (userMessage.length < 12 && recentActionDoneRate < 0.3) {
    scores.stuck += 1.5;
    scores.unknown += 1.0;
  }

  // 5. Emotional Inertia (Gradual Transition moving average)
  // Look at last 3 emotions in history to apply inertia bias
  if (recentEmotions.length > 0) {
    const recent = recentEmotions.slice(0, 3);
    let historyDistressCount = 0;
    let historyMomentumCount = 0;

    recent.forEach((emotion) => {
      if (emotion === "drained" || emotion === "anxious" || emotion === "scattered") {
        historyDistressCount++;
      } else if (emotion === "motivated" || emotion === "rebuilding") {
        historyMomentumCount++;
      }
    });

    if (historyDistressCount >= 2) {
      // Historical bias resists sudden jump to momentum
      scores.emotional_collapse += 2.0;
      scores.digital_escape += 1.0;
      signals.push(`قصور ذاتي عاطفي: تاريخ ضائقة (${historyDistressCount}/3)`);
    }

    if (historyMomentumCount >= 2) {
      // Historical bias smooths out single negative word
      scores.productive_momentum += 2.0;
      signals.push(`قصور ذاتي عاطفي: تاريخ إيجابي (${historyMomentumCount}/3)`);
    }
  }

  // 6. Present / Onboarding fallback
  if (sessionCount <= 1 && scores.digital_escape < 2 && scores.emotional_collapse < 2) {
    scores.present += 3.0;
  }
  // Engaged present user: long thoughtful message with no distress signals
  if (
    userMessage.length > 40 &&
    collapseCount === 0 &&
    escapeCount === 0 &&
    stuckCount === 0 &&
    (momentumCount >= 1 || rebuildingCount >= 1)
  ) {
    scores.present += 3.0;
    scores.productive_momentum += 1.0;
  }

  // 7. Find highest scoring state
  let selectedState: UserBehaviorState = "unknown";
  let maxScore = 0;

  (Object.keys(scores) as UserBehaviorState[]).forEach((state) => {
    if (scores[state] > maxScore) {
      maxScore = scores[state];
      selectedState = state;
    }
  });

  // Calculate confidence based on the margin of victory
  let confidence = 0.5;
  if (maxScore > 0) {
    const totalScore = Object.values(scores).reduce((a, b) => a + b, 0);
    confidence = Math.min(0.95, Math.max(0.4, maxScore / (totalScore || 1) + 0.2));
  }

  // If no clear signals, default to unknown
  if (maxScore === 0) {
    selectedState = "unknown";
    confidence = 0.3;
  }

  return {
    state: selectedState,
    confidence,
    signals,
    hourOfDay,
    isLateNight: lateNight,
    isFirstMessageOfDay: hoursSinceLastSession > 16,
  };
}
