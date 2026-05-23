interface Props { thinking?: boolean }

export function BreathingOrb({ thinking }: Props) {
  return (
    <div className="relative flex items-center justify-center w-40 h-40 mx-auto select-none">
      <div
        className="absolute inset-0 rounded-full animate-breathe-halo"
        style={{
          background:
            "radial-gradient(circle, rgba(230,195,142,0.35) 0%, rgba(125,143,106,0.15) 45%, transparent 70%)",
          filter: "blur(20px)",
          animationDuration: thinking ? "3s" : "7s",
        }}
      />
      <div
        className="absolute w-28 h-28 rounded-full animate-breathe"
        style={{
          background:
            "radial-gradient(circle at 35% 30%, #FBEACB 0%, #E6C38E 35%, #B8965E 70%, #4A4030 100%)",
          boxShadow:
            "0 0 60px 8px rgba(230,195,142,0.45), inset -10px -15px 30px rgba(74,64,48,0.5), inset 8px 10px 20px rgba(251,234,203,0.4)",
          animationDuration: thinking ? "3s" : "7s",
        }}
      />
      <div
        className="absolute w-6 h-6 rounded-full top-7 left-1/2 -translate-x-[140%] opacity-80"
        style={{
          background: "radial-gradient(circle, rgba(255,245,220,0.9), transparent 70%)",
          filter: "blur(4px)",
        }}
      />
    </div>
  );
}
