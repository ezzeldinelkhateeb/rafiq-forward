import React, { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  fetchPlans,
  createManualPlan,
  deletePlan,
  updatePlanStepStatus,
  generatePlanFromGoal,
  type Plan,
  type PlanStep,
} from "@/functions/plans.fn";
import {
  ChevronDown,
  ChevronUp,
  Trash2,
  Plus,
  Loader2,
  Sparkles,
  CheckCircle2,
  Circle,
  ListChecks,
  AlertCircle,
} from "lucide-react";

interface PlansListProps {
  userId: string;
}

export function PlansList({ userId }: PlansListProps) {
  const callFetchPlans = useServerFn(fetchPlans);
  const callCreateManual = useServerFn(createManualPlan);
  const callDeletePlan = useServerFn(deletePlan);
  const callUpdateStep = useServerFn(updatePlanStepStatus);
  const callGeneratePlan = useServerFn(generatePlanFromGoal);

  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Expanded plans IDs state
  const [expandedPlans, setExpandedPlans] = useState<Record<string, boolean>>({});

  // Form states
  const [showAddForm, setShowAddForm] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newSteps, setNewSteps] = useState<string[]>([""]);
  const [isAiGenerating, setIsAiGenerating] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null); // tracks IDs of plans/steps being updated

  const loadPlans = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await callFetchPlans({ data: { userId } });
      setPlans(res.plans);
      // Auto-expand the first plan if available
      if (res.plans.length > 0) {
        setExpandedPlans((prev) => ({ [res.plans[0].id]: true, ...prev }));
      }
    } catch (e: any) {
      console.error("[PlansList] Error loading plans:", e);
      setError("حصل مشكلة وأنا بحمل الخطط بتاعتك. جرب تاني كده؟");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPlans();
  }, [userId]);

  const toggleExpand = (planId: string) => {
    setExpandedPlans((prev) => ({
      ...prev,
      [planId]: !prev[planId],
    }));
  };

  const handleToggleStep = async (stepId: string, currentStatus: "pending" | "completed") => {
    setActionLoading(`step-${stepId}`);
    const nextStatus = currentStatus === "pending" ? "completed" : "pending";
    try {
      await callUpdateStep({ data: { userId, stepId, status: nextStatus } });
      // Optimistically update local state to avoid full reload lag
      setPlans((prevPlans) =>
        prevPlans.map((plan) => {
          if (!plan.steps) return plan;
          const hasStep = plan.steps.some((s) => s.id === stepId);
          if (!hasStep) return plan;

          const updatedSteps = plan.steps.map((s) =>
            s.id === stepId
              ? {
                  ...s,
                  status: nextStatus,
                  completed_at: nextStatus === "completed" ? new Date().toISOString() : null,
                }
              : s
          );

          const allCompleted = updatedSteps.every((s) => s.status === "completed");

          return {
            ...plan,
            status: allCompleted ? "completed" : "active",
            steps: updatedSteps,
          };
        })
      );
    } catch (e) {
      console.error("[PlansList] Error toggling step status:", e);
      setError("ما عرفتش أحدث خطوتك، حاول تاني.");
    } finally {
      setActionLoading(null);
    }
  };

  const handleDelete = async (planId: string) => {
    if (!confirm("متأكد إنك عاوز تمسح الخطة دي خالص؟")) return;
    setActionLoading(`plan-${planId}`);
    try {
      await callDeletePlan({ data: { userId, planId } });
      setPlans((prev) => prev.filter((p) => p.id !== planId));
    } catch (e) {
      console.error("[PlansList] Error deleting plan:", e);
      setError("حصلت مشكلة وأنا بمسح الخطة.");
    } finally {
      setActionLoading(null);
    }
  };

  const handleAddStepInput = () => {
    setNewSteps((prev) => [...prev, ""]);
  };

  const handleStepInputChange = (index: number, val: string) => {
    setNewSteps((prev) => {
      const copy = [...prev];
      copy[index] = val;
      return copy;
    });
  };

  const handleRemoveStepInput = (index: number) => {
    setNewSteps((prev) => prev.filter((_, i) => i !== index));
  };

  const handleCreateManual = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    setActionLoading("create");
    setError(null);
    try {
      const activeSteps = newSteps.filter((s) => s.trim().length > 0);
      const newPlan = await callCreateManual({
        data: {
          userId,
          title: newTitle.trim(),
          steps: activeSteps,
        },
      });

      setPlans((prev) => [newPlan, ...prev]);
      setExpandedPlans((prev) => ({ ...prev, [newPlan.id]: true }));
      // Reset form
      setNewTitle("");
      setNewSteps([""]);
      setShowAddForm(false);
    } catch (e) {
      console.error("[PlansList] Error creating manual plan:", e);
      setError("ما عرفتش أعمل الخطة دي، جرب تاني.");
    } finally {
      setActionLoading(null);
    }
  };

  const handleCreateAI = async () => {
    if (!newTitle.trim()) return;

    setIsAiGenerating(true);
    setError(null);
    try {
      const newPlan = await callGeneratePlan({
        data: {
          userId,
          goalTitle: newTitle.trim(),
        },
      });

      setPlans((prev) => [newPlan, ...prev]);
      setExpandedPlans((prev) => ({ ...prev, [newPlan.id]: true }));
      setNewTitle("");
      setNewSteps([""]);
      setShowAddForm(false);
    } catch (e) {
      console.error("[PlansList] Error generating AI plan:", e);
      setError("رفيق ما عرفش يقسم الهدف ده لخطوات دلوقتي. جرب تكتبه بأسلوب تاني أو ضيف خطواته يدوي.");
    } finally {
      setIsAiGenerating(false);
    }
  };

  return (
    <div className="flex flex-col h-full font-arabic text-ivory">
      {/* Header Controls */}
      <div className="flex items-center justify-between shrink-0 mb-4 px-1">
        <h3 className="text-sm font-semibold flex items-center gap-1.5 text-ivory/80">
          <ListChecks className="w-4 h-4 text-[#E6C38E]" />
          خططك المفككة لخطوات صغرى
        </h3>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="flex items-center gap-1 text-[11px] font-medium px-2.5 py-1 rounded-full border border-ivory/10 bg-ivory/[0.03] hover:bg-ivory/[0.07] hover:border-[#E6C38E]/30 cursor-pointer transition-all"
        >
          {showAddForm ? "إلغاء" : <><Plus className="w-3 h-3 text-[#E6C38E]" /> خطة جديدة</>}
        </button>
      </div>

      {error && (
        <div className="mb-3 p-3 rounded-xl border border-red-500/20 bg-red-500/5 text-red-400 text-xs flex items-start gap-2 animate-fade-in shrink-0">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {/* Add Plan Form Overlay/Dropdown */}
      {showAddForm && (
        <div className="shrink-0 p-4 rounded-xl border border-ivory/10 bg-ivory/[0.02] space-y-3 mb-4 animate-fade-in">
          <div>
            <label className="block text-[11px] text-ivory/45 mb-1">الهدف الكبير أو المشكلة اللي عاوز تخطط لها:</label>
            <input
              type="text"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="مثال: تنظيم النوم، المذاكرة لامتحان الكيمياء، تقليل السوشيال ميديا..."
              className="w-full bg-ivory/[0.04] border border-ivory/8 rounded-lg px-3 py-2 text-sm text-ivory outline-none focus:border-[#E6C38E]/40"
            />
          </div>

          {!isAiGenerating && (
            <div className="space-y-2">
              <label className="block text-[11px] text-ivory/45">الخطوات الصغرى (اختياري، أو خليه يفكر بدالك):</label>
              {newSteps.map((step, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <span className="text-[10px] text-ivory/30 w-4">{idx + 1}.</span>
                  <input
                    type="text"
                    value={step}
                    onChange={(e) => handleStepInputChange(idx, e.target.value)}
                    placeholder={`خطوة صغرى ${idx + 1}...`}
                    className="flex-1 bg-ivory/[0.02] border border-ivory/6 rounded-lg px-3 py-1.5 text-xs text-ivory outline-none focus:border-ivory/20"
                  />
                  {newSteps.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveStepInput(idx)}
                      className="p-1.5 rounded-lg hover:bg-red-500/10 text-ivory/40 hover:text-red-400"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              ))}
              <button
                type="button"
                onClick={handleAddStepInput}
                className="flex items-center gap-1 text-[10px] text-[#E6C38E] hover:underline px-1 py-1"
              >
                <Plus className="w-3 h-3" /> ضيف خطوة تانية
              </button>
            </div>
          )}

          <div className="flex gap-2 pt-2 border-t border-ivory/5">
            <button
              onClick={handleCreateAI}
              disabled={!newTitle.trim() || isAiGenerating || actionLoading !== null}
              className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold text-[#121212] transition-all disabled:opacity-40 disabled:cursor-not-allowed hover:brightness-110"
              style={{ background: "linear-gradient(135deg, #E6C38E, #d4ad6e)" }}
            >
              {isAiGenerating ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  رفيق بيفكر ويكتب...
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5" />
                  خلّق خطوات بالذكاء الاصطناعي ✨
                </>
              )}
            </button>

            {!isAiGenerating && (
              <button
                onClick={handleCreateManual}
                disabled={!newTitle.trim() || actionLoading === "create"}
                className="px-4 py-2 rounded-lg text-xs font-medium border border-ivory/10 hover:bg-ivory/[0.05] disabled:opacity-40"
              >
                ضيفها يدوي
              </button>
            )}
          </div>
        </div>
      )}

      {/* Plans List Scrollable Area */}
      <div className="flex-1 overflow-y-auto scrollbar-none space-y-3 pb-6">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <Loader2 className="w-6 h-6 text-[#E6C38E] animate-spin" />
            <p className="text-xs text-ivory/40">بجمع خطتك وأفكارك...</p>
          </div>
        ) : plans.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 px-4 text-center border border-dashed border-ivory/8 rounded-2xl">
            <p className="text-sm text-ivory/60 mb-1">مفيش خطط نشطة دلوقتي.</p>
            <p className="text-xs text-ivory/35 max-w-[240px]">
              لو عندك هدف كبير أو مشكلة معقدة، اكتبها فوق وخلي رفيق يفككها لخطوات صغرى مريحة.
            </p>
          </div>
        ) : (
          plans.map((plan) => {
            const steps = plan.steps || [];
            const completedCount = steps.filter((s) => s.status === "completed").length;
            const totalCount = steps.length;
            const progressPct = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
            const isExpanded = !!expandedPlans[plan.id];

            return (
              <div
                key={plan.id}
                className={`rounded-xl border transition-all duration-200 ${
                  plan.status === "completed"
                    ? "border-emerald-500/10 bg-emerald-500/[0.01]"
                    : "border-ivory/8 bg-ivory/[0.02] hover:bg-ivory/[0.03]"
                }`}
              >
                {/* Plan Header */}
                <div
                  onClick={() => toggleExpand(plan.id)}
                  className="p-4 flex items-center justify-between gap-3 cursor-pointer select-none"
                >
                  <div className="flex-1 min-w-0">
                    <h4
                      className={`text-sm font-semibold truncate transition-colors ${
                        plan.status === "completed" ? "text-emerald-400/80 line-through" : "text-ivory/90"
                      }`}
                    >
                      {plan.title}
                    </h4>

                    {/* Progress Bar Info */}
                    <div className="flex items-center gap-2 mt-1.5">
                      <div className="flex-1 h-1 bg-ivory/5 rounded-full overflow-hidden">
                        <div
                          className={`h-full transition-all duration-300 ${
                            plan.status === "completed" ? "bg-emerald-500" : "bg-[#E6C38E]"
                          }`}
                          style={{ width: `${progressPct}%` }}
                        />
                      </div>
                      <span className="text-[10px] text-ivory/40 whitespace-nowrap shrink-0">
                        {completedCount} من {totalCount} خطوات ({progressPct}%)
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => handleDelete(plan.id)}
                      disabled={actionLoading === `plan-${plan.id}`}
                      className="p-2 rounded-lg hover:bg-red-500/10 text-ivory/40 hover:text-red-400 transition-colors cursor-pointer"
                      title="امسح الخطة"
                    >
                      {actionLoading === `plan-${plan.id}` ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Trash2 className="w-3.5 h-3.5" />
                      )}
                    </button>

                    <button
                      onClick={() => toggleExpand(plan.id)}
                      className="p-2 rounded-lg hover:bg-ivory/5 text-ivory/40 hover:text-ivory/70 transition-colors cursor-pointer"
                    >
                      {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Steps List */}
                {isExpanded && (
                  <div className="px-4 pb-4 border-t border-ivory/5 pt-3 space-y-2.5 animate-slide-down">
                    {steps.length === 0 ? (
                      <p className="text-[11px] text-ivory/30 text-center py-2">مفيش خطوات مضافة للخطة دي.</p>
                    ) : (
                      steps.map((step) => {
                        const isStepLoading = actionLoading === `step-${step.id}`;
                        const isDone = step.status === "completed";

                        return (
                          <div
                            key={step.id}
                            onClick={() => !isStepLoading && handleToggleStep(step.id, step.status)}
                            className={`flex items-start gap-2.5 p-2 rounded-lg hover:bg-ivory/[0.02] cursor-pointer transition-colors ${
                              isDone ? "text-ivory/35" : "text-ivory/80"
                            }`}
                          >
                            <button
                              disabled={isStepLoading}
                              className="mt-0.5 shrink-0 focus:outline-none"
                            >
                              {isStepLoading ? (
                                <Loader2 className="w-4 h-4 text-[#E6C38E] animate-spin" />
                              ) : isDone ? (
                                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                              ) : (
                                <Circle className="w-4 h-4 text-ivory/25 hover:text-[#E6C38E]/50" />
                              )}
                            </button>
                            <span
                              className={`text-xs leading-relaxed select-none ${
                                isDone ? "line-through" : ""
                              }`}
                            >
                              {step.title}
                            </span>
                          </div>
                        );
                      })
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
