import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { Send, Settings, Sparkles, X, Check } from "lucide-react";
import logoUrl from "@/assets/rafiq-logo.png";
import { BreathingOrb } from "@/components/BreathingOrb";
import { callRafiq, type RafiqResponse } from "@/lib/rafiq-api";

export const Route = createFileRoute("/")({ component: Rafiq });

interface ChatMsg {
  id: string;
  role: "user" | "rafiq";
  text: string;
  action?: string;
  actionDone?: boolean;
}

const PILLS = [
  { emoji: "🛑", text: "مستنزف من السوشيال ميديا" },
  { emoji: "⏳", text: "ورايا حاجات ونفسي أنجزها" },
  { emoji: "🧠", text: "دماغي زحمة ومشوش" },
];

const STORAGE_KEY = "rafiq.gemini.key";

function Rafiq() {
  const [apiKey, setApiKey] = useState("");
  const [keyDraft, setKeyDraft] = useState("");
  const [showSettings, setShowSettings] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [thinking, setThinking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const k = typeof window !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null;
    if (k) setApiKey(k);
    else setShowSettings(true);
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, thinking]);

  const history = useMemo(
    () =>
      messages.flatMap<{ role: "user" | "model"; text: string }>((m) =>
        m.role === "user"
          ? [{ role: "user", text: m.text }]
          : [{ role: "model", text: m.text }],
      ),
    [messages],
  );

  async function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || thinking) return;
    if (!apiKey) {
      setShowSettings(true);
      return;
    }
    setError(null);
    const userMsg: ChatMsg = { id: crypto.randomUUID(), role: "user", text: trimmed };
    setMessages((m) => [...m, userMsg]);
    setInput("");
    setThinking(true);

    const start = Date.now();
    let response: RafiqResponse;
    try {
      response = await callRafiq(apiKey, trimmed, history);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "خطأ غير متوقع";
      setError(msg);
      setThinking(false);
      return;
    }
    const elapsed = Date.now() - start;
    if (elapsed < 3000) await new Promise((r) => setTimeout(r, 3000 - elapsed));

    setMessages((m) => [
      ...m,
      { id: crypto.randomUUID(), role: "rafiq", text: response.reply, action: response.action },
    ]);
    setThinking(false);
  }

  function saveKey() {
    const k = keyDraft.trim();
    if (!k) return;
    localStorage.setItem(STORAGE_KEY, k);
    setApiKey(k);
    setKeyDraft("");
    setShowSettings(false);
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#121212] text-ivory">
      {/* Header */}
      <header className="relative pt-6 pb-2 px-4 flex items-center justify-center">
        <button
          aria-label="الإعدادات"
          onClick={() => {
            setKeyDraft(apiKey);
            setShowSettings(true);
          }}
          className="absolute top-5 left-4 p-2 rounded-full text-ivory/30 hover:text-ivory/70 transition-colors"
        >
          <Settings className="w-4 h-4" />
        </button>
        <img
          src={logoUrl}
          alt="رفيق"
          className="h-14 w-auto opacity-30"
          style={{ filter: "brightness(1.4) sepia(0.05)" }}
        />
      </header>

      {/* Orb */}
      <div className="pt-2 pb-4">
        <BreathingOrb thinking={thinking} />
        <p className="text-center text-xs text-ivory/40 mt-3 font-arabic tracking-wide">
          يأخذ بيدك… لتكون أفضل نسخة من نفسك
        </p>
      </div>

      {/* Chat scroll area */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 pb-4">
        <div className="max-w-xl mx-auto space-y-4">
          {messages.length === 0 && !thinking && (
            <p className="text-center text-ivory/30 text-sm pt-4 font-arabic">
              اختر فكرة سريعة أو اكتب اللي في بالك…
            </p>
          )}
          {messages.map((m) => (
            <MessageBubble key={m.id} msg={m} onAction={(id) =>
              setMessages((prev) => prev.map((x) => (x.id === id ? { ...x, actionDone: true } : x)))
            } />
          ))}
          {thinking && <TypingIndicator />}
          {error && (
            <div className="text-center text-xs text-red-400/80 font-arabic" dir="auto">
              {error}
            </div>
          )}
        </div>
      </div>

      {/* Pills + Input */}
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

      {/* Settings modal */}
      {showSettings && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center px-4 animate-fade-up">
          <div className="w-full max-w-sm bg-[#1a1a1a] border border-ivory/10 rounded-2xl p-6 relative">
            <button
              onClick={() => setShowSettings(false)}
              className="absolute top-3 left-3 text-ivory/40 hover:text-ivory/80"
              aria-label="إغلاق"
            >
              <X className="w-4 h-4" />
            </button>
            <div className="flex items-center gap-2 mb-1">
              <Sparkles className="w-4 h-4" style={{ color: "#E6C38E" }} />
              <h2 className="font-arabic text-ivory text-lg">مفتاح Gemini</h2>
            </div>
            <p className="text-ivory/50 text-xs font-arabic mb-4 leading-relaxed">
              ضع مفتاح Google Gemini المجاني. يُحفظ على جهازك فقط.
            </p>
            <input
              type="password"
              value={keyDraft}
              onChange={(e) => setKeyDraft(e.target.value)}
              placeholder="AIza..."
              dir="ltr"
              className="w-full bg-ivory/[0.04] border border-ivory/10 rounded-lg px-3 py-2.5 text-ivory text-sm outline-none focus:border-gold/40 font-sans"
            />
            <button
              onClick={saveKey}
              disabled={!keyDraft.trim()}
              className="w-full mt-3 py-2.5 rounded-lg bg-gold/20 text-gold hover:bg-gold/30 disabled:opacity-30 transition-colors font-arabic text-sm"
              style={{ color: "#E6C38E" }}
            >
              حفظ
            </button>
            <a
              href="https://aistudio.google.com/apikey"
              target="_blank"
              rel="noreferrer"
              className="block text-center text-xs text-ivory/40 hover:text-ivory/70 mt-3 font-sans"
            >
              احصل على مفتاح مجاني ↗
            </a>
          </div>
        </div>
      )}
    </div>
  );
}

function MessageBubble({ msg, onAction }: { msg: ChatMsg; onAction: (id: string) => void }) {
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
        className="max-w-[85%] rounded-2xl rounded-tl-sm px-4 py-3 font-arabic text-[15px] leading-relaxed"
        style={{
          background: "linear-gradient(135deg, rgba(230,195,142,0.08), rgba(125,143,106,0.05))",
          border: "1px solid rgba(230,195,142,0.18)",
          color: "#F4F4F0",
        }}
      >
        {msg.text}
      </div>
      {msg.action && (
        <button
          onClick={() => onAction(msg.id)}
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
          {msg.action}
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
