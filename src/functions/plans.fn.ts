/**
 * Plans Server Functions — manages user goals breakdown, micro-actions list,
 * and automated AI plan generation using Gemini.
 */

import { createServerFn } from "@tanstack/react-start";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { callGemini } from "@/lib/ai-client";
import { AI_CONFIG } from "@/config/ai";

export interface PlanStep {
  id: string;
  plan_id: string;
  order_index: number;
  title: string;
  status: "pending" | "completed";
  due_at: string | null;
  completed_at: string | null;
  created_at: string;
}

export interface Plan {
  id: string;
  user_id: string;
  title: string;
  brain_node_id: string | null;
  target_date: string | null;
  status: "active" | "completed" | "archived";
  created_at: string;
  steps?: PlanStep[];
}

// ─── Fetch All Plans ─────────────────────────────────────────────────────────

export const fetchPlans = createServerFn({ method: "POST" })
  .inputValidator((input: { userId: string }) => input)
  .handler(async ({ data }): Promise<{ plans: Plan[] }> => {
    const { userId } = data;

    const { data: plans, error: plansError } = await supabaseAdmin
      .from("plans")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (plansError) throw new Error(plansError.message);
    if (!plans || plans.length === 0) return { plans: [] };

    const planIds = plans.map((p) => p.id);
    const { data: steps, error: stepsError } = await supabaseAdmin
      .from("plan_steps")
      .select("*")
      .in("plan_id", planIds)
      .order("order_index", { ascending: true });

    if (stepsError) throw new Error(stepsError.message);

    const plansWithSteps = (plans as Plan[]).map((plan) => ({
      ...plan,
      steps: (steps as PlanStep[] || []).filter((step) => step.plan_id === plan.id),
    }));

    return { plans: plansWithSteps };
  });

// ─── Create Manual Plan ──────────────────────────────────────────────────────

export const createManualPlan = createServerFn({ method: "POST" })
  .inputValidator(
    (input: {
      userId: string;
      title: string;
      brainNodeId?: string;
      targetDate?: string;
      steps: string[];
    }) => input
  )
  .handler(async ({ data }): Promise<Plan> => {
    const { userId, title, brainNodeId, targetDate, steps } = data;

    const { data: plan, error: planError } = await supabaseAdmin
      .from("plans")
      .insert({
        user_id: userId,
        title: title.trim(),
        brain_node_id: brainNodeId || null,
        target_date: targetDate || null,
        status: "active",
      })
      .select("*")
      .single();

    if (planError) throw new Error(planError.message);

    let insertedSteps: PlanStep[] = [];
    if (steps && steps.length > 0) {
      const stepsToInsert = steps
        .filter((s) => s.trim().length > 0)
        .map((stepTitle, idx) => ({
          plan_id: plan.id,
          order_index: idx,
          title: stepTitle.trim(),
          status: "pending",
        }));

      if (stepsToInsert.length > 0) {
        const { data: sData, error: stepsError } = await supabaseAdmin
          .from("plan_steps")
          .insert(stepsToInsert)
          .select("*");

        if (stepsError) throw new Error(stepsError.message);
        insertedSteps = (sData as PlanStep[]) || [];
      }
    }

    return {
      ...plan,
      steps: insertedSteps,
    } as Plan;
  });

// ─── Delete Plan ─────────────────────────────────────────────────────────────

export const deletePlan = createServerFn({ method: "POST" })
  .inputValidator((input: { userId: string; planId: string }) => input)
  .handler(async ({ data }) => {
    const { userId, planId } = data;

    const { error } = await supabaseAdmin
      .from("plans")
      .delete()
      .eq("id", planId)
      .eq("user_id", userId);

    if (error) throw new Error(error.message);
    return { success: true };
  });

// ─── Update Plan Step Status ──────────────────────────────────────────────────

export const updatePlanStepStatus = createServerFn({ method: "POST" })
  .inputValidator(
    (input: { userId: string; stepId: string; status: "pending" | "completed" }) => input
  )
  .handler(async ({ data }) => {
    const { userId, stepId, status } = data;

    // 1. Fetch step to get plan_id
    const { data: stepData, error: stepFetchError } = await supabaseAdmin
      .from("plan_steps")
      .select("plan_id")
      .eq("id", stepId)
      .single();

    if (stepFetchError || !stepData) throw new Error("Step not found");

    // 2. Verify plan owner
    const { data: planData, error: planFetchError } = await supabaseAdmin
      .from("plans")
      .select("user_id")
      .eq("id", stepData.plan_id)
      .eq("user_id", userId)
      .single();

    if (planFetchError || !planData) throw new Error("Plan not found or unauthorized");

    // 3. Update step status
    const completedAt = status === "completed" ? new Date().toISOString() : null;
    const { error: updateError } = await supabaseAdmin
      .from("plan_steps")
      .update({
        status,
        completed_at: completedAt,
      })
      .eq("id", stepId);

    if (updateError) throw new Error(updateError.message);

    // 4. Check if all steps of this plan are completed
    const { data: allSteps } = await supabaseAdmin
      .from("plan_steps")
      .select("status")
      .eq("plan_id", stepData.plan_id);

    const allCompleted =
      allSteps && allSteps.length > 0 && allSteps.every((s) => s.status === "completed");

    if (allCompleted) {
      await supabaseAdmin
        .from("plans")
        .update({ status: "completed" })
        .eq("id", stepData.plan_id);
    } else {
      await supabaseAdmin
        .from("plans")
        .update({ status: "active" })
        .eq("id", stepData.plan_id);
    }

    return { success: true };
  });

// ─── Generate Plan From Goal (AI) ──────────────────────────────────────────

export const generatePlanFromGoal = createServerFn({ method: "POST" })
  .inputValidator(
    (input: { userId: string; goalTitle: string; brainNodeId?: string }) => input
  )
  .handler(async ({ data }): Promise<Plan> => {
    const { userId, goalTitle, brainNodeId } = data;

    const systemInstruction = `
أنت مساعد سلوكي خبير وجزء من نظام "رفيق" لمكافحة التشتت وتنظيم الوقت.
مهمتك هي تقسيم هدف أو مشكلة معينة للمستخدم إلى خطة عمل عملية ومنظمة للغاية تتكون من ٥ إلى ١٠ خطوات صغيرة جداً (Micro-actions).

شروط الخطوات:
١) يجب أن تكون الخطوات صغيرة جداً وسهلة البدء وغير محبطة (مثال: "افتح المذكرة واقرأ أول سطر بس" بدلاً من "ذاكر الباب الأول كله").
٢) يجب صياغة عنوان الخطة وعناوين الخطوات بالكامل بالعامية المصرية الدافئة والمشجعة والصاحب الجدع (مثال: "بص يا صاحبي، أول خطوة..."، "اشرب شاي بالنعناع ونضف مكتبك").
٣) رتب الخطوات ترتيباً منطقياً تصاعدياً بحيث تشجع المستخدم على بناء الزخم (Momentum).

يجب أن يكون ردك كود JSON صالح فقط ومطابق للهيكل التالي تماماً (بدون أي نصوص إضافية أو علامات كود):
{
  "title": "عنوان مشجع وجذاب للخطة بالعامية المصرية الدافئة (مثال: خطة ترويض غول المذاكرة)",
  "steps": [
    {
      "order_index": 0,
      "title": "عنوان الخطوة الصغرى بالعامية المصرية"
    }
  ]
}
`.trim();

    const aiResult = await callGemini({
      model: AI_CONFIG.PRIMARY_MODEL,
      systemInstruction,
      userMessage: `الهدف أو المشكلة المراد تخطيطها وتفكيكها: "${goalTitle}"`,
      temperature: 0.7, // friendly and supportive tone variations
      maxOutputTokens: 1500,
      expectJson: true,
      responseSchema: {
        type: "object",
        properties: {
          title: { type: "string" },
          steps: {
            type: "array",
            items: {
              type: "object",
              properties: {
                order_index: { type: "number" },
                title: { type: "string" },
              },
              required: ["order_index", "title"],
            },
          },
        },
        required: ["title", "steps"],
      },
    });

    if (!aiResult.json) {
      throw new Error("Failed to generate plan via AI");
    }

    const planJson = aiResult.json as {
      title: string;
      steps: Array<{ order_index: number; title: string }>;
    };

    // Insert the plan
    const { data: plan, error: pError } = await supabaseAdmin
      .from("plans")
      .insert({
        user_id: userId,
        title: planJson.title.trim() || goalTitle,
        brain_node_id: brainNodeId || null,
        status: "active",
      })
      .select("*")
      .single();

    if (pError) throw new Error(pError.message);

    // Sort steps to keep order_index consistent
    const sortedSteps = [...planJson.steps].sort((a, b) => a.order_index - b.order_index);

    const stepsToInsert = sortedSteps.map((s, idx) => ({
      plan_id: plan.id,
      order_index: idx,
      title: s.title.trim(),
      status: "pending",
    }));

    const { data: insertedSData, error: sError } = await supabaseAdmin
      .from("plan_steps")
      .insert(stepsToInsert)
      .select("*");

    if (sError) throw new Error(sError.message);

    return {
      ...plan,
      steps: (insertedSData as PlanStep[]) || [],
    } as Plan;
  });
