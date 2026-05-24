/**
 * Context Assembler — pulls from all 5 memory layers and assembles
 * the AssembledMemory object that the Prompt Builder consumes.
 *
 * "Rafiq remembers stories, not just states."
 * This module translates DB rows → human narrative.
 */

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { AssembledMemory } from "@/types/memory";
import type { EmotionalState } from "@/types/memory";

// ─── Main Assembler ────────────────────────────────────────────────────────

export async function assembleMemory(params: {
  userId: string;
  currentMessage: string;
}): Promise<AssembledMemory> {
  const { userId, currentMessage } = params;

  // Parallel DB queries — all 5 layers
  const [
    identityResult,
    recentInteractions,
    relationshipSnapshot,
    emotionalHistory,
    streakResult,
  ] = await Promise.allSettled([
    fetchIdentityMemory(userId),
    fetchRecentInteractions(userId),
    fetchLatestSnapshot(userId, "relationship"),
    fetchRecentEmotionalTimeline(userId),
    fetchStreakStats(userId),
  ]);

  // Extract values safely
  const identity =
    identityResult.status === "fulfilled" ? identityResult.value : null;
  const interactions =
    recentInteractions.status === "fulfilled" ? recentInteractions.value : [];
  const relSnapshot =
    relationshipSnapshot.status === "fulfilled"
      ? relationshipSnapshot.value
      : null;
  const emotional =
    emotionalHistory.status === "fulfilled" ? emotionalHistory.value : [];
  const streak =
    streakResult.status === "fulfilled"
      ? streakResult.value
      : { done: 0, total: 0 };

  // ── Layer 1: Identity narrative ────────────────────────────────────────
  const identityNarrative = buildIdentityNarrative(identity);

  // ── Layer 2: Recent history narrative ─────────────────────────────────
  const recentHistoryNarrative = buildRecentHistoryNarrative(interactions);

  // ── Layer 3 & 4: Relationship + emotional narrative ────────────────────
  const relationshipNarrative = relSnapshot?.content ?? "";

  // ── Patterns narrative ─────────────────────────────────────────────────
  const patternsNarrative = buildPatternsNarrative(userId);

  // ── Timing data ────────────────────────────────────────────────────────
  const hoursSinceLastSession = computeHoursSinceLastSession(interactions);

  // ── Last action ────────────────────────────────────────────────────────
  const lastAction = buildLastActionContext(interactions);

  // ── Current emotional signal (rule-based, no LLM) ─────────────────────
  const currentEmotionalSignal = detectCurrentEmotion(
    currentMessage,
    emotional
  );

  return {
    identityNarrative,
    recentHistoryNarrative,
    relationshipNarrative,
    patternsNarrative,
    currentEmotionalSignal,
    hoursSinceLastSession,
    lastAction,
    streakStats: streak,
  };
}

// ─── DB Fetchers ───────────────────────────────────────────────────────────

async function fetchIdentityMemory(userId: string) {
  const { data } = await supabaseAdmin
    .from("identity_memory")
    .select("goals, struggles, personality, preferred_tone, trigger_words")
    .eq("user_id", userId)
    .single();
  return data;
}

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

async function fetchLatestSnapshot(
  userId: string,
  type: "relationship" | "weekly" | "emotional_arc"
) {
  const { data } = await supabaseAdmin
    .from("memory_snapshots")
    .select("content, covers_from, covers_to, created_at")
    .eq("user_id", userId)
    .eq("snapshot_type", type)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();
  return data;
}

async function fetchRecentEmotionalTimeline(userId: string) {
  const { data } = await supabaseAdmin
    .from("emotional_timeline")
    .select("emotional_state, intensity, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(10);
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

function buildIdentityNarrative(
  identity: {
    goals: string[] | null;
    struggles: string[] | null;
    personality: string | null;
    preferred_tone: string | null;
    trigger_words: string[] | null;
  } | null
): string {
  if (!identity) return "";

  const parts: string[] = [];
  if (identity.goals?.length) {
    parts.push(`هدفه: ${identity.goals.join("، ")}`);
  }
  if (identity.struggles?.length) {
    parts.push(`بيصارع: ${identity.struggles.join("، ")}`);
  }
  if (identity.personality) {
    parts.push(identity.personality);
  }
  return parts.join(". ");
}

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

  // Take last 4, reverse to chronological order
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

function buildPatternsNarrative(_userId: string): string {
  // Phase 1: returns empty — pattern detector populates this in Phase 2
  // The DB query would go here when pattern detection is active
  return "";
}

function computeHoursSinceLastSession(
  interactions: Array<{ created_at: string }>
): number {
  if (interactions.length === 0) return 0;
  // interactions are ordered DESC, so [0] is most recent
  const lastAt = new Date(interactions[0].created_at);
  const now = new Date();
  return (now.getTime() - lastAt.getTime()) / (1000 * 60 * 60);
}

function buildLastActionContext(
  interactions: Array<{
    action: string | null;
    action_done: boolean;
    created_at: string;
  }>
): AssembledMemory["lastAction"] {
  // Find most recent interaction with an action
  const withAction = interactions.find((i) => i.action);
  if (!withAction || !withAction.action) return undefined;

  const daysAgo = Math.floor(
    (Date.now() - new Date(withAction.created_at).getTime()) /
      (1000 * 60 * 60 * 24)
  );

  return {
    text: withAction.action,
    done: withAction.action_done,
    daysAgo,
  };
}

function detectCurrentEmotion(
  message: string,
  _recentEmotional: Array<{ emotional_state: string }>
): EmotionalState {
  const lower = message.toLowerCase();

  if (
    ["تعبت", "مش كويس", "صعب", "ضايق", "مستنزف", "تعب"].some((s) =>
      lower.includes(s)
    )
  )
    return "drained";
  if (
    ["قلقان", "خايف", "مش متأكد", "توتر", "ضغط"].some((s) =>
      lower.includes(s)
    )
  )
    return "anxious";
  if (
    ["مشتت", "زحمة", "مش قادر أركز", "تقطع"].some((s) => lower.includes(s))
  )
    return "scattered";
  if (
    ["عملت", "خلصت", "أنجزت", "تمام", "كويس"].some((s) => lower.includes(s))
  )
    return "motivated";
  if (["بدأت", "راجع", "حاول", "هحاول"].some((s) => lower.includes(s)))
    return "rebuilding";

  return "unknown";
}
