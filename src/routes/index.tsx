import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Send, Sparkles, Check, Flame } from "lucide-react";
import logoUrl from "@/assets/rafiq-logo.png";
import { BreathingOrb } from "@/components/BreathingOrb";
import { Onboarding } from "@/components/Onboarding";
import { ProactiveCard } from "@/components/chat/ProactiveCard";
import { useSession } from "@/hooks/useSession";
import { useRafiqChat } from "@/hooks/useRafiqChat";
import { useProactive } from "@/hooks/useProactive";
import { useStreak } from "@/hooks/useStreak";

export const Route = createFileRoute("/")({ component: Rafiq });

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
  const { messages, thinking, error, send, markActionDone, clearError } = useRafiqChat();
  const { nudge, dismiss: dismissNudge } = useProactive(userId, isReady);
  const { streak, refresh: refreshStreak } = useStreak(userId, isReady);

  const [input, setInput] = useState("");
  const [showOnboarding, setShowOnboarding] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

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

  function finishOnboarding() {
    localStorage.setItem(ONBOARDED_KEY, "1");
    setShowOnboarding(false);
  }

  async function handleSend(text: string) {
    if (!isReady || !userId || !sessionId) return;
    clearError();
    await send(text, userId, sessionId, persona);
    refreshStreak();
  }

  async function handleActionDone(msgId: string, actionText: string) {
    if (!isReady || !userId || !sessionId) return;
    await markActionDone(msgId, userId);
    await handleSend(`تمام، عملت ده: ${actionText}`);
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#121212] text-ivory">
      {showOnboarding && <Onboarding onDone={finishOnboarding} />}

      {/* Header */}
      <header className="relative pt-5 pb-2 px-4 flex items-center justify-between gap-3">
        <div
          className="flex items-center gap-1.5 text-xs font-arabic text-ivory/50 px-2 py-1 rounded-full bg-ivory/[0.03] border border-ivory/8"
          title="عدد الحركات اللي نفّذتها"
        >
          <Flame className="w-3.5 h-3.5" style={{ color: "#E6C38E" }} />
          <span>{streak.done}</span>
          <span className="text-ivory/25">/</span>
          <span className="text-ivory/40">{streak.total}</span>
        </div>
        <img
          src={logoUrl}
          alt="رفيق"
          className="h-12 w-auto opacity-30"
          style={{ filter: "brightness(1.4) sepia(0.05)" }}
        />
        <div className="w-12" />
      </header>

      {/* Persona Selector */}
      <div className="px-4 pt-1">
        <div className="max-w-xl mx-auto flex items-center justify-center gap-1.5 p-1 rounded-full border border-ivory/8 bg-ivory/[0.02]">
          {PERSONAS.map((p) => {
            const active = persona === p.id;
            return (
              <button
                key={p.id}
                onClick={() => setPersona(p.id)}
                className={`flex-1 px-3 py-1.5 rounded-full font-arabic text-[13px] transition-all ${
                  active ? "text-[#121212]" : "text-ivory/55 hover:text-ivory/85"
                }`}
                style={
                  active
                    ? { background: "linear-gradient(135deg, #E6C38E, #d4ad6e)" }
                    : undefined
                }
              >
                {p.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Orb */}
      <div className="pt-3 pb-3">
        <BreathingOrb thinking={thinking} mood={orbMood} />
        <p className="text-center text-[11px] text-ivory/35 mt-3 font-arabic tracking-wide">
          {PERSONAS.find((x) => x.id === persona)?.sub}
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
                dismissNudge();
                handleSend(text);
              }}
            />
          )}

          {messages.length === 0 && !thinking && !nudge && (
            <p className="text-center text-ivory/30 text-sm pt-4 font-arabic">
              فضفض معايا بكلمتين أو اختار حاجة من دول ونبدأ سوا…
            </p>
          )}

          {messages.map((m) => (
            <MessageBubble
              key={m.id}
              msg={m}
              onAction={() => handleActionDone(m.id, m.action || "")}
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

function MessageBubble({
  msg,
  onAction,
}: {
  msg: {
    id: string;
    role: "user" | "rafiq";
    text: string;
    reframe?: string;
    action?: string;
    actionDone?: boolean;
  };
  onAction: () => void;
}) {
  if (msg.role === "user") {
    return (
      <div className="flex justify-end animate-fade-up">
        <div className="max-w-[80%] bg-ivory/[0.06] border border-ivory/10 rounded-2xl rounded-tr-sm px-4 py-2.5 text-ivory/90 font-arabic text-[15px] leading-relaxed">
          {msg.text}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-start gap-2 animate-fade-up">
      <div
        className="max-w-[88%] rounded-2xl rounded-tl-sm px-4 py-3 font-arabic text-[15px] leading-relaxed space-y-1.5"
        style={{
          background: "linear-gradient(135deg, rgba(230,195,142,0.08), rgba(125,143,106,0.05))",
          border: "1px solid rgba(230,195,142,0.18)",
          color: "#F4F4F0",
        }}
      >
        {msg.text && <p>{msg.text}</p>}
        {msg.reframe && (
          <p className="text-[14px] pt-1.5 border-t border-ivory/8" style={{ color: "#cfd6c1" }}>
            {msg.reframe}
          </p>
        )}
      </div>

      {msg.action && (
        <button
          onClick={onAction}
          disabled={msg.actionDone}
          className="ml-1 group inline-flex items-center gap-2 px-4 py-2.5 rounded-full font-arabic text-sm transition-all"
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
