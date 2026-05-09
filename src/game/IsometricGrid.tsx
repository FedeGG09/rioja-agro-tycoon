import { motion, AnimatePresence } from "framer-motion";
import { memo, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useGame, type Finca, type FactoryType } from "./GameContext";
import { ZoomIn, ZoomOut, Maximize2, Move } from "lucide-react";
import tileVid from "@/assets/tile-vid.png";
import tileOlivo from "@/assets/tile-olivo.png";
import tileNogal from "@/assets/tile-nogal.png";
import tileEmpty from "@/assets/tile-empty.png";
import buildBodega from "@/assets/build-bodega.png";
import buildAlmazara from "@/assets/build-almazara.png";
import buildNuez from "@/assets/build-nuez.png";
import buildWarehouse from "@/assets/build-warehouse.png";
import vehTractor from "@/assets/vehicle-tractor.png";
import vehHilux from "@/assets/vehicle-hilux.png";
import vehTank from "@/assets/vehicle-tank.png";

const tileImg: Record<string, string> = { vid: tileVid, olivo: tileOlivo, nogal: tileNogal };
const factoryImg: Record<FactoryType, string> = { bodega: buildBodega, almazara: buildAlmazara, nuez: buildNuez };

const ALL_SPRITES = [tileVid, tileOlivo, tileNogal, tileEmpty, buildBodega, buildAlmazara, buildNuez, buildWarehouse, vehTractor, vehHilux, vehTank];
if (typeof window !== "undefined") {
  ALL_SPRITES.forEach((src) => {
    const img = new Image();
    img.decoding = "async";
    img.src = src;
    img.decode?.().catch(() => {});
  });
}

// Vegetación decorativa del Valle riojano (jarilla, algarrobo, piedras)
const DECOR = ["🌵", "🪨", "🌿", "🌾", "🪵", "🌳"] as const;

function rotPct(stock: number, capacidad: number) {
  if (capacidad <= 0 || stock <= capacidad) return 0;
  return Math.min(1, (stock - capacidad) / Math.max(capacidad, 1));
}

const TILE_W = 168;
const TILE_H = 96;
const GRID = 5;
const BOARD_W = GRID * TILE_W + 200;
const BOARD_H = GRID * TILE_H + 280;
const WAREHOUSE_GRID = { x: -1, y: 2 };

function isoPos(x: number, y: number) {
  return {
    left: (x - y) * (TILE_W / 2) + (GRID * TILE_W) / 2 + 100,
    top: (x + y) * (TILE_H / 2) + 60,
  };
}
const WAREHOUSE = isoPos(WAREHOUSE_GRID.x, WAREHOUSE_GRID.y);

function buildRoadSet(fincas: Finca[]): Set<string> {
  const roads = new Set<string>();
  const wx = WAREHOUSE_GRID.x;
  const wy = WAREHOUSE_GRID.y;
  for (const f of fincas) {
    // horizontal segment along y=wy
    const [x0, x1] = wx < f.x ? [wx + 1, f.x] : [f.x + 1, wx];
    for (let x = x0; x <= x1; x++) {
      if (!(x === f.x && wy === f.y)) roads.add(`${x},${wy}`);
    }
    // vertical from wy to f.y at column f.x
    const [y0, y1] = wy < f.y ? [wy + 1, f.y] : [f.y + 1, wy];
    for (let y = y0; y <= y1; y++) {
      if (!(f.x === f.x && y === f.y)) roads.add(`${f.x},${y}`);
    }
    roads.delete(`${f.x},${f.y}`);
  }
  return roads;
}

export function IsometricGrid({ onSelect, selectedId }: { onSelect: (f: Finca) => void; selectedId?: string }) {
  const { state, dispatch, isHarvestMonth, factoryFor, factoryLabel } = useGame();
  const harvest = isHarvestMonth(state.mes);
  const capacidad = (state.trabajadoresPermanentes + state.trabajadoresGolondrina) * 200;
  const totalWorkers = state.trabajadoresPermanentes + state.trabajadoresGolondrina;

  const [dragType, setDragType] = useState<FactoryType | null>(null);
  const [hoverTile, setHoverTile] = useState<string | null>(null);
  const [invalidFlash, setInvalidFlash] = useState<string | null>(null);

  const ghostRef = useRef<HTMLDivElement>(null);
  const dragTypeRef = useRef<FactoryType | null>(null);
  const lastPosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const rafRef = useRef<number | null>(null);
  const hoverRef = useRef<string | null>(null);

  // Camera (zoom + pan)
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const panDragRef = useRef<{ startX: number; startY: number; baseX: number; baseY: number; moved: boolean } | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [fitScale, setFitScale] = useState(1);

  useLayoutEffect(() => {
    if (!wrapRef.current) return;
    const el = wrapRef.current;
    const ro = new ResizeObserver(() => {
      const w = el.clientWidth - 24;
      const h = el.clientHeight - 24;
      const s = Math.min(1, Math.min(w / BOARD_W, h / BOARD_H));
      setFitScale(Math.max(0.45, s));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const totalScale = fitScale * zoom;
  const boardHeight = Math.max(420, Math.min(680, BOARD_H * fitScale + 80));

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
      if (ghostRef.current) ghostRef.current.style.transform = `translate3d(${x - 40}px, ${y - 40}px, 0)`;
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

  // Pan handlers (on background only)
  const onPanStart = (e: React.PointerEvent) => {
    if (dragType) return;
    panDragRef.current = { startX: e.clientX, startY: e.clientY, baseX: pan.x, baseY: pan.y, moved: false };
  };
  const onPanMove = (e: React.PointerEvent) => {
    const p = panDragRef.current;
    if (!p) return;
    const dx = e.clientX - p.startX;
    const dy = e.clientY - p.startY;
    if (Math.abs(dx) > 4 || Math.abs(dy) > 4) p.moved = true;
    setPan({ x: p.baseX + dx, y: p.baseY + dy });
  };
  const onPanEnd = () => {
    panDragRef.current = null;
  };

  // Wheel zoom
  const onWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    setZoom((z) => Math.max(0.5, Math.min(2, z - e.deltaY * 0.001)));
  };

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

  const roads = useMemo(() => buildRoadSet(state.fincas), [state.fincas]);

  // Vehículos: tractores (1 por finca activa, 2 si mecanización)
  const tractorsPerFinca = state.tech.mecanizacion ? 2 : 1;

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
        onWheel={onWheel}
        onPointerDown={onPanStart}
        onPointerMove={onPanMove}
        onPointerUp={onPanEnd}
        onPointerCancel={onPanEnd}
      >
        {/* Background — atardecer riojano */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse at 25% 0%, oklch(0.55 0.16 240 / 0.4), transparent 60%), radial-gradient(ellipse at 70% 100%, oklch(0.55 0.18 35 / 0.35), transparent 65%), linear-gradient(180deg, oklch(0.18 0.04 260) 0%, oklch(0.14 0.05 30) 100%)",
          }}
        />
        {/* Sol */}
        <motion.div
          animate={{ scale: [1, 1.05, 1], opacity: [0.5, 0.75, 0.5] }}
          transition={{ duration: 6, repeat: Infinity }}
          className="pointer-events-none absolute right-12 top-8 h-32 w-32 rounded-full bg-[var(--gold)] blur-3xl"
        />

        {/* Camera transform */}
        <div
          className="absolute left-1/2 top-1/2"
          style={{
            width: BOARD_W,
            height: BOARD_H,
            transform: `translate(-50%, -50%) translate3d(${pan.x}px, ${pan.y}px, 0) scale(${totalScale})`,
            transformOrigin: "center",
            willChange: "transform",
          }}
        >
          {/* Roads layer (debajo de tiles) */}
          {Array.from(roads).map((key) => {
            const [x, y] = key.split(",").map(Number);
            const pos = isoPos(x, y);
            return <Road key={`r-${key}`} pos={pos} />;
          })}

          {/* Tiles */}
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
            const z = (x + y) * 10;
            const showWaterDrip = !!(f && state.tech.riego && (f.type === "vid" || f.type === "olivo"));

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
                showWaterDrip={showWaterDrip}
                hasTank={!!(f && state.tech.riego)}
                tractorCount={f && harvest ? tractorsPerFinca : 0}
                hasDrones={!!(f && state.tech.drones)}
                onSelect={onSelect}
              />
            );
          })}

          {/* Warehouse */}
          <div
            className="pointer-events-none absolute"
            style={{
              left: WAREHOUSE.left - TILE_W * 0.5,
              top: WAREHOUSE.top - TILE_W * 0.45,
              width: TILE_W,
              height: TILE_W,
              zIndex: 500,
            }}
          >
            <img
              src={buildWarehouse}
              alt="Almacén central"
              width={TILE_W}
              height={TILE_W}
              decoding="async"
              draggable={false}
              className="h-full w-full select-none object-contain"
              style={{ filter: "drop-shadow(0 12px 14px rgba(0,0,0,0.65))" }}
            />
            <img
              src={vehHilux}
              alt=""
              width={56}
              height={56}
              decoding="async"
              draggable={false}
              className="absolute h-14 w-14 select-none object-contain"
              style={{ left: TILE_W * 0.55, top: TILE_W * 0.62, filter: "drop-shadow(0 4px 6px rgba(0,0,0,0.5))" }}
            />
            <div className="glass absolute -top-2 left-1/2 -translate-x-1/2 rounded-md px-1.5 py-0.5 text-[10px] font-bold whitespace-nowrap">
              🏚️ Almacén
            </div>
          </div>

          {/* Trabajadores: en huelga estáticos con warning, sino caminando hacia almacén */}
          <AnimatePresence>
            {totalWorkers > 0 && state.fincas.map((f, i) => {
              const n = Math.max(1, Math.min(4, Math.round(totalWorkers / 6)));
              const from = isoPos(f.x, f.y);
              if (state.huelga) {
                return (
                  <motion.div
                    key={`huelga-${f.id}`}
                    initial={{ opacity: 0, scale: 0.6 }}
                    animate={{ opacity: 1, scale: 1, y: [0, -3, 0] }}
                    transition={{ y: { duration: 1.4, repeat: Infinity }, opacity: { duration: 0.4 } }}
                    className="pointer-events-none absolute text-2xl drop-shadow-lg"
                    style={{ left: from.left - 12, top: from.top + 8, zIndex: 600 }}
                  >
                    <span className="relative">
                      👷
                      <span className="absolute -right-3 -top-2 rounded-full bg-destructive px-1 text-[10px] font-black text-white">⚠</span>
                    </span>
                  </motion.div>
                );
              }
              if (!harvest) return null;
              return Array.from({ length: n }).map((_, k) => (
                <motion.div
                  key={`w-${f.id}-${k}-${state.mes}`}
                  initial={{ opacity: 0, x: from.left, y: from.top }}
                  animate={{
                    opacity: [0, 1, 1, 1, 0],
                    x: [from.left, from.left, WAREHOUSE.left, WAREHOUSE.left, WAREHOUSE.left],
                    y: [from.top, from.top, WAREHOUSE.top, WAREHOUSE.top, WAREHOUSE.top - 14],
                  }}
                  transition={{ duration: 6, delay: i * 0.4 + k * 0.3, repeat: Infinity, ease: "easeInOut" }}
                  className="pointer-events-none absolute left-0 top-0 text-xl drop-shadow-lg"
                  style={{ zIndex: 600, willChange: "transform" }}
                >
                  👷
                </motion.div>
              ));
            })}
          </AnimatePresence>

          {/* Cajones de procesado: almacén → fábrica continuo */}
          <AnimatePresence>
            {!state.huelga && state.factories.map((fa, i) => {
              const to = isoPos(fa.x, fa.y);
              return (
                <motion.div
                  key={`cargo-${fa.id}`}
                  initial={{ opacity: 0 }}
                  animate={{
                    opacity: [0, 1, 1, 0],
                    x: [WAREHOUSE.left, WAREHOUSE.left, to.left, to.left],
                    y: [WAREHOUSE.top, WAREHOUSE.top, to.top, to.top],
                  }}
                  transition={{ duration: 5, delay: i * 0.7, repeat: Infinity, ease: "linear" }}
                  className="pointer-events-none absolute left-0 top-0 text-base drop-shadow-lg"
                  style={{ zIndex: 605, willChange: "transform" }}
                >
                  📦
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>

        {/* HUD interno */}
        <div className="glass absolute bottom-2 left-2 rounded-lg px-2 py-1 text-[10px] font-semibold sm:bottom-3 sm:left-3 sm:px-3 sm:py-1.5 sm:text-xs z-[800]">
          {harvest ? "🌞 Cosecha" : "🍂 Fuera"}
        </div>
        <div className="glass absolute bottom-2 right-2 rounded-lg px-2 py-1 text-[10px] sm:bottom-3 sm:right-3 sm:px-3 sm:py-1.5 sm:text-xs z-[800]">
          Cap: <b>{capacidad}</b> · Trab: <b>{totalWorkers}</b>
        </div>

        {/* Camera controls */}
        <div className="glass absolute right-2 top-2 flex flex-col gap-1 rounded-xl p-1 z-[800]">
          <button
            onClick={() => setZoom((z) => Math.min(2, z + 0.15))}
            className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-white/10"
            title="Zoom +"
          >
            <ZoomIn size={14} />
          </button>
          <button
            onClick={() => setZoom((z) => Math.max(0.5, z - 0.15))}
            className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-white/10"
            title="Zoom -"
          >
            <ZoomOut size={14} />
          </button>
          <button
            onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); }}
            className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-white/10"
            title="Reset"
          >
            <Maximize2 size={14} />
          </button>
        </div>
        <div className="glass absolute left-2 top-2 flex items-center gap-1 rounded-lg px-2 py-1 text-[10px] text-muted-foreground z-[800]">
          <Move size={11} /> Arrastrá para mover · rueda para zoom
        </div>
      </div>

      {/* Drag ghost */}
      {dragType && (
        <div
          ref={ghostRef}
          className="pointer-events-none fixed left-0 top-0 z-[9999]"
          style={{ willChange: "transform", transform: `translate3d(${lastPosRef.current.x - 40}px, ${lastPosRef.current.y - 40}px, 0)` }}
        >
          <img
            src={factoryImg[dragType]}
            alt=""
            width={80}
            height={80}
            decoding="async"
            className="h-20 w-20 object-contain drop-shadow-[0_8px_16px_rgba(0,0,0,0.6)]"
          />
        </div>
      )}
    </div>
  );
}

// ─── Road tile ──────────────────────────────────────────────────────────
const Road = memo(function Road({ pos }: { pos: { left: number; top: number } }) {
  return (
    <div
      className="pointer-events-none absolute"
      style={{
        left: pos.left - TILE_W / 2,
        top: pos.top + TILE_H * 0.25,
        width: TILE_W,
        height: TILE_H,
        zIndex: 1,
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: "20% 10%",
          background: "linear-gradient(135deg, oklch(0.42 0.06 50), oklch(0.36 0.05 45))",
          transform: "rotateX(60deg) rotateZ(45deg)",
          borderRadius: 2,
          boxShadow: "inset 0 1px 0 oklch(1 0 0 / 0.05), 0 2px 6px rgba(0,0,0,0.4)",
        }}
      />
    </div>
  );
});

// ─── Tile ──────────────────────────────────────────────────────────
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
  showWaterDrip: boolean;
  hasTank: boolean;
  tractorCount: number;
  hasDrones: boolean;
  onSelect: (f: Finca) => void;
}

const Tile = memo(function Tile({
  pos, z, finca: f, factory: fa, rot, isSelected, compatible, incompatible, isHover, shake,
  showWaterDrip, hasTank, tractorCount, hasDrones, onSelect,
}: TileProps) {
  const ringColor = incompatible && isHover ? "oklch(0.62 0.24 25)" : compatible && isHover ? "var(--vine-green)" : "var(--amber)";
  const showRing = isSelected || (compatible && isHover) || (incompatible && isHover);

  const decoration = !f ? DECOR[((pos.left * 7 + pos.top * 13) | 0) % DECOR.length] : null;
  return (
    <motion.div
      data-tile-id={f?.id}
      onClick={(e) => { e.stopPropagation(); if (f) onSelect(f); }}
      animate={shake ? { x: [0, -4, 4, -4, 4, 0] } : { x: 0 }}
      whileHover={f ? { y: -6, transition: { type: "spring", stiffness: 280, damping: 18 } } : undefined}
      className="absolute cursor-pointer"
      style={{ left: pos.left - TILE_W / 2, top: pos.top, width: TILE_W, height: TILE_H * 2.5, zIndex: z }}
    >
      <img
        src={f ? tileImg[f.type] : tileEmpty}
        alt=""
        width={TILE_W + 8}
        height={TILE_W + 8}
        decoding="async"
        draggable={false}
        className="pointer-events-none absolute -top-8 left-0 select-none"
        style={{
          width: TILE_W + 8,
          height: TILE_W + 8,
          filter:
            rot > 0
              ? `hue-rotate(-30deg) saturate(${1 - rot * 0.6}) brightness(${1 - rot * 0.3}) sepia(${rot * 0.6})`
              : isSelected
              ? "drop-shadow(0 0 12px var(--amber))"
              : "drop-shadow(0 8px 10px rgba(0,0,0,0.5))",
        }}
      />

      {/* Vegetación decorativa en celdas vacías (jarilla, algarrobo, piedra) */}
      {decoration && (
        <div
          className="pointer-events-none absolute select-none text-2xl"
          style={{ left: TILE_W * 0.32, top: TILE_H * 0.55, opacity: 0.85, filter: "drop-shadow(0 4px 4px rgba(0,0,0,0.5))" }}
        >
          {decoration}
        </div>
      )}
      {/* Riego: overlay azul */}
      {showWaterDrip && (
        <div
          className="pointer-events-none absolute"
          style={{
            left: TILE_W * 0.1,
            top: TILE_H * 0.45,
            width: TILE_W * 0.8,
            height: TILE_H * 0.5,
            background: "repeating-linear-gradient(45deg, oklch(0.7 0.15 230 / 0.4) 0 2px, transparent 2px 14px)",
            transform: "rotateX(60deg) rotateZ(45deg)",
            borderRadius: 4,
            mixBlendMode: "screen",
          }}
        />
      )}

      {/* Tanque australiano */}
      {hasTank && (
        <img
          src={vehTank}
          alt=""
          width={48}
          height={48}
          decoding="async"
          draggable={false}
          className="pointer-events-none absolute select-none"
          style={{ left: TILE_W * 0.05, top: TILE_H * 0.1, filter: "drop-shadow(0 3px 4px rgba(0,0,0,0.5))" }}
        />
      )}

      {/* Tractores recorriendo surcos */}
      {Array.from({ length: tractorCount }).map((_, i) => (
        <motion.img
          key={`tr-${i}`}
          src={vehTractor}
          alt=""
          width={56}
          height={56}
          decoding="async"
          draggable={false}
          className="pointer-events-none absolute select-none"
          initial={{ x: 0, y: 0 }}
          animate={{
            x: [TILE_W * 0.15, TILE_W * 0.55, TILE_W * 0.55, TILE_W * 0.15, TILE_W * 0.15],
            y: [TILE_H * 0.55, TILE_H * 0.55, TILE_H * 1.0, TILE_H * 1.0, TILE_H * 0.55],
          }}
          transition={{ duration: 8, repeat: Infinity, ease: "linear", delay: i * 2 }}
          style={{ width: 56, height: 56, filter: "drop-shadow(0 3px 4px rgba(0,0,0,0.5))" }}
        />
      ))}

      {/* Drones */}
      {hasDrones && (
        <motion.div
          className="pointer-events-none absolute text-xl"
          animate={{
            x: [TILE_W * 0.2, TILE_W * 0.6, TILE_W * 0.4, TILE_W * 0.2],
            y: [TILE_H * 0.2, TILE_H * 0.4, TILE_H * 0.6, TILE_H * 0.2],
          }}
          transition={{ duration: 6, repeat: Infinity, ease: "linear" }}
          style={{ filter: "drop-shadow(0 3px 4px rgba(0,0,0,0.5))" }}
        >
          🛸
        </motion.div>
      )}

      {showRing && (
        <div
          className="pointer-events-none absolute"
          style={{
            left: 0,
            top: TILE_H * 0.5,
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
        <div className="pointer-events-none absolute left-1/2 -top-2 -translate-x-1/2 z-10">
          <span
            className={`rounded-full px-2 py-0.5 text-[10px] font-bold backdrop-blur ${
              rot > 0 ? "bg-destructive/80 text-white" : "bg-black/60 text-white"
            }`}
          >
            {rot > 0.4 ? "🥀 " : ""}
            {f.name} · {f.stock}
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
              left: TILE_W * 0.15,
              top: -TILE_H * 0.7,
              width: TILE_W * 0.85,
              height: TILE_W * 0.85,
              filter: "drop-shadow(0 10px 12px rgba(0,0,0,0.6))",
              willChange: "transform",
            }}
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
});
