import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Send, Sparkles, Check, Flame } from "lucide-react";
import logoUrl from "@/assets/rafiq-logo.png";
import { BreathingOrb } from "@/components/BreathingOrb";
import { Onboarding } from "@/components/Onboarding";
import {
  generateRafiqReply,
  confirmActionDone,
  getStreakStats,
  type Persona,
  type RafiqReply,
} from "@/lib/rafiq.functions";

export const Route = createFileRoute("/")({ component: Rafiq });

interface ChatMsg {
  id: string;
  interactionId?: string;
  role: "user" | "rafiq";
  text: string;
  validate?: string;
  reframe?: string;
  action?: string;
  actionDone?: boolean;
}

const PILLS = [
  { emoji: "🛑", text: "مستنزف من السوشيال ميديا" },
  { emoji: "⏳", text: "ورايا حاجات ونفسي أنجزها" },
  { emoji: "🧠", text: "دماغي زحمة ومشوش" },
];

const PERSONAS: { id: Persona; label: string; sub: string }[] = [
  { id: "sage", label: "الحكيم", sub: "هدوء وعمق" },
  { id: "coach", label: "المدرّب", sub: "حسم وحركة" },
  { id: "friend", label: "الصاحب", sub: "دفء وبساطة" },
];

const SESSION_KEY = "rafiq.session.id";
const PERSONA_KEY = "rafiq.persona";
const ONBOARDED_KEY = "rafiq.onboarded";

function getSessionId(): string {
  if (typeof window === "undefined") return "ssr";
  let id = localStorage.getItem(SESSION_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(SESSION_KEY, id);
  }
  return id;
}

function Rafiq() {
  const callRafiq = useServerFn(generateRafiqReply);
  const confirmAction = useServerFn(confirmActionDone);
  const fetchStreak = useServerFn(getStreakStats);

  const [sessionId, setSessionId] = useState<string>("");
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [persona, setPersona] = useState<Persona>("friend");
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [thinking, setThinking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [streak, setStreak] = useState<{ done: number; total: number }>({ done: 0, total: 0 });
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setSessionId(getSessionId());
    const onboarded = localStorage.getItem(ONBOARDED_KEY);
    if (!onboarded) setShowOnboarding(true);
    const p = localStorage.getItem(PERSONA_KEY) as Persona | null;
    if (p) setPersona(p);
  }, []);

  useEffect(() => {
    if (!sessionId) return;
    fetchStreak({ data: { sessionId } })
      .then(setStreak)
      .catch(() => {});
  }, [sessionId, fetchStreak]);

  useEffect(() => {
    if (typeof window !== "undefined") localStorage.setItem(PERSONA_KEY, persona);
  }, [persona]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, thinking]);

  function finishOnboarding() {
    localStorage.setItem(ONBOARDED_KEY, "1");
    setShowOnboarding(false);
  }

  async function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || thinking || !sessionId) return;
    setError(null);
    const userMsg: ChatMsg = { id: crypto.randomUUID(), role: "user", text: trimmed };
    setMessages((m) => [...m, userMsg]);
    setInput("");
    setThinking(true);

    const start = Date.now();
    let response: RafiqReply;
    try {
      response = await callRafiq({ data: { sessionId, userText: trimmed, persona } });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "حصل خطأ غير متوقع";
      setError(msg);
      setThinking(false);
      return;
    }
    const elapsed = Date.now() - start;
    if (elapsed < 3000) await new Promise((r) => setTimeout(r, 3000 - elapsed));

    setMessages((m) => [
      ...m,
      {
        id: crypto.randomUUID(),
        interactionId: response.id,
        role: "rafiq",
        text: response.validate,
        validate: response.validate,
        reframe: response.reframe,
        action: response.action,
      },
    ]);
    setThinking(false);
    setStreak((s) => ({ ...s, total: s.total + 1 }));
  }

  async function markActionDone(msgId: string, interactionId?: string) {
    setMessages((prev) =>
      prev.map((x) => (x.id === msgId && !x.actionDone ? { ...x, actionDone: true } : x)),
    );
    setStreak((s) => ({ ...s, done: s.done + 1 }));
    if (interactionId) {
      try {
        await confirmAction({ data: { interactionId, sessionId } });
      } catch {
        /* non-blocking */
      }
    }
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#121212] text-ivory">
      {showOnboarding && <Onboarding onDone={finishOnboarding} />}

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
                  active ? { background: "linear-gradient(135deg, #E6C38E, #d4ad6e)" } : undefined
                }
              >
                {p.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="pt-3 pb-3">
        <BreathingOrb thinking={thinking} />
        <p className="text-center text-[11px] text-ivory/35 mt-3 font-arabic tracking-wide">
          {PERSONAS.find((x) => x.id === persona)?.sub} · يأخذ بيدك
        </p>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 pb-4">
        <div className="max-w-xl mx-auto space-y-4">
          {messages.length === 0 && !thinking && (
            <p className="text-center text-ivory/30 text-sm pt-4 font-arabic">
              اختر فكرة سريعة أو اكتب اللي في بالك…
            </p>
          )}
          {messages.map((m) => (
            <MessageBubble
              key={m.id}
              msg={m}
              onAction={() => markActionDone(m.id, m.interactionId)}
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

      <div className="px-4 pb-6 pt-2 bg-gradient-to-t from-[#121212] via-[#121212] to-transparent">
        <div className="max-w-xl mx-auto space-y-3">
          <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-none">
            {PILLS.map((p) => (
              <button
                key={p.text}
                onClick={() => send(p.text)}
                disabled={thinking}
                className="shrink-0 px-4 py-2 rounded-full border border-ivory/10 bg-ivory/[0.03] hover:bg-ivory/[0.06] hover:border-gold/40 transition-all text-sm font-arabic text-ivory/85 disabled:opacity-40"
              >
                <span className="ml-1">{p.emoji}</span> {p.text}
              </button>
            ))}
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              send(input);
            }}
            className="flex items-center gap-2 bg-ivory/[0.04] border border-ivory/10 rounded-2xl px-4 py-3 focus-within:border-gold/40 transition-colors"
          >
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="اكتب اللي في بالك…"
              dir="rtl"
              className="flex-1 bg-transparent outline-none text-ivory placeholder:text-ivory/30 font-arabic text-[15px]"
            />
            <button
              type="submit"
              disabled={!input.trim() || thinking}
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

function MessageBubble({ msg, onAction }: { msg: ChatMsg; onAction: () => void }) {
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
        {msg.validate && <p>{msg.validate}</p>}
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
          {msg.actionDone ? "تمام، عملتها" : msg.action}
        </button>
      )}
    </div>
  );
}

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
