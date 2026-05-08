import { useGame } from "./GameContext";

export function AmbientOverlay() {
  const { state } = useGame();
  const m = ((state.mes - 1) % 12) + 1;
  // Atardecer dorado más fuerte en otoño (Mar-May) y primavera tardía
  const sunsetStrength = m >= 3 && m <= 5 ? 0.35 : m >= 9 && m <= 11 ? 0.25 : 0.12;
  const zonda = state.eventos[0]?.title === "Viento Zonda";

  return (
    <>
      {/* Atardecer riojano: gradiente dorado-rosa con blend mode */}
      <div
        className="pointer-events-none fixed inset-0 z-[40]"
        style={{
          background:
            "radial-gradient(ellipse at 80% 10%, oklch(0.78 0.17 65 / 0.55), transparent 55%), radial-gradient(ellipse at 20% 90%, oklch(0.55 0.18 25 / 0.4), transparent 60%)",
          opacity: sunsetStrength,
          mixBlendMode: "overlay",
        }}
      />
      {/* Viento Zonda: polvo naranja animado */}
      {zonda && (
        <div
          className="pointer-events-none fixed inset-0 z-[41]"
          style={{
            background:
              "linear-gradient(110deg, transparent 0%, oklch(0.75 0.18 55 / 0.18) 30%, transparent 60%, oklch(0.7 0.18 45 / 0.12) 90%)",
            backdropFilter: "sepia(0.25) contrast(1.05)",
            animation: "zonda-drift 12s linear infinite",
          }}
        />
      )}
      <style>{`
        @keyframes zonda-drift {
          0% { background-position: 0% 0%; }
          100% { background-position: 200% 0%; }
        }
      `}</style>
    </>
  );
}
