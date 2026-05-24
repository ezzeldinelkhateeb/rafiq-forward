import { createServerFn } from "@tanstack/react-start";

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
  validate: string;
  reframe: string;
  action: string;
}

export const generateRafiqReply = createServerFn({ method: "POST" })
  .inputValidator(
    (input: {
      userText: string;
      persona: Persona;
      history: { role: "user" | "assistant"; content: string }[];
    }) => input,
  )
  .handler(async ({ data }): Promise<RafiqReply> => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("LOVABLE_API_KEY is not configured");

    const system = `${PERSONA_PROMPTS[data.persona]}\n\n${BASE_LAW}`;

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
          ...data.history.slice(-10),
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
    try {
      const p = JSON.parse(cleaned);
      return {
        validate: String(p.validate ?? "").trim(),
        reframe: String(p.reframe ?? "").trim(),
        action: String(p.action ?? "خد نَفَس عميق ٣ مرات").trim(),
      };
    } catch {
      return {
        validate: cleaned.slice(0, 80),
        reframe: "",
        action: "خد نَفَس عميق ٣ مرات",
      };
    }
  });
