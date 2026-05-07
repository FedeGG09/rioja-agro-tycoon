import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { useGame, type Finca, type FactoryType } from "./GameContext";
import tileVid from "@/assets/tile-vid.png";
import tileOlivo from "@/assets/tile-olivo.png";
import tileNogal from "@/assets/tile-nogal.png";
import tileEmpty from "@/assets/tile-empty.png";
import buildBodega from "@/assets/build-bodega.png";
import buildAlmazara from "@/assets/build-almazara.png";
import buildNuez from "@/assets/build-nuez.png";

const tileImg: Record<string, string> = { vid: tileVid, olivo: tileOlivo, nogal: tileNogal };
const factoryImg: Record<FactoryType, string> = { bodega: buildBodega, almazara: buildAlmazara, nuez: buildNuez };
const factoryEmoji: Record<FactoryType, string> = { bodega: "🍷", almazara: "🛢️", nuez: "🏭" };

function rotPct(stock: number, capacidad: number) {
  if (capacidad <= 0) return 0;
  if (stock <= capacidad) return 0;
  return Math.min(1, (stock - capacidad) / Math.max(capacidad, 1));
}

const TILE_W = 128;
const TILE_H = 74;
const GRID = 4;

export function IsometricGrid({ onSelect, selectedId }: { onSelect: (f: Finca) => void; selectedId?: string }) {
  const { state, dispatch, isHarvestMonth, factoryFor, factoryLabel } = useGame();
  const harvest = isHarvestMonth(state.mes);
  const capacidad = (state.trabajadoresPermanentes + state.trabajadoresGolondrina) * 200;
  const totalWorkers = state.trabajadoresPermanentes + state.trabajadoresGolondrina;

  const [drag, setDrag] = useState<{ type: FactoryType; x: number; y: number } | null>(null);
  const [hoverTile, setHoverTile] = useState<string | null>(null);
  const [invalidFlash, setInvalidFlash] = useState<string | null>(null);
  const boardRef = useRef<HTMLDivElement>(null);

  // Pointer-based unified drag (mouse + touch)
  useEffect(() => {
    if (!drag) return;
    const move = (e: PointerEvent) => {
      setDrag((d) => (d ? { ...d, x: e.clientX, y: e.clientY } : d));
      const el = document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null;
      const tileEl = el?.closest("[data-tile-id]") as HTMLElement | null;
      setHoverTile(tileEl?.dataset.tileId ?? null);
    };
    const up = (e: PointerEvent) => {
      const el = document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null;
      const tileEl = el?.closest("[data-tile-id]") as HTMLElement | null;
      const tid = tileEl?.dataset.tileId;
      if (tid) {
        const f = state.fincas.find((ff) => ff.id === tid);
        if (f) tryPlace(f, drag.type);
      }
      setDrag(null);
      setHoverTile(null);
    };
    window.addEventListener("pointermove", move, { passive: false });
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drag, state.fincas]);

  const tryPlace = (f: Finca, ftype: FactoryType) => {
    const expected = factoryFor[f.type];
    const occupied = state.factories.some((fa) => fa.x === f.x && fa.y === f.y);
    if (expected !== ftype || occupied || state.pesos < 1_500_000) {
      setInvalidFlash(f.id);
      setTimeout(() => setInvalidFlash(null), 600);
      return;
    }
    dispatch({ type: "PLACE_FACTORY", factoryType: ftype, fincaId: f.id });
  };

  const startDrag = (e: React.PointerEvent, t: FactoryType) => {
    e.preventDefault();
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    setDrag({ type: t, x: e.clientX, y: e.clientY });
  };

  // Isometric coords
  const isoPos = (x: number, y: number) => ({
    left: (x - y) * (TILE_W / 2) + GRID * TILE_W / 2,
    top: (x + y) * (TILE_H / 2) + 30,
  });

  // Worker positions in iso space
  const warehouse = { x: 3.5, y: -0.6 };
  const wPos = isoPos(warehouse.x, warehouse.y);

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
            onPointerDown={(e) => startDrag(e, t)}
            whileHover={{ scale: 1.04 }}
            whileTap={{ scale: 0.96 }}
            className={`flex cursor-grab touch-none select-none items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-xs backdrop-blur active:cursor-grabbing ${
              drag?.type === t ? "ring-2 ring-[var(--amber)]" : ""
            }`}
            style={{ touchAction: "none" }}
          >
            <img src={factoryImg[t]} alt={factoryLabel[t]} width={36} height={36} className="h-9 w-9 object-contain drop-shadow" loading="lazy" />
            <div className="flex flex-col leading-tight">
              <span className="font-bold">{factoryLabel[t]}</span>
              <span className="text-[10px] text-muted-foreground">$1.500.000</span>
            </div>
          </motion.div>
        ))}
        <div className="ml-auto text-[10px] text-muted-foreground">
          vid→bodega · olivo→almazara · nogal→nuez
        </div>
      </div>

      <div ref={boardRef} className="glass relative h-[520px] w-full overflow-hidden rounded-2xl">
        {/* Sky / ground gradient */}
        <div className="absolute inset-0" style={{
          background: "radial-gradient(ellipse at 30% 0%, oklch(0.55 0.14 230 / 0.35), transparent 60%), radial-gradient(ellipse at 70% 100%, oklch(0.45 0.18 35 / 0.25), transparent 65%)",
        }} />
        <motion.div
          animate={{ scale: [1, 1.05, 1], opacity: [0.45, 0.7, 0.45] }}
          transition={{ duration: 6, repeat: Infinity }}
          className="absolute right-12 top-8 h-28 w-28 rounded-full bg-[var(--gold)] blur-3xl"
        />

        {/* Iso board */}
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2" style={{ width: GRID * TILE_W, height: GRID * TILE_H + 120 }}>
          {Array.from({ length: GRID * GRID }).map((_, i) => {
            const x = i % GRID;
            const y = Math.floor(i / GRID);
            const f = state.fincas.find((ff) => ff.x === x && ff.y === y);
            const fa = state.factories.find((ff) => ff.x === x && ff.y === y);
            const isSelected = f && selectedId === f.id;
            const compatible = f && drag && factoryFor[f.type] === drag.type && !fa;
            const incompatible = f && drag && (factoryFor[f.type] !== drag.type || fa);
            const isHover = f && hoverTile === f.id;
            const rot = f ? rotPct(f.stock, capacidad) : 0;
            const pos = isoPos(x, y);
            const z = x + y;

            return (
              <motion.div
                key={i}
                data-tile-id={f?.id}
                onClick={() => f && onSelect(f)}
                animate={invalidFlash === f?.id ? { x: [pos.left, pos.left - 4, pos.left + 4, pos.left] } : {}}
                whileHover={f ? { y: pos.top - 4 } : {}}
                className="absolute cursor-pointer"
                style={{ left: pos.left, top: pos.top, width: TILE_W, height: TILE_H * 2, zIndex: z }}
              >
                {/* Tile image */}
                <img
                  src={f ? tileImg[f.type] : tileEmpty}
                  alt={f ? f.type : "empty"}
                  width={TILE_W}
                  height={TILE_W}
                  loading="lazy"
                  draggable={false}
                  className="pointer-events-none absolute -top-6 left-0 select-none"
                  style={{
                    width: TILE_W + 6,
                    height: TILE_W + 6,
                    filter: rot > 0
                      ? `hue-rotate(-30deg) saturate(${1 - rot * 0.6}) brightness(${1 - rot * 0.3}) sepia(${rot * 0.6})`
                      : isSelected
                      ? "drop-shadow(0 0 12px var(--amber))"
                      : "drop-shadow(0 6px 8px rgba(0,0,0,0.45))",
                  }}
                />
                {/* Highlight ring */}
                {(isSelected || (compatible && isHover) || (incompatible && isHover)) && (
                  <div
                    className="pointer-events-none absolute"
                    style={{
                      left: 0, top: TILE_H / 2,
                      width: TILE_W, height: TILE_H,
                      transform: "rotateX(60deg) rotateZ(45deg)",
                      transformOrigin: "center",
                      border: `3px solid ${
                        incompatible && isHover ? "oklch(0.62 0.24 25)" :
                        compatible && isHover ? "var(--vine-green)" :
                        "var(--amber)"
                      }`,
                      borderRadius: 6,
                      boxShadow: `0 0 16px ${incompatible && isHover ? "oklch(0.62 0.24 25)" : compatible && isHover ? "var(--vine-green)" : "var(--amber)"}`,
                    }}
                  />
                )}
                {/* Stock badge */}
                {f && (
                  <div className="pointer-events-none absolute left-1/2 top-2 -translate-x-1/2">
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold backdrop-blur ${rot > 0 ? "bg-destructive/80 text-white" : "bg-black/55 text-white"}`}>
                      {rot > 0.4 ? "🥀 " : ""}{f.stock}{rot > 0 ? " 💀" : ""}
                    </span>
                  </div>
                )}
                {/* Factory building */}
                <AnimatePresence>
                  {fa && (
                    <motion.img
                      initial={{ opacity: 0, scale: 0.4, y: -30 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.5 }}
                      transition={{ type: "spring", stiffness: 220, damping: 16 }}
                      src={factoryImg[fa.type]}
                      alt={fa.type}
                      draggable={false}
                      className="pointer-events-none absolute select-none"
                      style={{ left: TILE_W * 0.18, top: -TILE_H * 0.6, width: TILE_W * 0.78, height: TILE_W * 0.78, filter: "drop-shadow(0 8px 10px rgba(0,0,0,0.55))" }}
                    />
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}

          {/* Warehouse marker */}
          <div className="pointer-events-none absolute" style={{ left: wPos.left - 20, top: wPos.top - 20, zIndex: 100 }}>
            <div className="glass rounded-lg px-2 py-1 text-[10px] font-bold">🏚️ Almacén</div>
          </div>

          {/* Workers physically walking finca → warehouse */}
          <AnimatePresence>
            {harvest && totalWorkers > 0 && state.fincas.map((f, i) => {
              const n = Math.max(1, Math.min(5, Math.round(totalWorkers / 5)));
              const from = isoPos(f.x, f.y);
              return Array.from({ length: n }).map((_, k) => (
                <motion.div
                  key={`w-${f.id}-${k}-${state.mes}`}
                  initial={{ opacity: 0, left: from.left + 40, top: from.top + 10 }}
                  animate={{
                    opacity: [0, 1, 1, 1, 0],
                    left: [from.left + 40, from.left + 40, wPos.left, wPos.left, wPos.left],
                    top: [from.top + 10, from.top + 10, wPos.top + 10, wPos.top + 10, wPos.top - 10],
                  }}
                  transition={{ duration: 5, delay: i * 0.4 + k * 0.2, repeat: Infinity, ease: "easeInOut" }}
                  className="pointer-events-none absolute text-lg drop-shadow-lg"
                  style={{ zIndex: 200 }}
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

      {/* Floating drag ghost */}
      {drag && (
        <div
          className="pointer-events-none fixed z-[9999]"
          style={{ left: drag.x - 32, top: drag.y - 32 }}
        >
          <img src={factoryImg[drag.type]} alt="" width={64} height={64} className="h-16 w-16 object-contain drop-shadow-[0_8px_16px_rgba(0,0,0,0.6)]" />
        </div>
      )}
    </div>
  );
}
