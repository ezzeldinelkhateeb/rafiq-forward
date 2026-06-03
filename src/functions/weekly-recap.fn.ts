/**
 * Weekly Recap Server Function — generates a personalized weekly summary
 * using Gemini, highlighting what the user accomplished and where they grew.
 *
 * Called when it's been 7+ days since user joined or last recap was shown.
 * Output: a warm, personal Arabic message from Rafiq summarizing the week.
 */

import { createServerFn } from "@tanstack/react-start";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { callGemini } from "@/lib/ai-client";

// ─── Fetch Weekly Recap Data ───────────────────────────────────────────────

export const fetchWeeklyRecap = createServerFn({ method: "POST" })
  .inputValidator((input: { userId: string }) => input)
  .handler(async ({ data }): Promise<{ recap: string | null; stats: WeeklyStats }> => {
    const { userId } = data;

    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    const since = oneWeekAgo.toISOString();

    const [interactionsResult, userResult, habitsResult] = await Promise.allSettled([
      supabaseAdmin
        .from("interactions")
        .select("user_text, validate, action, action_done, created_at")
        .eq("user_id", userId)
        .gte("created_at", since)
        .order("created_at", { ascending: false })
        .limit(30),
      supabaseAdmin
        .from("users")
        .select("display_name, created_at")
        .eq("id", userId)
        .single(),
      supabaseAdmin
        .from("habit_logs")
        .select("completed_at")
        .eq("user_id", userId)
        .gte("completed_at", since),
    ]);

    const interactions =
      interactionsResult.status === "fulfilled" ? interactionsResult.value.data ?? [] : [];
    const user =
      userResult.status === "fulfilled" ? userResult.value.data : null;
    const habitLogs =
      habitsResult.status === "fulfilled" ? habitsResult.value.data ?? [] : [];

    const stats: WeeklyStats = {
      totalMessages: interactions.length,
      actionsCompleted: interactions.filter((i) => i.action_done).length,
      actionsProposed: interactions.filter((i) => i.action).length,
      habitCompletions: habitLogs.length,
      userName: user?.display_name ?? null,
    };

    // Don't generate if not enough data
    if (stats.totalMessages < 3) {
      return { recap: null, stats };
    }

    // Build prompt for Gemini
    const actionsList = interactions
      .filter((i) => i.action && i.action_done)
      .map((i) => `- ${i.action}`)
      .slice(0, 5)
      .join("\n");

    const name = stats.userName ? `يا ${stats.userName}` : "";
    const prompt = `أنت رفيق — رفيق سلوكي بيتكلم عربي مصري دارج.

بيانات أسبوع المستخدم:
- عدد المحادثات: ${stats.totalMessages}
- خطوات منجزة: ${stats.actionsCompleted} من ${stats.actionsProposed}
- عادات: ${stats.habitCompletions} مرة اتكملت
${actionsList ? `- أبرز خطوات عملها:\n${actionsList}` : ""}

اكتب رسالة واحدة قصيرة (2-3 جمل بالكتير) بأسلوب مصري دافي وبشري جداً تلخص الأسبوع ده وفيها شيء شخصي مش عام. ابدأ بـ "${name}". لا تكتر الكلام. لا قوائم. لا نصايح. بس لحظة وعي إنساني حقيقي.`;

    try {
      const result = await callGemini({
        systemInstruction: "أنت رفيق — رفيق سلوكي بيتكلم عربي مصري دارج. ردودك قصيرة وإنسانية.",
        userMessage: prompt,
        temperature: 0.85,
        maxOutputTokens: 150,
      });
      const recap = result.text?.trim() ?? buildFallbackRecap(stats);
      return { recap, stats };
    } catch {
      // Fallback: rule-based recap if Gemini unavailable
      const fallback = buildFallbackRecap(stats);
      return { recap: fallback, stats };
    }
  });

// ─── Check if Weekly Recap Should Show ────────────────────────────────────

export const shouldShowWeeklyRecap = createServerFn({ method: "POST" })
  .inputValidator((input: { userId: string }) => input)
  .handler(async ({ data }): Promise<boolean> => {
    const { userId } = data;

    // Check last seen at — if user joined 7+ days ago
    const { data: user } = await supabaseAdmin
      .from("users")
      .select("created_at, last_seen_at")
      .eq("id", userId)
      .single();

    if (!user) return false;

    const joinedAt = new Date(user.created_at);
    const daysSinceJoin = (Date.now() - joinedAt.getTime()) / (1000 * 60 * 60 * 24);

    // Show after first 7 days only (not every week — that's for later)
    return daysSinceJoin >= 7 && daysSinceJoin < 8;
  });

// ─── Types ─────────────────────────────────────────────────────────────────

export interface WeeklyStats {
  totalMessages: number;
  actionsCompleted: number;
  actionsProposed: number;
  habitCompletions: number;
  userName: string | null;
}

// ─── Fallback Recap Builder ────────────────────────────────────────────────

function buildFallbackRecap(stats: WeeklyStats): string {
  const name = stats.userName ? `يا ${stats.userName}` : "";
  const rate =
    stats.actionsProposed > 0
      ? Math.round((stats.actionsCompleted / stats.actionsProposed) * 100)
      : 0;

  if (stats.actionsCompleted === 0) {
    return `${name} — الأسبوع ده اتكلمنا ${stats.totalMessages} مرة. الخطوات العملية لسه في الطريق، وده تمام — المهم إنك لسه هنا.`;
  }

  if (rate >= 70) {
    return `${name} — الأسبوع ده كان حلو. عملت ${stats.actionsCompleted} خطوة من اللي اتفقنا عليه. الزخم ده أصعب ما يجي.`;
  }

  return `${name} — ${stats.actionsCompleted} خطوة خلال أسبوع. ده مش رقم صغير. استمر كده.`;
}
