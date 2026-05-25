import type { EmotionalState } from "@/types/memory";

interface InteractionData {
  user_text: string;
  validate: string | null;
  action: string | null;
  action_done: boolean;
  emotional_tag: string | null;
  created_at: string;
}

/**
 * Programmatically extracts emotional and behavioral promises from recent history.
 * Distills these into a warm, natural Egyptian Arabic continuity fragment.
 */
export function buildRelationshipContinuity(
  interactions: InteractionData[],
  streak: { done: number; total: number }
): string {
  if (interactions.length === 0) return "";

  const parts: string[] = [];
  const last = interactions[0];

  // 1. Check for unfinished action
  const lastWithAction = interactions.find((i) => i.action);
  if (lastWithAction && !lastWithAction.action_done && lastWithAction.action) {
    const daysAgo = Math.floor(
      (Date.now() - new Date(lastWithAction.created_at).getTime()) /
        (1000 * 60 * 60 * 24)
    );
    const when = daysAgo === 0 ? "النهارده الصبح" : daysAgo === 1 ? "امبارح" : `من كام يوم`;
    parts.push(
      `في آخر كلامنا ${when}، اقترحت عليك تعمل: "${lastWithAction.action}" بس لسه مظهرش إنها اتعملت.`
    );
  }

  // 2. Check for emotional state in the last interaction
  if (last.emotional_tag) {
    const tag = last.emotional_tag as EmotionalState;
    if (tag === "drained") {
      parts.push("المرة اللي فاتت كنت حاسس إنك مستنزف وتعبان ومحتاج تفصل.");
    } else if (tag === "anxious") {
      parts.push("آخر مرة كنا بنتكلم وكنت قلقان أو متوتر وضغطك عالي.");
    } else if (tag === "scattered") {
      parts.push("كنت بتقول إن دماغك مشوشة ومش عارف تركز في حاجة معينة.");
    } else if (tag === "motivated") {
      parts.push("ما شاء الله، آخر مرة كنت متحمس وحاسس بنشاط وهمة.");
    }
  }

  // 3. Highlight streak momentum if doing well
  if (streak.total >= 3 && streak.done / streak.total >= 0.7) {
    parts.push(
      `مخلص ${streak.done} خطوات من آخر ${streak.total} خطوات اقترحناهم — كيرف الحركة بتاعه عالي ومحترم اليومين دول.`
    );
  } else if (streak.total >= 4 && streak.done / streak.total < 0.3) {
    parts.push(
      `مخلصش غير خطوة واحدة بس من آخر خطوة اقترحناها، شكله مكسل ومحتاج زقة بلطف من غير ما نحسسه بذنب.`
    );
  }

  return parts.join(" ");
}
