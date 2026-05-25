import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { callGemini } from "@/lib/ai-client";
import { AI_CONFIG } from "@/config/ai";

interface SummarizerOutput {
  goals: string[];
  struggles: string[];
  personality: string;
  relationshipSnapshot: string;
}

/**
 * Summarizes the session and compresses the conversation history into narrative summaries
 * and structured identity memory. Runs asynchronously in the background.
 */
export async function summarizeSessionAndCompress(
  userId: string,
  sessionId: string
): Promise<void> {
  try {
    // 1. Fetch interactions from this session
    const { data: interactions, error: fetchErr } = await supabaseAdmin
      .from("interactions")
      .select("user_text, validate, reframe, action, action_done, created_at")
      .eq("user_id", userId)
      .eq("session_ref", sessionId)
      .order("created_at", { ascending: true });

    if (fetchErr || !interactions || interactions.length === 0) {
      console.log("[Memory Summarizer] No interactions found or error fetching:", fetchErr);
      return;
    }

    // 2. Format the dialogue for the LLM
    const dialogue = interactions
      .map((i) => {
        const userPart = `المستخدم: ${i.user_text}`;
        const rafiqPart = `رفيق: ${i.validate || ""} ${i.reframe || ""} [الأكشن المقترح: ${i.action || ""} | الحالة: ${i.action_done ? "تم" : "لم يتم"}]`;
        return `${userPart}\n${rafiqPart}`;
      })
      .join("\n\n");

    // Get current identity memory state to merge
    const { data: currentIdentity } = await supabaseAdmin
      .from("identity_memory")
      .select("goals, struggles, personality")
      .eq("user_id", userId)
      .single();

    const existingGoals = currentIdentity?.goals || [];
    const existingStruggles = currentIdentity?.struggles || [];
    const existingPersonality = currentIdentity?.personality || "مستخدم جديد لسه بنتعرف عليه.";

    // 3. Build system instruction for compression
    const systemInstruction = `
أنت جزء من نظام الذاكرة لرفيق (مساعد سلوكي ذكي). مهمتك هي ضغط المحادثة الحالية واستخراج تحديثات ملف المستخدم السلوكي.

بناءً على المحادثة المقدمة والبيانات الحالية للمستخدم:
1) استخرج الأهداف السلوكية (goals) طويلة الأمد الجديدة التي يريد تحقيقها (مثل: التخفيف من السوشيال ميديا، تنظيم النوم). ادمجها مع الأهداف الحالية.
2) استخرج الصراعات والتحديات (struggles) التي يواجهها حالياً (مثل: السهر، المماطلة، التشتت). ادمجها مع الصراعات الحالية.
3) حدث ملخص الشخصية (personality) في سطرين يصف حالته وسلوكه الحالي (مثل: "طالب جامعي يسهر كثيراً بسبب الهاتف ويعاني من ضغط المذاكرة ولكنه يعافر").
4) اكتب ملخصاً سردياً قصيراً للعلاقة والتواصل الحالي (relationshipSnapshot) في فقرة واحدة دافئة بالعامية المصرية توثق مسيرته الأخيرة (مثل: "رجع بعد غياب يومين وكان تعبان بسبب الموبايل، قمنا بخطوة غسل الوجه وبدأ يستعيد همته لغلق الشاشات").

بيانات المستخدم الحالية:
الأهداف الحالية: ${JSON.stringify(existingGoals)}
الصراعات الحالية: ${JSON.stringify(existingStruggles)}
ملخص الشخصية الحالي: "${existingPersonality}"

يجب أن ترجع النتيجة كـ كود JSON صالح تماماً بدون مقدمات ولا مؤخرات ولا علامات كود (\`\`\`json).
الهيكل المطلوب للـ JSON بالضبط:
{
  "goals": ["هدف 1", "هدف 2"],
  "struggles": ["صراع 1", "صراع 2"],
  "personality": "ملخص الشخصية الجديد هنا...",
  "relationshipSnapshot": "الملخص السردي للعلاقة هنا..."
}
`.trim();

    const userMessage = `إليك تفاصيل المحادثة الأخيرة:\n\n${dialogue}`;

    // 4. Call Gemini to compress
    const result = await callGemini({
      model: AI_CONFIG.NARRATIVE_MODEL,
      systemInstruction,
      userMessage,
      temperature: AI_CONFIG.TEMPERATURE.NARRATIVE,
      maxOutputTokens: AI_CONFIG.MAX_TOKENS.NARRATIVE,
      expectJson: true,
      responseSchema: {
        type: "object",
        properties: {
          goals: {
            type: "array",
            items: { type: "string" }
          },
          struggles: {
            type: "array",
            items: { type: "string" }
          },
          personality: { type: "string" },
          relationshipSnapshot: { type: "string" }
        },
        required: ["goals", "struggles", "personality", "relationshipSnapshot"]
      }
    });

    if (!result.json) {
      console.error("[Memory Summarizer] Did not receive valid JSON back from model:", result.text);
      return;
    }

    const output = result.json as unknown as SummarizerOutput;

    // Merge and filter duplicates
    const mergedGoals = Array.from(new Set([...existingGoals, ...(output.goals || [])])).slice(0, 10);
    const mergedStruggles = Array.from(new Set([...existingStruggles, ...(output.struggles || [])])).slice(0, 10);
    const updatedPersonality = output.personality || existingPersonality;

    // 5. Update identity memory
    const { error: identityErr } = await supabaseAdmin
      .from("identity_memory")
      .upsert({
        user_id: userId,
        goals: mergedGoals,
        struggles: mergedStruggles,
        personality: updatedPersonality,
        updated_at: new Date().toISOString(),
      });

    if (identityErr) {
      console.error("[Memory Summarizer] Error updating identity memory:", identityErr);
    }

    // 6. Insert new relationship memory snapshot
    if (output.relationshipSnapshot) {
      const firstInteractionDate = interactions[0].created_at;
      const lastInteractionDate = interactions[interactions.length - 1].created_at;

      const { error: snapshotErr } = await supabaseAdmin
        .from("memory_snapshots")
        .insert({
          user_id: userId,
          snapshot_type: "relationship",
          content: output.relationshipSnapshot,
          covers_from: firstInteractionDate,
          covers_to: lastInteractionDate,
          created_at: new Date().toISOString(),
        });

      if (snapshotErr) {
        console.error("[Memory Summarizer] Error inserting memory snapshot:", snapshotErr);
      }
    }

    console.log("[Memory Summarizer] Background session compression completed successfully.");
  } catch (e) {
    console.error("[Memory Summarizer] Unexpected error in background worker:", e);
  }
}
