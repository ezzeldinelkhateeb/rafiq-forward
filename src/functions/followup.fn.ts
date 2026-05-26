/**
 * Followup Server Functions — keep Rafiq present after every action.
 *
 * 1. confirmAndContinue: marks an action done, then immediately generates
 *    a short motivational follow-up message + next planning/serious step.
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
      .eq("user_id", data.userId)
      .single();
    if (!original) {
      throw new Error("Interaction not found or access denied");
    }

    // 2. Mark done
    await supabaseAdmin
      .from("interactions")
      .update({
        action_done: true,
        action_done_at: new Date().toISOString(),
      })
      .eq("id", data.interactionId)
      .eq("user_id", data.userId);

    // 3. Fetch user's identity memory (goals, struggles) to make planning specific
    const { data: identity } = await supabaseAdmin
      .from("identity_memory")
      .select("goals, struggles, personality")
      .eq("user_id", data.userId)
      .single();

    // 4. Log motivated state to emotional timeline (non-blocking)
    supabaseAdmin
      .from("emotional_timeline")
      .insert({
        user_id: data.userId,
        session_id: data.sessionId,
        emotional_state: "motivated",
        intensity: 7,
        source_text: `[نفّذ الأكشن: ${original?.action ?? ""}]`,
      })
      .then(() => {})
      .catch(() => {});

    const voice = PERSONA_VOICES[data.persona];

    const systemInstruction = `
${PHILOSOPHY_PROMPT_FRAGMENT}

أنت رفيق في صورة "${voice.name}": ${voice.description}

اللي قدامك لسه نفّذ الخطوة العملية اللي اقترحتها عليه.
مهمتك الآن:
١) احتفل معاه وشجعه بكلمة جدعة ودودة وبسيطة جداً (${LENGTH_CONSTRAINTS.VALIDATE_MAX_WORDS} كلمات كحد أقصى) — قدّر حركته.
٢) بدلاً من تكرار عبارات التشجيع التافهة أو إعطائه خطوة مادية بسيطة أخرى، انقل الحوار لمرحلة "الجد والتنظيم والتخطيط": ساعده يرتب أفكاره المشوشة، وخذ بيده لوضع خطة أو جدول بسيط وعملي للخروج من المشكلة التي يعاني منها حالياً (بناءً على أهدافه وتحدياته المذكورة أدناه).
٣) اقترح عليه خطوة تخطيطية أو تنظيمية محددة كـ action (مثل: كتابة أول ٣ أولويات وراك، تحديد ساعة معينة للبدء، أو كتابة جدول لليوم).

بيانات المستخدم لمساعدتك في التوجيه:
الأهداف المسجلة له: ${JSON.stringify(identity?.goals || [])}
التحديات والصراعات الحالية: ${JSON.stringify(identity?.struggles || [])}
ملخص شخصيته: "${identity?.personality || ""}"

OUTPUT: JSON فقط بدون markdown:
{"validate":"الاحتفال القصير + التوجيه والبدء في ترتيب الأفكار والخطة بالعامية المصرية وبنبرة جدعة وحنونة","action":"الخطوة التخطيطية العملية القادمة (مثال: اكتبلي أهم ٣ حاجات وراك دلوقتي)"}
`.trim();

    const userPrompt = `
المستند الأصلي للمحادثة:
المستخدم قال: "${original?.user_text ?? ""}"
أنت اقترحت له: "${original?.action ?? ""}"
وهو دلوقتي نفّذ الخطوة دي بنجاح. هاته للخطوة التخطيطية الجاية للبدء في حل مشكلته الكبيرة وترتيب أفكاره.
`.trim();

    const aiResult = await callGemini({
      model: AI_CONFIG.PRIMARY_MODEL,
      systemInstruction,
      userMessage: userPrompt,
      temperature: AI_CONFIG.TEMPERATURE.COMPANION,
      maxOutputTokens: 4000,
      expectJson: true,
      responseSchema: {
        type: "object",
        properties: {
          validate: { type: "string" },
          action: { type: "string" },
        },
        required: ["validate", "action"],
      },
    });

    const validate =
      String(aiResult.json?.validate ?? "").trim() || "عاش يا بطل 👊";
    const action =
      String(aiResult.json?.action ?? "").trim() || "اكتبلي جدول يومك";

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
      .eq("user_id", data.userId)
      .single();
    if (!original) {
      throw new Error("Interaction not found or access denied");
    }

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
المستحدم قال: "${original?.user_text ?? ""}"
الخطوة اللي مش قادر عليها: "${original?.action ?? ""}"
هاته بديل أخف.
`.trim();

    const aiResult = await callGemini({
      model: AI_CONFIG.PRIMARY_MODEL,
      systemInstruction,
      userMessage: userPrompt,
      temperature: 0.9,
      maxOutputTokens: 2000,
      expectJson: true,
      responseSchema: {
        type: "object",
        properties: {
          action: { type: "string" },
        },
        required: ["action"],
      },
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
