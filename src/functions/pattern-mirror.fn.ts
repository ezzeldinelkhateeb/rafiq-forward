/**
 * Pattern Mirror Server Function — picks the single most relevant behavioral
 * pattern and generates ONE honest, human reflective insight about it.
 *
 * Not a dashboard. Not a list. ONE sentence that makes the user stop and think.
 * Shown once per week at session start.
 */

import { createServerFn } from "@tanstack/react-start";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { callGemini } from "@/lib/ai-client";

// ─── Fetch Pattern Mirror ──────────────────────────────────────────────────

export const fetchPatternMirror = createServerFn({ method: "POST" })
  .inputValidator((input: { userId: string }) => input)
  .handler(async ({ data }): Promise<{ mirror: string | null }> => {
    const { userId } = data;

    // Check if we already showed a mirror this week
    const lastShownKey = `rafiq.pattern_mirror.last_shown.${userId}`;

    // Fetch behavioral patterns + session timing data
    const [patternsResult, interactionsResult, userResult] = await Promise.allSettled([
      supabaseAdmin
        .from("behavioral_patterns")
        .select("pattern_type, description, occurrence_count, last_seen_at")
        .eq("user_id", userId)
        .order("occurrence_count", { ascending: false })
        .limit(3),
      supabaseAdmin
        .from("interactions")
        .select("created_at, user_text")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(20),
      supabaseAdmin
        .from("users")
        .select("display_name, created_at")
        .eq("id", userId)
        .single(),
    ]);

    const patterns =
      patternsResult.status === "fulfilled" ? patternsResult.value.data ?? [] : [];
    const interactions =
      interactionsResult.status === "fulfilled" ? interactionsResult.value.data ?? [] : [];
    const user =
      userResult.status === "fulfilled" ? userResult.value.data : null;

    // Need at least some data to generate a meaningful mirror
    if (patterns.length === 0 && interactions.length < 5) {
      return { mirror: null };
    }

    const name = user?.display_name ?? null;
    const namePhrase = name ? `يا ${name}` : "";

    // Pick the most significant pattern
    const topPattern = patterns[0];

    // Build timing insight from interactions
    const lateNightCount = interactions.filter((i) => {
      const hour = new Date(i.created_at).getHours();
      return hour >= 23 || hour <= 3;
    }).length;

    const hasLateNightPattern = lateNightCount >= 3;

    // Build context for Gemini
    const patternContext = topPattern
      ? `النمط الأبرز: ${topPattern.pattern_type} — "${topPattern.description}" (تكرر ${topPattern.occurrence_count} مرة)`
      : "";

    const timingContext = hasLateNightPattern
      ? `المستخدم بييجي لرفيق كثيراً بالليل المتأخر (${lateNightCount} مرة من آخر 20 رسالة).`
      : "";

    const context = [patternContext, timingContext].filter(Boolean).join("\n");

    if (!context) return { mirror: null };

    const prompt = `أنت رفيق — رفيق سلوكي بيتكلم عربي مصري دارج.

لاحظت الأنماط دي في سلوك المستخدم ${namePhrase}:
${context}

اكتب جملة أو جملتين بالكتير — ملاحظة سلوكية واحدة صادقة وإنسانية.
مش نصيحة. مش تحليل. بس مرآة: "لاحظت إنك..." أو "بلاحظ عليك...".
الهدف مش تصحيح — الهدف إن هو يشوف نفسه.
لا حكم. لا تبسيط. كن مباشراً وحنيناً في نفس الوقت.`;

    try {
      const result = await callGemini({
        systemInstruction: "أنت رفيق — رفيق سلوكي بيتكلم عربي مصري دارج. ردودك مختصرة وصادقة وإنسانية.",
        userMessage: prompt,
        temperature: 0.8,
        maxOutputTokens: 120,
      });
      const mirror = result.text?.trim() ?? null;
      return { mirror };
    } catch {
      return { mirror: buildFallbackMirror(name, topPattern ?? null, hasLateNightPattern) };
    }
  });

// ─── Check If Mirror Should Show ──────────────────────────────────────────

export const shouldShowPatternMirror = createServerFn({ method: "POST" })
  .inputValidator((input: { userId: string; lastShownAt: string | null }) => input)
  .handler(async ({ data }): Promise<boolean> => {
    const { lastShownAt } = data;

    if (!lastShownAt) return true; // never shown before

    const daysSinceShown =
      (Date.now() - new Date(lastShownAt).getTime()) / (1000 * 60 * 60 * 24);

    return daysSinceShown >= 7;
  });

// ─── Fallback Mirror ───────────────────────────────────────────────────────

function buildFallbackMirror(
  name: string | null,
  pattern: { pattern_type: string; description: string } | null,
  hasLateNight: boolean
): string | null {
  const n = name ? `يا ${name}` : "";

  if (pattern?.pattern_type === "doomscroll") {
    return `بلاحظ ${n} إنك بتيجي لرفيق غالباً بعد جلسة سكرول طويلة. الموضوع ده بيقول إيه برأيك؟`;
  }
  if (pattern?.pattern_type === "avoidance") {
    return `بلاحظ ${n} إنك أحياناً بتتجنب الخطوات اللي اتفقنا عليها. مش عيب — بس يستاهل نفكر فيه سوا.`;
  }
  if (hasLateNight) {
    return `بلاحظ ${n} إنك بتيجي لرفيق كتير بالليل المتأخر. ده وقت تاني من اليوم وإحساس تاني — بتيجي ليه؟`;
  }
  return null;
}
