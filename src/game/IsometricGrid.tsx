import { motion, AnimatePresence } from "framer-motion";
import { useState } from "react";
import { useGame, type Finca, type FactoryType } from "./GameContext";

const cropEmoji: Record<string, string> = { vid: "🍇", olivo: "🫒", nogal: "🌰" };
const factoryEmoji: Record<FactoryType, string> = { bodega: "🍷", almazara: "🛢️", nuez: "🏭" };

function rotPct(stock: number, capacidad: number) {
  if (capacidad <= 0) return 0;
  if (stock <= capacidad) return 0;
  return Math.min(1, (stock - capacidad) / Math.max(capacidad, 1));
}

export function IsometricGrid({ onSelect, selectedId }: { onSelect: (f: Finca) => void; selectedId?: string }) {
  const { state, dispatch, isHarvestMonth, factoryFor, factoryLabel } = useGame();
  const harvest = isHarvestMonth(state.mes);
  const capacidad = (state.trabajadoresPermanentes + state.trabajadoresGolondrina) * 200;
  const [dragType, setDragType] = useState<FactoryType | null>(null);
  const [hoverTile, setHoverTile] = useState<string | null>(null);
  const [invalidFlash, setInvalidFlash] = useState<string | null>(null);

  const totalWorkers = state.trabajadoresPermanentes + state.trabajadoresGolondrina;

  const handleDrop = (f: Finca, ftype: FactoryType) => {
    const expected = factoryFor[f.type];
    const occupied = state.factories.some((fa) => fa.x === f.x && fa.y === f.y);
    if (expected !== ftype || occupied || state.pesos < 1_500_000) {
      setInvalidFlash(f.id);
      setTimeout(() => setInvalidFlash(null), 600);
      return;
    }
    dispatch({ type: "PLACE_FACTORY", factoryType: ftype, fincaId: f.id });
  };

  return (
    <div className="space-y-3">
      {/* Construction palette */}
      <div className="glass flex flex-wrap items-center gap-3 rounded-2xl px-4 py-3">
        <div className="text-[11px] font-black uppercase tracking-wider text-[var(--amber)]">
          🛠️ Arrastrá para construir
        </div>
        {(["bodega", "almazara", "nuez"] as FactoryType[]).map((t) => (
          <motion.div
            key={t}
            draggable
            onDragStart={() => setDragType(t)}
            onDragEnd={() => { setDragType(null); setHoverTile(null); }}
            whileHover={{ scale: 1.04 }}
            whileTap={{ scale: 0.96 }}
            className={`flex cursor-grab select-none items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-xs backdrop-blur active:cursor-grabbing ${
              dragType === t ? "ring-2 ring-[var(--amber)]" : ""
            }`}
          >
            <span className="text-lg">{factoryEmoji[t]}</span>
            <div className="flex flex-col leading-tight">
              <span className="font-bold">{factoryLabel[t]}</span>
              <span className="text-[10px] text-muted-foreground">$1.500.000</span>
            </div>
          </motion.div>
        ))}
        <div className="ml-auto text-[10px] text-muted-foreground">
          Soltá sobre la finca compatible (vid→bodega · olivo→almazara · nogal→nuez)
        </div>
      </div>

      <div className="glass relative h-[480px] w-full overflow-hidden rounded-2xl">
        <div className="absolute inset-0 bg-gradient-to-b from-[oklch(0.22_0.06_265)] via-[oklch(0.18_0.05_260)] to-[oklch(0.10_0.03_265)] opacity-80" />
        <motion.div
          animate={{ scale: [1, 1.05, 1], opacity: [0.55, 0.8, 0.55] }}
          transition={{ duration: 6, repeat: Infinity }}
          className="absolute right-12 top-8 h-24 w-24 rounded-full bg-[var(--gold)] blur-2xl"
        />
        <div className="absolute inset-0 opacity-15" style={{
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
              const compatible = f && dragType && factoryFor[f.type] === dragType && !fa;
              const incompatible = f && dragType && (factoryFor[f.type] !== dragType || fa);
              const isHover = f && hoverTile === f.id;
              const rot = f ? rotPct(f.stock, capacidad) : 0;

              return (
                <motion.button
                  key={i}
                  whileHover={{ scale: 1.06, z: 12 }}
                  animate={invalidFlash === f?.id ? { x: [0, -4, 4, -4, 4, 0] } : {}}
                  onClick={() => f && onSelect(f)}
                  onDragOver={(e) => { if (f && dragType) { e.preventDefault(); setHoverTile(f.id); } }}
                  onDragLeave={() => setHoverTile((h) => (h === f?.id ? null : h))}
                  onDrop={(e) => { e.preventDefault(); if (f && dragType) handleDrop(f, dragType); setHoverTile(null); }}
                  className={`relative h-24 w-24 rounded-md border shadow-xl transition-all ${
                    f
                      ? f.type === "vid"
                        ? "border-[var(--vine)]/60"
                        : f.type === "olivo"
                        ? "border-[var(--olive)]/60"
                        : "border-[var(--walnut)]/60"
                      : "border-white/10"
                  } ${isSelected ? "ring-2 ring-[var(--amber)] ring-offset-2 ring-offset-transparent" : ""} ${
                    compatible && isHover ? "ring-4 ring-[var(--vine-green)]" : ""
                  } ${incompatible && isHover ? "ring-4 ring-destructive" : ""}`}
                  style={{
                    background: f
                      ? rot > 0
                        ? `linear-gradient(135deg, color-mix(in oklab, ${baseFor(f.type)} ${Math.round((1 - rot) * 100)}%, var(--rot)), color-mix(in oklab, ${baseDark(f.type)} ${Math.round((1 - rot) * 100)}%, var(--rot)))`
                        : `linear-gradient(135deg, ${baseFor(f.type)}, ${baseDark(f.type)})`
                      : "linear-gradient(135deg, oklch(0.25 0.04 260), oklch(0.18 0.03 260))",
                  }}
                >
                  {f && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-2xl"
                      style={{ transform: "rotateZ(45deg) rotateX(-55deg)" }}>
                      <span className="drop-shadow-lg">{rot > 0.4 ? "🥀" : cropEmoji[f.type]}</span>
                      <span className={`rounded px-1.5 text-[10px] font-bold backdrop-blur ${rot > 0 ? "bg-destructive/70 text-white" : "bg-black/40 text-white"}`}>
                        {f.stock}{rot > 0 ? " 💀" : ""}
                      </span>
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

          {/* Workers physically walking finca → warehouse during harvest */}
          <AnimatePresence>
            {harvest && totalWorkers > 0 && state.fincas.map((f, i) => {
              // up to N workers proportional to golondrina slider
              const n = Math.max(1, Math.min(6, Math.round(totalWorkers / 4)));
              return Array.from({ length: n }).map((_, k) => (
                <motion.div
                  key={`w-${f.id}-${k}-${state.mes}`}
                  initial={{ opacity: 0, x: f.x * 100 - 150, y: f.y * 100 - 150 }}
                  animate={{
                    opacity: [0, 1, 1, 1, 0],
                    x: [f.x * 100 - 150, f.x * 100 - 150, 220, 220, 220],
                    y: [f.y * 100 - 150, f.y * 100 - 150, -120, -120, -150],
                  }}
                  transition={{ duration: 5, delay: i * 0.5 + k * 0.25, repeat: Infinity, ease: "easeInOut" }}
                  className="pointer-events-none absolute text-xl drop-shadow-lg"
                  style={{ transform: "rotateZ(45deg) rotateX(-55deg)" }}
                >
                  👷
                </motion.div>
              ));
            })}
          </AnimatePresence>
        </div>

        <div className="absolute bottom-3 left-3 glass rounded-lg px-3 py-1.5 text-xs font-semibold">
          {harvest ? "🌞 Temporada de Cosecha" : "🍂 Fuera de cosecha"}
        </div>
        <div className="absolute bottom-3 right-3 glass rounded-lg px-3 py-1.5 text-xs">
          Capacidad: <b>{capacidad}</b> · Trab: <b>{totalWorkers}</b>
        </div>
      </div>
    </div>
  );
}

function baseFor(t: string) {
  return t === "vid" ? "oklch(0.45 0.2 20)" : t === "olivo" ? "oklch(0.55 0.16 130)" : "oklch(0.5 0.1 60)";
}
function baseDark(t: string) {
  return t === "vid" ? "oklch(0.3 0.15 15)" : t === "olivo" ? "oklch(0.4 0.12 130)" : "oklch(0.35 0.08 55)";
}
