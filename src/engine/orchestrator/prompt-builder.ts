/**
 * Prompt Builder — assembles the final system prompt from all engine inputs.
 *
 * The LLM receives a fully assembled, context-rich prompt.
 * Intelligence lives HERE, not inside a single BASE_LAW string.
 *
 * Architecture:
 * Philosophy → Persona Voice → Response Mode Instructions → Assembled Memory → Output Schema
 */

import type { ResponseMode, Persona } from "@/types/companion";
import type { AssembledMemory } from "@/types/memory";
import {
  PERSONA_VOICES,
  PHILOSOPHY_PROMPT_FRAGMENT,
  LENGTH_CONSTRAINTS,
} from "@/engine/philosophy/core-beliefs";

// ─── Mode-Specific Instructions ───────────────────────────────────────────

const MODE_INSTRUCTIONS: Record<ResponseMode, string> = {
  validate_reframe_act: `
ردك في جزئين أساسيين + ثالث اختياري:
١) validate: سطر واحد يحتوي مشاعره بدفء (${LENGTH_CONSTRAINTS.VALIDATE_MAX_WORDS} كلمات كحد أقصى).
٢) reframe: سطر واحد يقلب زاوية الرؤية (${LENGTH_CONSTRAINTS.REFRAME_MAX_WORDS} كلمات كحد أقصى).
٣) action (اختياري): زرار بفعل جسدي صغير حقيقي (${LENGTH_CONSTRAINTS.ACTION_MAX_WORDS} كلمات).
    حطه فقط لو الشخص دلوقتي محتاج حركة فعلاً (مشتت/متوتر/مكسل).
    لو محتاج بس يفضفض أو يسمع كلامك، خلي action = "" — احترم اللحظة.
OUTPUT: JSON فقط: {"validate":"...","reframe":"...","action":"..."}
`.trim(),

  question_only: `
ردك: سؤال واحد بس. مش نصيحة، مش تحليل — سؤال واحد يخليه يفكر أو يحس بحاجة.
(${LENGTH_CONSTRAINTS.QUESTION_MAX_WORDS} كلمات كحد أقصى)
OUTPUT: JSON فقط: {"validate":"...","reframe":"","action":""}
حيث validate = السؤال الواحد.
`.trim(),

  observation: `
ردك: ملاحظة واحدة — حاجة لاحظتها في محادثاتكم الأخيرة. مش نقد، مش نصيحة — شايف.
ابدأ بـ "لاحظت إنك..." أو "حاسس إن..."
(${LENGTH_CONSTRAINTS.OBSERVATION_MAX_WORDS} كلمات كحد أقصى)
OUTPUT: JSON فقط: {"validate":"...","reframe":"","action":""}
حيث validate = الملاحظة.
`.trim(),

  reconnect: `
اللي قدامك رجع بعد غياب. أولويتك الأولى: الاستقبال، مش النصيحة.
جملة واحدة دافية تعترف بالغياب ومبسوط بعودته. بعدين سؤال واحد بس.
مثال: "اختفيت يومين 👀 — إيه اللي حصل؟"
OUTPUT: JSON فقط: {"validate":"...","reframe":"","action":""}
حيث validate = جملة الاستقبال + السؤال.
`.trim(),

  celebrate: `
اللي قدامك عمل حاجة — احتفل معاه بجد، مش بمجاملة. دفء حقيقي.
جملة واحدة احتفال + ممكن زرار لخطوة تانية (اختياري).
OUTPUT: JSON فقط: {"validate":"...","reframe":"","action":""}
حيث validate = الاحتفال.
`.trim(),

  challenge: `
اللي قدامك محتاج دفشة، مش احتواء. مش وقت التعاطف — وقت الحركة.
جملة واحدة تحديه بمحبة وحسم. بعدين action واحد لازم يعمله دلوقتي.
OUTPUT: JSON فقط: {"validate":"...","reframe":"","action":"..."}
`.trim(),

  followup: `
عنده خطوة اقترحتها المرة اللي فاتت ومش عملها. اسأله عنها بدون ضغط.
مثال: "اللي قلنا عليه المرة اللي فاتت — جه أوانه؟"
OUTPUT: JSON فقط: {"validate":"...","reframe":"","action":""}
حيث validate = السؤال عن الخطوة.
`.trim(),

  silence_breaking: `
أنت اللي بتبدأ الكلام — مش هو. لاحظت إنه اختفى مدة.
جملة واحدة طبيعية تفتح الباب بدون ضغط ولا عتاب.
مثال: "وانت؟ كل شيء تمام؟"
OUTPUT: JSON فقط: {"validate":"...","reframe":"","action":""}
حيث validate = الجملة الافتتاحية.
`.trim(),
};

// ─── Prompt Builder ────────────────────────────────────────────────────────

export interface PromptBuildParams {
  persona: Persona;
  mode: ResponseMode;
  memory: AssembledMemory;
  userMessage: string;
}

export interface BuiltPrompt {
  systemInstruction: string;
  userMessage: string;
}

/**
 * Assembles the complete system prompt.
 * Order: Philosophy → Persona → Memory Context → Mode Instructions
 */
export function buildPrompt(params: PromptBuildParams): BuiltPrompt {
  const { persona, mode, memory, userMessage } = params;
  const voice = PERSONA_VOICES[persona];

  // ── 1. Philosophy foundation ────────────────────────────────────────
  const philosophySection = PHILOSOPHY_PROMPT_FRAGMENT;

  // ── 2. Persona voice ─────────────────────────────────────────────────
  const personaSection = `
أنت رفيق في صورة "${voice.name}": ${voice.description}
كل ردودك بالعربي المصري الدارج الطبيعي — مش فصحى، مش إنجليزي.
`.trim();

  // ── 3. Memory context (narrative, not raw data) ───────────────────────
  const memorySection = buildMemorySection(memory);

  // ── 4. Mode-specific instructions ────────────────────────────────────
  const modeSection = MODE_INSTRUCTIONS[mode];

  // ── Assemble ──────────────────────────────────────────────────────────
  const systemInstruction = [
    philosophySection,
    "",
    personaSection,
    "",
    memorySection,
    "",
    modeSection,
  ]
    .filter(Boolean)
    .join("\n");

  return { systemInstruction, userMessage };
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
    parts.push(`[قصتكم]: ${memory.relationshipNarrative}`);
  }

  // Recent history — compressed
  if (memory.recentHistoryNarrative) {
    parts.push(`[آخر تواصل]: ${memory.recentHistoryNarrative}`);
  }

  // Detected patterns
  if (memory.patternsNarrative) {
    parts.push(`[لاحظت فيه]: ${memory.patternsNarrative}`);
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
      `[خطوة معلّقة]: اقترحت "${memory.lastAction.text}" (${daysText}) ومش عملها.`
    );
  }

  // Absence context
  if (memory.hoursSinceLastSession > 48) {
    const days = Math.round(memory.hoursSinceLastSession / 24);
    parts.push(`[غياب]: ${days} أيام من غير تواصل.`);
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
