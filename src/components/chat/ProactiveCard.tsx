/**
 * ProactiveCard — shown when Rafiq initiates.
 * This is Rafiq speaking first. Not reacting. Noticing.
 */

import { X } from "lucide-react";
import type { ProactiveNudge } from "@/types/companion";

interface Props {
  nudge: ProactiveNudge;
  onDismiss: () => void;
  onReply: (text: string) => void;
}

export function ProactiveCard({ nudge, onDismiss, onReply }: Props) {
  return (
    <div
      className="mx-auto max-w-xl animate-fade-up"
      dir="rtl"
      style={{
        background:
          "linear-gradient(135deg, rgba(230,195,142,0.1), rgba(125,143,106,0.06))",
        border: "1px solid rgba(230,195,142,0.25)",
        borderRadius: "1.25rem",
        padding: "1rem 1.25rem",
        position: "relative",
      }}
    >
      {/* Dismiss */}
      <button
        onClick={onDismiss}
        aria-label="إغلاق"
        className="absolute top-3 left-3 text-ivory/30 hover:text-ivory/60 transition-colors"
      >
        <X className="w-3.5 h-3.5" />
      </button>

      {/* Rafiq label */}
      <p
        className="text-[10px] font-arabic tracking-widest mb-2"
        style={{ color: "#E6C38E", opacity: 0.6 }}
      >
        رفيق
      </p>

      {/* Main nudge text */}
      <p
        className="font-arabic text-[15px] leading-relaxed"
        style={{ color: "#F4F4F0" }}
      >
        {nudge.text}
      </p>

      {/* Subtext (e.g. "3 days since last session") */}
      {nudge.subtext && (
        <p
          className="font-arabic text-[12px] mt-1"
          style={{ color: "rgba(244,244,240,0.4)" }}
        >
          {nudge.subtext}
        </p>
      )}

      {/* Optional action button */}
      {nudge.action && (
        <button
          onClick={() => {
            onReply(nudge.action!);
            onDismiss();
          }}
          className="mt-3 px-4 py-2 rounded-full font-arabic text-sm transition-all"
          style={{
            background: "linear-gradient(135deg, rgba(230,195,142,0.2), rgba(230,195,142,0.08))",
            border: "1px solid rgba(230,195,142,0.4)",
            color: "#E6C38E",
          }}
        >
          {nudge.action}
        </button>
      )}
    </div>
  );
}
