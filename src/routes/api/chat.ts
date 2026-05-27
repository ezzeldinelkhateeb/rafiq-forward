import { createFileRoute } from "@tanstack/react-router";
import { assembleMemory } from "@/engine/orchestrator/context-assembler";
import { analyzeBehavioralState } from "@/engine/analyzer/state-machine";
import { selectResponseMode } from "@/engine/orchestrator/response-strategy";
import { buildPrompt } from "@/engine/orchestrator/prompt-builder";
import { callGeminiStream, getSchemaForMode } from "@/lib/ai-client";
import { AI_CONFIG } from "@/config/ai";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { summarizeSessionAndCompress } from "@/engine/memory/memory-summarizer";
import { extractBrainNodesFromChat } from "@/functions/brain-map.fn";

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const body = await request.json();
          const { userId, sessionId, userText, persona, recentMessageCount, consecutiveAdviceCount } = body;

          if (!userId || !sessionId || !userText || !persona) {
            return new Response("Missing parameters", { status: 400 });
          }

          // ── Step 1: Assemble memory (all 5 layers) ──
          const memory = await assembleMemory({
            userId,
            currentMessage: userText,
          });

          // ── Step 2: Analyze behavioral state ──
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

          // ── Step 3: Select response mode ──
          const isActionCompletion = userText.startsWith("تمام، عملت ده:") || userText === "تمام، عملتها ✓";
          const mode = selectResponseMode({
            behaviorState: behaviorAnalysis.state,
            persona,
            hoursSinceLastSession: memory.hoursSinceLastSession,
            hasUnfinishedAction: !!(
              memory.lastAction && !memory.lastAction.done
            ),
            lastActionDone: memory.lastAction?.done ?? true,
            recentMessageCount: recentMessageCount ?? 0,
            userMessageLength: userText.length,
            consecutiveAdviceCount: consecutiveAdviceCount ?? 0,
            hasRelationshipMemory: memory.relationshipNarrative.length > 0,
            isActionCompletion,
            recentModes: memory.recentModes,
          });

          // ── Step 4: Build prompt ──
          const { systemInstruction, userMessage } = buildPrompt({
            persona,
            mode,
            memory,
            userMessage: userText,
          });

          // ── Step 5: Call Gemini Streaming ──
          const schema = getSchemaForMode(mode);
          const responseStream = await callGeminiStream({
            model: AI_CONFIG.PRIMARY_MODEL,
            systemInstruction,
            userMessage,
            temperature: AI_CONFIG.COMPANION_TEMPERATURES[mode] ?? AI_CONFIG.TEMPERATURE.COMPANION,
            maxOutputTokens: AI_CONFIG.MAX_TOKENS.COMPANION,
            responseSchema: schema,
          });

          // ── Step 6: Create ReadableStream ──
          const encoder = new TextEncoder();
          let fullText = "";

          const customStream = new ReadableStream({
            async start(controller) {
              try {
                for await (const chunk of responseStream) {
                  const text = chunk.text ?? "";
                  fullText += text;
                  controller.enqueue(encoder.encode(text));
                }

                // ── Step 7: Persist interaction in background (async) ──
                let parsed = { text: "", reframe: "", action: "" };
                try {
                  // Attempt JSON parsing on complete accumulated text
                  const cleanText = fullText.trim()
                    .replace(/^```(?:json|js|javascript)?\s*/i, "")
                    .replace(/\s*```$/i, "")
                    .trim();
                  const json = JSON.parse(cleanText);
                  parsed.text = json.validate ?? "";
                  parsed.reframe = json.reframe ?? "";
                  parsed.action = json.action ?? "";
                } catch {
                  // Fallback: extract using regex from partial/incomplete JSON
                  const validateMatch = fullText.match(/"validate"\s*:\s*"([^"\\]*(?:\\.[^"\\]*)*)"/) 
                                     || fullText.match(/"validate"\s*:\s*"([^"]*)$/);
                  const reframeMatch = fullText.match(/"reframe"\s*:\s*"([^"\\]*(?:\\.[^"\\]*)*)"/)
                                    || fullText.match(/"reframe"\s*:\s*"([^"]*)$/);
                  const actionMatch = fullText.match(/"action"\s*:\s*"([^"\\]*(?:\\.[^"\\]*)*)"/)
                                   || fullText.match(/"action"\s*:\s*"([^"]*)$/);
                  
                  parsed.text = validateMatch ? validateMatch[1] : fullText.slice(0, 300);
                  parsed.reframe = reframeMatch ? reframeMatch[1] : "";
                  parsed.action = actionMatch ? actionMatch[1] : "";
                }

                // Clean braces/quotes from text if raw JSON leaked
                parsed.text = parsed.text
                  .replace(/\{?\s*"validate"\s*:\s*"/g, "")
                  .replace(/"\s*,\s*"reframe".*/g, "")
                  .replace(/"\s*,\s*"action".*/g, "")
                  .replace(/["{}]/g, "")
                  .trim();

                // Save interaction to Supabase
                const { data: saved } = await supabaseAdmin
                  .from("interactions")
                  .insert({
                    user_id: userId,
                    session_id: sessionId,
                    session_ref: sessionId,
                    persona,
                    user_text: userText,
                    validate: parsed.text,
                    reframe: parsed.reframe || null,
                    action: parsed.action || null,
                    emotional_tag: memory.currentEmotionalSignal,
                    response_mode: mode,
                  })
                  .select("id")
                  .single();

                // Log emotional timeline entry
                if (memory.currentEmotionalSignal && memory.currentEmotionalSignal !== "unknown") {
                  await supabaseAdmin.from("emotional_timeline").insert({
                    user_id: userId,
                    session_id: sessionId,
                    emotional_state: memory.currentEmotionalSignal,
                    intensity: 5,
                    source_text: userText,
                  });
                }

                // Update session count and handle summarizer
                const nextMsgCount = (recentMessageCount ?? 0) + 1;
                await supabaseAdmin
                  .from("sessions")
                  .update({ message_count: nextMsgCount })
                  .eq("id", sessionId);

                if (nextMsgCount > 0 && nextMsgCount % 5 === 0) {
                  void summarizeSessionAndCompress(userId, sessionId).catch((e) => {
                    console.error("[api/chat] Summarizer error:", e);
                  });
                }

                // Trigger automated brain-node extraction in background
                extractBrainNodesFromChat({ data: { userId, userText } }).catch((e) => {
                  console.error("[api/chat] Error extracting brain nodes:", e);
                });

                // Send metadata suffix at the end of the stream
                const metadata = {
                  id: saved?.id ?? crypto.randomUUID(),
                  mode,
                  emotionalTag: memory.currentEmotionalSignal,
                };
                controller.enqueue(encoder.encode(`__METADATA__${JSON.stringify(metadata)}`));
              } catch (e) {
                console.error("[api/chat] Error during stream processing:", e);
              } finally {
                controller.close();
              }
            },
          });

          return new Response(customStream, {
            headers: {
              "Content-Type": "text/event-stream; charset=utf-8",
              "Cache-Control": "no-cache",
              "Connection": "keep-alive",
            },
          });
        } catch (e: any) {
          console.error("[api/chat] Route handler error:", e);
          return new Response(JSON.stringify({ error: e.message }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }
      },
    },
  },
});
