import type { BehavioralScores } from "@/engine/events/event-types";
import type { UserBehaviorState } from "@/types/behavioral";

export interface DynamicStance {
  warmth: number;        // 0-1: How caring/friendly (1) vs clinical/cool (0)
  pressure: number;      // 0-1: How demanding/pushy to take actions (1) vs relaxed (0)
  playfulness: number;   // 0-1: How humorous/witty/Egyptian-street (1) vs sober/serious (0)
  directness: number;    // 0-1: How blunt/frank/straightforward (1) vs gentle/polite (0)
  depth: number;         // 0-1: How introspective/philosophical (1) vs immediate/action-oriented (0)
}

/**
 * Computes a dynamic stance based on user's behavioral scores, state, and current context.
 * This completely replaces static persona tabs in favor of a dynamic, adaptive relationship stance.
 */
export function computeDynamicStance(
  scores: BehavioralScores,
  state: UserBehaviorState,
  recentEmotions: string[] = []
): DynamicStance {
  // Default baseline values (representing a balanced friend persona)
  let warmth = 0.6;
  let pressure = 0.3;
  let playfulness = 0.5;
  let directness = 0.5;
  let depth = 0.4;

  const currentHour = new Date().getHours();
  const isLateNight = currentHour >= 23 || currentHour <= 4;

  // 1. Warmth adjustments
  if (state === "emotional_collapse") {
    warmth = 0.9; // Needs high empathy and support
  } else if (state === "digital_escape" || state === "stuck") {
    warmth = 0.45; // Slightly lower warmth to allow for tough love
  }
  if (isLateNight) {
    warmth = Math.min(1.0, warmth + 0.15); // Late night calls for extra softness
  }
  if (recentEmotions.includes("drained") || recentEmotions.includes("anxious")) {
    warmth = Math.min(1.0, warmth + 0.15);
  }

  // 2. Pressure adjustments
  if (state === "digital_escape") {
    pressure = 0.8; // High pressure to break the scroll loop
  } else if (state === "stuck") {
    pressure = 0.7; // Needs a firm push to get moving
  } else if (state === "productive_momentum") {
    pressure = 0.65; // Keep the momentum going
  } else if (state === "emotional_collapse") {
    pressure = 0.05; // DO NOT pressure when user is collapsing
  } else if (isLateNight) {
    pressure = 0.1; // Low pressure at night
  }
  // If trust score is low (avoiding actions), reduce pressure slightly and make action easier
  if (scores.trustScore < 0.3) {
    pressure = Math.max(0.1, pressure - 0.2);
  }

  // 3. Playfulness adjustments
  if (state === "emotional_collapse") {
    playfulness = 0.1; // Serious, empathetic tone
  } else if (state === "digital_escape") {
    playfulness = 0.25; // Focus on interrupting the pattern, not joking around too much
  } else if (state === "productive_momentum" || state === "present") {
    playfulness = 0.7; // Celebrate and use more humor
  }
  if (isLateNight) {
    playfulness = Math.max(0.1, playfulness - 0.3); // Late night is quiet and reflective, not playful
  }

  // 4. Directness adjustments
  if (state === "digital_escape") {
    directness = 0.95; // Extreme directness: "قفل الموبايل"
  } else if (state === "stuck") {
    directness = 0.85; // Challenge the excuses directly
  } else if (state === "emotional_collapse") {
    directness = 0.3; // Gentle, not too blunt
  }

  // 5. Depth adjustments
  if (state === "emotional_collapse") {
    depth = 0.85; // Deep empathy and reflection
  } else if (isLateNight) {
    depth = 0.8; // Late night thoughts
  } else if (state === "digital_escape" || state === "productive_momentum") {
    depth = 0.2; // Keep it immediate and surface-level for action
  }
  // Higher emotional volatility increases depth of interaction
  if (scores.emotionalVolatility > 0.6) {
    depth = Math.min(1.0, depth + 0.15);
  }

  return {
    warmth: Number(warmth.toFixed(2)),
    pressure: Number(pressure.toFixed(2)),
    playfulness: Number(playfulness.toFixed(2)),
    directness: Number(directness.toFixed(2)),
    depth: Number(depth.toFixed(2)),
  };
}

export function buildStancePromptInstructions(stance: DynamicStance): string {
  return `
[نبرة وأسلوب التعامل الحركي الحالي (Stance)]:
- الدفء والاحتواء العاطفي (Warmth): ${Math.round(stance.warmth * 100)}% ${
    stance.warmth > 0.7
      ? "— كن حنوناً، داعماً، ومستمعاً ممتازاً؛ ركز على الطبطبة والاحتواء."
      : stance.warmth < 0.4
        ? "— كن موضوعياً وواقعياً؛ ركز على الحقيقة السلوكية بدون طبطبة."
        : "— كن صديقاً متوازناً."
  }
- ضغط الحركة والأفعال (Pressure): ${Math.round(stance.pressure * 100)}% ${
    stance.pressure > 0.7
      ? "— اضغط بقوة لحثه على البدء في فعل حقيقي فوراً؛ لا تقبل التراجع."
      : stance.pressure < 0.2
        ? "— تجنب تماماً الضغط أو توجيه النصائح القاسية؛ ساعده على الاسترخاء فقط."
        : "— اقترح حركة خفيفة إذا لزم الأمر."
  }
- الخفة والمرح بلدي (Playfulness): ${Math.round(stance.playfulness * 100)}% ${
    stance.playfulness > 0.6
      ? "— استخدم خفة دم مصرية، اضحك ونكش فيه بلطف، الجو يسمح بالمرح والبهجة."
      : stance.playfulness < 0.2
        ? "— كن جاداً، هادئاً، ووقوراً؛ الجو لا يناسب النكات أو التنكيش."
        : "— نبرة صديق عادية ولطيفة."
  }
- الصراحة المباشرة (Directness): ${Math.round(stance.directness * 100)}% ${
    stance.directness > 0.8
      ? "— واجهه بعيوبه وأعذاره مباشرة وبدون مقدمات (حب حازم وصريح)."
      : stance.directness < 0.4
        ? "— كن ناعماً ولطيفاً جداً في تعبيرك؛ ابتعد عن المواجهات القاسية."
        : "— واجه بلطف متوازن."
  }
- العمق والتأمل (Depth): ${Math.round(stance.depth * 100)}% ${
    stance.depth > 0.7
      ? "— ابحث عن جذور المشاعر وتكلم بأسلوب فلسفي دافئ وعميق؛ لا تتسرع بالحلول السطحية."
      : stance.depth < 0.3
        ? "— كن بسيطاً ومباشراً وسريعاً؛ لا تتفلسف وركز على اللحظة الآنية فقط."
        : "— توازن بين الفهم والتبسيط."
  }
`.trim();
}
