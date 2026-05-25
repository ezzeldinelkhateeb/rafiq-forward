import React, { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { fetchDashboardData, type DashboardData } from "@/functions/dashboard.fn";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Flame, Sparkles, BrainCircuit, Heart, BarChart3, AlertCircle, RefreshCw } from "lucide-react";

// Mapping emotional states to Egyptian labels, colors, and border styling
const EMOTION_MAP: Record<
  string,
  { label: string; bg: string; border: string; text: string }
> = {
  motivated: {
    label: "نشيط ومتحمس 💪",
    bg: "rgba(125,143,106,0.15)",
    border: "rgba(125,143,106,0.35)",
    text: "#7D8F6A",
  },
  rebuilding: {
    label: "بيحاول ويقوم 🏃‍♂️",
    bg: "rgba(230,195,142,0.15)",
    border: "rgba(230,195,142,0.35)",
    text: "#E6C38E",
  },
  drained: {
    label: "مستنزف وتعبان 🔋",
    bg: "rgba(76,81,191,0.15)",
    border: "rgba(76,81,191,0.35)",
    text: "#7F9CF5",
  },
  anxious: {
    label: "متوتر وقلقان 😰",
    bg: "rgba(159,122,234,0.15)",
    border: "rgba(159,122,234,0.35)",
    text: "#B794F4",
  },
  scattered: {
    label: "مشتت وتايه 🌀",
    bg: "rgba(49,151,149,0.15)",
    border: "rgba(49,151,149,0.35)",
    text: "#319795",
  },
  unknown: {
    label: "حالة عادية ☕",
    bg: "rgba(255,255,255,0.05)",
    border: "rgba(255,255,255,0.15)",
    text: "rgba(244,244,240,0.6)",
  },
};

// Mapping pattern types to friendly Egyptian names
const PATTERN_MAP: Record<string, { label: string; color: string }> = {
  doomscroll: { label: "دوامة السوشيال ميديا 📱", color: "#F56565" },
  avoidance: { label: "التهرب من الفعل والخطوات 🏃‍♂️", color: "#ED8936" },
  collapse_hour: { label: "خمول وسهر الليل المتأخر 🌙", color: "#ED64A6" },
  focus_window: { label: "ساعة تركيز وإنجاز عالية 🎯", color: "#48BB78" },
};

interface DashboardDrawerProps {
  userId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  streakDone: number;
  streakTotal: number;
}

export function DashboardDrawer({
  userId,
  open,
  onOpenChange,
  streakDone,
  streakTotal,
}: DashboardDrawerProps) {
  const getDashboard = useServerFn(fetchDashboardData);
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadData = React.useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await getDashboard({ data: { userId } });
      setData(res);
    } catch (e) {
      console.error("[DashboardDrawer] Error fetching data:", e);
      setError("حصلت مشكلة وأنا بجيب البيانات السلوكية بتاعتك.");
    } finally {
      setLoading(false);
    }
  }, [userId, getDashboard]);

  useEffect(() => {
    if (open) {
      loadData();
    }
  }, [open, loadData]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-md bg-[#121212] border-l border-ivory/10 text-ivory overflow-y-auto font-arabic scrollbar-none"
        dir="rtl"
      >
        <SheetHeader className="text-right space-y-2 pb-4 border-b border-ivory/8">
          <SheetTitle className="text-xl font-bold flex items-center gap-2 text-[#E6C38E]">
            <BrainCircuit className="w-5 h-5" />
            وعي رفيق وتاريخك
          </SheetTitle>
          <SheetDescription className="text-xs text-ivory/45">
            هنا رفيق بيكتب خلاصة فهمه لطريقتك وتحدياتك اليومية عشان يدعمك صح.
          </SheetDescription>
        </SheetHeader>

        {loading && (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <RefreshCw className="w-8 h-8 text-[#E6C38E] animate-spin" />
            <p className="text-xs text-ivory/40">برتبلك أفكارك وتاريخك السلوكي...</p>
          </div>
        )}

        {error && (
          <div className="flex items-center gap-2 p-4 mt-6 rounded-xl border border-red-500/20 bg-red-500/5 text-xs text-red-400">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {!loading && !error && data && (
          <div className="space-y-6 pt-5 pb-10">
            {/* 1. Streak Card */}
            <div
              className="p-4 rounded-2xl border transition-all"
              style={{
                background: "linear-gradient(135deg, rgba(230,195,142,0.06), rgba(125,143,106,0.03))",
                borderColor: "rgba(230,195,142,0.15)",
              }}
            >
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <p className="text-[10px] tracking-widest text-[#E6C38E] uppercase opacity-70">
                    معدل الحركة الأسبوعي
                  </p>
                  <h3 className="text-2xl font-bold font-mono">
                    {streakDone} <span className="text-xs text-ivory/30">خطوة ناجحة</span>
                  </h3>
                </div>
                <div className="p-2.5 rounded-full bg-gold/10 border border-gold/25">
                  <Flame className="w-6 h-6 text-[#E6C38E]" />
                </div>
              </div>
              <div className="w-full bg-ivory/5 h-1.5 rounded-full mt-4 overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${streakTotal > 0 ? (streakDone / streakTotal) * 100 : 0}%`,
                    background: "linear-gradient(90deg, #7D8F6A, #E6C38E)",
                  }}
                />
              </div>
              <p className="text-[11px] text-ivory/40 mt-2 text-left">
                أنجزت {streakTotal > 0 ? Math.round((streakDone / streakTotal) * 100) : 0}% من إجمالي الخطوات المقترحة
              </p>
            </div>

            {/* 2. How Rafiq Sees You (Personality) */}
            {data.identity?.personality && (
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-ivory/50 flex items-center gap-1.5 px-1">
                  <Heart className="w-3.5 h-3.5 text-[#E6C38E]" />
                  كيف يراك رفيق (تحليلك السلوكي)
                </h4>
                <div className="p-4 rounded-xl border border-ivory/8 bg-ivory/[0.02] text-[13px] leading-relaxed text-ivory/85">
                  {data.identity.personality}
                </div>
              </div>
            )}

            {/* 3. Goals & Struggles */}
            <div className="grid grid-cols-1 gap-4">
              {/* Goals */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-ivory/50 px-1">أهدافك السلوكية اللي بنسعى ليها 🎯</h4>
                <div className="flex flex-wrap gap-1.5">
                  {data.identity?.goals && data.identity.goals.length > 0 ? (
                    data.identity.goals.map((g) => (
                      <span
                        key={g}
                        className="text-xs px-3 py-1.5 rounded-full border"
                        style={{
                          background: "rgba(125,143,106,0.06)",
                          borderColor: "rgba(125,143,106,0.25)",
                          color: "#7D8F6A",
                        }}
                      >
                        {g}
                      </span>
                    ))
                  ) : (
                    <span className="text-xs text-ivory/30 px-1">لسه محددناش أهداف كبيرة، بنبدأ خطوة بخطوة.</span>
                  )}
                </div>
              </div>

              {/* Struggles */}
              <div className="space-y-2 pt-2">
                <h4 className="text-xs font-bold text-ivory/50 px-1">التحديات والصراعات اللي بنواجهها 🌋</h4>
                <div className="flex flex-wrap gap-1.5">
                  {data.identity?.struggles && data.identity.struggles.length > 0 ? (
                    data.identity.struggles.map((s) => (
                      <span
                        key={s}
                        className="text-xs px-3 py-1.5 rounded-full border"
                        style={{
                          background: "rgba(230,195,142,0.06)",
                          borderColor: "rgba(230,195,142,0.25)",
                          color: "#E6C38E",
                        }}
                      >
                        {s}
                      </span>
                    ))
                  ) : (
                    <span className="text-xs text-ivory/30 px-1">الدنيا رايقة ومفيش تحديات صعبة متسجلة لسه.</span>
                  )}
                </div>
              </div>
            </div>

            {/* 4. Behavioral Patterns */}
            <div className="space-y-2 pt-2">
              <h4 className="text-xs font-bold text-ivory/50 flex items-center gap-1.5 px-1">
                <BarChart3 className="w-3.5 h-3.5 text-[#E6C38E]" />
                عادات رصدها رفيق مؤخراً
              </h4>
              <div className="space-y-2">
                {data.patterns && data.patterns.length > 0 ? (
                  data.patterns.map((p) => {
                    const mapped = PATTERN_MAP[p.pattern_type] || {
                      label: p.pattern_type,
                      color: "#E6C38E",
                    };
                    return (
                      <div
                        key={p.pattern_type}
                        className="p-3 rounded-xl border border-ivory/5 bg-ivory/[0.01] flex items-start justify-between gap-3 text-xs"
                      >
                        <div className="space-y-1">
                          <p className="font-semibold" style={{ color: mapped.color }}>
                            {mapped.label}
                          </p>
                          <p className="text-[11px] text-ivory/50 leading-relaxed">
                            {p.description}
                          </p>
                        </div>
                        <span
                          className="shrink-0 text-[10px] font-mono px-2 py-0.5 rounded-md text-ivory/70 border border-ivory/10"
                          title="عدد مرات الملاحظة في المحادثات"
                        >
                          تكرر {p.occurrence_count}x
                        </span>
                      </div>
                    );
                  })
                ) : (
                  <p className="text-xs text-ivory/30 px-1">مفيش عادات سلوكية واضحة اترصدت لسه، كمل حركتك.</p>
                )}
              </div>
            </div>

            {/* 5. Emotional Timeline */}
            <div className="space-y-3 pt-2">
              <h4 className="text-xs font-bold text-ivory/50 flex items-center gap-1.5 px-1">
                <Sparkles className="w-3.5 h-3.5 text-[#E6C38E]" />
                خط سير مشاعرك وطاقتك
              </h4>
              <div className="relative border-r border-ivory/8 mr-3 pr-4 space-y-4">
                {data.emotionalTimeline && data.emotionalTimeline.length > 0 ? (
                  data.emotionalTimeline.map((e, idx) => {
                    const mapped = EMOTION_MAP[e.emotional_state] || EMOTION_MAP.unknown;
                    const dateStr = new Date(e.created_at).toLocaleTimeString("ar-EG", {
                      hour: "numeric",
                      minute: "2-digit",
                    });
                    return (
                      <div key={idx} className="relative flex flex-col gap-1 text-xs">
                        {/* Timeline point */}
                        <span
                          className="absolute -right-[21px] top-1.5 w-2 h-2 rounded-full border"
                          style={{
                            backgroundColor: mapped.text,
                            borderColor: "#121212",
                          }}
                        />
                        <div className="flex items-center justify-between gap-2">
                          <span
                            className="px-2 py-0.5 rounded-md border text-[11px] font-semibold"
                            style={{
                              backgroundColor: mapped.bg,
                              borderColor: mapped.border,
                              color: mapped.text,
                            }}
                          >
                            {mapped.label}
                          </span>
                          <span className="text-[10px] text-ivory/30">{dateStr}</span>
                        </div>
                        {e.source_text && (
                          <p className="text-[11px] text-ivory/50 italic leading-snug px-1 pt-0.5">
                            "{e.source_text.slice(0, 75)}"
                          </p>
                        )}
                      </div>
                    );
                  })
                ) : (
                  <p className="text-xs text-ivory/30 px-1 pr-0">لسه معندناش نقط مشاعر واضحة متسجلة، دردش مع رفيق.</p>
                )}
              </div>
            </div>

            {/* 6. Relationship Narrative Snapshot */}
            {data.latestSnapshot && (
              <div className="space-y-2 pt-2">
                <h4 className="text-xs font-bold text-ivory/50 px-1">مسيرتك الأخيرة (ملخص رفيق)</h4>
                <div className="p-4 rounded-xl border border-gold/10 bg-gradient-to-br from-gold/[0.02] to-transparent text-[13px] leading-relaxed text-ivory/75 italic">
                  "{data.latestSnapshot}"
                </div>
              </div>
            )}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
