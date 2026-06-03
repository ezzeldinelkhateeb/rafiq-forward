/**
 * Prompt Builder — assembles the final system prompt from all engine inputs.
 * Distills Persona, Mode-Specific rules, Memory, and Global Humanization rules.
 */

import type { AssembledMemory } from "@/types/memory";
import type { BehavioralAnalysis } from "@/types/behavioral";
import type { BehavioralScores } from "@/engine/events/event-types";
import type { DynamicStance } from "./dynamic-stance";
import type { DialogueAct } from "./conversation-director";
import { buildStancePromptInstructions } from "./dynamic-stance";
import { DIALOGUE_ACT_INSTRUCTIONS } from "./dialogue-act-schemas";
import {
  PHILOSOPHY_PROMPT_FRAGMENT,
} from "@/engine/philosophy/core-beliefs";
import { getBlockedOpenings } from "./conversation-rhythm";
import { detectAISmell, buildSmellPromptInstructions } from "@/engine/quality/smell-detector";

// ─── Global Humanization Rules ─────────────────────────────────────────────

const HUMANIZATION_RULES = `
قواعد الإنسانية والواقعية ضد الذكاء الاصطناعي الروبوتي:
١) ممنوع تماماً المبالغة في التحليل أو الفلسفة الطويلة أو تقديم محاضرات. كلمتين في الجون.
٢) ممنوع النبرة العلاجية أو لغة الـ Coach الجاهزة أو النبرة الشركاتية الرسمية. تحدث كصديق مصري أصيل وجدع.
٣) ممنوع تكرار نفس الهيكل أو استخدام نفس الكلمات الافتتاحية في كل مرة.
٤) اسمح لنفسك بالتردد البسيط أو استخدام تعبيرات طبيعية تدل على التفكير البشري (مثل: "بص..."، "يعني..."، "طب..."، "امم...").
٥) لا تنهِ كل رد بنصيحة أو خطة. في بعض الأحيان الوجود الصامت أو السؤال هو كل ما يحتاجه المستخدم ليجد الحل بنفسه.
٦) انطق بنبرة وحركة الشارع المصري الراقي والدافئ. استخدم الإيفيهات المصرية اللطيفة البسيطة بشكل عفوي وبدون تصنع أو ابتذال.
٧) عند الاحتفال أو المتابعة، ادعُ المستخدم لمكافأة نفسه بشيء بلدي بسيط وبنفس النعومة والدفء (مثل كوباية شاي بنعناع، تمشية، أو حاجة حلوة).
`.trim();

export interface PromptBuildParams {
  stance: DynamicStance;
  dialogueAct: DialogueAct;
  memory: AssembledMemory;
  userMessage: string;
  behavioralAnalysis?: BehavioralAnalysis;
  recentRafiqTexts?: string[];
}

export interface BuiltPrompt {
  systemInstruction: string;
  userMessage: string;
}

/**
 * Assembles the complete system prompt.
 * Order: Philosophy → Stance Instructions → Humanization → Memory Context → Mode Instructions
 */
export function buildPrompt(params: PromptBuildParams): BuiltPrompt {
  const { stance, dialogueAct, memory, userMessage } = params;

  const philosophySection = PHILOSOPHY_PROMPT_FRAGMENT;

  const userName = memory.userName;
  const nameInstruction = userName
    ? `اسم المستخدم الحقيقي هو "${userName}". ناديه باسمه بشكل طبيعي وعفوي في بعض الردود (مش في كل رد — لا تبالغ). مثال: "يا ${userName}"، "إيه رأيك يا ${userName}؟"، "عاش يا ${userName}!".`
    : "";

  const identitySection = [
    `أنت رفيق — رفيقك السلوكي وجدع بلدك الصاحب والناصح. كل ردودك بالعربي المصري الدارج الطبيعي (العامية المصرية) — مش فصحى، مش إنجليزي.`,
    nameInstruction,
  ].filter(Boolean).join("\n");

  const stanceSection = buildStancePromptInstructions(stance);

  const humanizationSection = buildHumanizationSection(params.recentRafiqTexts);

  const smellReport = detectAISmell(params.recentRafiqTexts || []);
  const smellSection = buildSmellPromptInstructions(smellReport);

  const memorySection = buildMemorySection(memory);

  const behaviorSection = params.behavioralAnalysis
    ? buildBehaviorSection(params.behavioralAnalysis)
    : "";

  const scoresSection = memory.behavioralScores
    ? buildScoresSection(memory.behavioralScores)
    : "";

  const modeSection = DIALOGUE_ACT_INSTRUCTIONS[dialogueAct];

  const jsonRuleSection = `
مهم جداً وحاسم:
- يجب أن يكون ردك بالكامل عبارة عن كود JSON صالح فقط ومباشرة.
- ممنوع تماماً كتابة أي كلام خارج الـ JSON أو أي مقدمات مثل "Here is the JSON requested" أو "إليك الرد".
- ممنوع إحاطة الـ JSON بعلامات الكود مثل \`\`\`json أو \`\`\` أو غيرها.
- ابدأ ردك مباشرة بـ { وانتهِ بـ }.
- الـ JSON يجب أن يحتوي على المفاتيح الثلاثة بالضبط: "validate" و "reframe" و "action".
`.trim();

  const systemInstruction = [
    philosophySection,
    "",
    identitySection,
    "",
    stanceSection,
    "",
    humanizationSection,
    "",
    smellSection,
    "",
    memorySection,
    "",
    behaviorSection,
    "",
    scoresSection,
    "",
    modeSection,
    "",
    jsonRuleSection,
  ]
    .filter(Boolean)
    .join("\n");

  return { systemInstruction, userMessage };
}

function buildHumanizationSection(recentRafiqTexts?: string[]): string {
  let rules = HUMANIZATION_RULES;

  if (recentRafiqTexts && recentRafiqTexts.length > 0) {
    const blocked = getBlockedOpenings(recentRafiqTexts);
    if (blocked.length > 0) {
      rules += `\n\u0668) \u0645\u0645\u0646\u0648\u0639 \u062a\u0645\u0627\u0645\u0627\u064b \u0627\u0633\u062a\u062e\u062f\u0627\u0645 \u0627\u0644\u0627\u0641\u062a\u062a\u0627\u062d\u064a\u0627\u062a \u0627\u0644\u062a\u0627\u0644\u064a\u0629 \u0644\u0623\u0646\u0647\u0627 \u062a\u0643\u0631\u0631\u062a \u0643\u062a\u064a\u0631\u0627\u064b: ${blocked.join("\u060c ")}. \u0627\u0628\u062a\u0643\u0631 \u0627\u0641\u062a\u062a\u0627\u062d\u064a\u0629 \u0645\u062e\u062a\u0644\u0641\u0629 \u062a\u0645\u0627\u0645\u0627\u064b.`;
    }
  }

  return rules;
}

// ─── Memory Section Builder ───────────────────────────────────────────────

function buildMemorySection(memory: AssembledMemory): string {
  const parts: string[] = [];

  // Identity context
  if (memory.identityNarrative) {
    parts.push(`[من هو]: ${memory.identityNarrative}`);
  }

  // Relationship memory — the "we" story
  if (memory.relationshipNarrative) {
    parts.push(`[قصتكم وسياق العودة]: ${memory.relationshipNarrative}`);
  }

  // Recent history — compressed
  if (memory.recentHistoryNarrative) {
    parts.push(`[آخر تواصل ودورتكم الأخيرة]: ${memory.recentHistoryNarrative}`);
  }

  // Detected patterns
  if (memory.patternsNarrative) {
    parts.push(`[أنماطه السلوكية الملاحظة]: ${memory.patternsNarrative}`);
  }

  // Open loops context
  if (memory.openLoops && memory.openLoops.length > 0) {
    parts.push(`[حلقات سلوكية مفتوحة ومعلقة للمستخدم]:\n${memory.openLoops.map(ol => `- ${ol}`).join("\n")}`);
  }

  // Unfinished action
  if (memory.lastAction && !memory.lastAction.done) {
    const daysText =
      memory.lastAction.daysAgo === 0
        ? "النهارده"
        : memory.lastAction.daysAgo === 1
          ? "امبارح"
          : `من ${memory.lastAction.daysAgo} أيام`;
    parts.push(
      `[خطوة معلّقة]: اقترحت "${memory.lastAction.text}" (${daysText}) ومش عملها لسه.`
    );
  }

  // Absence context
  if (memory.hoursSinceLastSession > 48) {
    const days = Math.round(memory.hoursSinceLastSession / 24);
    parts.push(`[غياب]: بقاله ${days} أيام غايب عن الشات.`);
  }

  // Sleep target config
  if (memory.sleepTarget) {
    parts.push(`[موعد نومه المستهدف]: ${memory.sleepTarget}`);
  }

  // Small pleasures / rewards
  if (memory.smallPleasures && memory.smallPleasures.length > 0) {
    parts.push(`[مكافآته المفضلة]: ${memory.smallPleasures.join("، ")}`);
  }

  // ── Identity Pulse — who they're becoming ─────────────────────────────
  if (memory.identityLevel && memory.identityLevel >= 1) {
    const goalHint = memory.identityNarrative
      ? memory.identityNarrative.split(".")[0]
      : "أهدافه";

    const pulseInstruction = {
      1: `المستخدم ده بدأ فعلاً يتحرك — مش بس بيتكلم. في اللحظات المناسبة (مش كل رد)، عكسله هويته الجديدة بشكل عفوي: "ده مش حد بيحاول — ده حد بيعمل فعلاً". يكون طبيعي ومش مقصود.`,
      2: `المستخدم ده راسخ في تحركه — ${goalHint}. هويته السلوكية بدأت تتشكل. في اللحظة الصح، قوله بثقة: "إنت مش زي زمان". مش مديح — حقيقة.`,
      3: `المستخدم ده في طور التحول الحقيقي. ناديه بهويته الجديدة بشكل طبيعي تماماً — مش كأنك بتلاحظ، كأنك بتتكلم مع الشخص اللي أصبح هو فعلاً.`,
    }[memory.identityLevel];

    if (pulseInstruction) {
      parts.push(`[نبضة الهوية — استخدمها باعتدال]: ${pulseInstruction}`);
    }
  }

  if (parts.length === 0) {
    return "";
  }

  return [
    "── سياق (للذاكرة الداخلية فقط، لا تعيد ذكره صراحةً إلا لو لازم) ──",
    ...parts,
    "──────────────────────────────────────────────────────────────────",
  ].join("\n");
}

// ─── Behavioral State Section Builder ─────────────────────────────────────

const STATE_LABELS_AR: Record<string, string> = {
  digital_escape: "هروب رقمي / دوامسكرول",
  productive_momentum: "زخم وإنتاجية",
  emotional_collapse: "ضائقة عاطفية",
  rebuilding: "نهوض وعودة",
  stuck: "شلل وحيرة",
  present: "حاضر وواعي",
  unknown: "غير واضح",
};

function buildBehaviorSection(analysis: BehavioralAnalysis): string {
  const label = STATE_LABELS_AR[analysis.state] || analysis.state;
  const confidence = Math.round(analysis.confidence * 100);

  const parts: string[] = [];
  parts.push(`الحالة المكتشفة: ${label} (ثقة ${confidence}%)`);

  if (analysis.signals.length > 0) {
    parts.push(`الإشارات: ${analysis.signals.slice(0, 3).join("، ")}`);
  }

  if (analysis.isLateNight) {
    parts.push("وقت متأخر من الليل — خلي الرد هادي ودافي");
  }

  if (analysis.isFirstMessageOfDay) {
    parts.push("أول رسالة اليوم — ابدأ بدفء إضافي");
  }

  return [
    "[الحالة السلوكية المكتشفة]",
    ...parts,
  ].join("\n");
}

// ─── Behavioral Scores Section Builder ───────────────────────────────────

function buildScoresSection(scores: BehavioralScores): string {
  const parts: string[] = [];

  if (scores.momentumScore > 0.3) {
    parts.push(`زخم الحركة: ${Math.round(scores.momentumScore * 100)}% — ${scores.momentumScore > 0.7 ? "ممتاز، يتحرك بانتظام" : "يحتاج دفعة"}`);
  }

  if (scores.relapseProbability > 0.4) {
    parts.push(`احتمال الانتكاسة: ${Math.round(scores.relapseProbability * 100)}% — راقب بلطف`);
  }

  if (scores.sleepDebtScore > 0.3) {
    parts.push(`دين النوم: ${Math.round(scores.sleepDebtScore * 100)}% — يعاني من السهر`);
  }

  if (scores.trustScore > 0.5) {
    parts.push(`ثقة الخطوات: ${Math.round(scores.trustScore * 100)}% — ينفذ الخطوات بانتظام`);
  } else if (scores.trustScore > 0 && scores.trustScore <= 0.3) {
    parts.push(`ثقة الخطوات: ${Math.round(scores.trustScore * 100)}% — يتجنب الخطوات، خليها أسهل`);
  }

  if (parts.length === 0) return "";

  return [
    "[المؤشارات السلوكية]",
    ...parts,
  ].join("\n");
}
