import { useState, useRef, useEffect, KeyboardEvent } from "react";
import { BreathingOrb } from "@/components/BreathingOrb";

// ─── Types ───────────────────────────────────────────────────────────────────

interface Props {
  onDone: (data: {
    name: string;
    blocker: string;
    goal: string;
    sleepTime: string;
    smallPleasure: string;
  }) => void;
}

interface CompletedStep {
  question: string;
  answer: string;
}

type StepId = "name" | "blocker" | "goal" | "sleep" | "pleasure";

interface Step {
  id: StepId;
  question: string | ((name: string) => string);
  placeholder: string;
  quickOptions: string[] | null;
}

// ─── Steps Definition ────────────────────────────────────────────────────────

const STEPS: Step[] = [
  {
    id: "name",
    question:
      "يا هلا بيك! 👋 أنا رفيق — رفيقك السلوكي. عشان أعرفك صح وأنادي عليك صح... إنت اسمك إيه؟",
    placeholder: "اكتب اسمك...",
    quickOptions: null,
  },
  {
    id: "blocker",
    question: (name: string) =>
      `تشرفنا يا ${name}! 🙌 سؤال صريح — إيه أكبر حاجة بتاخد وقتك وطاقتك دلوقتي؟`,
    placeholder: "قول بصراحة، مش هحكم...",
    quickOptions: [
      "السكرول في السوشيال ميديا",
      "مش قادر أبدأ أي حاجة",
      "التسويف وتأجيل المهام",
      "أفكار مش بتبطل في دماغي",
    ],
  },
  {
    id: "goal",
    question:
      "وإيه الحاجة اللي حابب تعملها بس لحد دلوقتي ماعملتهاش؟",
    placeholder: "هدفك أو حاجة عايز تغيرها...",
    quickOptions: [
      "أنظم وقتي صح وأنجز أكتر",
      "أقرأ أو أتعلم حاجة جديدة",
      "أمارس رياضة بانتظام",
      "أبدأ مشروع أو فكرة في دماغي",
    ],
  },
  {
    id: "sleep",
    question:
      "تمام! سؤال عملي — بتنام تقريباً امتى بالليل؟ (عشان رفيق ميوقفكش بالليل لو مش وقتها 😄)",
    placeholder: "مثال: 11 بالليل، 12 منتصف الليل...",
    quickOptions: [
      "10 أو 11 بالليل",
      "منتصف الليل تقريباً",
      "1 الصبح",
      "أكتر من 2 الصبح",
    ],
  },
  {
    id: "pleasure",
    question: (name: string) =>
      `آخر سؤال يا ${name} — إيه الحاجة البسيطة اللي بتبسطك لما تعمل حاجة كويسة لنفسك؟`,
    placeholder: "مكافأتك البسيطة...",
    quickOptions: [
      "قهوة أو شاي بالراحة ☕",
      "تمشية بره في الهوا 🚶",
      "أغنية بحبها 🎵",
      "وقت فراغ بلا ضغط 🎮",
    ],
  },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function resolveQuestion(step: Step, name: string): string {
  return typeof step.question === "function" ? step.question(name) : step.question;
}

// ─── Inline Keyframe Style Injection ─────────────────────────────────────────

const ANIMATION_CSS = `
@keyframes rafiq-fadeInUp {
  from { opacity: 0; transform: translateY(12px); }
  to   { opacity: 1; transform: translateY(0);    }
}
@keyframes rafiq-fadeInDown {
  from { opacity: 0; transform: translateY(-8px); }
  to   { opacity: 1; transform: translateY(0);    }
}
@keyframes rafiq-scaleIn {
  from { opacity: 0; transform: scale(0.88); }
  to   { opacity: 1; transform: scale(1);    }
}
@keyframes rafiq-dot-bounce {
  0%, 80%, 100% { transform: translateY(0);    opacity: 0.4; }
  40%            { transform: translateY(-6px); opacity: 1;   }
}
@keyframes rafiq-progress-fill {
  from { width: 0%; }
  to   { width: 100%; }
}
@keyframes rafiq-celebrate-pop {
  0%   { opacity: 0; transform: scale(0.7); }
  60%  { transform: scale(1.06); }
  100% { opacity: 1; transform: scale(1);   }
}
@keyframes rafiq-shimmer {
  0%   { background-position: -200% center; }
  100% { background-position:  200% center; }
}
`;

function injectStyles() {
  if (typeof document === "undefined") return;
  const id = "rafiq-onboarding-styles";
  if (document.getElementById(id)) return;
  const el = document.createElement("style");
  el.id = id;
  el.textContent = ANIMATION_CSS;
  document.head.appendChild(el);
}

// ─── Sub-components ──────────────────────────────────────────────────────────

/** Small 'ر' avatar circle used on Rafiq's chat bubbles */
function RafiqAvatar() {
  return (
    <div
      style={{
        width: 32,
        height: 32,
        borderRadius: "50%",
        background: "linear-gradient(135deg, #E6C38E, #B8965E)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
        boxShadow: "0 0 10px rgba(230,195,142,0.4)",
        fontSize: 14,
        fontWeight: 700,
        color: "#121212",
        fontFamily: "serif",
      }}
    >
      ر
    </div>
  );
}

/** Rafiq's chat bubble — left-aligned */
function RafiqBubble({ text, delay = 0 }: { text: string; delay?: number }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-end",
        gap: 8,
        animation: `rafiq-fadeInUp 0.4s ease both`,
        animationDelay: `${delay}ms`,
        direction: "rtl",
      }}
    >
      <RafiqAvatar />
      <div
        style={{
          maxWidth: "75%",
          background: "rgba(255,255,255,0.07)",
          border: "1px solid rgba(230,195,142,0.18)",
          borderRadius: "18px 18px 18px 4px",
          padding: "12px 16px",
          color: "#F4F4F0",
          fontSize: 15,
          lineHeight: 1.65,
          fontFamily: "inherit",
          direction: "rtl",
          textAlign: "right",
        }}
      >
        {text}
      </div>
    </div>
  );
}

/** User's answer bubble — right-aligned */
function UserBubble({ text }: { text: string }) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "flex-start",
        animation: `rafiq-fadeInUp 0.35s ease both`,
        direction: "rtl",
      }}
    >
      <div
        style={{
          maxWidth: "72%",
          background: "linear-gradient(135deg, #E6C38E22, #B8965E33)",
          border: "1px solid rgba(230,195,142,0.35)",
          borderRadius: "18px 18px 4px 18px",
          padding: "10px 16px",
          color: "#E6C38E",
          fontSize: 15,
          lineHeight: 1.6,
          fontFamily: "inherit",
          direction: "rtl",
          textAlign: "right",
        }}
      >
        {text}
      </div>
    </div>
  );
}

/** Animated "typing…" indicator shown while Rafiq is "composing" */
function TypingIndicator() {
  const dotStyle = (delay: number): React.CSSProperties => ({
    width: 7,
    height: 7,
    borderRadius: "50%",
    background: "#E6C38E",
    animation: `rafiq-dot-bounce 1.2s ease infinite`,
    animationDelay: `${delay}ms`,
  });

  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-end",
        gap: 8,
        animation: `rafiq-fadeInUp 0.3s ease both`,
        direction: "rtl",
      }}
    >
      <RafiqAvatar />
      <div
        style={{
          background: "rgba(255,255,255,0.07)",
          border: "1px solid rgba(230,195,142,0.18)",
          borderRadius: "18px 18px 18px 4px",
          padding: "14px 18px",
          display: "flex",
          gap: 5,
          alignItems: "center",
        }}
      >
        <div style={dotStyle(0)} />
        <div style={dotStyle(180)} />
        <div style={dotStyle(360)} />
      </div>
    </div>
  );
}

/** Top progress bar */
function ProgressBar({ step, total }: { step: number; total: number }) {
  const pct = Math.round(((step) / total) * 100);
  return (
    <div
      style={{
        width: "100%",
        height: 3,
        background: "rgba(244,244,240,0.08)",
        borderRadius: 4,
        overflow: "hidden",
        flexShrink: 0,
      }}
    >
      <div
        style={{
          height: "100%",
          width: `${pct}%`,
          background: "linear-gradient(90deg, #E6C38E, #d4ad6e)",
          borderRadius: 4,
          transition: "width 0.5s ease",
          boxShadow: "0 0 8px rgba(230,195,142,0.5)",
        }}
      />
    </div>
  );
}

/** Quick-option chip button */
function QuickChip({
  label,
  onClick,
  disabled,
}: {
  label: string;
  onClick: () => void;
  disabled: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        padding: "8px 14px",
        borderRadius: 20,
        border: "1px solid rgba(230,195,142,0.35)",
        background: "rgba(230,195,142,0.07)",
        color: "#E6C38E",
        fontSize: 13,
        fontFamily: "inherit",
        cursor: disabled ? "default" : "pointer",
        opacity: disabled ? 0.5 : 1,
        transition: "all 0.2s ease",
        direction: "rtl",
        whiteSpace: "nowrap",
        animation: `rafiq-fadeInUp 0.3s ease both`,
      }}
      onMouseEnter={(e) => {
        if (!disabled) {
          (e.currentTarget as HTMLButtonElement).style.background =
            "rgba(230,195,142,0.18)";
          (e.currentTarget as HTMLButtonElement).style.borderColor =
            "rgba(230,195,142,0.6)";
        }
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLButtonElement).style.background =
          "rgba(230,195,142,0.07)";
        (e.currentTarget as HTMLButtonElement).style.borderColor =
          "rgba(230,195,142,0.35)";
      }}
    >
      {label}
    </button>
  );
}

// ─── Celebration Screen ───────────────────────────────────────────────────────

function CelebrationScreen({ name }: { name: string }) {
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 60,
        background: "#121212",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 28,
        padding: "32px 24px",
        animation: `rafiq-celebrate-pop 0.6s ease both`,
        direction: "rtl",
        textAlign: "center",
      }}
    >
      <BreathingOrb mood="motivated" />

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <h1
          style={{
            margin: 0,
            fontSize: 28,
            fontWeight: 700,
            background:
              "linear-gradient(90deg, #E6C38E, #FBEACB, #E6C38E) 200% center",
            backgroundSize: "200%",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            animation: `rafiq-shimmer 2.5s linear infinite`,
            fontFamily: "inherit",
          }}
        >
          عاش يا {name}! 🎉
        </h1>

        <p
          style={{
            margin: 0,
            fontSize: 17,
            color: "#F4F4F0",
            lineHeight: 1.7,
            maxWidth: 320,
            fontFamily: "inherit",
            opacity: 0.9,
          }}
        >
          رفيق وصل وجاهز يبدأ معاك
          <br />
          <span style={{ color: "rgba(244,244,240,0.55)", fontSize: 14 }}>
            بنبني الخطة دلوقتي...
          </span>
        </p>
      </div>

      {/* Subtle pulsing dots indicator */}
      <div style={{ display: "flex", gap: 6 }}>
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            style={{
              width: 6,
              height: 6,
              borderRadius: "50%",
              background: "#E6C38E",
              animation: `rafiq-dot-bounce 1.4s ease infinite`,
              animationDelay: `${i * 220}ms`,
              opacity: 0.7,
            }}
          />
        ))}
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function Onboarding({ onDone }: Props) {
  injectStyles();

  // ── State ──
  const [currentStep, setCurrentStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [inputValue, setInputValue] = useState("");
  const [isRafiqTyping, setIsRafiqTyping] = useState(false);
  const [completedSteps, setCompletedSteps] = useState<CompletedStep[]>([]);
  const [isDone, setIsDone] = useState(false);

  // ── Refs ──
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const name = answers["name"] ?? "";
  const step = STEPS[currentStep];
  const questionText = step ? resolveQuestion(step, name) : "";

  // ── Auto-scroll to bottom whenever chat updates ──
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [completedSteps, isRafiqTyping, currentStep]);

  // ── Focus input when Rafiq finishes typing ──
  useEffect(() => {
    if (!isRafiqTyping && !isDone) {
      inputRef.current?.focus();
    }
  }, [isRafiqTyping, isDone]);

  // ── Submit an answer ──
  const handleSubmit = (value?: string) => {
    const raw = (value ?? inputValue).trim();
    if (!raw || isRafiqTyping) return;

    const answeredStep = STEPS[currentStep];
    const answeredQuestion = resolveQuestion(answeredStep, name);

    // Record the answer
    const newAnswers = { ...answers, [answeredStep.id]: raw };
    setAnswers(newAnswers);
    setInputValue("");

    // Push to completed steps (for chat history rendering)
    setCompletedSteps((prev) => [
      ...prev,
      { question: answeredQuestion, answer: raw },
    ]);

    const isLast = currentStep === STEPS.length - 1;

    if (isLast) {
      // Show typing for a beat, then celebration
      setIsRafiqTyping(true);
      setTimeout(() => {
        setIsRafiqTyping(false);
        setIsDone(true);
        // Call onDone after 2.5s to let the user enjoy the celebration
        setTimeout(() => {
          onDone({
            name: newAnswers["name"] ?? "",
            blocker: newAnswers["blocker"] ?? "",
            goal: newAnswers["goal"] ?? "",
            sleepTime: newAnswers["sleep"] ?? "",
            smallPleasure: newAnswers["pleasure"] ?? "",
          });
        }, 2500);
      }, 700);
    } else {
      // Show Rafiq typing indicator, then next question
      setIsRafiqTyping(true);
      setTimeout(() => {
        setIsRafiqTyping(false);
        setCurrentStep((s) => s + 1);
      }, 600);
    }
  };

  // ── Enter key ──
  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSubmit();
    }
  };

  // ─── Render ───────────────────────────────────────────────────────────────

  if (isDone) {
    return <CelebrationScreen name={name} />;
  }

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 50,
        background: "#121212",
        display: "flex",
        flexDirection: "column",
        direction: "rtl",
        overflow: "hidden",
        fontFamily:
          "'Cairo', 'Noto Naskh Arabic', 'Segoe UI', Tahoma, Arial, sans-serif",
      }}
    >
      {/* ── Header: progress bar + step counter ── */}
      <div
        style={{
          padding: "16px 20px 12px",
          flexShrink: 0,
          display: "flex",
          flexDirection: "column",
          gap: 8,
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <span
            style={{
              fontSize: 11,
              color: "rgba(244,244,240,0.35)",
              fontWeight: 500,
              letterSpacing: "0.03em",
            }}
          >
            {currentStep + 1} / {STEPS.length}
          </span>
          <span
            style={{
              fontSize: 13,
              color: "rgba(230,195,142,0.7)",
              fontWeight: 600,
            }}
          >
            رفيق
          </span>
        </div>
        <ProgressBar step={currentStep} total={STEPS.length} />
      </div>

      {/* ── Chat Scroll Area ── */}
      <div
        ref={scrollRef}
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "8px 16px 16px",
          display: "flex",
          flexDirection: "column",
          gap: 14,
          // Subtle fade at top
          maskImage:
            "linear-gradient(to bottom, transparent 0%, black 60px, black 100%)",
          WebkitMaskImage:
            "linear-gradient(to bottom, transparent 0%, black 60px, black 100%)",
        }}
      >
        {/* ── Completed history: question + answer pairs ── */}
        {completedSteps.map((cs, idx) => (
          <div
            key={idx}
            style={{ display: "flex", flexDirection: "column", gap: 10 }}
          >
            <RafiqBubble text={cs.question} />
            <UserBubble text={cs.answer} />
          </div>
        ))}

        {/* ── Current Rafiq question ── */}
        {!isRafiqTyping && currentStep < STEPS.length && (
          <RafiqBubble
            key={`q-${currentStep}`}
            text={questionText}
            delay={completedSteps.length === 0 ? 300 : 0}
          />
        )}

        {/* ── Typing indicator ── */}
        {isRafiqTyping && <TypingIndicator />}
      </div>

      {/* ── Input Area ── */}
      {!isRafiqTyping && currentStep < STEPS.length && (
        <div
          style={{
            flexShrink: 0,
            padding: "0 16px 24px",
            display: "flex",
            flexDirection: "column",
            gap: 10,
            animation: `rafiq-fadeInDown 0.35s ease both`,
          }}
        >
          {/* Quick-option chips */}
          {step.quickOptions && (
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: 8,
                justifyContent: "flex-end",
              }}
            >
              {step.quickOptions.map((opt) => (
                <QuickChip
                  key={opt}
                  label={opt}
                  disabled={isRafiqTyping}
                  onClick={() => handleSubmit(opt)}
                />
              ))}
            </div>
          )}

          {/* Text input + send button row */}
          <div
            style={{
              display: "flex",
              gap: 10,
              alignItems: "center",
            }}
          >
            <input
              ref={inputRef}
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={step.placeholder}
              disabled={isRafiqTyping}
              dir="rtl"
              style={{
                flex: 1,
                height: 48,
                borderRadius: 24,
                border: "1px solid rgba(230,195,142,0.25)",
                background: "rgba(255,255,255,0.05)",
                color: "#F4F4F0",
                fontSize: 15,
                padding: "0 18px",
                outline: "none",
                fontFamily: "inherit",
                direction: "rtl",
                textAlign: "right",
                transition: "border-color 0.2s ease, box-shadow 0.2s ease",
              }}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = "rgba(230,195,142,0.55)";
                e.currentTarget.style.boxShadow =
                  "0 0 0 3px rgba(230,195,142,0.1)";
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = "rgba(230,195,142,0.25)";
                e.currentTarget.style.boxShadow = "none";
              }}
            />

            {/* Send button */}
            <button
              onClick={() => handleSubmit()}
              disabled={isRafiqTyping || !inputValue.trim()}
              style={{
                width: 48,
                height: 48,
                borderRadius: "50%",
                background:
                  inputValue.trim()
                    ? "linear-gradient(135deg, #E6C38E, #d4ad6e)"
                    : "rgba(230,195,142,0.12)",
                border: "none",
                cursor: inputValue.trim() ? "pointer" : "default",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
                transition: "all 0.2s ease",
                boxShadow: inputValue.trim()
                  ? "0 0 16px rgba(230,195,142,0.35)"
                  : "none",
              }}
            >
              {/* Arrow icon — pointing left (RTL send direction) */}
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke={inputValue.trim() ? "#121212" : "rgba(230,195,142,0.4)"}
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <line x1="22" y1="2" x2="11" y2="13" />
                <polygon points="22 2 15 22 11 13 2 9 22 2" />
              </svg>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
