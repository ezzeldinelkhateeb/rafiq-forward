import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Send, Sparkles, Check, Flame, RefreshCw, Clock, Loader2, Eye } from "lucide-react";
import logoUrl from "@/assets/rafiq-logo.png";
import { BreathingOrb } from "@/components/BreathingOrb";
import { Onboarding } from "@/components/Onboarding";
import { ProactiveCard } from "@/components/chat/ProactiveCard";
import { DashboardDrawer } from "@/components/chat/DashboardDrawer";
import { useSession } from "@/hooks/useSession";
import { useRafiqChat } from "@/hooks/useRafiqChat";
import { useProactive } from "@/hooks/useProactive";
import { useStreak } from "@/hooks/useStreak";
import { usePatternMirror } from "@/hooks/usePatternMirror";
import { useServerFn } from "@tanstack/react-start";
import { generatePlanFromGoal } from "@/functions/plans.fn";
import { saveOnboardingData } from "@/functions/onboarding.fn";
import { generateCharacterArc, ARC_MILESTONES } from "@/functions/character-arc.fn";

export const Route = createFileRoute("/")({
  component: Rafiq,
  head: () => ({
    links: [
      { rel: "canonical", href: "https://rafiq-forward.lovable.app/" },
    ],
  }),
});

// ─── Constants ─────────────────────────────────────────────────────────────

const PERSONAS = [
  { id: "sage" as const, label: "الحكيم", sub: "رايق وعاقل · كلمتين في الجون" },
  { id: "coach" as const, label: "المدرّب", sub: "هيشد عليك ويحركك فوراً" },
  { id: "friend" as const, label: "الصاحب", sub: "ابن بلد جدع وحنين بزيادة" },
];

const QUICK_PILLS = [
  { emoji: "📱", text: "تعبت من فرة الموبايل والسوشيال ميديا 🤯" },
  { emoji: "⏳", text: "ورايا كوم حاجات ومكسل أبدأ فيها 🏃‍♂️" },
  { emoji: "🌀", text: "دماغي بتلف ومش عارف أركز خالص 🤦‍♂️" },
];

const ONBOARDED_KEY = "rafiq.onboarded";

// ─── Main Component ─────────────────────────────────────────────────────────

function Rafiq() {
  const { userId, sessionId, persona, isReady, setPersona } = useSession();
  const { messages, thinking, error, send, confirmAction, swapAlternative, clearError, loadHistory } = useRafiqChat();
  const { nudge, dismiss: dismissNudge, accept: acceptNudge } = useProactive(userId, isReady);
  const { streak, refresh: refreshStreak } = useStreak(userId, isReady);
  const { mirror: patternMirror, dismiss: dismissMirror } = usePatternMirror(userId, isReady);

  const callGeneratePlan = useServerFn(generatePlanFromGoal);
  const callSaveOnboarding = useServerFn(saveOnboardingData);
  const callGenerateArc = useServerFn(generateCharacterArc);

  const [input, setInput] = useState("");
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [showDashboard, setShowDashboard] = useState(false);
  const [dashboardTab, setDashboardTab] = useState<"insights" | "habits" | "focus" | "brain" | "plans">("insights");
  const [planningMessageId, setPlanningMessageId] = useState<string | null>(null);
  const [progressMoment, setProgressMoment] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  async function handleMakePlan(msgId: string, actionText: string) {
    if (!userId || !isReady) return;
    setPlanningMessageId(msgId);
    try {
      await callGeneratePlan({ data: { userId, goalTitle: actionText } });
      setDashboardTab("plans");
      setShowDashboard(true);
    } catch (err) {
      console.error("[Rafiq] Error generating plan from chat:", err);
      alert("معلش يا صاحبي حصلت مشكلة وأنا بقسم الإجراء ده لخطوات. جرب تاني كده؟");
    } finally {
      setPlanningMessageId(null);
    }
  }

  // Determine current orb mood based on thinking state and latest message's emotional tag
  let orbMood: "calm" | "thinking" | "motivated" | "drained" | "anxious" = "calm";
  if (thinking) {
    orbMood = "thinking";
  } else if (messages.length > 0) {
    const latestRafiqMsg = [...messages].reverse().find((m) => m.role === "rafiq");
    if (latestRafiqMsg?.emotionalTag) {
      const tag = latestRafiqMsg.emotionalTag;
      if (tag === "motivated" || tag === "rebuilding") {
        orbMood = "motivated";
      } else if (tag === "drained" || tag === "numb") {
        orbMood = "drained";
      } else if (tag === "anxious" || tag === "scattered") {
        orbMood = "anxious";
      }
    } else if (latestRafiqMsg?.mode) {
      const mode = latestRafiqMsg.mode;
      if (mode === "celebrate") {
        orbMood = "motivated";
      } else if (mode === "challenge") {
        orbMood = "anxious";
      }
    }
  }

  // Load chat history on session ready
  useEffect(() => {
    if (isReady && userId) {
      loadHistory(userId);
    }
  }, [isReady, userId, loadHistory]);

  // Onboarding check
  useEffect(() => {
    if (typeof window === "undefined") return;
    const onboarded = localStorage.getItem(ONBOARDED_KEY);
    if (!onboarded) setShowOnboarding(true);
  }, []);

  // Auto-scroll on new messages
  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, thinking]);

  async function finishOnboarding(data: {
    name: string;
    blocker: string;
    goal: string;
    sleepTime: string;
    smallPleasure: string;
  }) {
    localStorage.setItem(ONBOARDED_KEY, "1");
    setShowOnboarding(false);
    // Save onboarding data to Supabase in background
    if (userId) {
      callSaveOnboarding({
        data: {
          userId,
          name: data.name,
          blocker: data.blocker,
          goal: data.goal,
          sleepTime: data.sleepTime,
          smallPleasure: data.smallPleasure,
        },
      }).catch(() => {});
    }
  }

  async function handleSend(text: string) {
    if (!isReady || !userId || !sessionId) return;
    clearError();
    await send(text, userId, sessionId, persona);
    refreshStreak();
  }

  async function handleConfirm(msgId: string) {
    if (!isReady || !userId || !sessionId) return;
    await confirmAction(msgId, userId, sessionId, persona);
    refreshStreak();
    const done = streak.done + 1;

    // Character Arc — milestone moments
    const isMilestone = (ARC_MILESTONES as readonly number[]).includes(done);
    if (isMilestone && userId) {
      callGenerateArc({ data: { userId, milestone: done } })
        .then(({ arcMessage }) => {
          if (arcMessage) {
            // Inject arc message as a special Rafiq message after a short delay
            setTimeout(() => {
              // This triggers via the chat state — we use send internally
              // The arc message appears as a new Rafiq bubble
              window.dispatchEvent(new CustomEvent("rafiq:arc", { detail: { arcMessage } }));
            }, 1200);
          }
        })
        .catch(() => {});
    }

    // Progress moment toast for non-milestones
    if (!isMilestone) {
      if (done % 5 === 0) {
        setProgressMoment(`🏆 ${done} خطوة خلصتها مع رفيق! ده مش هين — استمر.`);
        setTimeout(() => setProgressMoment(null), 4000);
      } else if (done === 1) {
        setProgressMoment(`✨ أول خطوة عملتها! ده أصعب ما في الموضوع.`);
        setTimeout(() => setProgressMoment(null), 4000);
      }
    }
  }

  // ── Character Arc event listener ─────────────────────────────────────────
  // Arc messages are injected via custom event after milestone detection
  useEffect(() => {
    function onArcEvent(e: Event) {
      const { arcMessage } = (e as CustomEvent<{ arcMessage: string }>).detail;
      if (!arcMessage) return;
      // Directly send as a Rafiq message into the existing chat
      handleSend(`__arc__: ${arcMessage}`);
    }
    window.addEventListener("rafiq:arc", onArcEvent);
    return () => window.removeEventListener("rafiq:arc", onArcEvent);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isReady, userId, sessionId]);

  return (
    <div className="min-h-screen flex flex-col bg-[#121212] text-ivory">
      {showOnboarding && <Onboarding onDone={finishOnboarding} />}
      <DashboardDrawer
        userId={userId}
        open={showDashboard}
        onOpenChange={setShowDashboard}
        streakDone={streak.done}
        streakTotal={streak.total}
        defaultTab={dashboardTab}
      />

      {/* Header */}
      <header className="relative pt-5 pb-2 px-4 flex items-center justify-between gap-3">
        <button
          onClick={() => {
            setDashboardTab("insights");
            setShowDashboard(true);
          }}
          className="flex items-center gap-1.5 text-xs font-arabic text-ivory/50 px-2.5 py-1 rounded-full bg-ivory/[0.03] hover:bg-ivory/[0.07] border border-ivory/8 hover:border-[#E6C38E]/30 cursor-pointer transition-all active:scale-95"
          title="افتح لوحة البيانات وعي رفيق"
        >
          <Flame className="w-3.5 h-3.5 animate-pulse" style={{ color: "#E6C38E" }} />
          <span>{streak.done}</span>
          <span className="text-ivory/25">/</span>
          <span className="text-ivory/40">{streak.total}</span>
        </button>
        {/* Progress Moment Toast */}
        {progressMoment && (
          <div
            style={{
              position: "absolute",
              top: 60,
              left: "50%",
              transform: "translateX(-50%)",
              background: "linear-gradient(135deg, rgba(230,195,142,0.18), rgba(125,143,106,0.12))",
              border: "1px solid rgba(230,195,142,0.4)",
              borderRadius: 16,
              padding: "10px 20px",
              color: "#E6C38E",
              fontFamily: "var(--font-arabic, serif)",
              fontSize: 14,
              zIndex: 40,
              whiteSpace: "nowrap",
              animation: "fadeInUp 0.3s ease",
              backdropFilter: "blur(8px)",
            }}
          >
            {progressMoment}
          </div>
        )}

        <h1 className="sr-only">رفيق — مساعدك الذكي للتخلص من التشتت وبناء العادات بالعامية المصرية</h1>
        <img
          src={logoUrl}
          alt="رفيق — شعار التطبيق"
          width={48}
          height={48}
          fetchPriority="high"
          className="h-12 w-auto opacity-30"
          style={{ filter: "brightness(1.4) sepia(0.05)" }}
        />

        <div className="w-12" />
      </header>

      {/* Orb */}
      <div className="pt-3 pb-3">
        <BreathingOrb thinking={thinking} mood={orbMood} />
        <p className="text-center text-[11px] text-ivory/35 mt-3 font-arabic tracking-wide">
          رفيقك السلوكي · معاك خطوة بخطوة
        </p>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 pb-4">
        <div className="max-w-xl mx-auto space-y-4">
          {/* Proactive nudge — shown before any user message */}
          {nudge && messages.length === 0 && (
            <ProactiveCard
              nudge={nudge}
              onDismiss={dismissNudge}
              onReply={(text) => {
                acceptNudge(text);
                handleSend(text);
              }}
            />
          )}

          {/* Pattern Mirror — weekly behavioral insight, shown once per week */}
          {patternMirror && messages.length === 0 && !nudge && (
            <div
              className="animate-fade-up rounded-2xl px-5 py-4"
              dir="rtl"
              style={{
                background: "linear-gradient(135deg, rgba(125,143,106,0.10), rgba(230,195,142,0.05))",
                border: "1px solid rgba(125,143,106,0.3)",
              }}
            >
              <div className="flex items-center gap-2 mb-2">
                <Eye className="w-3.5 h-3.5" style={{ color: "#7D8F6A" }} />
                <p className="text-[10px] font-arabic tracking-widest" style={{ color: "#7D8F6A", opacity: 0.8 }}>
                  مرآة الأسبوع
                </p>
              </div>
              <p className="font-arabic text-[15px] leading-relaxed" style={{ color: "#F4F4F0" }}>
                {patternMirror}
              </p>
              <button
                onClick={dismissMirror}
                className="mt-3 text-[11px] font-arabic text-ivory/30 hover:text-ivory/60 transition-colors"
              >
                شكراً رفيق ×
              </button>
            </div>
          )}


          {messages.length === 0 && !thinking && !nudge && (
            <div
              className="mx-auto max-w-xl animate-fade-up rounded-2xl px-5 py-4"
              dir="rtl"
              style={{
                background:
                  "linear-gradient(135deg, rgba(230,195,142,0.08), rgba(125,143,106,0.05))",
                border: "1px solid rgba(230,195,142,0.18)",
              }}
            >
              <p className="text-[10px] font-arabic tracking-widest mb-2" style={{ color: "#E6C38E", opacity: 0.6 }}>
                رفيق
              </p>
              <p className="font-arabic text-[15px] leading-relaxed" style={{ color: "#F4F4F0" }}>
                أنا جنبك. لو دماغك زحمة، يلا نرتبها سوا — خطوة صغيرة بخطوة صغيرة.
              </p>
              <p className="font-arabic text-[12px] mt-1.5" style={{ color: "rgba(244,244,240,0.4)" }}>
                ابدأ بكلمة بسيطة أو اختار من تحت.
              </p>
            </div>
          )}

          {messages.map((m) => (
            <MessageBubble
              key={m.id}
              msg={m}
              onConfirm={() => handleConfirm(m.id)}
              onAlternative={() => swapAlternative(m.id, userId, persona)}
              isPlanning={planningMessageId === m.id}
              onMakePlan={() => handleMakePlan(m.id, m.action || "")}
              onCommit={(commitText) => handleSend(commitText)}
            />
          ))}

          {thinking && <TypingIndicator />}

          {error && (
            <div className="text-center text-xs text-red-400/80 font-arabic" dir="auto">
              {error}
            </div>
          )}
        </div>
      </div>

      {/* Input Area */}
      <div className="px-4 pb-6 pt-2 bg-gradient-to-t from-[#121212] via-[#121212] to-transparent">
        <div className="max-w-xl mx-auto space-y-3">
          {/* Quick pills */}
          <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-none">
            {QUICK_PILLS.map((p) => (
              <button
                key={p.text}
                onClick={() => handleSend(p.text)}
                disabled={thinking || !isReady}
                className="shrink-0 px-4 py-2 rounded-full border border-ivory/10 bg-ivory/[0.03] hover:bg-ivory/[0.06] hover:border-gold/40 transition-all text-sm font-arabic text-ivory/85 disabled:opacity-40"
              >
                <span className="ml-1">{p.emoji}</span> {p.text}
              </button>
            ))}
          </div>

          {/* Text input */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSend(input);
              setInput("");
            }}
            className="flex items-center gap-2 bg-ivory/[0.04] border border-ivory/10 rounded-2xl px-4 py-3 focus-within:border-gold/40 transition-colors"
          >
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="قول يا رفيق، إيه اللي معطلك؟..."
              dir="rtl"
              className="flex-1 bg-transparent outline-none text-ivory placeholder:text-ivory/30 font-arabic text-[15px]"
            />
            <button
              type="submit"
              disabled={!input.trim() || thinking || !isReady}
              aria-label="إرسال"
              className="p-2 rounded-full bg-gold/15 text-gold hover:bg-gold/25 disabled:opacity-30 disabled:hover:bg-gold/15 transition-colors"
              style={{ color: "#E6C38E" }}
            >
              <Send className="w-4 h-4 -scale-x-100" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

// ─── Message Bubble ─────────────────────────────────────────────────────────

function getGoogleCalendarUrl(actionName: string): string {
  const text = encodeURIComponent(actionName);
  const details = encodeURIComponent("خطوة عملية مقترحة من رفيق لمساعدتك في تحقيق أهدافك وتنظيم يومك.");
  const now = new Date();
  const start = now.toISOString().replace(/-|:|\.\d\d\d/g, "");
  now.setHours(now.getHours() + 1);
  const end = now.toISOString().replace(/-|:|\.\d\d\d/g, "");
  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${text}&details=${details}&dates=${start}/${end}`;
}

function MessageBubble({
  msg,
  onConfirm,
  onAlternative,
  isPlanning,
  onMakePlan,
  onCommit,
}: {
  msg: {
    id: string;
    role: "user" | "rafiq";
    text: string;
    reframe?: string;
    action?: string;
    actionDone?: boolean;
    alternativeTried?: boolean;
    mode?: string;
  };
  onConfirm: () => void;
  onAlternative: () => void;
  isPlanning?: boolean;
  onMakePlan?: () => void;
  onCommit?: (commitText: string) => void;
}) {
  const [showCommitInput, setShowCommitInput] = useState(false);
  const [commitValue, setCommitValue] = useState("");

  if (msg.role === "user") {
    return (
      <div className="flex justify-end animate-fade-up">
        <div className="max-w-[80%] bg-ivory/[0.06] border border-ivory/10 rounded-2xl rounded-tr-sm px-4 py-2.5 text-ivory/90 font-arabic text-[15px] leading-relaxed">
          {msg.text}
        </div>
      </div>
    );
  }

  // Special styling for character arc milestone messages
  const isArcMessage = msg.mode === "character_arc";

  return (
    <div className="flex flex-col items-start gap-2 animate-fade-up">
      <div
        className="max-w-[88%] rounded-2xl rounded-tl-sm px-4 py-3 font-arabic text-[15px] leading-relaxed space-y-1.5"
        style={{
          background: isArcMessage
            ? "linear-gradient(135deg, rgba(230,195,142,0.15), rgba(125,143,106,0.10))"
            : "linear-gradient(135deg, rgba(230,195,142,0.08), rgba(125,143,106,0.05))",
          border: isArcMessage
            ? "1px solid rgba(230,195,142,0.40)"
            : "1px solid rgba(230,195,142,0.18)",
          color: "#F4F4F0",
          boxShadow: isArcMessage ? "0 0 20px rgba(230,195,142,0.08)" : "none",
        }}
      >
        {isArcMessage && (
          <p className="text-[10px] font-arabic tracking-widest mb-1" style={{ color: "#E6C38E", opacity: 0.7 }}>
            ✦ لحظة وعي
          </p>
        )}
        {msg.text && <p>{msg.text}</p>}
        {msg.reframe && (
          <p className="text-[14px] pt-1.5 border-t border-ivory/8" style={{ color: "#cfd6c1" }}>
            {msg.reframe}
          </p>
        )}
      </div>

      {msg.action && (
        <div className="flex items-center gap-2 flex-wrap ml-1">
          <button
            onClick={onConfirm}
            disabled={msg.actionDone}
            className="group inline-flex items-center gap-2 px-4 py-2.5 rounded-full font-arabic text-sm transition-all"
            style={{
              background: msg.actionDone
                ? "rgba(125,143,106,0.15)"
                : "linear-gradient(135deg, rgba(230,195,142,0.18), rgba(230,195,142,0.08))",
              border: `1px solid ${msg.actionDone ? "rgba(125,143,106,0.4)" : "rgba(230,195,142,0.45)"}`,
              color: msg.actionDone ? "#7D8F6A" : "#E6C38E",
            }}
          >
            {msg.actionDone ? <Check className="w-4 h-4" /> : <Sparkles className="w-3.5 h-3.5" />}
            {msg.actionDone ? "تمام، عملتها ✓" : msg.action}
          </button>

          {!msg.actionDone && (
            <a
              href={getGoogleCalendarUrl(msg.action)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-full font-arabic text-[12px] transition-all text-ivory/55 hover:text-ivory/85 border border-ivory/10 hover:border-ivory/25 bg-ivory/[0.02]"
              title="أضف الخطوة دي لتقويم جوجل للتذكير"
            >
              <Clock className="w-3 h-3 text-[#E6C38E]" />
              أضف للتقويم
            </a>
          )}

          {/* ── Time Commitment ─────────────────────────────────────────── */}
          {!msg.actionDone && !showCommitInput && (
            <button
              onClick={() => setShowCommitInput(true)}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-full font-arabic text-[12px] transition-all text-ivory/55 hover:text-[#E6C38E]/80 border border-ivory/10 hover:border-[#E6C38E]/30 bg-ivory/[0.02]"
              title="حدد امتى هتعملها"
            >
              ⏰ هعملها الساعة...
            </button>
          )}

          {!msg.actionDone && showCommitInput && (
            <div className="flex items-center gap-1.5 w-full mt-1" dir="rtl">
              <input
                autoFocus
                value={commitValue}
                onChange={(e) => setCommitValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && commitValue.trim()) {
                    onCommit?.(`هعمل "${msg.action}" ${commitValue.trim()} 🕐`);
                    setShowCommitInput(false);
                    setCommitValue("");
                  }
                  if (e.key === "Escape") {
                    setShowCommitInput(false);
                    setCommitValue("");
                  }
                }}
                placeholder="مثال: 9 بالليل، بكرة الصبح..."
                className="flex-1 bg-ivory/[0.05] border border-[#E6C38E]/30 rounded-full px-3 py-1.5 text-[12px] font-arabic text-ivory placeholder:text-ivory/30 outline-none focus:border-[#E6C38E]/60 transition-colors"
              />
              <button
                onClick={() => {
                  if (commitValue.trim()) {
                    onCommit?.(`هعمل "${msg.action}" ${commitValue.trim()} 🕐`);
                  }
                  setShowCommitInput(false);
                  setCommitValue("");
                }}
                className="text-[#E6C38E]/70 hover:text-[#E6C38E] text-[11px] font-arabic px-2"
              >
                تمام
              </button>
            </div>
          )}

          {!msg.actionDone && !msg.alternativeTried && (
            <button
              onClick={onAlternative}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-full font-arabic text-[12px] transition-all text-ivory/55 hover:text-ivory/85 border border-ivory/10 hover:border-ivory/25 bg-ivory/[0.02]"
              title="مش قادر دلوقتي؟ هاتلي حل تاني"
            >
              <RefreshCw className="w-3 h-3" />
              مش قادر · هاتلي حل تاني
            </button>
          )}

          {!msg.actionDone && onMakePlan && (
            <button
              onClick={onMakePlan}
              disabled={isPlanning}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-full font-arabic text-[12px] transition-all text-ivory/55 hover:text-ivory/85 border border-ivory/10 hover:border-[#E6C38E]/25 bg-ivory/[0.02] cursor-pointer disabled:opacity-40"
              title="خلي رفيق يقسم الإجراء ده لخطوات صغرى"
            >
              {isPlanning ? (
                <Loader2 className="w-3 h-3 animate-spin text-[#E6C38E]" />
              ) : (
                <Sparkles className="w-3.5 h-3.5 text-[#E6C38E]" />
              )}
              قسّمها لخطوات 📋
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Typing Indicator ─────────────────────────────────────────────────────

function TypingIndicator() {
  return (
    <div className="flex justify-start animate-fade-up">
      <div className="flex items-center gap-1.5 px-4 py-3 rounded-2xl rounded-tl-sm bg-ivory/[0.04] border border-ivory/10">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="w-1.5 h-1.5 rounded-full"
            style={{
              background: "#E6C38E",
              animation: `dot-pulse 1.4s ease-in-out ${i * 0.2}s infinite`,
            }}
          />
        ))}
      </div>
    </div>
  );
}
