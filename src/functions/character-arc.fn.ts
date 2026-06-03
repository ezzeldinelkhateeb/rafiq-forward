/**
 * Character Arc Server Function — generates a deeply personal milestone message
 * when the user reaches 5, 10, 20, 30, or 50 completed actions.
 *
 * This is NOT a generic congratulations. It's a reflection of WHO they're becoming.
 * Gemini generates it from their actual identity data and progress.
 */

import { createServerFn } from "@tanstack/react-start";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { callGemini } from "@/lib/ai-client";

// ─── Milestone Thresholds ──────────────────────────────────────────────────

export const ARC_MILESTONES = [5, 10, 20, 30, 50, 75, 100] as const;

export type ArcMilestone = typeof ARC_MILESTONES[number];

// ─── Generate Character Arc ────────────────────────────────────────────────

export const generateCharacterArc = createServerFn({ method: "POST" })
  .inputValidator((input: { userId: string; milestone: number }) => input)
  .handler(async ({ data }): Promise<{ arcMessage: string }> => {
    const { userId, milestone } = data;

    // Fetch user identity + recent wins
    const [identityResult, userResult, recentWinsResult] = await Promise.allSettled([
      supabaseAdmin
        .from("identity_memory")
        .select("goals, struggles, small_pleasures")
        .eq("user_id", userId)
        .single(),
      supabaseAdmin
        .from("users")
        .select("display_name")
        .eq("id", userId)
        .single(),
      supabaseAdmin
        .from("interactions")
        .select("action, created_at")
        .eq("user_id", userId)
        .eq("action_done", true)
        .order("created_at", { ascending: false })
        .limit(5),
    ]);

    const identity =
      identityResult.status === "fulfilled" ? identityResult.value.data : null;
    const user =
      userResult.status === "fulfilled" ? userResult.value.data : null;
    const wins =
      recentWinsResult.status === "fulfilled" ? recentWinsResult.value.data ?? [] : [];

    const name = user?.display_name ?? null;
    const namePhrase = name ? `يا ${name}` : "";
    const goal = identity?.goals?.[0] ?? null;
    const struggle = identity?.struggles?.[0] ?? null;
    const recentWinsList = wins
      .filter((w) => w.action)
      .map((w) => `- ${w.action}`)
      .join("\n");

    // Determine arc stage language
    const stageContext = {
      5:  "بدأ رحلته للتو وأثبت لنفسه إنه قادر يتحرك",
      10: "وصل لنقطة تحول — مش حد بيحاول، ده حد بيعمل",
      20: "أصبح له هوية سلوكية جديدة، حتى لو ما لاحظش",
      30: "ترسخت عاداته — الثبات ده أصعب من البداية",
      50: "وصل لمرحلة نادرة — كتير بيبدأوا، قليل بيوصلوا لهنا",
      75: "ما يعمله دلوقتي كان حلم من 6 شهور. هو عمله.",
      100: "مئة خطوة — مش رقم، ده شخص تغير.",
    }[milestone] ?? `أنجز ${milestone} خطوة`;

    const prompt = `أنت رفيق — رفيق سلوكي بيتكلم عربي مصري دارج.

المستخدم ${namePhrase} للتو أكمل خطوته رقم ${milestone}. ${stageContext}.
${goal ? `هدفه الأساسي: ${goal}` : ""}
${struggle ? `كان بيصارع: ${struggle}` : ""}
${recentWinsList ? `آخر خطوات عملها:\n${recentWinsList}` : ""}

اكتب رسالة واحدة (2-3 جمل بالكتير) بأسلوب مصري دافي وحقيقي جداً.
الرسالة دي مش تهنئة — دي مرآة. عكسله مين أصبح، مش بس إيه عمل.
لا تقول "مبروك" أو "عظيم" أو كلام فضفاض. كون محدد وشخصي وإنساني.
لا قوائم. لا نصايح. بس لحظة وعي حقيقية.
ابدأ مباشرة بالرسالة.`;

    try {
      const result = await callGemini({
        systemInstruction: "أنت رفيق — رفيق سلوكي بيتكلم عربي مصري دارج. ردودك قصيرة وإنسانية وشخصية جداً.",
        userMessage: prompt,
        temperature: 0.85,
        maxOutputTokens: 180,
      });
      const arcMessage = result.text?.trim() ?? buildFallbackArc(name, milestone, goal);
      return { arcMessage };
    } catch {
      return { arcMessage: buildFallbackArc(name, milestone, goal) };
    }
  });

// ─── Fallback Arc ──────────────────────────────────────────────────────────

function buildFallbackArc(
  name: string | null,
  milestone: number,
  goal: string | null
): string {
  const n = name ? `يا ${name}` : "";
  const g = goal ? ` في طريقك نحو ${goal}` : "";

  if (milestone === 5) {
    return `${n} — 5 خطوات${g}. ده مش صدفة — ده قرار بتتخذه مرة بعد مرة.`;
  }
  if (milestone === 10) {
    return `${n} — عملت 10 خطوات. النقطة دي بالظبط هي اللي بيعدّيها المستمرون فقط.`;
  }
  if (milestone === 20) {
    return `${n} — 20 خطوة. ده مش حد بيحاول. ده حد بيعيش بشكل مختلف فعلاً.`;
  }
  return `${n} — ${milestone} خطوة. الأرقام مش المهم — المهم مين أصبحت وأنت بتعملها.`;
}
