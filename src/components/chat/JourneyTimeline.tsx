import React, { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { fetchWinsTimeline, type WinItem } from "@/functions/journey.fn";
import {
  Award,
  CheckCircle2,
  Flame,
  Timer,
  Calendar,
  Loader2,
  Sparkles,
  Zap,
} from "lucide-react";

interface JourneyTimelineProps {
  userId: string;
}

export function JourneyTimeline({ userId }: JourneyTimelineProps) {
  const callFetchWins = useServerFn(fetchWinsTimeline);

  const [wins, setWins] = useState<WinItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadWins = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await callFetchWins({ data: { userId } });
      setWins(res.wins);
    } catch (e) {
      console.error("[JourneyTimeline] Error fetching wins:", e);
      setError("ما قدرتش أقرأ تاريخ إنجازاتك دلوقتي. جرب تاني؟");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadWins();
  }, [userId]);

  // Group wins by Date
  const groupedWins = wins.reduce<Record<string, WinItem[]>>((groups, win) => {
    const date = new Date(win.completedAt);
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(today.getDate() - 1);

    let dateLabel = "";
    if (date.toDateString() === today.toDateString()) {
      dateLabel = "اليوم ✨";
    } else if (date.toDateString() === yesterday.toDateString()) {
      dateLabel = "أمس ⌛";
    } else {
      dateLabel = date.toLocaleDateString("ar-EG", {
        weekday: "long",
        day: "numeric",
        month: "long",
      });
    }

    if (!groups[dateLabel]) {
      groups[dateLabel] = [];
    }
    groups[dateLabel].push(win);
    return groups;
  }, {});

  // Compute counts
  const habitCount = wins.filter((w) => w.type === "habit").length;
  const stepCount = wins.filter((w) => w.type === "step").length;
  const focusCount = wins.filter((w) => w.type === "focus").length;
  const totalMinutesFocus = wins
    .filter((w) => w.type === "focus")
    .reduce((sum, w) => sum + (w.metadata?.durationMinutes || 0), 0);

  return (
    <div className="flex flex-col h-full font-arabic text-ivory">
      {/* Stats Summary Dashboard Card */}
      <div
        className="shrink-0 p-4 rounded-2xl border border-gold/15 bg-gradient-to-br from-gold/[0.04] to-emerald/[0.02] mb-5 animate-fade-in"
        style={{
          background: "linear-gradient(135deg, rgba(230,195,142,0.06), rgba(125,143,106,0.03))",
        }}
      >
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-full bg-gold/10 border border-gold/25 text-[#E6C38E]">
            <Award className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-sm font-semibold">رحلة بطل: سجل انتصاراتك 🏆</h4>
            <p className="text-[11px] text-ivory/55 leading-relaxed">
              كل خطوة عملتها، وكل عادة التزمت بيها، وكل دقيقة ركزت فيها متسجلة هنا كفخر ليك.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 mt-4 pt-3 border-t border-ivory/5 text-center">
          <div className="bg-ivory/[0.02] p-2 rounded-xl border border-ivory/5">
            <p className="text-[9px] text-ivory/40">العادات الملتزمة</p>
            <p className="text-sm font-bold text-amber-400 mt-0.5">{habitCount}</p>
          </div>
          <div className="bg-ivory/[0.02] p-2 rounded-xl border border-ivory/5">
            <p className="text-[9px] text-ivory/40">المهام المنجزة</p>
            <p className="text-sm font-bold text-emerald-400 mt-0.5">{stepCount}</p>
          </div>
          <div className="bg-ivory/[0.02] p-2 rounded-xl border border-ivory/5">
            <p className="text-[9px] text-ivory/40">دقائق التركيز</p>
            <p className="text-sm font-bold text-cyan-400 mt-0.5">{totalMinutesFocus} د</p>
          </div>
        </div>
      </div>

      {/* Wins Timeline Scrollable Area */}
      <div className="flex-1 overflow-y-auto scrollbar-none pb-6 space-y-5">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <Loader2 className="w-6 h-6 text-[#E6C38E] animate-spin" />
            <p className="text-xs text-ivory/40">بجمع سجل نجاحاتك التاريخي...</p>
          </div>
        ) : error ? (
          <div className="p-3 text-center text-xs text-red-400 border border-red-500/20 bg-red-500/5 rounded-xl">
            {error}
          </div>
        ) : wins.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center border border-dashed border-ivory/8 rounded-2xl p-6">
            <Sparkles className="w-6 h-6 text-[#E6C38E] opacity-40 mb-2" />
            <p className="text-xs font-semibold text-ivory/70 mb-1">بداية الطريق خطوة واحدة!</p>
            <p className="text-[11px] text-ivory/40 max-w-[220px]">
              لسه ما سجلناش إنجازات هنا. بمجرد إنجاز عادة، أو خطة، أو جلسة تركيز، هتظهر انتصاراتك هنا فوراً.
            </p>
          </div>
        ) : (
          Object.keys(groupedWins).map((dateLabel) => (
            <div key={dateLabel} className="space-y-3">
              {/* Date Header */}
              <div className="flex items-center gap-2 px-1">
                <Calendar className="w-3.5 h-3.5 text-ivory/30" />
                <span className="text-xs font-bold text-ivory/50">{dateLabel}</span>
                <div className="flex-1 h-px bg-ivory/5" />
              </div>

              {/* Items List */}
              <div className="relative border-r border-ivory/8 mr-2.5 pr-4 space-y-4">
                {groupedWins[dateLabel].map((win) => {
                  let icon = <CheckCircle2 className="w-4 h-4 text-emerald-400" />;
                  let bgGlow = "shadow-[0_0_10px_rgba(72,187,120,0.15)]";
                  let itemColor = "border-emerald-500/10 bg-emerald-500/[0.01]";

                  if (win.type === "habit") {
                    icon = <Flame className="w-4 h-4 text-amber-500" />;
                    bgGlow = "shadow-[0_0_10px_rgba(245,158,11,0.15)]";
                    itemColor = "border-amber-500/10 bg-amber-500/[0.01]";
                  } else if (win.type === "focus") {
                    icon = <Timer className="w-4 h-4 text-cyan-400" />;
                    bgGlow = "shadow-[0_0_10px_rgba(34,211,238,0.15)]";
                    itemColor = "border-cyan-500/10 bg-cyan-500/[0.01]";
                  }

                  const timeStr = new Date(win.completedAt).toLocaleTimeString("ar-EG", {
                    hour: "numeric",
                    minute: "2-digit",
                  });

                  return (
                    <div
                      key={win.id}
                      className={`relative flex flex-col p-3 rounded-xl border transition-all hover:bg-ivory/[0.01] ${itemColor} ${bgGlow}`}
                    >
                      {/* Timeline Dot Indicator */}
                      <span
                        className="absolute -right-[21px] top-4.5 w-2 h-2 rounded-full border border-[#121212] transition-transform duration-300 hover:scale-125"
                        style={{
                          backgroundColor:
                            win.type === "habit"
                              ? "#F59E0B"
                              : win.type === "focus"
                                ? "#22D3EE"
                                : "#10B981",
                        }}
                      />

                      <div className="flex items-start justify-between gap-3 text-xs">
                        <div className="space-y-1">
                          <h5 className="font-semibold text-ivory/95 flex items-center gap-1.5 leading-snug">
                            {icon}
                            {win.title}
                          </h5>
                          <p className="text-[10px] text-ivory/45">{win.subtitle}</p>
                        </div>
                        <span className="text-[10px] text-ivory/30 shrink-0 font-mono flex items-center gap-1 mt-0.5">
                          <Zap className="w-2.5 h-2.5 text-gold/60" /> {timeStr}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
