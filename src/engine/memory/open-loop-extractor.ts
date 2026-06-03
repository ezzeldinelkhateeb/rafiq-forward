import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { callGemini } from "@/lib/ai-client";
import { AI_CONFIG } from "@/config/ai";

export interface ExtractedOpenLoop {
  loop_type: "promise" | "postponement" | "excuse" | "avoidance" | "win" | "collapse";
  content: string;
  expected_by: string | null;
}

/**
 * Background analyzer that extracts commitments, promises, avoidances, or wins
 * from the user's message and stores them in the database.
 */
export async function extractAndStoreOpenLoops(params: {
  userId: string;
  interactionId: string;
  userText: string;
  rafiqText: string;
}): Promise<void> {
  const { userId, interactionId, userText, rafiqText } = params;

  try {
    const systemInstruction = `
أنت جزء من نظام ذكاء اصطناعي سلوكي (مساعد رقمي اسمه رفيق).
مهمتك: تحليل الحوار الأخير بين المستخدم ورفيق لاستخراج أي "حلقات مفتوحة" (Open Loops) سلوكية قام بها المستخدم.

الحلقات المفتوحة التي تهمنا هي:
١) وعد (promise): التزام أو عهد قطعه المستخدم على نفسه (مثال: "هذاكر بكرة"، "هقرأ الكتاب ده بالليل").
٢) تأجيل (postponement): تأجيل فعل شيء ما لوقت لاحق (مثال: "هعمل ده بعدين"، "مش فاضي دلوقتي وهعمله الساعة ٧").
٣) عذر (excuse): تبرير لعدم فعل شيء أو التهرب من خطة/عادة (مثال: "الكهرباء قطعت"، "كنت تعبان").
٤) تجنب (avoidance): سلوك تهرب واضح من مواجهة مشكلة أو مهمة (مثال: "مش قادر أفتح الكتاب"، "بضيع وقت").
٥) إنجاز/فوز (win): إنجاز خطوة سلوكية بنجاح (مثال: "خلصت التمرين"، "ذاكرت ساعتين").
٦) انتكاسة/انهيار (collapse): اعتراف بالوقوع في عادة سيئة أو تراجع سلوكي كبير (مثال: "سهرت للفجر بلعب"، "ضيعت اليوم كله دومسكرول").

حلل الحوار التالي واستخرج أي حلقات مفتوحة تنطبق.
الحوار:
- المستخدم قال: "${userText}"
- رفيق اقترح/قال: "${rafiqText}"

إذا لم تجد أي حلقات مفتوحة حقيقية، ارجع مصفوفة فارغة.
أرجع النتيجة بصيغة JSON فقط كـ Array من الكائنات (Objects) بالبنية التالية:
[
  {
    "loop_type": "promise" | "postponement" | "excuse" | "avoidance" | "win" | "collapse",
    "content": "ملخص واضح وقصير بالعامية المصرية لما حدث (مثال: وعد يذاكر بكرة الصبح)",
    "expected_by": "تاريخ ووقت متوقع للإنجاز بصيغة ISO 8601 إذا ذكر أو خمنته بشكل واقعي أو null"
  }
]
    `.trim();

    const aiResult = await callGemini({
      model: AI_CONFIG.PRIMARY_MODEL,
      systemInstruction,
      userMessage: `استخرج الحلقات المفتوحة من: "${userText}" ورده على رفيق "${rafiqText}"`,
      temperature: 0.2, // Low temp for extraction tasks
      expectJson: true,
      responseSchema: {
        type: "array",
        items: {
          type: "object",
          properties: {
            loop_type: {
              type: "string",
              enum: ["promise", "postponement", "excuse", "avoidance", "win", "collapse"],
            },
            content: { type: "string" },
            expected_by: { type: "string", nullable: true },
          },
          required: ["loop_type", "content", "expected_by"],
        },
      },
    });

    const loops: ExtractedOpenLoop[] = Array.isArray(aiResult.json) ? aiResult.json : [];
    if (loops.length === 0) return;

    // Store in DB
    const inserts = loops.map((l) => ({
      user_id: userId,
      loop_type: l.loop_type,
      content: l.content,
      extracted_from: interactionId,
      expected_by: l.expected_by ? new Date(l.expected_by).toISOString() : null,
      status: "open",
    }));

    await (supabaseAdmin.from("open_loops" as any) as any).insert(inserts);

    // If there is a "win" or positive completion loop, auto-close previous related open loops
    const hasWin = loops.some((l) => l.loop_type === "win");
    if (hasWin) {
      // Auto-close oldest open loops (soft-resolution)
      await (supabaseAdmin
        .from("open_loops" as any) as any)
        .update({
          status: "closed",
          closed_at: new Date().toISOString(),
        })
        .eq("user_id", userId)
        .eq("status", "open")
        .order("created_at", { ascending: true })
        .limit(2); // Close the oldest 2 to avoid memory bloat
    }
  } catch (e) {
    console.error("[open-loop-extractor] Failed to extract open loops:", e);
  }
}
