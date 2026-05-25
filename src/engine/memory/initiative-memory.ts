interface InteractionData {
  user_text: string;
  validate: string | null;
  action: string | null;
  action_done: boolean;
  created_at: string;
}

/**
 * Initiative Memory Engine
 * Programmatically notices behavioral inconsistencies or repetitive loops
 * and provides follow-up topics to the response selector.
 */
export function buildInitiativeObservation(
  interactions: InteractionData[],
  identity: { goals?: string[]; struggles?: string[] } | null
): string {
  if (interactions.length < 3) return "";

  const parts: string[] = [];

  // 1. Detect late-night messaging pattern vs sleeping goals
  const lateNightMessages = interactions.filter((i) => {
    const hour = new Date(i.created_at).getHours();
    return hour >= 23 || hour <= 4;
  });

  const wantsToSleepEarly =
    identity?.goals?.some((g) => g.includes("نوم") || g.includes("أنام بدري")) ||
    identity?.struggles?.some((s) => s.includes("سهر") || s.includes("نوم"));

  if (lateNightMessages.length >= 2 && wantsToSleepEarly) {
    parts.push(
      "ملاحظة: هو مسجل إنه حابب ينام بدري أو بيعاني من السهر، ومع ذلك آخر كلامه كله كان متأخر جداً بالليل (بين الساعة 11 م و 4 ص)."
    );
  }

  // 2. Action avoidance pattern
  const totalSuggestedActions = interactions.filter((i) => i.action).length;
  const totalCompletedActions = interactions.filter((i) => i.action && i.action_done).length;

  if (totalSuggestedActions >= 3 && totalCompletedActions === 0) {
    parts.push(
      "ملاحظة: اقترحنا عليه كذا خطوة عملية الأيام اللي فاتت ومعملش ولا واحدة فيهم. في نمط تهرب واضح من الفعل الجسدي."
    );
  }

  // 3. Social media binging contradiction
  const mentionsSocialMedia = interactions.filter((i) =>
    ["تليفون", "موبايل", "فيس", "إنستا", "تيك", "سوشيال", "فيديو", "يوتيوب"].some((keyword) =>
      i.user_text.toLowerCase().includes(keyword)
    )
  );

  if (mentionsSocialMedia.length >= 3) {
    parts.push(
      "ملاحظة: شكواه متكررة جداً عن التليفون والسوشيال ميديا ودوامة الفيديوهات بشكل شبه مستمر في كلامه الأخير."
    );
  }

  return parts.join(" ");
}
