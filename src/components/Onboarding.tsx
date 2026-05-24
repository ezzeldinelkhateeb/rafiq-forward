import { useState } from "react";
import { ArrowLeft } from "lucide-react";
import { BreathingOrb } from "@/components/BreathingOrb";

interface Props {
  onDone: () => void;
}

const SCREENS = [
  {
    title: "يا هلا بيك! 👋",
    body: "أنا رفيق.. مش دكتور نفسي ولا جاي أديك محاضرة، أنا صاحبك اللي هيشدك من فرة الموبايل ويزقك خطوة بخطوة للحياة الحقيقية.",
    cta: "يلا بينا",
  },
  {
    title: "قانوني هنا بسيط 👇",
    body: "أقل كلام، وأكبر حركة! كل ما تيجي تفصل أو تضيع وقت، هرجعك تلتفت لنفسك ولجسمك وتعمل حاجة حقيقية تفوقك.",
    cta: "فهمت الدماغ",
  },
  {
    title: "سرّك في بير 🤫",
    body: "كل اللي هيتقال هنا بيفضل هنا ومحدش هيشوفه غيرك. مساحتك الخاصة والآمنة تماماً عشان تفصل وتركز.",
    cta: "ابدأ رحلتك",
  },
];

export function Onboarding({ onDone }: Props) {
  const [i, setI] = useState(0);
  const screen = SCREENS[i];

  return (
    <div className="fixed inset-0 z-50 bg-[#121212] flex flex-col items-center justify-between px-6 py-10 animate-fade-up">
      <div className="flex items-center gap-1 self-start">
        {SCREENS.map((_, idx) => (
          <span
            key={idx}
            className="h-1 rounded-full transition-all"
            style={{
              width: idx === i ? 24 : 8,
              background: idx <= i ? "#E6C38E" : "rgba(244,244,240,0.15)",
            }}
          />
        ))}
      </div>

      <div className="flex flex-col items-center text-center max-w-sm">
        <BreathingOrb />
        <h1
          key={`t-${i}`}
          className="mt-8 font-arabic text-3xl text-ivory animate-fade-up"
          style={{ color: "#F4F4F0" }}
        >
          {screen.title}
        </h1>
        <p
          key={`b-${i}`}
          className="mt-4 font-arabic text-[15px] text-ivory/60 leading-relaxed animate-fade-up"
        >
          {screen.body}
        </p>
      </div>

      <div className="w-full max-w-sm flex flex-col items-center gap-3">
        <button
          onClick={() => (i < SCREENS.length - 1 ? setI(i + 1) : onDone())}
          className="w-full py-3.5 rounded-full font-arabic text-[15px] transition-all"
          style={{
            background: "linear-gradient(135deg, #E6C38E, #d4ad6e)",
            color: "#121212",
          }}
        >
          {screen.cta}
        </button>
        {i > 0 && (
          <button
            onClick={() => setI(i - 1)}
            className="flex items-center gap-1 text-ivory/40 hover:text-ivory/70 text-xs font-arabic"
          >
            <ArrowLeft className="w-3 h-3" />
            رجوع
          </button>
        )}
      </div>
    </div>
  );
}
