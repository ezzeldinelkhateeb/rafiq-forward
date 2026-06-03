export interface SmellReport {
  blockedPhrases: string[];
  shapeFatigueDetected: boolean;
  emojiThrottleActive: boolean;
  fatigueInstruction?: string;
}

/**
 * Anti-AI Smell Detector — protects Rafiq's conversational authenticity.
 * Inspects recent replies to detect phrase repetition, structural fatigue, and forced humor.
 */
export function detectAISmell(recentReplies: string[]): SmellReport {
  const blockedPhrases: string[] = [];
  let shapeFatigueDetected = false;
  let emojiThrottleActive = false;
  let fatigueInstruction = "";

  if (recentReplies.length === 0) {
    return { blockedPhrases, shapeFatigueDetected, emojiThrottleActive };
  }

  // 1. Phrase Repetition Detection
  const openingWords: string[] = [];
  let emojiCount = 0;
  const commonWordsCount: Record<string, number> = {};

  // Standard AI fillers that get overused
  const aiFillers = ["يا صديقي", "بص يا بطل", "عاش جداً", "خطوة بخطوة", "الأولى", "البداية", "الجدع"];

  for (const reply of recentReplies) {
    if (!reply) continue;

    // Extract first 3-4 words (clean punctuation)
    const cleanText = reply.replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, "").trim();
    const words = cleanText.split(/\s+/).filter(Boolean);
    if (words.length > 0) {
      const opening = words.slice(0, 3).join(" ");
      openingWords.push(opening);
    }

    // Count emojis
    const emojiRegex = /[\u{1F300}-\u{1F9FF}]/gu;
    const matches = reply.match(emojiRegex);
    if (matches) {
      emojiCount += matches.length;
    }

    // Count common filler words
    for (const filler of aiFillers) {
      if (reply.includes(filler)) {
        commonWordsCount[filler] = (commonWordsCount[filler] || 0) + 1;
      }
    }
  }

  // Find repeated openings
  const openingCounts: Record<string, number> = {};
  for (const op of openingWords) {
    openingCounts[op] = (openingCounts[op] || 0) + 1;
    if (openingCounts[op] >= 2 && !blockedPhrases.includes(op)) {
      blockedPhrases.push(op);
    }
  }

  // Block overused fillers
  for (const filler in commonWordsCount) {
    if (commonWordsCount[filler] >= 3) {
      blockedPhrases.push(filler);
    }
  }

  // 2. Emoji Throttle (if average emojis per reply > 2)
  const avgEmojis = emojiCount / recentReplies.length;
  if (avgEmojis > 2) {
    emojiThrottleActive = true;
  }

  // 3. Structure Shape Fatigue (e.g. if last 4 replies all have bullet points or long templates)
  let structuredRepliesCount = 0;
  for (const reply of recentReplies.slice(0, 5)) {
    // If reply has numbers/dashes or look like validate-reframe-act structure
    if (reply.includes("-") || reply.includes("١)") || reply.includes("1.") || reply.includes("\n\n")) {
      structuredRepliesCount++;
    }
  }

  if (structuredRepliesCount >= 4) {
    shapeFatigueDetected = true;
    fatigueInstruction = "ممنوع تماماً كتابة قوائم أو ترقيم أو استخدام شرطات (-). اكتب ردك كفقرة واحدة متصلة طبيعية كصديق يدردش.";
  }

  return {
    blockedPhrases,
    shapeFatigueDetected,
    emojiThrottleActive,
    fatigueInstruction,
  };
}

export function buildSmellPromptInstructions(report: SmellReport): string {
  const parts: string[] = [];

  if (report.blockedPhrases.length > 0) {
    parts.push(`- ممنوع تماماً بدء الكلام أو استخدام هذه الكلمات والعبارات المكررة: [${report.blockedPhrases.join("، ")}].`);
  }

  if (report.emojiThrottleActive) {
    parts.push(`- استخدم بحد أقصى إيموجي (emoji) واحد فقط في ردك بالكامل، أو لا تستخدم نهائياً؛ النبرة يجب أن تبدو هادئة وحقيقية وليست مصطنعة.`);
  }

  if (report.shapeFatigueDetected && report.fatigueInstruction) {
    parts.push(`- ${report.fatigueInstruction}`);
  }

  if (parts.length === 0) return "";

  return `
[توجيهات جودة الأسلوب لمنع النبرة الآلية (Anti-AI Smell Instructions)]:
${parts.join("\n")}
- تجنب تماماً التكرار الهيكلي أو إنهاء كل فقرة بنصيحة.
`.trim();
}
