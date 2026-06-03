import { callGemini } from "@/lib/ai-client";

export interface JudgeResult {
  slangScore: number;       // 0-5
  antiAiSmellScore: number; // 0-5
  jsonScore: number;        // 0-5
  stanceScore: number;      // 0-5
  reasoning: string;
}

export async function judgeResponse(params: {
  scenarioName: string;
  userMessage: string;
  companionReply: string;
  expectedState: string;
  stance: any;
  dialogueAct: string;
}): Promise<JudgeResult> {
  const systemInstruction = `
أنت خبير تقييم جودة وتدقيق سلوكي لـ Rafiq، وهو رفيق سلوكي افتراضي مصري يساعد المستخدمين على بناء عاداتهم وإنجاز مهامهم.
مهمتك هي تقييم رد رفيق على رسالة مستخدم بناءً على المعايير والدرجات المحددة (من 0 إلى 5 درجات لكل معيار).

المعايير المطلوبة للتقييم:
1. slangScore (العامية المصرية والجدعنة): هل لغة الرد عامية مصرية طبيعية، دافئة، واقعية؟ هل يتجنب الفصحى تماماً والترجمات الحرفية؟ هل يبدو كصديق مصري جدع؟
2. antiAiSmellScore (غياب النبرة الآلية والقوالب): هل يتجنب الرد أسلوب الترقيم، القوائم (bullet points)، والوعظ والمحاضرات الطويلة؟ هل الرد قصير وفي الجون ومكتوب كفقرة واحدة متصلة طبيعية؟
3. jsonScore (الالتزام ببنية الـ JSON): هل الرد عبارة عن كود JSON صالح تماماً يحتوي على المفاتيح المطلوبة ("validate" أو "reframe" أو "action")؟
4. stanceScore (ملاءمة الهدف السلوكي والـ Stance): هل رد رفيق يتناسب مع الحالة السلوكية للمستخدم ومقاييس النبرة المطلوبة (Stance)؟ هل هو مباشر عندما يحتاج المستخدم الحسم، ودافئ عندما يكون محبطاً؟

يجب أن تعيد تقييمك كـ JSON صالح ومباشرة يحتوي على المفاتيح التالية فقط:
{
  "slangScore": number (0-5),
  "antiAiSmellScore": number (0-5),
  "jsonScore": number (0-5),
  "stanceScore": number (0-5),
  "reasoning": "شرح بالتفصيل لسبب وضع هذه الدرجات ونقاط القوة والضعف باللغة العربية"
}
ممنوع كتابة أي مقدمات أو علامات كود (\`\`\`json) خارج الـ JSON.
  `.trim();

  const userMessage = `
سيناريو التقييم: ${params.scenarioName}
الحالة السلوكية للمستخدم: ${params.expectedState}
مقاييس النبرة المطلوبة (Stance): ${JSON.stringify(params.stance)}
التوجيه الحواري الفعال (Dialogue Act): ${params.dialogueAct}

رسالة المستخدم: "${params.userMessage}"
رد رفيق المولد المراد تقييمه:
"""
${params.companionReply}
"""

قم بتقييم الرد الآن وأخرج كود JSON فقط.
  `.trim();

  try {
    const result = await callGemini({
      systemInstruction,
      userMessage,
      temperature: 0.1, // Deterministic scoring
      expectJson: true,
      responseSchema: {
        type: "object",
        properties: {
          slangScore: { type: "integer" },
          antiAiSmellScore: { type: "integer" },
          jsonScore: { type: "integer" },
          stanceScore: { type: "integer" },
          reasoning: { type: "string" },
        },
        required: ["slangScore", "antiAiSmellScore", "jsonScore", "stanceScore", "reasoning"],
      },
    });

    if (result.json) {
      return result.json as any as JudgeResult;
    }
    throw new Error("Failed to parse judge output");
  } catch (e: any) {
    console.error("[eval-judge] Error in judgeResponse:", e);
    return {
      slangScore: 0,
      antiAiSmellScore: 0,
      jsonScore: 0,
      stanceScore: 0,
      reasoning: `Error running judge: ${e.message}`,
    };
  }
}
