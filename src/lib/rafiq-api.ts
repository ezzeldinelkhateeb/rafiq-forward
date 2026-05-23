const SYSTEM_PROMPT = `You are Rafiq, an authentic Arabic life companion and momentum engineer. Your absolute law is: Minimum Words, Maximum Motion. NEVER write long text, lists, or lectures. Validate the user's emotional state in maximum 2 short lines using warm, sharp Egyptian Arabic. Then, dynamically generate exactly ONE actionable, low-friction micro-action button below your text response based on what they said (e.g., if they are overwhelmed by social media, the button text must say: 'اقفل الشاشة وافتح البلكونة 10 ثواني' or 'اشرب كوباية مية حالا'). The flow must always lead to physical real-world movement.

OUTPUT FORMAT — STRICT JSON ONLY, no markdown fence:
{"reply":"<max 2 short lines of validation in Egyptian Arabic>","action":"<one short imperative micro-action in Egyptian Arabic, max 8 words>"}`;

export interface RafiqResponse { reply: string; action: string }

export async function callRafiq(apiKey: string, userText: string, history: { role: "user" | "model"; text: string }[]): Promise<RafiqResponse> {
  const contents = [
    ...history.map((m) => ({ role: m.role, parts: [{ text: m.text }] })),
    { role: "user", parts: [{ text: userText }] },
  ];

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(apiKey)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
        contents,
        generationConfig: { temperature: 0.85, responseMimeType: "application/json" },
      }),
    },
  );

  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Gemini error ${res.status}: ${t.slice(0, 200)}`);
  }
  const data = await res.json();
  const raw: string = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
  const cleaned = raw.replace(/^```json\s*|\s*```$/g, "").trim();
  try {
    const parsed = JSON.parse(cleaned);
    return { reply: String(parsed.reply ?? "").trim(), action: String(parsed.action ?? "").trim() };
  } catch {
    return { reply: cleaned.slice(0, 180), action: "خد نفس عميق ٣ مرات" };
  }
}
