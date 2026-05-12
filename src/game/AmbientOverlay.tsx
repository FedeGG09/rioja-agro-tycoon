import { motion } from "framer-motion";
import { useGame } from "./GameContext";

/**
 * Escenario vectorial dinámico: montañas flat-design con sombras proyectadas,
 * río orgánico, paleta monocromática slate con acentos ámbar/vino.
 * Capas con parallax sutil + animación de entrada.
 */
export function AmbientOverlay() {
  const { state } = useGame();
  const m = ((state.mes - 1) % 12) + 1;
  const sunsetStrength = m >= 3 && m <= 5 ? 0.32 : m >= 9 && m <= 11 ? 0.22 : 0.1;
  const zonda = state.eventos[0]?.title === "Viento Zonda";

  // Movimiento sutil parallax — basado en mes para que se sienta vivo sin distraer
  const drift = (state.mes % 24) - 12; // -12..12

  return (
    <>
      {/* Capa 1 — Cielo + sol */}
      <div
        className="pointer-events-none fixed inset-0 z-[10] overflow-hidden"
        aria-hidden
      >
        <svg
          width="100%"
          height="100%"
          viewBox="0 0 1600 900"
          preserveAspectRatio="xMidYMid slice"
          className="absolute inset-0 h-full w-full"
        >
          <defs>
            <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="oklch(0.20 0.05 260)" />
              <stop offset="55%" stopColor="oklch(0.14 0.04 265)" />
              <stop offset="100%" stopColor="oklch(0.10 0.03 260)" />
            </linearGradient>
            <radialGradient id="sun" cx="0.78" cy="0.18" r="0.22">
              <stop offset="0%" stopColor="oklch(0.85 0.18 75 / 0.55)" />
              <stop offset="100%" stopColor="oklch(0.85 0.18 75 / 0)" />
            </radialGradient>

            {/* Sombras proyectadas para flat-design 3D */}
            <filter id="mtnShadow" x="-10%" y="-10%" width="120%" height="140%">
              <feDropShadow dx="14" dy="18" stdDeviation="0" floodColor="#000" floodOpacity="0.35" />
            </filter>
            <filter id="mtnShadowSoft" x="-10%" y="-10%" width="120%" height="140%">
              <feDropShadow dx="8" dy="10" stdDeviation="0" floodColor="#000" floodOpacity="0.28" />
            </filter>

            {/* Río con leve reflejo */}
            <linearGradient id="river" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="oklch(0.62 0.13 230)" />
              <stop offset="100%" stopColor="oklch(0.45 0.12 235)" />
            </linearGradient>
          </defs>

          <rect width="1600" height="900" fill="url(#sky)" />
          <rect width="1600" height="900" fill="url(#sun)" opacity={0.4 + sunsetStrength} />

          {/* Capa lejana — montañas pálidas, parallax suave */}
          <motion.g
            initial={{ y: 30, opacity: 0 }}
            animate={{ y: 0, opacity: 0.55, x: drift * 0.6 }}
            transition={{ duration: 1.6, ease: "easeOut" }}
          >
            <path
              d="M -50 620 L 180 420 L 320 540 L 480 380 L 640 520 L 820 360 L 980 520 L 1180 400 L 1380 540 L 1650 460 L 1650 900 L -50 900 Z"
              fill="oklch(0.30 0.04 260)"
              filter="url(#mtnShadowSoft)"
            />
            {/* Highlights flat-design (cara iluminada) */}
            <path
              d="M 180 420 L 250 500 L 320 540 L 245 540 Z M 480 380 L 560 470 L 640 520 L 540 520 Z M 820 360 L 900 450 L 980 520 L 880 520 Z M 1180 400 L 1270 490 L 1380 540 L 1260 540 Z"
              fill="oklch(0.40 0.04 255)"
              opacity="0.65"
            />
          </motion.g>

          {/* Capa media — montañas medias con acento ámbar (atardecer) */}
          <motion.g
            initial={{ y: 60, opacity: 0 }}
            animate={{ y: 0, opacity: 0.85, x: drift * 1.2 }}
            transition={{ duration: 1.4, ease: "easeOut", delay: 0.1 }}
          >
            <path
              d="M -50 720 L 120 540 L 280 660 L 440 480 L 600 660 L 760 500 L 940 660 L 1120 520 L 1320 660 L 1500 560 L 1650 640 L 1650 900 L -50 900 Z"
              fill="oklch(0.24 0.05 260)"
              filter="url(#mtnShadow)"
            />
            {/* Cara iluminada con tono terracota (acento) */}
            <path
              d="M 120 540 L 200 640 L 280 660 L 195 660 Z M 440 480 L 520 600 L 600 660 L 510 660 Z M 760 500 L 850 610 L 940 660 L 840 660 Z M 1120 520 L 1220 620 L 1320 660 L 1210 660 Z"
              fill="oklch(0.42 0.10 45)"
              opacity={0.55 + sunsetStrength}
            />
          </motion.g>

          {/* Río orgánico — curva fluida con reflejos mínimos */}
          <motion.g
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.75 }}
            transition={{ duration: 2, delay: 0.4 }}
          >
            <path
              d="M -20 760 C 200 740, 380 800, 560 770 S 920 720, 1100 780 S 1460 800, 1650 760 L 1650 820 C 1460 850, 1280 800, 1100 830 S 740 870, 560 820 S 200 800, -20 820 Z"
              fill="url(#river)"
            />
            {/* Reflejos sutiles */}
            <path
              d="M 100 778 C 280 766, 460 798, 640 782 M 720 808 C 900 796, 1080 824, 1260 808"
              stroke="oklch(0.85 0.10 230 / 0.35)"
              strokeWidth="1.5"
              fill="none"
            />
          </motion.g>

          {/* Cerros cercanos — silueta delantera con sombra dura (flat 3D) */}
          <motion.g
            initial={{ y: 80, opacity: 0 }}
            animate={{ y: 0, opacity: 0.95, x: drift * 1.8 }}
            transition={{ duration: 1.2, ease: "easeOut", delay: 0.2 }}
          >
            <path
              d="M -50 850 L 90 740 L 230 830 L 380 720 L 540 820 L 700 740 L 880 830 L 1050 750 L 1240 830 L 1420 760 L 1650 820 L 1650 900 L -50 900 Z"
              fill="oklch(0.18 0.04 260)"
              filter="url(#mtnShadow)"
            />
            <path
              d="M 90 740 L 170 820 L 230 830 L 165 830 Z M 380 720 L 470 810 L 540 820 L 460 820 Z M 700 740 L 800 820 L 880 830 L 790 830 Z M 1050 750 L 1160 820 L 1240 830 L 1150 830 Z"
              fill="oklch(0.55 0.16 65)"
              opacity={0.4 + sunsetStrength * 0.8}
            />
          </motion.g>
        </svg>
      </div>

      {/* Atardecer riojano: blend dorado-rosa */}
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
