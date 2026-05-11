import { motion, AnimatePresence } from "framer-motion";
import { memo, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useGame, INFRA_INFO, type Finca, type FactoryType, type InfraType } from "./GameContext";
import { parcelCost, isBuildable, computeRoadNetwork, isConnected, MAP_SIZE, CENTER } from "./MapEngine";
import { ZoomIn, ZoomOut, Maximize2, Move, Lock, Mountain, Waves, X, Construction } from "lucide-react";
import tileVid from "@/assets/tile-vid.png";
import tileOlivo from "@/assets/tile-olivo.png";
import tileNogal from "@/assets/tile-nogal.png";
import tileEmpty from "@/assets/tile-empty.png";
import buildBodega from "@/assets/build-bodega.png";
import buildAlmazara from "@/assets/build-almazara.png";
import buildNuez from "@/assets/build-nuez.png";
import buildWarehouse from "@/assets/build-warehouse.png";
import buildVivienda1 from "@/assets/build-vivienda1.png";
import buildVivienda2 from "@/assets/build-vivienda2.png";
import buildVivienda3 from "@/assets/build-vivienda3.png";
import buildComedor from "@/assets/build-comedor.png";
import buildSalud from "@/assets/build-salud.png";
import buildPozo from "@/assets/build-pozo.png";

const tileImg: Record<string, string> = { vid: tileVid, olivo: tileOlivo, nogal: tileNogal };
const factoryImg: Record<FactoryType, string> = { bodega: buildBodega, almazara: buildAlmazara, nuez: buildNuez };
const infraImg: Record<InfraType, string> = {
  vivienda1: buildVivienda1,
  vivienda2: buildVivienda2,
  vivienda3: buildVivienda3,
  comedor: buildComedor,
  salud: buildSalud,
  pozo: buildPozo,
};

const ALL_SPRITES = [tileVid, tileOlivo, tileNogal, tileEmpty, buildBodega, buildAlmazara, buildNuez, buildWarehouse,
  buildVivienda1, buildVivienda2, buildVivienda3, buildComedor, buildSalud, buildPozo];
if (typeof window !== "undefined") {
  ALL_SPRITES.forEach((src) => {
    const img = new Image();
    img.decoding = "async";
    img.src = src;
    img.decode?.().catch(() => {});
  });
}

const TILE_W = 96;
const TILE_H = 56;
const BOARD_W = MAP_SIZE * TILE_W + 200;
const BOARD_H = MAP_SIZE * TILE_H + 280;

function isoPos(x: number, y: number) {
  return {
    left: (x - y) * (TILE_W / 2) + (MAP_SIZE * TILE_W) / 2 + 100,
    top: (x + y) * (TILE_H / 2) + 60,
  };
}
const WAREHOUSE = isoPos(CENTER.x, CENTER.y);

function rotPct(stock: number, capacidad: number) {
  if (capacidad <= 0 || stock <= capacidad) return 0;
  return Math.min(1, (stock - capacidad) / Math.max(capacidad, 1));
}

type Tool =
  | { kind: "factory"; type: FactoryType }
  | { kind: "infra"; type: InfraType }
  | { kind: "buy" }
  | { kind: "road" }
  | null;

export function IsometricGrid({ onSelect, selectedId }: { onSelect: (f: Finca) => void; selectedId?: string }) {
  const { state, dispatch, isHarvestMonth, factoryFor } = useGame();
  const harvest = isHarvestMonth(state.mes);
  const capacidad = (state.trabajadoresPermanentes + state.trabajadoresGolondrina) * 200;
  const totalWorkers = state.trabajadoresPermanentes + state.trabajadoresGolondrina;

  const [tool, setTool] = useState<Tool>(null);
  const [flash, setFlash] = useState<string | null>(null);

  // Camera
  const [zoom, setZoom] = useState(0.7);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const panDragRef = useRef<{ startX: number; startY: number; baseX: number; baseY: number; moved: boolean } | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [fitScale, setFitScale] = useState(0.4);

  useLayoutEffect(() => {
    if (!wrapRef.current) return;
    const el = wrapRef.current;
    const ro = new ResizeObserver(() => {
      const w = el.clientWidth - 24;
      const h = el.clientHeight - 24;
      const s = Math.min(1, Math.min(w / BOARD_W, h / BOARD_H));
      setFitScale(Math.max(0.3, s));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const totalScale = fitScale * zoom;
  const boardHeight = 540;

  const paintedRef = useRef<Set<string>>(new Set());

  const onClickCell = (x: number, y: number) => {
    const cell = state.map[y]?.[x];
    if (!cell) return;
    if (tool?.kind === "road") {
      const k = `${x},${y}`;
      if (paintedRef.current.has(k)) return;
      paintedRef.current.add(k);
      if (cell.owned && cell.terrain === "plain") {
        dispatch({ type: "TOGGLE_ROAD", x, y });
      } else {
        setFlash(k);
        setTimeout(() => setFlash(null), 500);
      }
      return;
    }
    if (!cell.owned) {
      if (tool?.kind === "buy") {
        dispatch({ type: "BUY_PARCEL", x, y });
      } else {
        // Open modal-lite: auto-select buy mode
        setTool({ kind: "buy" });
      }
      return;
    }
    // Owned cell
    if (cell.terrain === "cerro" || cell.terrain === "rio" || cell.terrain === "piedra") {
      setFlash(`${x},${y}`);
      setTimeout(() => setFlash(null), 600);
      return;
    }
    const f = state.fincas.find((ff) => ff.x === x && ff.y === y);
    const fa = state.factories.find((ff) => ff.x === x && ff.y === y);
    const inf = state.infra.find((ii) => ii.x === x && ii.y === y);

    if (tool?.kind === "factory") {
      if (f && !fa && factoryFor[f.type] === tool.type && state.pesos >= 1_500_000) {
        dispatch({ type: "PLACE_FACTORY", factoryType: tool.type, fincaId: f.id });
      } else {
        setFlash(`${x},${y}`);
        setTimeout(() => setFlash(null), 600);
      }
      return;
    }
    if (tool?.kind === "infra") {
      if (!f && !fa && !inf && state.pesos >= INFRA_INFO[tool.type].cost) {
        dispatch({ type: "PLACE_INFRA", infraType: tool.type, x, y });
      } else {
        setFlash(`${x},${y}`);
        setTimeout(() => setFlash(null), 600);
      }
      return;
    }
    if (f) onSelect(f);
  };

  // Pan (disabled in road mode so the user can paint freely)
  const onPanStart = (e: React.PointerEvent) => {
    if (tool?.kind === "road") {
      paintedRef.current = new Set();
      return;
    }
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
  const onPanEnd = () => { panDragRef.current = null; };
  const onWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    setZoom((z) => Math.max(0.4, Math.min(3.5, z - e.deltaY * 0.001)));
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
  const infraByXY = useMemo(() => {
    const m = new Map<string, (typeof state.infra)[number]>();
    state.infra.forEach((b) => m.set(`${b.x},${b.y}`, b));
    return m;
  }, [state.infra]);
  const reach = useMemo(() => computeRoadNetwork(state.map), [state.map]);
  const hasAnyRoad = reach.size > 1;

  return (
    <div className="space-y-3">
      <BuildToolbar tool={tool} setTool={setTool} pesos={state.pesos} />

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
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse at 25% 0%, oklch(0.55 0.16 240 / 0.4), transparent 60%), radial-gradient(ellipse at 70% 100%, oklch(0.55 0.18 35 / 0.35), transparent 65%), linear-gradient(180deg, oklch(0.18 0.04 260) 0%, oklch(0.14 0.05 30) 100%)",
          }}
        />
        <motion.div
          animate={{ scale: [1, 1.05, 1], opacity: [0.5, 0.75, 0.5] }}
          transition={{ duration: 6, repeat: Infinity }}
          className="pointer-events-none absolute right-12 top-8 h-32 w-32 rounded-full bg-[var(--gold)] blur-3xl"
        />

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
          {/* All cells */}
          {state.map.map((row, y) => row.map((cell, x) => {
            const f = fincaByXY.get(`${x},${y}`);
            const fa = factoryByXY.get(`${x},${y}`);
            const inf = infraByXY.get(`${x},${y}`);
            const pos = isoPos(x, y);
            const z = (x + y) * 10;
            const isSelected = !!(f && selectedId === f.id);
            const rot = f ? rotPct(f.stock, capacidad) : 0;
            const flashing = flash === `${x},${y}`;
            const connected = (f || fa) ? (hasAnyRoad ? isConnected(x, y, reach) : true) : true;

            // Highlight valid targets for active tool
            let validTarget = false;
            let invalidTarget = false;
            if (tool && cell.owned && cell.terrain === "plain") {
              if (tool.kind === "factory") {
                validTarget = !!(f && !fa && factoryFor[f.type] === tool.type);
                invalidTarget = !validTarget;
              } else if (tool.kind === "infra") {
                validTarget = !f && !fa && !inf;
                invalidTarget = !validTarget;
              } else if (tool.kind === "road") {
                validTarget = !cell.road;
                invalidTarget = false;
              }
            }
            if (tool?.kind === "buy" && !cell.owned) validTarget = true;

            return (
              <Cell
                key={`${x},${y}`}
                cell={cell}
                pos={pos}
                z={z}
                finca={f}
                factory={fa}
                infra={inf}
                isSelected={isSelected}
                rot={rot}
                flashing={flashing}
                validTarget={validTarget}
                invalidTarget={invalidTarget}
                connected={connected}
                onClick={() => onClickCell(x, y)}
              />
            );
          }))}

          {/* Warehouse en CENTER */}
          <div
            className="pointer-events-none absolute"
            style={{
              left: WAREHOUSE.left - TILE_W * 0.5,
              top: WAREHOUSE.top - TILE_W * 0.5,
              width: TILE_W,
              height: TILE_W,
              zIndex: 800,
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
            <div className="glass absolute -top-1 left-1/2 -translate-x-1/2 rounded-md px-1.5 py-0.5 text-[10px] font-bold whitespace-nowrap">
              🏚️ Almacén
            </div>
          </div>

          {/* Trabajadores hacia almacén durante cosecha */}
          <AnimatePresence>
            {!state.huelga && harvest && totalWorkers > 0 && state.fincas.map((f, i) => {
              const n = Math.max(1, Math.min(3, Math.round(totalWorkers / 8)));
              const from = isoPos(f.x, f.y);
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
                  className="pointer-events-none absolute left-0 top-0 text-base drop-shadow-lg"
                  style={{ zIndex: 600, willChange: "transform" }}
                >
                  👷
                </motion.div>
              ));
            })}
          </AnimatePresence>
        </div>

        {/* HUD interno */}
        <div className="glass absolute bottom-2 left-2 rounded-lg px-2 py-1 text-[10px] font-semibold sm:px-3 sm:py-1.5 sm:text-xs z-[800]">
          {harvest ? "🌞 Cosecha" : "🍂 Fuera"} · 20×20 · Mapa Riojano
        </div>
        <div className="glass absolute bottom-2 right-2 rounded-lg px-2 py-1 text-[10px] sm:px-3 sm:py-1.5 sm:text-xs z-[800]">
          Cap: <b>{capacidad}</b> · Trab: <b>{totalWorkers}</b>
        </div>

        <div className="glass absolute right-2 top-2 flex flex-col gap-1 rounded-xl p-1 z-[800]">
          <button onClick={() => setZoom((z) => Math.min(3.5, z + 0.2))} className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-white/10" title="Zoom +">
            <ZoomIn size={14} />
          </button>
          <button onClick={() => setZoom((z) => Math.max(0.4, z - 0.2))} className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-white/10" title="Zoom -">
            <ZoomOut size={14} />
          </button>
          <button onClick={() => { setZoom(0.7); setPan({ x: 0, y: 0 }); }} className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-white/10" title="Reset">
            <Maximize2 size={14} />
          </button>
        </div>
        <div className="glass absolute left-2 top-2 flex items-center gap-1 rounded-lg px-2 py-1 text-[10px] text-muted-foreground z-[800]">
          <Move size={11} /> Arrastrá · rueda para zoom
        </div>

        {tool && (
          <div className="glass absolute left-1/2 top-2 -translate-x-1/2 flex items-center gap-2 rounded-xl px-3 py-1.5 text-xs z-[850]">
            <span className="font-bold text-[var(--amber)]">
              {tool.kind === "buy" ? "💰 Comprando parcela" :
               tool.kind === "road" ? "🛣️ Trazando camino (arrastrá)" :
               tool.kind === "factory" ? `🏭 Colocando fábrica` :
               tool.kind === "infra" ? `${INFRA_INFO[tool.type].icon} Colocando ${INFRA_INFO[tool.type].name}` : ""}
            </span>
            <button onClick={() => setTool(null)} className="rounded-md p-0.5 hover:bg-white/10"><X size={12} /></button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── BuildToolbar ────────────────────────────────────────────────
function BuildToolbar({ tool, setTool, pesos }: { tool: Tool; setTool: (t: Tool) => void; pesos: number }) {
  const items: Array<{ kind: "factory" | "infra" | "buy"; key: string; label: string; icon: string; cost: number; tone: string }> = [
    { kind: "buy", key: "buy", label: "Comprar parcela", icon: "💰", cost: 0, tone: "amber" },
    { kind: "infra", key: "vivienda1", label: "Campamento", icon: "⛺", cost: 800_000, tone: "vine" },
    { kind: "infra", key: "vivienda2", label: "Casas Finca", icon: "🏡", cost: 3_000_000, tone: "vine" },
    { kind: "infra", key: "vivienda3", label: "Barrio Pro", icon: "🏘️", cost: 10_000_000, tone: "vine" },
    { kind: "infra", key: "comedor", label: "Comedor", icon: "🍲", cost: 1_500_000, tone: "amber" },
    { kind: "infra", key: "salud", label: "Salud", icon: "⛑️", cost: 4_000_000, tone: "amber" },
    { kind: "infra", key: "pozo", label: "Pozo Agua", icon: "💧", cost: 2_000_000, tone: "vine" },
    { kind: "factory", key: "bodega", label: "Bodega", icon: "🍷", cost: 1_500_000, tone: "terra" },
    { kind: "factory", key: "almazara", label: "Almazara", icon: "🫒", cost: 1_500_000, tone: "terra" },
    { kind: "factory", key: "nuez", label: "Nuez", icon: "🌰", cost: 1_500_000, tone: "terra" },
  ];
  const isActive = (k: string) =>
    (tool?.kind === "buy" && k === "buy") ||
    (tool?.kind === "factory" && tool.type === k) ||
    (tool?.kind === "infra" && tool.type === k);
  return (
    <div className="glass flex flex-wrap items-center gap-1.5 rounded-2xl px-2 py-2">
      <div className="text-[10px] font-black uppercase tracking-wider text-[var(--amber)] mr-1">🛠️ Construir</div>
      {items.map((it) => {
        const tooExpensive = pesos < it.cost;
        return (
          <button
            key={it.key}
            onClick={() => {
              if (isActive(it.key)) setTool(null);
              else if (it.kind === "buy") setTool({ kind: "buy" });
              else if (it.kind === "factory") setTool({ kind: "factory", type: it.key as FactoryType });
              else setTool({ kind: "infra", type: it.key as InfraType });
            }}
            disabled={tooExpensive && it.cost > 0}
            className={`flex items-center gap-1 rounded-xl border px-2 py-1 text-[10px] font-bold transition disabled:opacity-30 ${
              isActive(it.key)
                ? "border-[var(--amber)] bg-[var(--amber)]/15 text-[var(--amber)] ring-1 ring-[var(--amber)]"
                : "border-white/10 bg-white/5 hover:bg-white/10"
            }`}
          >
            <span className="text-base">{it.icon}</span>
            <div className="flex flex-col items-start leading-tight">
              <span>{it.label}</span>
              {it.cost > 0 && <span className="text-[9px] text-muted-foreground tabular-nums">${(it.cost / 1_000_000).toFixed(it.cost < 1_000_000 ? 2 : 1)}M</span>}
            </div>
          </button>
        );
      })}
    </div>
  );
}

// ─── Cell ────────────────────────────────────────────────────────
interface CellProps {
  cell: { x: number; y: number; terrain: string; elevation: number; owned: boolean };
  pos: { left: number; top: number };
  z: number;
  finca?: Finca;
  factory?: { id: string; type: FactoryType; x: number; y: number; processed: number };
  infra?: { id: string; type: InfraType; x: number; y: number };
  isSelected: boolean;
  rot: number;
  flashing: boolean;
  validTarget: boolean;
  invalidTarget: boolean;
  onClick: () => void;
}

const Cell = memo(function Cell({
  cell, pos, z, finca: f, factory: fa, infra: inf, isSelected, rot, flashing, validTarget, invalidTarget, onClick,
}: CellProps) {
  const elevation = cell.terrain === "cerro" ? cell.elevation * 8 : 0;

  // Terrain tile body (CSS rhombus) for non-plain terrain
  const renderTerrainBody = () => {
    if (cell.terrain === "plain") {
      if (f) {
        return (
          <img
            src={tileImg[f.type]}
            alt=""
            width={TILE_W + 4}
            height={TILE_W + 4}
            decoding="async"
            draggable={false}
            className="pointer-events-none absolute -top-6 left-0 select-none"
            style={{
              width: TILE_W + 4,
              height: TILE_W + 4,
              filter: rot > 0
                ? `hue-rotate(-30deg) saturate(${1 - rot * 0.6}) brightness(${1 - rot * 0.3}) sepia(${rot * 0.6})`
                : isSelected ? "drop-shadow(0 0 12px var(--amber))" : "drop-shadow(0 6px 8px rgba(0,0,0,0.5))",
            }}
          />
        );
      }
      // Empty owned plain
      return (
        <img
          src={tileEmpty}
          alt=""
          width={TILE_W + 4}
          height={TILE_W + 4}
          decoding="async"
          draggable={false}
          className="pointer-events-none absolute -top-6 left-0 select-none opacity-90"
          style={{ width: TILE_W + 4, height: TILE_W + 4, filter: "drop-shadow(0 4px 6px rgba(0,0,0,0.4))" }}
        />
      );
    }
    // Stylized terrain via CSS
    const palette: Record<string, string> = {
      cerro: "linear-gradient(135deg, oklch(0.45 0.04 50), oklch(0.32 0.04 40))",
      rio: "linear-gradient(135deg, oklch(0.55 0.13 235), oklch(0.4 0.1 230))",
      piedra: "linear-gradient(135deg, oklch(0.55 0.02 280), oklch(0.4 0.02 280))",
    };
    return (
      <div
        className="pointer-events-none absolute"
        style={{
          left: 2,
          top: TILE_H * 0.5 - elevation,
          width: TILE_W - 4,
          height: TILE_H,
          transform: "rotateX(60deg) rotateZ(45deg)",
          background: palette[cell.terrain] || palette.piedra,
          borderRadius: 4,
          boxShadow: cell.terrain === "cerro"
            ? "0 8px 14px rgba(0,0,0,0.6), inset 0 1px 0 oklch(1 0 0 / 0.08)"
            : "inset 0 1px 0 oklch(1 0 0 / 0.05), 0 2px 4px rgba(0,0,0,0.4)",
        }}
      />
    );
  };

  const lockOverlay = !cell.owned && (
    <div
      className="pointer-events-none absolute"
      style={{
        left: 2,
        top: TILE_H * 0.5,
        width: TILE_W - 4,
        height: TILE_H,
        transform: "rotateX(60deg) rotateZ(45deg)",
        background: "repeating-linear-gradient(45deg, oklch(0 0 0 / 0.55) 0 6px, oklch(0 0 0 / 0.25) 6px 12px)",
        borderRadius: 4,
        border: "1px dashed oklch(1 0 0 / 0.2)",
      }}
    />
  );

  const showRing = isSelected || validTarget || invalidTarget;
  const ringColor = invalidTarget ? "oklch(0.62 0.24 25)" : validTarget ? "var(--vine-green)" : "var(--amber)";

  return (
    <motion.div
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      animate={flashing ? { x: [0, -3, 3, -3, 3, 0] } : { x: 0 }}
      whileHover={cell.owned && cell.terrain === "plain" ? { y: -4, transition: { type: "spring", stiffness: 280, damping: 18 } } : undefined}
      className="absolute cursor-pointer"
      style={{ left: pos.left - TILE_W / 2, top: pos.top, width: TILE_W, height: TILE_H * 2.2, zIndex: z }}
    >
      {renderTerrainBody()}
      {lockOverlay}

      {/* Terrain icons */}
      {cell.terrain === "cerro" && (
        <div className="pointer-events-none absolute" style={{ left: TILE_W * 0.32, top: TILE_H * 0.1 - elevation, fontSize: 24 }}>
          <Mountain size={28} className="text-stone-300/80 drop-shadow" />
        </div>
      )}
      {cell.terrain === "rio" && (
        <div className="pointer-events-none absolute" style={{ left: TILE_W * 0.35, top: TILE_H * 0.45 }}>
          <Waves size={20} className="text-sky-300/90 drop-shadow" />
        </div>
      )}
      {cell.terrain === "piedra" && (
        <div className="pointer-events-none absolute select-none" style={{ left: TILE_W * 0.35, top: TILE_H * 0.45, fontSize: 20 }}>🪨</div>
      )}

      {showRing && (
        <div
          className="pointer-events-none absolute"
          style={{
            left: 2,
            top: TILE_H * 0.5,
            width: TILE_W - 4,
            height: TILE_H,
            transform: "rotateX(60deg) rotateZ(45deg)",
            border: `2px solid ${ringColor}`,
            borderRadius: 6,
            boxShadow: `0 0 10px ${ringColor}`,
          }}
        />
      )}

      {/* Lock + cost label for not-owned */}
      {!cell.owned && (
        <div className="pointer-events-none absolute left-1/2 top-0 -translate-x-1/2 z-10">
          <span className="flex items-center gap-1 rounded-full bg-black/70 px-1.5 py-0.5 text-[9px] font-bold text-white">
            <Lock size={9} /> ${(parcelCost(cell.x, cell.y) / 1_000_000).toFixed(1)}M
          </span>
        </div>
      )}

      {/* Finca label */}
      {f && (
        <div className="pointer-events-none absolute left-1/2 -top-1 -translate-x-1/2 z-10">
          <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-bold ${rot > 0 ? "bg-destructive/80 text-white" : "bg-black/60 text-white"}`}>
            {f.name} · {f.stock}{rot > 0 ? " 💀" : ""}
          </span>
        </div>
      )}

      {/* Factory sprite */}
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
              left: TILE_W * 0.1,
              top: -TILE_H * 0.55,
              width: TILE_W * 0.85,
              height: TILE_W * 0.85,
              filter: "drop-shadow(0 8px 10px rgba(0,0,0,0.6))",
            }}
          />
        )}
      </AnimatePresence>

      {/* Infra: emoji + label */}
      {inf && (
        <div className="pointer-events-none absolute left-1/2 -translate-x-1/2 select-none" style={{ top: -TILE_H * 0.4 }}>
          <div className="text-3xl drop-shadow-[0_6px_8px_rgba(0,0,0,0.6)]">{INFRA_INFO[inf.type].icon}</div>
          <div className="absolute left-1/2 top-[110%] -translate-x-1/2 whitespace-nowrap rounded-md bg-black/65 px-1 py-[1px] text-[8px] font-bold text-white">
            {INFRA_INFO[inf.type].name}
          </div>
        </div>
      )}

      {/* Coverage radius hint when infra selected (only for water/comedor/salud) */}
      {inf && (inf.type === "pozo" || inf.type === "comedor" || inf.type === "salud") && (
        <div
          className="pointer-events-none absolute rounded-full"
          style={{
            left: TILE_W * 0.5 - (INFRA_INFO[inf.type].radius || 3) * TILE_W * 0.5,
            top: TILE_H * 0.5 - (INFRA_INFO[inf.type].radius || 3) * TILE_H * 0.5,
            width: (INFRA_INFO[inf.type].radius || 3) * TILE_W,
            height: (INFRA_INFO[inf.type].radius || 3) * TILE_H,
            border: `1px dashed ${inf.type === "pozo" ? "oklch(0.7 0.15 230)" : inf.type === "comedor" ? "var(--amber)" : "var(--vine-green)"}`,
            opacity: 0.25,
            transform: "rotateX(60deg) rotateZ(45deg)",
          }}
        />
      )}
    </motion.div>
  );
});
