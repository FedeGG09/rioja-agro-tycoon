import { motion, AnimatePresence } from "framer-motion";
import { useGame, type Finca } from "./GameContext";

const cropEmoji: Record<string, string> = { vid: "🍇", olivo: "🫒", nogal: "🌰" };
const factoryEmoji: Record<string, string> = { bodega: "🍷", almazara: "🛢️", nuez: "🏭" };

export function IsometricGrid({ onSelect, selectedId }: { onSelect: (f: Finca) => void; selectedId?: string }) {
  const { state, isHarvestMonth } = useGame();
  const harvest = isHarvestMonth(state.mes);

  return (
    <div className="glass relative h-[480px] w-full overflow-hidden rounded-2xl">
      {/* ambient sky */}
      <div className="absolute inset-0 bg-gradient-to-b from-[oklch(0.3_0.08_260)] via-[oklch(0.25_0.06_40)] to-[oklch(0.35_0.12_45)] opacity-60" />
      {/* sun */}
      <motion.div
        animate={{ scale: [1, 1.05, 1], opacity: [0.7, 0.9, 0.7] }}
        transition={{ duration: 6, repeat: Infinity }}
        className="absolute right-12 top-8 h-24 w-24 rounded-full bg-[var(--gold)] blur-xl"
      />
      {/* stars */}
      <div className="absolute inset-0 opacity-20" style={{
        backgroundImage: "radial-gradient(white 1px, transparent 1px)",
        backgroundSize: "40px 40px",
      }} />

      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
        style={{ transformStyle: "preserve-3d", perspective: "1400px" }}>
        <div className="grid grid-cols-4 gap-2" style={{ transform: "rotateX(55deg) rotateZ(-45deg)" }}>
          {Array.from({ length: 16 }).map((_, i) => {
            const x = i % 4;
            const y = Math.floor(i / 4);
            const f = state.fincas.find((ff) => ff.x === x && ff.y === y);
            const fa = state.factories.find((ff) => ff.x === x && ff.y === y);
            const isSelected = f && selectedId === f.id;
            return (
              <motion.button
                key={i}
                whileHover={{ scale: 1.06, z: 12 }}
                onClick={() => f && onSelect(f)}
                className={`relative h-24 w-24 rounded-md border shadow-xl transition-all ${
                  f
                    ? f.type === "vid"
                      ? "border-[var(--vine)]/60"
                      : f.type === "olivo"
                      ? "border-[var(--olive)]/60"
                      : "border-[var(--walnut)]/60"
                    : "border-white/10"
                } ${isSelected ? "ring-2 ring-[var(--amber)] ring-offset-2 ring-offset-transparent" : ""}`}
                style={{
                  background: f
                    ? f.type === "vid"
                      ? "linear-gradient(135deg, oklch(0.45 0.2 20), oklch(0.3 0.15 15))"
                      : f.type === "olivo"
                      ? "linear-gradient(135deg, oklch(0.55 0.16 130), oklch(0.4 0.12 130))"
                      : "linear-gradient(135deg, oklch(0.5 0.1 60), oklch(0.35 0.08 55))"
                    : "linear-gradient(135deg, oklch(0.35 0.05 50), oklch(0.25 0.04 50))",
                }}
              >
                {f && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-2xl"
                    style={{ transform: "rotateZ(45deg) rotateX(-55deg)" }}>
                    <span className="drop-shadow-lg">{cropEmoji[f.type]}</span>
                    <span className="rounded bg-black/40 px-1.5 text-[10px] font-bold text-white backdrop-blur">{f.stock}</span>
                  </div>
                )}
                <AnimatePresence>
                  {fa && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.3, y: -20 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      transition={{ type: "spring", stiffness: 200, damping: 15 }}
                      className="absolute -top-3 -right-3 text-2xl drop-shadow-[0_0_8px_oklch(0.78_0.17_70_/_0.6)]"
                      style={{ transform: "rotateZ(45deg) rotateX(-55deg)" }}
                    >
                      {factoryEmoji[fa.type]}
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.button>
            );
          })}
        </div>

        {/* workers walking from finca to warehouse during harvest */}
        <AnimatePresence>
          {harvest && state.fincas.map((f, i) => (
            <motion.div
              key={`w-${f.id}-${state.mes}`}
              initial={{ opacity: 0, x: f.x * 100 - 200, y: f.y * 100 - 200 }}
              animate={{
                opacity: [0, 1, 1, 0],
                x: [f.x * 100 - 200, 0, 200, 250],
                y: [f.y * 100 - 200, 0, 0, -50],
              }}
              transition={{ duration: 6, delay: i * 0.4, repeat: Infinity, ease: "easeInOut" }}
              className="pointer-events-none absolute text-xl drop-shadow-lg"
              style={{ transform: "rotateZ(45deg) rotateX(-55deg)" }}
            >
              👷
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      <div className="absolute bottom-3 left-3 glass rounded-lg px-3 py-1.5 text-xs font-semibold">
        {harvest ? "🌞 Temporada de Cosecha" : "🍂 Fuera de cosecha"}
      </div>
      <div className="absolute bottom-3 right-3 glass rounded-lg px-3 py-1.5 text-xs">
        Capacidad: <b>{(state.trabajadoresPermanentes + state.trabajadoresGolondrina) * 200}</b>
      </div>
    </div>
  );
}
