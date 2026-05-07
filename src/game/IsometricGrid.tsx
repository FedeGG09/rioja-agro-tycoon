import { motion, AnimatePresence } from "framer-motion";
import { memo, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
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

// Preload + decode all sprites once at module load
const ALL_SPRITES = [tileVid, tileOlivo, tileNogal, tileEmpty, buildBodega, buildAlmazara, buildNuez];
if (typeof window !== "undefined") {
  ALL_SPRITES.forEach((src) => {
    const img = new Image();
    img.decoding = "async";
    img.src = src;
    // best-effort decode
    img.decode?.().catch(() => {});
  });
}

function rotPct(stock: number, capacidad: number) {
  if (capacidad <= 0 || stock <= capacidad) return 0;
  return Math.min(1, (stock - capacidad) / Math.max(capacidad, 1));
}

const TILE_W = 128;
const TILE_H = 74;
const GRID = 4;
const BOARD_W = GRID * TILE_W;
const BOARD_H = GRID * TILE_H + 160;

function isoPos(x: number, y: number) {
  return {
    left: (x - y) * (TILE_W / 2) + (GRID * TILE_W) / 2,
    top: (x + y) * (TILE_H / 2) + 30,
  };
}
const WAREHOUSE = isoPos(3.5, -0.6);

export function IsometricGrid({ onSelect, selectedId }: { onSelect: (f: Finca) => void; selectedId?: string }) {
  const { state, dispatch, isHarvestMonth, factoryFor, factoryLabel } = useGame();
  const harvest = isHarvestMonth(state.mes);
  const capacidad = (state.trabajadoresPermanentes + state.trabajadoresGolondrina) * 200;
  const totalWorkers = state.trabajadoresPermanentes + state.trabajadoresGolondrina;

  // Drag state — kept minimal in React; ghost moves via ref/rAF
  const [dragType, setDragType] = useState<FactoryType | null>(null);
  const [hoverTile, setHoverTile] = useState<string | null>(null);
  const [invalidFlash, setInvalidFlash] = useState<string | null>(null);

  const ghostRef = useRef<HTMLDivElement>(null);
  const dragTypeRef = useRef<FactoryType | null>(null);
  const lastPosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const rafRef = useRef<number | null>(null);
  const hoverRef = useRef<string | null>(null);

  // Responsive scale — fit board within container width
  const wrapRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  useLayoutEffect(() => {
    if (!wrapRef.current) return;
    const el = wrapRef.current;
    const ro = new ResizeObserver(() => {
      const w = el.clientWidth - 24; // padding
      const h = el.clientHeight - 24;
      const s = Math.min(1, Math.min(w / BOARD_W, h / BOARD_H));
      setScale(Math.max(0.45, s));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Board height adapts to viewport
  const boardHeight = Math.max(360, Math.min(560, BOARD_H * scale + 80));

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

  // Pointer-based unified drag (mouse + touch). Move ghost via direct DOM, batch hover via rAF.
  useEffect(() => {
    if (!dragType) return;
    dragTypeRef.current = dragType;

    const flush = () => {
      rafRef.current = null;
      const { x, y } = lastPosRef.current;
      if (ghostRef.current) {
        ghostRef.current.style.transform = `translate3d(${x - 32}px, ${y - 32}px, 0)`;
      }
      const el = document.elementFromPoint(x, y) as HTMLElement | null;
      const tileEl = el?.closest("[data-tile-id]") as HTMLElement | null;
      const tid = tileEl?.dataset.tileId ?? null;
      if (tid !== hoverRef.current) {
        hoverRef.current = tid;
        setHoverTile(tid);
      }
    };

    const move = (e: PointerEvent) => {
      lastPosRef.current = { x: e.clientX, y: e.clientY };
      if (rafRef.current == null) rafRef.current = requestAnimationFrame(flush);
    };
    const up = (e: PointerEvent) => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      const el = document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null;
      const tileEl = el?.closest("[data-tile-id]") as HTMLElement | null;
      const tid = tileEl?.dataset.tileId;
      if (tid) {
        const f = state.fincas.find((ff) => ff.id === tid);
        if (f && dragTypeRef.current) tryPlace(f, dragTypeRef.current);
      }
      setDragType(null);
      setHoverTile(null);
      hoverRef.current = null;
    };

    window.addEventListener("pointermove", move, { passive: true });
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dragType]);

  const startDrag = (e: React.PointerEvent, t: FactoryType) => {
    e.preventDefault();
    lastPosRef.current = { x: e.clientX, y: e.clientY };
    setDragType(t);
  };

  // Memoized tile lookup
  const fincaByXY = useMemo(() => {
    const m = new Map<string, Finca>();
    state.fincas.forEach((f) => m.set(`${f.x},${f.y}`, f));
    return m;
  }, [state.fincas]);
  const factoryByXY = useMemo(() => {
    const m = new Map<string, (typeof state.factories)[number]>();
    state.factories.forEach((f) => m.set(`${f.x},${f.y}`, f));
    return m;
  }, [state.factories]);

  return (
    <div className="space-y-3">
      {/* Construction palette */}
      <div className="glass flex flex-wrap items-center gap-2 rounded-2xl px-3 py-2 sm:gap-3 sm:px-4 sm:py-3">
        <div className="text-[11px] font-black uppercase tracking-wider text-[var(--amber)]">
          🛠️ Arrastrá para construir
        </div>
        {(["bodega", "almazara", "nuez"] as FactoryType[]).map((t) => (
          <motion.div
            key={t}
            onPointerDown={(e) => startDrag(e, t)}
            whileHover={{ scale: 1.04 }}
            whileTap={{ scale: 0.96 }}
            className={`flex cursor-grab select-none items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-2 py-1 text-xs backdrop-blur active:cursor-grabbing sm:px-3 sm:py-1.5 ${
              dragType === t ? "ring-2 ring-[var(--amber)]" : ""
            }`}
            style={{ touchAction: "none" }}
          >
            <img src={factoryImg[t]} alt="" width={32} height={32} decoding="async" className="h-8 w-8 object-contain drop-shadow" />
            <div className="flex flex-col leading-tight">
              <span className="font-bold">{factoryLabel[t]}</span>
              <span className="text-[10px] text-muted-foreground">$1.500.000</span>
            </div>
          </motion.div>
        ))}
        <div className="hidden text-[10px] text-muted-foreground sm:ml-auto sm:block">
          vid→bodega · olivo→almazara · nogal→nuez
        </div>
      </div>

      <div
        ref={wrapRef}
        className="glass relative w-full overflow-hidden rounded-2xl"
        style={{ height: boardHeight, touchAction: "none" }}
      >
        {/* Background */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse at 30% 0%, oklch(0.55 0.14 230 / 0.35), transparent 60%), radial-gradient(ellipse at 70% 100%, oklch(0.45 0.18 35 / 0.25), transparent 65%)",
          }}
        />
        <motion.div
          animate={{ scale: [1, 1.05, 1], opacity: [0.45, 0.7, 0.45] }}
          transition={{ duration: 6, repeat: Infinity }}
          className="pointer-events-none absolute right-8 top-6 h-24 w-24 rounded-full bg-[var(--gold)] blur-3xl"
        />

        {/* Scaled iso board */}
        <div
          className="absolute left-1/2 top-1/2"
          style={{
            width: BOARD_W,
            height: BOARD_H,
            transform: `translate(-50%, -50%) scale(${scale})`,
            transformOrigin: "center",
            willChange: "transform",
          }}
        >
          {Array.from({ length: GRID * GRID }).map((_, i) => {
            const x = i % GRID;
            const y = Math.floor(i / GRID);
            const f = fincaByXY.get(`${x},${y}`);
            const fa = factoryByXY.get(`${x},${y}`);
            const isSelected = !!(f && selectedId === f.id);
            const compatible = !!(f && dragType && factoryFor[f.type] === dragType && !fa);
            const incompatible = !!(f && dragType && (factoryFor[f.type] !== dragType || fa));
            const isHover = !!(f && hoverTile === f.id);
            const rot = f ? rotPct(f.stock, capacidad) : 0;
            const pos = isoPos(x, y);
            const z = x + y;

            return (
              <Tile
                key={i}
                pos={pos}
                z={z}
                finca={f}
                factory={fa}
                rot={rot}
                isSelected={isSelected}
                compatible={compatible}
                incompatible={incompatible}
                isHover={isHover}
                shake={invalidFlash === f?.id}
                onSelect={onSelect}
              />
            );
          })}

          {/* Warehouse marker */}
          <div
            className="pointer-events-none absolute"
            style={{ left: WAREHOUSE.left - 24, top: WAREHOUSE.top - 24, zIndex: 100 }}
          >
            <div className="glass rounded-lg px-2 py-1 text-[10px] font-bold">🏚️ Almacén</div>
          </div>

          {/* Workers walking */}
          <AnimatePresence>
            {harvest && totalWorkers > 0 &&
              state.fincas.map((f, i) => {
                const n = Math.max(1, Math.min(4, Math.round(totalWorkers / 6)));
                const from = isoPos(f.x, f.y);
                return Array.from({ length: n }).map((_, k) => (
                  <motion.div
                    key={`w-${f.id}-${k}-${state.mes}`}
                    initial={{ opacity: 0, x: from.left + 40, y: from.top + 10 }}
                    animate={{
                      opacity: [0, 1, 1, 1, 0],
                      x: [from.left + 40, from.left + 40, WAREHOUSE.left, WAREHOUSE.left, WAREHOUSE.left],
                      y: [from.top + 10, from.top + 10, WAREHOUSE.top + 10, WAREHOUSE.top + 10, WAREHOUSE.top - 10],
                    }}
                    transition={{ duration: 5, delay: i * 0.4 + k * 0.25, repeat: Infinity, ease: "easeInOut" }}
                    className="pointer-events-none absolute left-0 top-0 text-lg drop-shadow-lg"
                    style={{ zIndex: 200, willChange: "transform" }}
                  >
                    👷
                  </motion.div>
                ));
              })}
          </AnimatePresence>
        </div>

        <div className="glass absolute bottom-2 left-2 rounded-lg px-2 py-1 text-[10px] font-semibold sm:bottom-3 sm:left-3 sm:px-3 sm:py-1.5 sm:text-xs">
          {harvest ? "🌞 Cosecha" : "🍂 Fuera"}
        </div>
        <div className="glass absolute bottom-2 right-2 rounded-lg px-2 py-1 text-[10px] sm:bottom-3 sm:right-3 sm:px-3 sm:py-1.5 sm:text-xs">
          Cap: <b>{capacidad}</b> · Trab: <b>{totalWorkers}</b>
        </div>
      </div>

      {/* Floating drag ghost — moved via direct DOM (no re-render per pointer event) */}
      {dragType && (
        <div
          ref={ghostRef}
          className="pointer-events-none fixed left-0 top-0 z-[9999]"
          style={{ willChange: "transform", transform: `translate3d(${lastPosRef.current.x - 32}px, ${lastPosRef.current.y - 32}px, 0)` }}
        >
          <img
            src={factoryImg[dragType]}
            alt=""
            width={64}
            height={64}
            decoding="async"
            className="h-16 w-16 object-contain drop-shadow-[0_8px_16px_rgba(0,0,0,0.6)]"
          />
        </div>
      )}
    </div>
  );
}

// ─── Tile (memoized) ──────────────────────────────────────────────────────────

interface TileProps {
  pos: { left: number; top: number };
  z: number;
  finca?: Finca;
  factory?: { id: string; type: FactoryType; x: number; y: number; processed: number };
  rot: number;
  isSelected: boolean;
  compatible: boolean;
  incompatible: boolean;
  isHover: boolean;
  shake: boolean;
  onSelect: (f: Finca) => void;
}

const Tile = memo(function Tile({
  pos, z, finca: f, factory: fa, rot, isSelected, compatible, incompatible, isHover, shake, onSelect,
}: TileProps) {
  const ringColor = incompatible && isHover
    ? "oklch(0.62 0.24 25)"
    : compatible && isHover
    ? "var(--vine-green)"
    : "var(--amber)";
  const showRing = isSelected || (compatible && isHover) || (incompatible && isHover);

  return (
    <motion.div
      data-tile-id={f?.id}
      onClick={() => f && onSelect(f)}
      animate={shake ? { x: [0, -4, 4, -4, 4, 0] } : { x: 0 }}
      className="absolute cursor-pointer"
      style={{ left: pos.left, top: pos.top, width: TILE_W, height: TILE_H * 2, zIndex: z }}
    >
      <img
        src={f ? tileImg[f.type] : tileEmpty}
        alt=""
        width={TILE_W + 6}
        height={TILE_W + 6}
        decoding="async"
        draggable={false}
        className="pointer-events-none absolute -top-6 left-0 select-none"
        style={{
          width: TILE_W + 6,
          height: TILE_W + 6,
          filter:
            rot > 0
              ? `hue-rotate(-30deg) saturate(${1 - rot * 0.6}) brightness(${1 - rot * 0.3}) sepia(${rot * 0.6})`
              : isSelected
              ? "drop-shadow(0 0 12px var(--amber))"
              : "drop-shadow(0 6px 8px rgba(0,0,0,0.45))",
        }}
      />
      {showRing && (
        <div
          className="pointer-events-none absolute"
          style={{
            left: 0,
            top: TILE_H / 2,
            width: TILE_W,
            height: TILE_H,
            transform: "rotateX(60deg) rotateZ(45deg)",
            border: `3px solid ${ringColor}`,
            borderRadius: 6,
            boxShadow: `0 0 16px ${ringColor}`,
          }}
        />
      )}
      {f && (
        <div className="pointer-events-none absolute left-1/2 top-2 -translate-x-1/2">
          <span
            className={`rounded-full px-2 py-0.5 text-[10px] font-bold backdrop-blur ${
              rot > 0 ? "bg-destructive/80 text-white" : "bg-black/55 text-white"
            }`}
          >
            {rot > 0.4 ? "🥀 " : ""}
            {f.stock}
            {rot > 0 ? " 💀" : ""}
          </span>
        </div>
      )}
      <AnimatePresence>
        {fa && (
          <motion.img
            initial={{ opacity: 0, scale: 0.4, y: -30 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.5 }}
            transition={{ type: "spring", stiffness: 220, damping: 16 }}
            src={factoryImg[fa.type]}
            alt=""
            draggable={false}
            decoding="async"
            className="pointer-events-none absolute select-none"
            style={{
              left: TILE_W * 0.18,
              top: -TILE_H * 0.6,
              width: TILE_W * 0.78,
              height: TILE_W * 0.78,
              filter: "drop-shadow(0 8px 10px rgba(0,0,0,0.55))",
              willChange: "transform",
            }}
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
});
