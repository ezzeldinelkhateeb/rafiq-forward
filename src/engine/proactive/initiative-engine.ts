/**
 * Proactive Initiative Engine — decides WHEN Rafiq should reach out.
 *
 * This is Rafiq taking initiative. Not reacting. Initiating.
 * Called on every session load. Returns one nudge or none.
 *
 * Design: modular trigger system — each trigger is independent.
 * Adding push notifications later = calling triggerCheck() from a cron job.
 */

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { ProactiveNudge, ProactiveTrigger } from "@/types/companion";
import { consumeEvents } from "@/engine/events/event-logger";
import { computeBehavioralScores } from "@/engine/events/event-scores";
import type { BehavioralScores } from "@/engine/events/event-types";
import { callGemini } from "@/lib/ai-client";

// ─── Trigger Definitions ───────────────────────────────────────────────────

interface TriggerContext {
  userId: string;
  hoursSinceLastSession: number;
  lastActionDone: boolean;
  lastActionText: string | null;
  recentActionDoneRate: number; // 0–1 over last 7 sessions
  recentSessionCount: number; // sessions in last 7 days
  hourOfDay: number;
  scores: BehavioralScores;
}

interface TriggerResult {
  triggered: boolean;
  type: ProactiveTrigger;
  priority: number; // lower = higher priority
}

// ─── Individual Trigger Checks ────────────────────────────────────────────

/** > 48h since last session */
function checkReturnAfterAbsence(ctx: TriggerContext): TriggerResult {
  return {
    triggered: ctx.hoursSinceLastSession > 48,
    type: "return_after_absence",
    priority: 1,
  };
}

/** Last action was not done, and it's been > 24h */
function checkUnfinishedAction(ctx: TriggerContext): TriggerResult {
  return {
    triggered:
      !ctx.lastActionDone &&
      ctx.lastActionText !== null &&
      ctx.hoursSinceLastSession > 24,
    type: "unfinished_action",
    priority: 2,
  };
}

/** Loading app during late night hours (11 PM - 4 AM) and > 16h since last session */
function checkLateNight(ctx: TriggerContext): TriggerResult {
  const hour = ctx.hourOfDay;
  return {
    triggered: (hour >= 23 || hour <= 4) && ctx.hoursSinceLastSession > 16,
    type: "late_night_awareness",
    priority: 2,
  };
}

/** Low action completion rate (< 0.2) or relapse score > 0.5, and > 24h gap */
function checkRelapseSignal(ctx: TriggerContext): TriggerResult {
  return {
    triggered:
      (ctx.scores.relapseProbability > 0.5 || ctx.recentActionDoneRate < 0.2) &&
      ctx.hoursSinceLastSession > 24,
    type: "relapse_signal",
    priority: 3,
  };
}

/** 5+ days with no sessions at all */
function checkProlongedStagnation(ctx: TriggerContext): TriggerResult {
  return {
    triggered:
      ctx.recentSessionCount === 0 && ctx.hoursSinceLastSession > 120,
    type: "prolonged_stagnation",
    priority: 4,
  };
}

/** High momentum score (> 0.6) or 3+ actions completed in past week — momentum worthy of recognition */
function checkStreakMomentum(ctx: TriggerContext): TriggerResult {
  return {
    triggered:
      (ctx.scores.momentumScore > 0.6 || ctx.recentActionDoneRate >= 0.6) &&
      ctx.hoursSinceLastSession < 48,
    type: "streak_momentum",
    priority: 5,
  };
}

// ─── Trigger Orchestrator ─────────────────────────────────────────────────

function calculateInterruptionConfidence(
  type: ProactiveTrigger,
  ctx: TriggerContext
): number {
  switch (type) {
    case "return_after_absence":
      // Ranges from 0.5 (at 48h) to 1.0 (at 144h)
      return Math.min(1.0, 0.5 + (ctx.hoursSinceLastSession - 48) / 192);
    case "unfinished_action":
      // Ranges based on trustScore and hours since last session
      const trustWeight = 0.3 * ctx.scores.trustScore;
      const timeWeight = Math.min(0.3, (ctx.hoursSinceLastSession - 24) / 96);
      return Math.min(1.0, 0.4 + trustWeight + timeWeight);
    case "late_night_awareness":
      // Based on sleep debt
      return Math.min(1.0, 0.5 + 0.5 * ctx.scores.sleepDebtScore);
    case "relapse_signal":
      // Based on relapse probability
      return Math.min(1.0, 0.4 + 0.6 * ctx.scores.relapseProbability);
    case "prolonged_stagnation":
      // Higher confidence the longer the stagnation
      return Math.min(1.0, 0.8 + (ctx.hoursSinceLastSession - 120) / 240);
    case "streak_momentum":
      // Based on momentum score
      return Math.min(1.0, 0.5 + 0.5 * ctx.scores.momentumScore);
    default:
      return 0.0;
  }
}

/**
 * Evaluates all triggers in priority order.
 * Returns the highest-priority triggered result, or null.
 */
export async function evaluateProactiveTriggers(
  userId: string
): Promise<{ type: ProactiveTrigger; ctx: TriggerContext; confidence: number } | null> {
  const ctx = await buildTriggerContext(userId);

  const triggers = [
    checkReturnAfterAbsence(ctx),
    checkUnfinishedAction(ctx),
    checkLateNight(ctx),
    checkRelapseSignal(ctx),
    checkProlongedStagnation(ctx),
    checkStreakMomentum(ctx),
  ]
    .filter((t) => t.triggered)
    .sort((a, b) => a.priority - b.priority);

  if (triggers.length === 0) return null;

  const type = triggers[0].type;
  const confidence = calculateInterruptionConfidence(type, ctx);

  return { type, ctx, confidence };
}

// ─── Context Builder ──────────────────────────────────────────────────────

async function buildTriggerContext(userId: string): Promise<TriggerContext> {
  const now = new Date();

  // Fetch last session info + recent action stats + events in parallel
  const [lastInteractionResult, recentStatsResult, eventsResult] = await Promise.allSettled([
    supabaseAdmin
      .from("interactions")
      .select("action, action_done, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(1)
      .single(),
    supabaseAdmin
      .from("interactions")
      .select("action_done, created_at")
      .eq("user_id", userId)
      .gte(
        "created_at",
        new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()
      )
      .order("created_at", { ascending: false }),
    consumeEvents(userId, { limit: 50 }),
  ]);

  const lastInteraction =
    lastInteractionResult.status === "fulfilled" &&
    lastInteractionResult.value.data
      ? lastInteractionResult.value.data
      : null;

  const recentInteractions =
    recentStatsResult.status === "fulfilled" &&
    recentStatsResult.value.data
      ? recentStatsResult.value.data
      : [];

  const events =
    eventsResult.status === "fulfilled" ? eventsResult.value : [];

  // Hours since last session
  const hoursSinceLastSession = lastInteraction
    ? (now.getTime() - new Date(lastInteraction.created_at).getTime()) /
      (1000 * 60 * 60)
    : 999;

  // Recent action completion rate
  const withAction = recentInteractions.filter((i) => i.action_done !== null);
  const doneCount = withAction.filter((i) => i.action_done).length;
  const recentActionDoneRate =
    withAction.length > 0 ? doneCount / withAction.length : 0;

  // Compute behavioral scores
  const scores = computeBehavioralScores(events, {
    interactionStats: { done: doneCount, total: withAction.length },
  });

  return {
    userId,
    hoursSinceLastSession,
    lastActionDone: lastInteraction?.action_done ?? true,
    lastActionText: lastInteraction?.action ?? null,
    recentActionDoneRate,
    recentSessionCount: recentInteractions.length,
    hourOfDay: now.getHours(),
    scores,
  };
}

// ─── Nudge Text Templates (static, diversity-seeded) ──────────────────────

/**
 * Template pools per trigger type.
 * The nudge generator picks from these + optionally LLM-personalizes.
 * Keeping static variants prevents prompt engineering for simple cases.
 */
export const NUDGE_TEMPLATES: Record<
  Exclude<ProactiveTrigger, "none">,
  string[]
> = {
  return_after_absence: [
    "حمد الله على السلامة يا صديقي، غبت فين؟ 👀",
    "غيبتك طالت.. لعله خير؟",
    "وحشتنا والله يا غالي.. طمني، عامل إيه النهاردة؟",
    "طولت الغيبة المرة دي.. كله تمام معاك؟",
  ],
  unfinished_action: [
    "شكلنا كسلنا عن الخطوة اللي فاتت.. جه أوانها ولا إيه؟ 😉",
    "الخطوة الصغيرة اللي اتفقنا عليها لسه مستنياك على فكرة! 🎯",
    "فاكر الحاجة العملية اللي فكرنا فيها؟ لسه وقتها.",
  ],
  prolonged_stagnation: [
    "فين أيامك؟ وحشتنا دردشتنا.. نبدأ خطوة جديدة سوا؟",
    "بقيت بتغيب كتير.. أنا هنا ومستنيك لما تحب تفوق.",
    "أنا دايماً هنا في ضهرك لو دماغك زحمتك وحبيت تفصل.",
  ],
  streak_momentum: [
    "عاش يا بطل! شايفك بتعفّر وبتتحرك صح 👊 كمل ومتوقفش!",
    "الأسبوع ده كان ضرب نار.. إيه الخطوة الجاية عشان نحافظ على الفرمة؟",
    "الزخم حلو والفرمة ماشية تمام، كمل كدة وبلاش تقف!",
  ],
  relapse_signal: [
    "حاسس إن الليلة تقيلة عليك شوية.. متسيبش نفسك للدوامة.",
    "لو حسيت إنك بتضيع، أنا في ضهرك.. اقفل الشاشة وتعال ندردش ثواني.",
    "شكل اللف في الموبايل واكل دماغك.. سيب الموبايل وخد نفس عميق.",
  ],
  late_night_awareness: [
    "سهران ليه لحد دلوقتي يا بطل؟ كله تمام؟ 🌙",
    "الليل سكونه حلو، بس السهر بيتعب.. حط التليفون بعيد ونم.",
    "سحلة نص الليل دي متعبة.. أنا هنا لو حابب تفصل وتنام.",
  ],
};

/**
 * Picks a nudge text — deterministic rotation based on day of week.
 * No LLM call for basic nudges (fast, cheap, predictable).
 */
export function pickNudgeText(
  type: Exclude<ProactiveTrigger, "none">,
  lastActionText?: string | null
): string {
  const templates = NUDGE_TEMPLATES[type];
  const dayIndex = new Date().getDay();
  const base = templates[dayIndex % templates.length];

  // For unfinished action, personalize with the actual action text
  if (type === "unfinished_action" && lastActionText) {
    return `يا ترى عملت "${lastActionText}" ولا لسه مكسل؟ 😉`;
  }

  return base;
}

async function generateDynamicNudgeText(
  type: Exclude<ProactiveTrigger, "none">,
  ctx: TriggerContext
): Promise<string> {
  const systemInstruction = `
أنت رفيق — رفيق السلوك ومساعد وناصح للمستخدم.
مهمتك الآن هي كتابة "نغزة" (proactive nudge) قصيرة ودافئة وجدعة باللهجة العامية المصرية لتشجيع المستخدم أو الاطمئنان عليه بناءً على تحليله السلوكي.

نوع النغزة المطلوب كتابتها:
${type === "return_after_absence" ? "- ترحيب بعد غياب (غياب أكثر من 48 ساعة). اسأل عنه بدفء." : ""}
${type === "unfinished_action" ? `- تذكير بخطوة لم تكتمل: "${ctx.lastActionText || "خطوتك السابقة"}". فكره بلطف وبدون لوم.` : ""}
${type === "prolonged_stagnation" ? "- تنبيه ركود طويل (لم يفتح التطبيق منذ 5+ أيام). اعرض المساعدة أو الدردشة البسيطة لتفريغ الزحمة." : ""}
${type === "streak_momentum" ? "- تشجيع على زخم وإنجاز رائع (أكمل عدة خطوات بنجاح). هنئه وشجعه على الاستمرار." : ""}
${type === "relapse_signal" ? "- دعم عند إشارات انتكاسة أو تشتت (انخفاض إنجاز الخطوات). ذكره بأنك في ضهره واقترح عليه يرمي الموبايل شوية." : ""}
${type === "late_night_awareness" ? "- تنبيه سهر متأخر بالليل (يسهر كثيراً). شجعه بلطف على إغلاق الشاشة والنوم." : ""}

المؤشرات السلوكية الحالية للمستخدم:
- زخم الحركة: ${Math.round(ctx.scores.momentumScore * 100)}%
- نسبة الالتزام بالخطوات: ${Math.round(ctx.scores.trustScore * 100)}%
- احتمال الانتكاسة: ${Math.round(ctx.scores.relapseProbability * 100)}%
- دين النوم: ${Math.round(ctx.scores.sleepDebtScore * 100)}%

قواعد صارمة للكتابة:
١) اكتب جملة واحدة فقط قصيرة (بين 5 إلى 12 كلمة).
٢) النبرة يجب أن تكون مصرية أصيلة وجدعة ودافئة جداً وليست رسمية أو ذكاء اصطناعي آلي.
٣) لا تستخدم كليشيهات جاهزة مكررة. تجنب البدء بكلمات مكررة دائماً.
٤) استخدم إيموجي واحد معبر في النهاية أو لا تستخدم.
٥) ممنوع تماماً كتابة أي توضيح أو أي كلام إضافي، فقط النص الذي سيظهر للمستخدم.
`.trim();

  try {
    const result = await callGemini({
      systemInstruction,
      userMessage: "اكتب النغزة الآن بالعامية المصرية.",
      temperature: 0.85,
      maxOutputTokens: 50,
      expectJson: false,
    });
    const text = result.text.trim().replace(/^["']|["']$/g, ""); // Clean quotes if any
    if (text && text.length > 5) {
      return text;
    }
  } catch (err) {
    console.error("[initiative-engine] Failed to generate dynamic nudge, falling back to static template:", err);
  }

  // Fallback to static template
  return pickNudgeText(type, ctx.lastActionText);
}

/**
 * Builds the full ProactiveNudge object to return to the frontend.
 */
export async function buildProactiveNudge(
  userId: string
): Promise<ProactiveNudge | null> {
  const result = await evaluateProactiveTriggers(userId);

  if (!result) {
    return null;
  }

  const { type, ctx, confidence } = result;

  if (type === "none") {
    return null;
  }

  // Generate nudge text dynamically via Gemini
  const text = await generateDynamicNudgeText(type, ctx);

  return {
    type,
    text,
    interruptionConfidence: confidence,
    subtext:
      type === "return_after_absence" && ctx.hoursSinceLastSession > 96
        ? `بقالك ${Math.round(ctx.hoursSinceLastSession / 24)} أيام غايب`
        : undefined,
    action:
      type === "streak_momentum"
        ? "عاش.. هكمّل 💪"
        : undefined,
  };
}
