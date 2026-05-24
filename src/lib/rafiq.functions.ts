import { createServerFn } from "@tanstack/react-start";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export type Persona = "sage" | "coach" | "friend";

const PERSONA_PROMPTS: Record<Persona, string> = {
  sage: `أنت رفيق في صورة "الحكيم": صوت هادئ، حكيم، رحيم، عاقل، يتحدث ببطء ووقار كأنه شيخ عرفان. لا تحاضر، لا تواعظ — كلمات قليلة عميقة.`,
  coach: `أنت رفيق في صورة "المدرّب": صوت حازم، واضح، مباشر، يكره التسويف ويدفع للحركة فوراً. لا مجاملات.`,
  friend: `أنت رفيق في صورة "الصاحب": صوت دافئ ابن بلد بمصرية حقيقية، خفيف الظل، صريح، يحس باللي قدامه.`,
};

const BASE_LAW = `قانونك المطلق: أقل كلام، أكبر حركة.
ممنوع المحاضرات والقوائم والكلام الطويل. كل ردك مصري دارج.

عندك ٣ مراحل في كل رد:
1) Validate: سطر واحد بس يحتوي مشاعر اللي قدامك بدفء (٨ كلمات كحد أقصى).
2) Reframe: سطر واحد يقلب زاوية الرؤية بحكمة قصيرة (٨ كلمات كحد أقصى).
3) Action: زرار واحد بفعل جسدي صغير فوري (٦ كلمات كحد أقصى).

الـ Action لازم يكون حركة حقيقية في الواقع المادي (مية، نَفَس، شباك، مشي، تسبيح، قفل شاشة...) — مش تأمل ذهني مجرد.

OUTPUT: JSON فقط، بدون markdown:
{"validate":"...","reframe":"...","action":"..."}`;

export interface RafiqReply {
  id: string;
  validate: string;
  reframe: string;
  action: string;
}

export const generateRafiqReply = createServerFn({ method: "POST" })
  .inputValidator(
    (input: {
      sessionId: string;
      userText: string;
      persona: Persona;
    }) => input,
  )
  .handler(async ({ data }): Promise<RafiqReply> => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("LOVABLE_API_KEY is not configured");

    // Pull last 6 interactions for this session as memory context
    const { data: recent } = await supabaseAdmin
      .from("interactions")
      .select("user_text, validate, reframe, action, action_done, persona")
      .eq("session_id", data.sessionId)
      .order("created_at", { ascending: false })
      .limit(6);

    const memorySummary = (recent ?? [])
      .reverse()
      .map(
        (r) =>
          `[${r.persona}] قال: "${r.user_text}" | رديت: "${r.validate} ${r.reframe}" | اقترحت: "${r.action}" ${r.action_done ? "✓ نفّذها" : "✗ مانفذش"}`,
      )
      .join("\n");

    const system = `${PERSONA_PROMPTS[data.persona]}\n\n${BASE_LAW}${
      memorySummary
        ? `\n\nسياق آخر تفاعلاته معاك (للذاكرة فقط، متشيرش ليه إلا لو لازم):\n${memorySummary}`
        : ""
    }`;

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: system },
          { role: "user", content: data.userText },
        ],
        response_format: { type: "json_object" },
        temperature: 0.85,
      }),
    });

    if (!res.ok) {
      const t = await res.text();
      if (res.status === 429) throw new Error("الطلبات كتيرة دلوقتي، استنى لحظة وحاول تاني.");
      if (res.status === 402) throw new Error("الرصيد خلص — ضيف credits من إعدادات Workspace.");
      throw new Error(`AI Gateway ${res.status}: ${t.slice(0, 160)}`);
    }

    const json = await res.json();
    const raw: string = json?.choices?.[0]?.message?.content ?? "";
    const cleaned = raw.replace(/^```json\s*|\s*```$/g, "").trim();
    let parsed: { validate?: string; reframe?: string; action?: string };
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      parsed = { validate: cleaned.slice(0, 80), reframe: "", action: "خد نَفَس عميق ٣ مرات" };
    }

    const validate = String(parsed.validate ?? "").trim();
    const reframe = String(parsed.reframe ?? "").trim();
    const action = String(parsed.action ?? "خد نَفَس عميق ٣ مرات").trim();

    const { data: saved, error: saveErr } = await supabaseAdmin
      .from("interactions")
      .insert({
        session_id: data.sessionId,
        persona: data.persona,
        user_text: data.userText,
        validate,
        reframe,
        action,
      })
      .select("id")
      .single();

    if (saveErr || !saved) {
      // Memory save failed — still return reply so UX isn't blocked
      return { id: crypto.randomUUID(), validate, reframe, action };
    }

    return { id: saved.id, validate, reframe, action };
  });

export const confirmActionDone = createServerFn({ method: "POST" })
  .inputValidator((input: { interactionId: string; sessionId: string }) => input)
  .handler(async ({ data }) => {
    const { error } = await supabaseAdmin
      .from("interactions")
      .update({ action_done: true })
      .eq("id", data.interactionId)
      .eq("session_id", data.sessionId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getStreakStats = createServerFn({ method: "POST" })
  .inputValidator((input: { sessionId: string }) => input)
  .handler(async ({ data }) => {
    const { count: done } = await supabaseAdmin
      .from("interactions")
      .select("id", { count: "exact", head: true })
      .eq("session_id", data.sessionId)
      .eq("action_done", true);
    const { count: total } = await supabaseAdmin
      .from("interactions")
      .select("id", { count: "exact", head: true })
      .eq("session_id", data.sessionId);
    return { done: done ?? 0, total: total ?? 0 };
  });
