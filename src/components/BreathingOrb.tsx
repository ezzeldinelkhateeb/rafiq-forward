import logoUrl from "@/assets/rafiq-logo.png";

export type OrbMood = "calm" | "thinking" | "motivated" | "drained" | "anxious";

interface Props {
  thinking?: boolean;
  mood?: OrbMood;
}

const MOOD_STYLES: Record<
  OrbMood,
  {
    coreGradient: string;
    haloGradient: string;
    boxShadow: string;
    waveBorderColor: string;
    highlightColor: string;
  }
> = {
  calm: {
    coreGradient: "radial-gradient(circle at 35% 30%, #FBEACB 0%, #E6C38E 40%, #B8965E 75%, #4A4030 100%)",
    haloGradient: "radial-gradient(circle, rgba(230,195,142,0.4) 0%, rgba(125,143,106,0.12) 45%, transparent 70%)",
    boxShadow: "0 0 65px 10px rgba(230,195,142,0.45), inset -8px -12px 25px rgba(74,64,48,0.6), inset 8px 10px 20px rgba(251,234,203,0.4)",
    waveBorderColor: "rgba(230, 195, 142, 0.22)",
    highlightColor: "rgba(255, 245, 220, 0.95)",
  },
  thinking: {
    coreGradient: "radial-gradient(circle at 35% 30%, #D8E4D0 0%, #7D8F6A 40%, #5E6D4E 75%, #2D3525 100%)",
    haloGradient: "radial-gradient(circle, rgba(125,143,106,0.45) 0%, rgba(74,90,60,0.12) 45%, transparent 70%)",
    boxShadow: "0 0 65px 10px rgba(125,143,106,0.45), inset -8px -12px 25px rgba(45,53,37,0.6), inset 8px 10px 20px rgba(216,228,208,0.4)",
    waveBorderColor: "rgba(125, 143, 106, 0.25)",
    highlightColor: "rgba(235, 245, 230, 0.95)",
  },
  motivated: {
    coreGradient: "radial-gradient(circle at 35% 30%, #FFE5C4 0%, #FF9F1C 40%, #E85D04 75%, #6A040F 100%)",
    haloGradient: "radial-gradient(circle, rgba(255,159,28,0.45) 0%, rgba(232,93,4,0.12) 45%, transparent 70%)",
    boxShadow: "0 0 75px 12px rgba(255,159,28,0.55), inset -8px -12px 25px rgba(106,4,15,0.6), inset 8px 10px 20px rgba(255,229,196,0.4)",
    waveBorderColor: "rgba(255, 159, 28, 0.28)",
    highlightColor: "rgba(255, 240, 215, 0.95)",
  },
  drained: {
    coreGradient: "radial-gradient(circle at 35% 30%, #A9BCCF 0%, #4A5D6E 40%, #2E3A46 75%, #171D23 100%)",
    haloGradient: "radial-gradient(circle, rgba(74,93,110,0.4) 0%, rgba(46,58,70,0.12) 45%, transparent 70%)",
    boxShadow: "0 0 60px 8px rgba(74,93,110,0.4), inset -8px -12px 25px rgba(23,29,35,0.6), inset 8px 10px 20px rgba(169,188,207,0.4)",
    waveBorderColor: "rgba(74, 93, 110, 0.22)",
    highlightColor: "rgba(220, 235, 250, 0.9)",
  },
  anxious: {
    coreGradient: "radial-gradient(circle at 35% 30%, #E8C5D8 0%, #A5668B 40%, #69306D 75%, #38133E 100%)",
    haloGradient: "radial-gradient(circle, rgba(165,102,139,0.45) 0%, rgba(105,48,109,0.12) 45%, transparent 70%)",
    boxShadow: "0 0 65px 10px rgba(165,102,139,0.45), inset -8px -12px 25px rgba(56,19,62,0.6), inset 8px 10px 20px rgba(232,197,216,0.4)",
    waveBorderColor: "rgba(165, 102, 139, 0.25)",
    highlightColor: "rgba(250, 230, 240, 0.95)",
  },
};

export function BreathingOrb({ thinking, mood: propMood }: Props) {
  // Resolve active mood (force 'thinking' if thinking prop is true, otherwise fallback to propMood or calm)
  const activeMood = thinking ? "thinking" : propMood || "calm";
  const styles = MOOD_STYLES[activeMood];

  // Dynamically control animation duration (3s for thinking/active, 7s for default calm)
  const duration = thinking ? "3s" : "7s";

  return (
    <div className="relative flex items-center justify-center w-48 h-48 mx-auto select-none group">
      {/* Concentric wave rings pulsing outward */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div
          className="absolute w-28 h-28 rounded-full border border-current animate-wave-pulse"
          style={{ color: styles.waveBorderColor, animationDelay: "0s" }}
        />
        <div
          className="absolute w-28 h-28 rounded-full border border-current animate-wave-pulse"
          style={{ color: styles.waveBorderColor, animationDelay: "1.3s" }}
        />
        <div
          className="absolute w-28 h-28 rounded-full border border-current animate-wave-pulse"
          style={{ color: styles.waveBorderColor, animationDelay: "2.6s" }}
        />
      </div>

      {/* Glow Halo behind the orb */}
      <div
        className="absolute inset-0 rounded-full animate-breathe-halo transition-all duration-1000 ease-in-out"
        style={{
          background: styles.haloGradient,
          filter: "blur(24px)",
          animationDuration: duration,
        }}
      />

      {/* Main Glassmorphic Glowing Orb Body */}
      <div
        className="absolute w-28 h-28 rounded-full flex items-center justify-center animate-breathe transition-all duration-1000 ease-in-out"
        style={{
          background: styles.coreGradient,
          boxShadow: styles.boxShadow,
          animationDuration: duration,
        }}
      >
        {/* Glow Highlight dot inside the orb (gives a 3D sphere look) */}
        <div
          className="absolute w-8 h-8 rounded-full top-2 left-6 opacity-80 pointer-events-none transition-all duration-1000"
          style={{
            background: `radial-gradient(circle, ${styles.highlightColor}, transparent 70%)`,
            filter: "blur(4px)",
          }}
        />

        {/* Center Logo - beautifully nested inside the glowing orb */}
        <img
          src={logoUrl}
          alt="رفيق — شعار التطبيق"
          className="w-14 h-14 object-contain opacity-85 select-none pointer-events-none drop-shadow-[0_2px_10px_rgba(0,0,0,0.6)] mix-blend-luminosity filter transition-transform duration-500 group-hover:scale-105"
        />
      </div>
    </div>
  );
}
