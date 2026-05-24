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

// ─── Trigger Definitions ───────────────────────────────────────────────────

interface TriggerContext {
  userId: string;
  hoursSinceLastSession: number;
  lastActionDone: boolean;
  lastActionText: string | null;
  recentActionDoneRate: number; // 0–1 over last 7 sessions
  recentSessionCount: number; // sessions in last 7 days
  hourOfDay: number;
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

/** 5+ days with no sessions at all */
function checkProlongedStagnation(ctx: TriggerContext): TriggerResult {
  return {
    triggered:
      ctx.recentSessionCount === 0 && ctx.hoursSinceLastSession > 120,
    type: "prolonged_stagnation",
    priority: 3,
  };
}

/** 3+ actions completed in past week — momentum worthy of recognition */
function checkStreakMomentum(ctx: TriggerContext): TriggerResult {
  return {
    triggered:
      ctx.recentActionDoneRate >= 0.6 &&
      ctx.recentSessionCount >= 3 &&
      ctx.hoursSinceLastSession < 48,
    type: "streak_momentum",
    priority: 4,
  };
}

// ─── Trigger Orchestrator ─────────────────────────────────────────────────

/**
 * Evaluates all triggers in priority order.
 * Returns the highest-priority triggered result, or null.
 */
export async function evaluateProactiveTriggers(
  userId: string
): Promise<{ type: ProactiveTrigger; ctx: TriggerContext } | null> {
  const ctx = await buildTriggerContext(userId);

  const triggers = [
    checkReturnAfterAbsence(ctx),
    checkUnfinishedAction(ctx),
    checkProlongedStagnation(ctx),
    checkStreakMomentum(ctx),
  ]
    .filter((t) => t.triggered)
    .sort((a, b) => a.priority - b.priority);

  if (triggers.length === 0) return null;

  return { type: triggers[0].type, ctx };
}

// ─── Context Builder ──────────────────────────────────────────────────────

async function buildTriggerContext(userId: string): Promise<TriggerContext> {
  const now = new Date();

  // Fetch last session info + recent action stats
  const [lastInteractionResult, recentStatsResult] = await Promise.allSettled([
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

  return {
    userId,
    hoursSinceLastSession,
    lastActionDone: lastInteraction?.action_done ?? true,
    lastActionText: lastInteraction?.action ?? null,
    recentActionDoneRate,
    recentSessionCount: recentInteractions.length,
    hourOfDay: now.getHours(),
  };
}

// ─── Nudge Text Templates (static, diversity-seeded) ──────────────────────

/**
 * Template pools per trigger type.
 * The nudge generator picks from these + optionally LLM-personalizes.
 * Keeping static variants prevents prompt engineering for simple cases.
 */
export const NUDGE_TEMPLATES: Record<
  Exclude<ProactiveTrigger, "relapse_signal" | "none">,
  string[]
> = {
  return_after_absence: [
    "حمد الله على السلامة! فين أراضيك؟ 👀",
    "غبت فين يا صديق؟ لعله خير؟",
    "وحشتنا والله.. طمني عليك، عامل إيه؟",
    "طولت الغيبة المرة دي.. كله تمام؟",
  ],
  unfinished_action: [
    "شكلنا كسلنا عن الخطوة اللي فاتت.. جه أوانها ولا إيه؟ 😉",
    "الحاجة اللي اتفقنا عليها لسه مستنياك على فكرة! 🎯",
    "الخطوة الصغيرة اللي اتفقنا عليها.. عملت فيها إيه؟",
  ],
  prolonged_stagnation: [
    "فين أيامك؟ وحشتنا دردشتنا.. نبدأ خطوة جديدة سوا؟",
    "بقيت بتغيب كتير.. أنا هنا ومستنيك لما تحب تفوق.",
    "أنا دايماً هنا في ضهرك لو دماغك زحمتك وحبيت تفصل.",
  ],
  streak_momentum: [
    "عاش يا بطل! شايفك بتعفّر وبتتحرك صح 👊",
    "الأسبوع ده كان ضرب نار.. إيه الخطوة الجاية عشان نكمل؟",
    "الزخم حلو والفرمة ماشية تمام، كمل كدة ومتوقفش!",
  ],
};

/**
 * Picks a nudge text — deterministic rotation based on day of week.
 * No LLM call for basic nudges (fast, cheap, predictable).
 */
export function pickNudgeText(
  type: Exclude<ProactiveTrigger, "relapse_signal" | "none">,
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

  const { type, ctx } = result;

  if (type === "relapse_signal" || type === "none") {
    return null;
  }

  const text = pickNudgeText(type, ctx.lastActionText);

  return {
    type,
    text,
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
