import React, { useEffect, useState, useRef, useCallback } from "react";
import { useServerFn } from "@tanstack/react-start";
import { fetchDashboardData, updateDashboardConfig, type DashboardData } from "@/functions/dashboard.fn";
import {
  getHabitsAndFocusData,
  addHabit,
  deleteHabit,
  logHabitCompletion,
  logFocusSession,
  type HabitData,
  type HabitLogData,
  type FocusSessionData,
} from "@/functions/habits.fn";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  Flame,
  Sparkles,
  BrainCircuit,
  Heart,
  BarChart3,
  AlertCircle,
  RefreshCw,
  Clock,
  Play,
  Pause,
  CheckCircle2,
  Plus,
  Trash2,
  Award,
  Timer,
  Check,
} from "lucide-react";

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
  const updateConfig = useServerFn(updateDashboardConfig);
  const fetchHabitsAndFocus = useServerFn(getHabitsAndFocusData);
  const callAddHabit = useServerFn(addHabit);
  const callDeleteHabit = useServerFn(deleteHabit);
  const callLogHabit = useServerFn(logHabitCompletion);
  const callLogFocus = useServerFn(logFocusSession);

  // Tabs state
  const [activeTab, setActiveTab] = useState<"insights" | "habits" | "focus">("insights");

  // Dashboard Data
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Settings inputs
  const [sleepTarget, setSleepTarget] = useState<string>("");
  const [smallPleasures, setSmallPleasures] = useState<string[]>([]);
  const [newRewardInput, setNewRewardInput] = useState("");
  const [updatingSettings, setUpdatingSettings] = useState(false);

  // Habits state
  const [habits, setHabits] = useState<HabitData[]>([]);
  const [habitLogs, setHabitLogs] = useState<HabitLogData[]>([]);
  const [newHabitName, setNewHabitName] = useState("");
  const [newHabitDesc, setNewHabitDesc] = useState("");
  const [loadingHabits, setLoadingHabits] = useState(false);

  // Focus Timer state
  const [focusSessions, setFocusSessions] = useState<FocusSessionData[]>([]);
  const [focusTopic, setFocusTopic] = useState("");
  const [timerMinutes, setTimerMinutes] = useState(25);
  const [timerSeconds, setTimerSeconds] = useState(0);
  const [timerRunning, setTimerRunning] = useState(false);
  const [focusSuccess, setFocusSuccess] = useState(false);
  const timerIntervalRef = useRef<number | null>(null);

  // Load Dashboard Data
  const loadDashboard = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await getDashboard({ data: { userId } });
      setData(res);
      if (res.identity) {
        setSleepTarget(res.identity.sleep_target || "");
        setSmallPleasures(res.identity.small_pleasures || []);
      }
    } catch (e) {
      console.error("[DashboardDrawer] Error fetching data:", e);
      setError("حصلت مشكلة وأنا بجيب البيانات السلوكية بتاعتك.");
    } finally {
      setLoading(false);
    }
  }, [userId, getDashboard]);

  // Load Habits & Focus Data
  const loadHabitsAndFocus = useCallback(async () => {
    if (!userId) return;
    setLoadingHabits(true);
    try {
      const res = await fetchHabitsAndFocus({ data: { userId } });
      setHabits(res.habits || []);
      setHabitLogs(res.habitLogs || []);
      setFocusSessions(res.focusSessions || []);
    } catch (e) {
      console.error("[DashboardDrawer] Error fetching habits/focus:", e);
    } finally {
      setLoadingHabits(false);
    }
  }, [userId, fetchHabitsAndFocus]);

  useEffect(() => {
    if (open) {
      loadDashboard();
      loadHabitsAndFocus();
    }
  }, [open, loadDashboard, loadHabitsAndFocus]);

  // Save Settings Config
  const handleSaveSettings = async (updatedPleasures = smallPleasures, targetSleep = sleepTarget) => {
    if (!userId) return;
    setUpdatingSettings(true);
    try {
      await updateConfig({
        data: {
          userId,
          sleepTarget: targetSleep || null,
          smallPleasures: updatedPleasures,
        },
      });
      // Refresh identity in data
      setData((prev) => {
        if (!prev) return null;
        return {
          ...prev,
          identity: prev.identity
            ? {
                ...prev.identity,
                sleep_target: targetSleep || null,
                small_pleasures: updatedPleasures,
              }
            : null,
        };
      });
    } catch (e) {
      console.error("[DashboardDrawer] Error saving config:", e);
    } finally {
      setUpdatingSettings(false);
    }
  };

  const handleAddReward = () => {
    const trimmed = newRewardInput.trim();
    if (!trimmed) return;
    if (smallPleasures.includes(trimmed)) {
      setNewRewardInput("");
      return;
    }
    const updated = [...smallPleasures, trimmed];
    setSmallPleasures(updated);
    setNewRewardInput("");
    handleSaveSettings(updated);
  };

  const handleRemoveReward = (reward: string) => {
    const updated = smallPleasures.filter((r) => r !== reward);
    setSmallPleasures(updated);
    handleSaveSettings(updated);
  };

  const handleSleepTargetChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    setSleepTarget(val);
    handleSaveSettings(smallPleasures, val);
  };

  // Habit Actions
  const handleCreateHabit = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = newHabitName.trim();
    if (!name || !userId) return;

    try {
      const res = await callAddHabit({
        data: { userId, name, description: newHabitDesc },
      });
      setHabits((prev) => [...prev, res]);
      setNewHabitName("");
      setNewHabitDesc("");
    } catch (err) {
      console.error("[DashboardDrawer] Error creating habit:", err);
    }
  };

  const handleDeleteHabit = async (habitId: string) => {
    if (!userId) return;
    try {
      await callDeleteHabit({ data: { habitId, userId } });
      setHabits((prev) => prev.filter((h) => h.id !== habitId));
    } catch (err) {
      console.error("[DashboardDrawer] Error deleting habit:", err);
    }
  };

  const handleToggleHabit = async (habitId: string) => {
    if (!userId) return;
    try {
      const res = await callLogHabit({ data: { habitId, userId } });
      if (res.success) {
        // Optimistically add log and update streak
        setHabitLogs((prev) => [
          { habit_id: habitId, completed_at: new Date().toISOString() },
          ...prev,
        ]);
        setHabits((prev) =>
          prev.map((h) =>
            h.id === habitId
              ? {
                  ...h,
                  current_streak: res.current_streak,
                  max_streak: Math.max(h.max_streak, res.current_streak),
                  last_completed_at: new Date().toISOString(),
                }
              : h
          )
        );
      }
    } catch (err) {
      console.error("[DashboardDrawer] Error completing habit:", err);
    }
  };

  const isHabitCompletedToday = (habitId: string): boolean => {
    const todayStr = new Date().toDateString();
    return habitLogs.some(
      (l) => l.habit_id === habitId && new Date(l.completed_at).toDateString() === todayStr
    );
  };

  // Focus Timer Actions
  useEffect(() => {
    if (timerRunning) {
      timerIntervalRef.current = window.setInterval(() => {
        setTimerSeconds((sec) => {
          if (sec === 0) {
            setTimerMinutes((min) => {
              if (min === 0) {
                // Timer finished!
                handleTimerFinished();
                return 0;
              }
              return min - 1;
            });
            return 59;
          }
          return sec - 1;
        });
      }, 1000);
    } else {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
      }
    }

    return () => {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
      }
    };
  }, [timerRunning]);

  const handleTimerFinished = async () => {
    setTimerRunning(false);
    if (!userId) return;
    try {
      const topic = focusTopic.trim() || "جلسة عامة";
      const res = await callLogFocus({
        data: { userId, durationMinutes: 25, focusTopic: topic },
      });
      setFocusSessions((prev) => [
        {
          id: res.id,
          duration_minutes: 25,
          completed_at: new Date().toISOString(),
          focus_topic: topic,
        },
        ...prev,
      ]);
      setFocusSuccess(true);
      setTimeout(() => setFocusSuccess(false), 5000);
      setFocusTopic("");
      setTimerMinutes(25);
      setTimerSeconds(0);
    } catch (err) {
      console.error("[DashboardDrawer] Error logging focus:", err);
    }
  };

  const handleToggleTimer = () => {
    setTimerRunning((r) => !r);
  };

  const handleResetTimer = () => {
    setTimerRunning(false);
    setTimerMinutes(25);
    setTimerSeconds(0);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-md bg-[#121212] border-l border-ivory/10 text-ivory overflow-y-auto font-arabic scrollbar-none flex flex-col h-full"
        dir="rtl"
      >
        <SheetHeader className="text-right space-y-2 pb-2 shrink-0">
          <SheetTitle className="text-xl font-bold flex items-center gap-2 text-[#E6C38E]">
            <BrainCircuit className="w-5 h-5" />
            رفيق الجدع: الوعي والإنجاز
          </SheetTitle>
          <SheetDescription className="text-xs text-ivory/45">
            متابع العادات وإدارة وقتك ونفسك، عشان نوصل للـ version الأفضل سوا.
          </SheetDescription>
        </SheetHeader>

        {/* Custom Tabs Navigation */}
        <div className="flex border-b border-ivory/8 mt-3 shrink-0">
          <button
            onClick={() => setActiveTab("insights")}
            className={`flex-1 pb-2.5 text-center text-xs font-semibold border-b-2 transition-all ${
              activeTab === "insights"
                ? "border-[#E6C38E] text-[#E6C38E]"
                : "border-transparent text-ivory/45 hover:text-ivory/70"
            }`}
          >
            وعي رفيق وتقريرك
          </button>
          <button
            onClick={() => setActiveTab("habits")}
            className={`flex-1 pb-2.5 text-center text-xs font-semibold border-b-2 transition-all ${
              activeTab === "habits"
                ? "border-[#E6C38E] text-[#E6C38E]"
                : "border-transparent text-ivory/45 hover:text-ivory/70"
            }`}
          >
            متابع العادات 🎯
          </button>
          <button
            onClick={() => setActiveTab("focus")}
            className={`flex-1 pb-2.5 text-center text-xs font-semibold border-b-2 transition-all ${
              activeTab === "focus"
                ? "border-[#E6C38E] text-[#E6C38E]"
                : "border-transparent text-ivory/45 hover:text-ivory/70"
            }`}
          >
            جلسة تركيز ⏱
          </button>
        </div>

        {/* Tab Contents Scrollable Area */}
        <div className="flex-1 overflow-y-auto scrollbar-none py-4">
          {loading && activeTab === "insights" && (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <RefreshCw className="w-8 h-8 text-[#E6C38E] animate-spin" />
              <p className="text-xs text-ivory/40">برتبلك أفكارك وتاريخك السلوكي...</p>
            </div>
          )}

          {error && activeTab === "insights" && (
            <div className="flex items-center gap-2 p-4 mt-6 rounded-xl border border-red-500/20 bg-red-500/5 text-xs text-red-400">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* ──── TAB 1: INSIGHTS & PERSONAL CONFIG ──── */}
          {!loading && !error && data && activeTab === "insights" && (
            <div className="space-y-6">
              {/* Streak Card */}
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
                      معدل الحركة السلوكي الأسبوعي
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
                  أنجزت {streakTotal > 0 ? Math.round((streakDone / streakTotal) * 100) : 0}% من إجمالي خطط رفيق
                </p>
              </div>

              {/* Dynamic Personality (Rafiq sees you) */}
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

              {/* Goals & Struggles Displays */}
              <div className="grid grid-cols-1 gap-4">
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

                <div className="space-y-2">
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
                      <span className="text-xs text-ivory/30 px-1">مفيش تحديات صعبة متسجلة لسه.</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Habits Observed Patterns */}
              <div className="space-y-2">
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
                          <span className="shrink-0 text-[10px] font-mono px-2 py-0.5 rounded-md text-ivory/70 border border-ivory/10">
                            تكرر {p.occurrence_count}x
                          </span>
                        </div>
                      );
                    })
                  ) : (
                    <p className="text-xs text-ivory/30 px-1">مفيش عادات واضحة رصدتها اللوغاريتمات لسه.</p>
                  )}
                </div>
              </div>

              {/* ── Settings Configurator ── */}
              <div className="border-t border-ivory/8 pt-5 space-y-4">
                <h4 className="text-sm font-bold text-[#E6C38E] flex items-center gap-1.5 px-1">
                  شخصنة رفيق وعاداتك
                </h4>

                {/* Sleep Target Dropdown */}
                <div className="space-y-1.5">
                  <label className="text-xs text-ivory/50 px-1">موعد نومك المستهدف 🌙</label>
                  <select
                    value={sleepTarget}
                    onChange={handleSleepTargetChange}
                    className="w-full px-3 py-2 text-xs rounded-xl bg-ivory/[0.03] border border-ivory/10 text-ivory/90 focus:outline-none focus:border-[#E6C38E]"
                  >
                    <option value="" className="bg-[#121212]">مش محدد</option>
                    <option value="10:00 PM" className="bg-[#121212]">10:00 مساءً</option>
                    <option value="11:00 PM" className="bg-[#121212]">11:00 مساءً (أحسن)</option>
                    <option value="12:00 AM" className="bg-[#121212]">12:00 بعد منتصف الليل</option>
                    <option value="01:00 AM" className="bg-[#121212]">01:00 صباحاً</option>
                    <option value="02:00 AM" className="bg-[#121212]">02:00 صباحاً</option>
                  </select>
                </div>

                {/* Small Pleasures Rewards Tags */}
                <div className="space-y-2">
                  <label className="text-xs text-ivory/50 px-1">مكافآتك المفضلة (بيحبها رفيق ينصحك بيها) ☕</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="مثال: شاي بالنعناع، تمشية..."
                      value={newRewardInput}
                      onChange={(e) => setNewRewardInput(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleAddReward()}
                      className="flex-1 px-3 py-2 text-xs rounded-xl bg-ivory/[0.03] border border-ivory/10 text-ivory focus:outline-none focus:border-[#E6C38E]"
                    />
                    <button
                      onClick={handleAddReward}
                      className="px-3 rounded-xl bg-[#E6C38E] text-[#121212] hover:bg-[#d4ad6e] transition-all text-xs font-bold flex items-center justify-center"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {smallPleasures.map((r) => (
                      <span
                        key={r}
                        className="text-xs px-2.5 py-1 rounded-full border border-gold/15 bg-gold/[0.03] text-gold/80 flex items-center gap-1.5"
                      >
                        {r}
                        <button
                          onClick={() => handleRemoveReward(r)}
                          className="text-ivory/40 hover:text-red-400 font-bold shrink-0 text-[10px]"
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {/* Emotional Timeline */}
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
                    <p className="text-xs text-ivory/30 px-1 pr-0">لسه معندناش نقط مشاعر، دردش مع رفيق.</p>
                  )}
                </div>
              </div>

              {/* Snapshot Narrative */}
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

          {/* ──── TAB 2: HABIT TRACKER ──── */}
          {activeTab === "habits" && (
            <div className="space-y-5">
              {/* Add Habit Form */}
              <form onSubmit={handleCreateHabit} className="p-4 rounded-xl border border-ivory/8 bg-ivory/[0.01] space-y-3">
                <p className="text-[11px] text-[#E6C38E] font-semibold">بناء عادة جديدة</p>
                <div className="space-y-2">
                  <input
                    type="text"
                    required
                    placeholder="اسم العادة (مثال: شرب مية، قفل الشاشات)"
                    value={newHabitName}
                    onChange={(e) => setNewHabitName(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl bg-ivory/[0.03] border border-ivory/10 text-ivory focus:outline-none focus:border-[#E6C38E]"
                  />
                  <input
                    type="text"
                    placeholder="ملاحظة خفيفة (اختياري)"
                    value={newHabitDesc}
                    onChange={(e) => setNewHabitDesc(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl bg-ivory/[0.03] border border-ivory/10 text-ivory focus:outline-none focus:border-[#E6C38E]"
                  />
                  <button
                    type="submit"
                    className="w-full py-2.5 rounded-xl bg-[#E6C38E] hover:bg-[#d4ad6e] text-[#121212] font-bold text-xs flex items-center justify-center gap-1 transition-all active:scale-98"
                  >
                    <Plus className="w-4 h-4" />
                    ابني العادة دي
                  </button>
                </div>
              </form>

              {/* Habit List */}
              {loadingHabits ? (
                <div className="flex justify-center py-10">
                  <RefreshCw className="w-6 h-6 text-[#E6C38E] animate-spin" />
                </div>
              ) : (
                <div className="space-y-3">
                  <h4 className="text-xs font-bold text-ivory/50 px-1">عاداتك اللي بتبنيها اليومين دول</h4>
                  {habits.length === 0 ? (
                    <p className="text-xs text-ivory/30 px-1">لسه مفيش عادات! ابني عادة جديدة فوق عشان تتابعها.</p>
                  ) : (
                    habits.map((h) => {
                      const done = isHabitCompletedToday(h.id);
                      return (
                        <div
                          key={h.id}
                          className="p-3 rounded-xl border border-ivory/8 bg-ivory/[0.01] flex items-center justify-between gap-3"
                        >
                          <div className="flex items-center gap-3">
                            <button
                              onClick={() => handleToggleHabit(h.id)}
                              className={`w-6 h-6 rounded-full border flex items-center justify-center transition-all cursor-pointer ${
                                done
                                  ? "bg-[#7D8F6A] border-[#7D8F6A] text-[#121212]"
                                  : "border-ivory/20 hover:border-[#E6C38E]"
                              }`}
                            >
                              {done && <Check className="w-4 h-4" />}
                            </button>
                            <div className="space-y-0.5">
                              <p className={`text-xs font-semibold ${done ? "line-through text-ivory/40" : "text-ivory/90"}`}>
                                {h.name}
                              </p>
                              {h.description && (
                                <p className="text-[10px] text-ivory/40">
                                  {h.description}
                                </p>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-3">
                            {/* Streak badge */}
                            <div
                              className="flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-mono text-ivory/70 border-orange-500/20 bg-orange-500/5"
                              title="ستريك الأيام المتتالية للعادة"
                            >
                              <Flame className="w-3 h-3 text-orange-400" />
                              <span>{h.current_streak}</span>
                            </div>

                            {/* Trash button */}
                            <button
                              onClick={() => handleDeleteHabit(h.id)}
                              className="text-ivory/30 hover:text-red-400 transition-all p-1"
                              title="احذف العادة"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              )}
            </div>
          )}

          {/* ──── TAB 3: FOCUS TIMER ──── */}
          {activeTab === "focus" && (
            <div className="space-y-6 flex flex-col items-center">
              {/* Minimalist Pomodoro Clock */}
              <div
                className="w-48 h-48 rounded-full border flex flex-col items-center justify-center p-3 relative transition-all"
                style={{
                  background: timerRunning
                    ? "radial-gradient(circle, rgba(230,195,142,0.1), transparent)"
                    : "transparent",
                  borderColor: timerRunning ? "rgba(230,195,142,0.3)" : "rgba(244,244,240,0.1)",
                }}
              >
                <p className="text-[10px] tracking-widest text-[#E6C38E] uppercase opacity-70 mb-1">
                  {timerRunning ? "جلسة تركيز جارية..." : "جلسة تركيز"}
                </p>
                <div className="text-4xl font-bold font-mono text-ivory/95">
                  {String(timerMinutes).padStart(2, "0")}:{String(timerSeconds).padStart(2, "0")}
                </div>
                <Timer className="w-4 h-4 text-ivory/20 mt-2" />
              </div>

              {/* Success Notification */}
              {focusSuccess && (
                <div className="w-full flex items-center justify-center gap-2 p-3 rounded-xl border border-green-500/20 bg-green-500/5 text-xs text-green-400 animate-fade-in">
                  <Award className="w-4 h-4" />
                  <span>عاش يا بطل! تم تسجيل ٢٥ دقيقة تركيز، كافئ نفسك بجد وحب!</span>
                </div>
              )}

              {/* Focus Topic Input */}
              <div className="w-full space-y-1.5 px-2">
                <label className="text-xs text-ivory/50">بتذاكر أو بتعمل إيه دلوقتي؟</label>
                <input
                  type="text"
                  disabled={timerRunning}
                  placeholder="مثال: مذاكرة كيمياء، برمجة الواجهة..."
                  value={focusTopic}
                  onChange={(e) => setFocusTopic(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl bg-ivory/[0.03] border border-ivory/10 text-ivory focus:outline-none focus:border-[#E6C38E] disabled:opacity-50"
                />
              </div>

              {/* Timer Controls */}
              <div className="flex gap-3 w-full px-2">
                <button
                  onClick={handleToggleTimer}
                  className={`flex-1 py-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer ${
                    timerRunning
                      ? "bg-red-500/10 border border-red-500/30 text-red-400 hover:bg-red-500/20"
                      : "bg-[#E6C38E] text-[#121212] hover:bg-[#d4ad6e]"
                  }`}
                >
                  {timerRunning ? (
                    <>
                      <Pause className="w-4 h-4" />
                      إيقاف مؤقت
                    </>
                  ) : (
                    <>
                      <Play className="w-4 h-4" />
                      ابدأ ٢٥ دقيقة تركيز
                    </>
                  )}
                </button>
                <button
                  onClick={handleResetTimer}
                  className="px-4 py-3 rounded-xl border border-ivory/10 hover:border-ivory/20 transition-all text-xs font-bold text-ivory/70"
                >
                  إعادة ضبط
                </button>
              </div>

              {/* Focus Logs */}
              <div className="w-full pt-4 space-y-2 border-t border-ivory/8">
                <h4 className="text-xs font-bold text-ivory/50 px-1">آخر جلسات التركيز المكتملة</h4>
                <div className="space-y-2 max-h-40 overflow-y-auto scrollbar-none">
                  {focusSessions.length === 0 ? (
                    <p className="text-[11px] text-ivory/30 px-1">لسه مفيش جلسات تركيز مكتملة النهاردة.</p>
                  ) : (
                    focusSessions.map((fs, idx) => {
                      const timeStr = new Date(fs.completed_at).toLocaleTimeString("ar-EG", {
                        hour: "numeric",
                        minute: "2-digit",
                      });
                      return (
                        <div
                          key={fs.id || idx}
                          className="p-2.5 rounded-lg border border-ivory/5 bg-ivory/[0.01] flex items-center justify-between text-xs"
                        >
                          <div className="flex items-center gap-2">
                            <CheckCircle2 className="w-4 h-4 text-green-500" />
                            <span>{fs.focus_topic || "جلسة عامة"}</span>
                          </div>
                          <span className="text-[10px] text-ivory/30">
                            {fs.duration_minutes} دقيقة · {timeStr}
                          </span>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
