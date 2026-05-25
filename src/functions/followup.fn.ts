/**
 * Followup Server Functions — keep Rafiq present after every action.
 *
 * 1. confirmAndContinue: marks an action done, then immediately generates
 *    a short motivational follow-up message + next micro-step.
 * 2. regenerateAlternative: when the user can't do the suggested action,
 *    swap the action in place with an easier alternative path.
 */

import { createServerFn } from "@tanstack/react-start";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { callGemini } from "@/lib/ai-client";
import { AI_CONFIG } from "@/config/ai";
import {
  PERSONA_VOICES,
  PHILOSOPHY_PROMPT_FRAGMENT,
  LENGTH_CONSTRAINTS,
} from "@/engine/philosophy/core-beliefs";
import type { RafiqReply, Persona } from "@/types/companion";

// ─── 1. Confirm action done + generate next-step motivation ───────────────

export const confirmAndContinue = createServerFn({ method: "POST" })
  .inputValidator(
    (input: {
      interactionId: string;
      userId: string;
      sessionId: string;
      persona: Persona;
    }) => input
  )
  .handler(async ({ data }): Promise<RafiqReply> => {
    // 1. Fetch original interaction
    const { data: original } = await supabaseAdmin
      .from("interactions")
      .select("user_text, validate, reframe, action, persona")
      .eq("id", data.interactionId)
      .single();

    // 2. Mark done
    await supabaseAdmin
      .from("interactions")
      .update({
        action_done: true,
        action_done_at: new Date().toISOString(),
      })
      .eq("id", data.interactionId)
      .eq("user_id", data.userId);

    const voice = PERSONA_VOICES[data.persona];

    const systemInstruction = `
${PHILOSOPHY_PROMPT_FRAGMENT}

أنت رفيق في صورة "${voice.name}": ${voice.description}

اللي قدامك لسه نفّذ الخطوة اللي اقترحتها — ${voice.celebrateStyle}.
ردك دلوقتي عبارة عن جزئين قصيرين:
١) تحفيز قصير وحقيقي على إنجازه (${LENGTH_CONSTRAINTS.VALIDATE_MAX_WORDS} كلمات كحد أقصى) — مش مجاملة جوفاء.
٢) خطوة جديدة صغيرة جداً تبني على اللي عمله الآن، تستمر الزخم (${LENGTH_CONSTRAINTS.ACTION_MAX_WORDS} كلمات كحد أقصى) — حركة جسدية حقيقية.

OUTPUT: JSON فقط بدون markdown:
{"validate":"...","action":"..."}
`.trim();

    const userPrompt = `
المستخدم قال أصلاً: "${original?.user_text ?? ""}"
أنت اقترحت: "${original?.action ?? ""}"
وهو دلوقتي نفّذها. هاته للخطوة الجاية.
`.trim();

    const aiResult = await callGemini({
      model: AI_CONFIG.PRIMARY_MODEL,
      systemInstruction,
      userMessage: userPrompt,
      temperature: AI_CONFIG.TEMPERATURE.COMPANION,
      maxOutputTokens: 200,
      expectJson: true,
    });

    const validate =
      String(aiResult.json?.validate ?? "").trim() || "عاش يا بطل 👊";
    const action =
      String(aiResult.json?.action ?? "").trim() || "خد نَفَس عميق تاني";

    // Persist as new interaction (parent = original)
    const { data: saved } = await supabaseAdmin
      .from("interactions")
      .insert({
        user_id: data.userId,
        session_id: data.sessionId,
        session_ref: data.sessionId,
        persona: data.persona,
        user_text: `[نفّذ: ${original?.action ?? ""}]`,
        validate,
        action,
        response_mode: "celebrate_continue",
        parent_interaction_id: data.interactionId,
      })
      .select("id")
      .single();

    return {
      id: saved?.id ?? crypto.randomUUID(),
      mode: "celebrate",
      text: validate,
      action,
    };
  });

// ─── 2. Generate an easier alternative action ─────────────────────────────

export const regenerateAlternative = createServerFn({ method: "POST" })
  .inputValidator(
    (input: {
      interactionId: string;
      userId: string;
      persona: Persona;
    }) => input
  )
  .handler(async ({ data }): Promise<{ action: string }> => {
    const { data: original } = await supabaseAdmin
      .from("interactions")
      .select("user_text, action")
      .eq("id", data.interactionId)
      .single();

    const voice = PERSONA_VOICES[data.persona];

    const systemInstruction = `
${PHILOSOPHY_PROMPT_FRAGMENT}

أنت رفيق في صورة "${voice.name}".
الخطوة اللي اقترحتها قبل كده الشخص مش قادر يعملها دلوقتي.
اقترح خطوة بديلة أسهل وأخف، حركة جسدية صغيرة جداً ممكن يعملها وهو قاعد مكانه.
ممنوع تعيد نفس الخطوة. خليها مختلفة وأخف بشكل واضح.

OUTPUT: JSON فقط: {"action":"..."}
(${LENGTH_CONSTRAINTS.ACTION_MAX_WORDS} كلمات كحد أقصى)
`.trim();

    const userPrompt = `
المستخدم قال: "${original?.user_text ?? ""}"
الخطوة اللي مش قادر عليها: "${original?.action ?? ""}"
هاته بديل أخف.
`.trim();

    const aiResult = await callGemini({
      model: AI_CONFIG.PRIMARY_MODEL,
      systemInstruction,
      userMessage: userPrompt,
      temperature: 0.9,
      maxOutputTokens: 80,
      expectJson: true,
    });

    const action =
      String(aiResult.json?.action ?? "").trim() || "خد ٣ أنفاس بس";

    // Update original interaction's action in place
    await supabaseAdmin
      .from("interactions")
      .update({ action })
      .eq("id", data.interactionId)
      .eq("user_id", data.userId);

    return { action };
  });
