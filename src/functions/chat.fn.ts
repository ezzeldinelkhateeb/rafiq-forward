/**
 * Chat Server Function — the rebuilt brain-connected reply generator.
 *
 * Pipeline:
 * 1. Assemble memory (5 layers → narrative)
 * 2. Analyze behavioral state (rule-based)
 * 3. Select response mode (diversity engine)
 * 4. Build prompt (philosophy + persona + memory + mode)
 * 5. Call Gemini (via @google/genai SDK)
 * 6. Persist interaction + emotional signal (async, non-blocking)
 * 7. Return reply
 */

import { createServerFn } from "@tanstack/react-start";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { callGemini } from "@/lib/ai-client";
import { AI_CONFIG } from "@/config/ai";
import { assembleMemory } from "@/engine/orchestrator/context-assembler";
import { computeDynamicStance } from "@/engine/orchestrator/dynamic-stance";
import { directConversation } from "@/engine/orchestrator/conversation-director";
import { DIALOGUE_ACT_RESPONSE_SCHEMA } from "@/engine/orchestrator/dialogue-act-schemas";
import { DEFAULT_SCORES } from "@/engine/events/event-types";
import { buildPrompt } from "@/engine/orchestrator/prompt-builder";
import { analyzeBehavioralState } from "@/engine/analyzer/state-machine";
import { summarizeSessionAndCompress } from "@/engine/memory/memory-summarizer";
import type { RafiqReply, Persona } from "@/types/companion";

// ─── Main Chat Function ────────────────────────────────────────────────────

export const generateRafiqReply = createServerFn({ method: "POST" })
  .inputValidator(
    (input: {
      userId: string;
      sessionId: string;
      userText: string;
      persona: Persona;
      recentMessageCount: number;
      consecutiveAdviceCount: number;
    }) => input
  )
  .handler(async ({ data }): Promise<RafiqReply> => {
    const {
      userId,
      sessionId,
      userText,
      persona,
      recentMessageCount,
      consecutiveAdviceCount,
    } = data;

    // ── Step 1: Assemble memory (all 5 layers) ──────────────────────────
    const memory = await assembleMemory({
      userId,
      currentMessage: userText,
    });

    // ── Step 2: Analyze behavioral state ────────────────────────────────
    const hourOfDay = new Date().getHours();
    const recentActionDoneRate =
      memory.streakStats.total > 0
        ? memory.streakStats.done / memory.streakStats.total
        : 0;

    const behaviorAnalysis = analyzeBehavioralState({
      userMessage: userText,
      hourOfDay,
      hoursSinceLastSession: memory.hoursSinceLastSession,
      recentActionDoneRate,
      sessionCount: memory.streakStats.total,
      recentEmotions: memory.recentEmotions,
    });

    // ── Step 2b: Compute Dynamic Stance ──
    const stance = computeDynamicStance(
      memory.behavioralScores || DEFAULT_SCORES,
      behaviorAnalysis.state,
      memory.recentEmotions
    );

    // ── Step 3: Direct the conversation ──
    const isActionCompletion = userText.startsWith("تمام، عملت ده:") || userText === "تمام، عملتها ✓";
    const direction = directConversation({
      behaviorState: behaviorAnalysis.state,
      stance,
      consecutiveAdviceCount: consecutiveAdviceCount ?? 0,
      userMessageLength: userText.length,
      hoursSinceLastSession: memory.hoursSinceLastSession,
      hasUnfinishedAction: !!(
        memory.lastAction && !memory.lastAction.done
      ),
      lastActionDone: memory.lastAction?.done ?? true,
      isActionCompletion,
    });

    // ── Step 4: Build prompt ─────────────────────────────────────────────
    const { systemInstruction, userMessage } = buildPrompt({
      stance,
      dialogueAct: direction.dialogueAct,
      memory,
      userMessage: userText,
      behavioralAnalysis: behaviorAnalysis,
      recentRafiqTexts: memory.recentRafiqTexts,
    });

    // ── Step 5: Call Gemini ──────────────────────────────────────────────
    const aiResult = await callGemini({
      model: AI_CONFIG.PRIMARY_MODEL,
      systemInstruction,
      userMessage,
      temperature: AI_CONFIG.TEMPERATURE.COMPANION,
      maxOutputTokens: AI_CONFIG.MAX_TOKENS.COMPANION,
      expectJson: true,
      responseSchema: DIALOGUE_ACT_RESPONSE_SCHEMA,
    });

    // ── Step 6: Parse response ───────────────────────────────────────────
    const parsed = parseReply(aiResult.json, aiResult.text, direction.dialogueAct);
    parsed.emotionalTag = memory.currentEmotionalSignal;

    // ── Step 7: Persist interaction (non-blocking) ───────────────────────
    persistInteraction({
      userId,
      sessionId,
      persona,
      userText,
      parsed,
      mode: direction.dialogueAct,
      emotionalTag: memory.currentEmotionalSignal,
    }).catch(() => {
      // Non-blocking — never block UX on persistence failure
    });

    // ── Step 7.5: Log emotional state to timeline (non-blocking) ─────────
    if (memory.currentEmotionalSignal && memory.currentEmotionalSignal !== "unknown") {
      supabaseAdmin
        .from("emotional_timeline")
        .insert({
          user_id: userId,
          session_id: sessionId,
          emotional_state: memory.currentEmotionalSignal,
          intensity: 5,
          source_text: userText,
        })
        .then(() => {}, () => {});
    }

    // ── Step 8: Update session message count (non-blocking) ──────────────
    const nextMsgCount = recentMessageCount + 1;
    void supabaseAdmin
      .from("sessions")
      .update({ message_count: nextMsgCount })
      .eq("id", sessionId)
      .then(() => undefined);

    // ── Step 9: Background memory compression (non-blocking) ─────────────
    if (nextMsgCount > 0 && nextMsgCount % 5 === 0) {
      summarizeSessionAndCompress(userId, sessionId).catch((e) => {
        console.error("[chat.fn] Background memory compression error:", e);
      });
    }

    return parsed;
  });

// ─── Response Parser ───────────────────────────────────────────────────────

function parseReply(
  json: Record<string, unknown> | undefined,
  rawText: string,
  mode: string
): RafiqReply {
  const id = crypto.randomUUID();

  if (json) {
    const validate = String(json.validate ?? "").trim();
    const reframe = String(json.reframe ?? "").trim();
    const action = String(json.action ?? "").trim();

    return {
      id,
      mode,
      text: validate || rawText.slice(0, 120),
      reframe: reframe || undefined,
      action: action || undefined,
    };
  }

  // Fallback: LLM returned non-JSON or parsing failed completely.
  // Clean rawText from any accidental JSON leftovers (e.g. {"validate":...)
  let cleanText = rawText.trim();
  if (cleanText.startsWith("{") || cleanText.includes('"validate"')) {
    // Try to extract the validate text via regex
    const match = cleanText.match(/"validate"\s*:\s*"([^"\\]*(?:\\.[^"\\]*)*)"/)
               || cleanText.match(/"validate"\s*:\s*"([^"]*)$/);
    if (match) {
      cleanText = match[1];
    } else {
      // Just strip braces, quotes, and JSON keys to make it readable
      cleanText = cleanText
        .replace(/\{?\s*"validate"\s*:\s*"/g, "")
        .replace(/"\s*,\s*"reframe".*/g, "")
        .replace(/"\s*,\s*"action".*/g, "")
        .replace(/["{}]/g, "")
        .trim();
    }
  }

  return {
    id,
    mode,
    text: cleanText.slice(0, 300).trim() || "خد نَفَس عميق 🌬",
    reframe: undefined,
    action: mode === "validate_reframe_act" ? "خد نَفَس عميق ٣ مرات" : undefined,
  };
}

// ─── Persistence ─────────────────────────────────────────────────────

// ─── Load Chat History ───────────────────────────────────────────────────

export interface ChatHistoryItem {
  id: string;
  user_text: string;
  validate: string;
  reframe: string | null;
  action: string | null;
  action_done: boolean;
  response_mode: string;
  emotional_tag: string | null;
}

export const loadChatHistory = createServerFn({ method: "POST" })
  .inputValidator((input: { userId: string; limit?: number }) => input)
  .handler(async ({ data }): Promise<ChatHistoryItem[]> => {
    const { userId, limit = 10 } = data;
    const { data: rows, error } = await supabaseAdmin
      .from("interactions")
      .select(
        "id, user_text, validate, reframe, action, action_done, response_mode, emotional_tag"
      )
      .eq("user_id", userId)
      .order("created_at", { ascending: true })
      .limit(limit);

    if (error || !rows) return [];
    return rows as ChatHistoryItem[];
  });

// ─── Persistence (internal) ──────────────────────────────────────────────────

async function persistInteraction(params: {
  userId: string;
  sessionId: string;
  persona: string;
  userText: string;
  parsed: RafiqReply;
  mode: string;
  emotionalTag: string;
}) {
  const { data: saved } = await supabaseAdmin
    .from("interactions")
    .insert({
      user_id: params.userId,
      session_id: params.sessionId,
      session_ref: params.sessionId,
      persona: params.persona,
      user_text: params.userText,
      validate: params.parsed.text,
      reframe: params.parsed.reframe ?? null,
      action: params.parsed.action ?? null,
      emotional_tag: params.emotionalTag,
      response_mode: params.mode,
    })
    .select("id")
    .single();

  // Update the reply ID to the DB-assigned UUID if save succeeded
  if (saved) {
    params.parsed.id = saved.id;
  }
}
