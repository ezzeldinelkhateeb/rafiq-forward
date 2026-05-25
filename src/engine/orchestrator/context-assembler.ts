/**
 * Context Assembler — pulls relevant memory from `interactions` and
 * compresses it into AssembledMemory for the Prompt Builder.
 *
 * Phase 1: only `interactions` table is used. Future layers (identity,
 * snapshots, emotional timeline) will plug in here without API changes.
 */

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { AssembledMemory, EmotionalState } from "@/types/memory";

export async function assembleMemory(params: {
  userId: string;
  currentMessage: string;
}): Promise<AssembledMemory> {
  const { userId, currentMessage } = params;

  const [recentResult, streakResult] = await Promise.allSettled([
    fetchRecentInteractions(userId),
    fetchStreakStats(userId),
  ]);

  const interactions =
    recentResult.status === "fulfilled" ? recentResult.value : [];
  const streak =
    streakResult.status === "fulfilled"
      ? streakResult.value
      : { done: 0, total: 0 };

  return {
    identityNarrative: "",
    recentHistoryNarrative: buildRecentHistoryNarrative(interactions),
    relationshipNarrative: "",
    patternsNarrative: "",
    currentEmotionalSignal: detectCurrentEmotion(currentMessage),
    hoursSinceLastSession: computeHoursSinceLastSession(interactions),
    lastAction: buildLastActionContext(interactions),
    streakStats: streak,
  };
}

// ─── DB Fetchers ───────────────────────────────────────────────────────────

async function fetchRecentInteractions(userId: string) {
  const { data } = await supabaseAdmin
    .from("interactions")
    .select(
      "user_text, validate, reframe, action, action_done, persona, created_at, emotional_tag"
    )
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(8);
  return data ?? [];
}

async function fetchStreakStats(userId: string) {
  const [doneResult, totalResult] = await Promise.all([
    supabaseAdmin
      .from("interactions")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("action_done", true),
    supabaseAdmin
      .from("interactions")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId),
  ]);
  return {
    done: doneResult.count ?? 0,
    total: totalResult.count ?? 0,
  };
}

// ─── Narrative Builders ────────────────────────────────────────────────────

function buildRecentHistoryNarrative(
  interactions: Array<{
    user_text: string;
    validate: string | null;
    action: string | null;
    action_done: boolean;
    created_at: string;
  }>
): string {
  if (interactions.length === 0) return "";
  const recent = [...interactions].reverse().slice(-4);
  return recent
    .map((r) => {
      const actionStatus = r.action
        ? r.action_done
          ? `(عمل: "${r.action}" ✓)`
          : `(اقترح: "${r.action}" — لم ينفذ)`
        : "";
      return `قال: "${r.user_text.slice(0, 60)}" ${actionStatus}`.trim();
    })
    .join(" | ");
}

function computeHoursSinceLastSession(
  interactions: Array<{ created_at: string }>
): number {
  if (interactions.length === 0) return 0;
  const lastAt = new Date(interactions[0].created_at);
  return (Date.now() - lastAt.getTime()) / (1000 * 60 * 60);
}

function buildLastActionContext(
  interactions: Array<{
    action: string | null;
    action_done: boolean;
    created_at: string;
  }>
): AssembledMemory["lastAction"] {
  const withAction = interactions.find((i) => i.action);
  if (!withAction || !withAction.action) return undefined;
  const daysAgo = Math.floor(
    (Date.now() - new Date(withAction.created_at).getTime()) /
      (1000 * 60 * 60 * 24)
  );
  return { text: withAction.action, done: withAction.action_done, daysAgo };
}

function detectCurrentEmotion(message: string): EmotionalState {
  const lower = message.toLowerCase();
  if (["تعبت", "مش كويس", "صعب", "ضايق", "مستنزف", "تعب"].some((s) => lower.includes(s)))
    return "drained";
  if (["قلقان", "خايف", "مش متأكد", "توتر", "ضغط"].some((s) => lower.includes(s)))
    return "anxious";
  if (["مشتت", "زحمة", "مش قادر أركز", "تقطع", "دوشة"].some((s) => lower.includes(s)))
    return "scattered";
  if (["عملت", "خلصت", "أنجزت", "تمام", "كويس"].some((s) => lower.includes(s)))
    return "motivated";
  if (["بدأت", "راجع", "حاول", "هحاول"].some((s) => lower.includes(s)))
    return "rebuilding";
  return "unknown";
}
