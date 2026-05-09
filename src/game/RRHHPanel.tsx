import { motion } from "framer-motion";
import { useGame, fmtPesos } from "./GameContext";
import { Users, UserPlus, UserMinus, RefreshCw, Star, AlertTriangle } from "lucide-react";

export function RRHHPanel() {
  const { state, dispatch } = useGame();
  const permanentes = state.personalContratado.filter((w) => w.tipo === "permanente");
  const golondrinas = state.personalContratado.filter((w) => w.tipo === "golondrina");
  const costoMensual = state.personalContratado.reduce((s, w) => s + w.salario, 0);
  const insuficiente = costoMensual > state.pesos;

  return (
    <div className="space-y-3">
      <div className={`glass rounded-xl p-3 ${insuficiente ? "ring-1 ring-destructive/60" : ""}`}>
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Costo operativo proyectado</div>
        <div className={`text-lg font-black tabular-nums ${insuficiente ? "text-destructive" : "text-[var(--amber)]"}`}>
          {fmtPesos(costoMensual)} <span className="text-[10px] font-normal text-muted-foreground">/ mes</span>
        </div>
        <div className="mt-1 grid grid-cols-2 gap-2 text-[10px]">
          <div className="rounded-md bg-white/5 px-2 py-1">
            <div className="text-muted-foreground">Permanentes</div>
            <div className="font-bold text-[var(--vine-green)]">{permanentes.length}</div>
          </div>
          <div className="rounded-md bg-white/5 px-2 py-1">
            <div className="text-muted-foreground">Golondrinas</div>
            <div className="font-bold text-[var(--amber)]">{golondrinas.length}</div>
          </div>
        </div>
        {insuficiente && (
          <div className="mt-2 flex items-center gap-1 rounded-md bg-destructive/15 px-2 py-1 text-[10px] font-bold text-destructive">
            <AlertTriangle size={11} /> Pesos insuficientes para pagar planilla — moral colapsará el próximo mes.
          </div>
        )}
      </div>

      <div className="flex items-center justify-between">
        <div className="text-[11px] font-black uppercase tracking-wider text-[var(--amber)] flex items-center gap-1.5">
          <Users size={13} /> Personal Disponible
        </div>
        <button
          onClick={() => dispatch({ type: "REFRESH_POOL" })}
          className="flex items-center gap-1 rounded-lg bg-white/5 px-2 py-1 text-[10px] hover:bg-white/10"
        >
          <RefreshCw size={10} /> Refrescar
        </button>
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {state.personalDisponible.map((w) => (
          <WorkerCard
            key={w.id}
            worker={w}
            actionLabel="Contratar"
            actionIcon={<UserPlus size={11} />}
            actionTone="green"
            onAction={() => dispatch({ type: "HIRE_WORKER", workerId: w.id })}
            disabled={state.pesos < w.salario * 0.5}
            costNote={`Anticipo: ${fmtPesos(w.salario * 0.5)}`}
          />
        ))}
        {state.personalDisponible.length === 0 && (
          <div className="col-span-2 text-center text-xs text-muted-foreground p-3">
            No hay perfiles. Refrescá el pool.
          </div>
        )}
      </div>

      <div className="mt-4 text-[11px] font-black uppercase tracking-wider text-[var(--vine-green)] flex items-center gap-1.5">
        <Users size={13} /> Plantilla actual ({state.personalContratado.length})
      </div>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 max-h-72 overflow-y-auto pr-1">
        {state.personalContratado.map((w) => (
          <WorkerCard
            key={w.id}
            worker={w}
            actionLabel="Despedir"
            actionIcon={<UserMinus size={11} />}
            actionTone="red"
            onAction={() => dispatch({ type: "FIRE_WORKER", workerId: w.id })}
            costNote={`${w.tipo === "permanente" ? "Permanente" : "Golondrina"} · ${fmtPesos(w.salario)}/mes`}
          />
        ))}
      </div>
    </div>
  );
}

function WorkerCard({
  worker,
  actionLabel,
  actionIcon,
  actionTone,
  onAction,
  disabled,
  costNote,
}: {
  worker: { id: string; nombre: string; apellido: string; experiencia: number; moral: number; avatar: string; tipo: string };
  actionLabel: string;
  actionIcon: React.ReactNode;
  actionTone: "green" | "red";
  onAction: () => void;
  disabled?: boolean;
  costNote: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass rounded-xl p-2.5 flex flex-col gap-2"
    >
      <div className="flex items-center gap-2">
        <img
          src={worker.avatar}
          alt={`${worker.nombre} ${worker.apellido}`}
          width={40}
          height={40}
          loading="lazy"
          className="h-10 w-10 rounded-full border-2 border-white/20 bg-white/5 object-cover"
        />
        <div className="min-w-0 flex-1">
          <div className="truncate text-xs font-bold leading-tight">{worker.nombre} {worker.apellido}</div>
          <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
            {Array.from({ length: 5 }).map((_, i) => (
              <Star
                key={i}
                size={9}
                className={i < Math.round(worker.experiencia / 2) ? "fill-[var(--amber)] text-[var(--amber)]" : "text-white/15"}
              />
            ))}
            <span className="ml-1">Exp {worker.experiencia}</span>
          </div>
        </div>
      </div>
      <div>
        <div className="flex justify-between text-[9px] uppercase tracking-wider text-muted-foreground">
          <span>Moral</span>
          <span className="tabular-nums">{worker.moral}%</span>
        </div>
        <div className="h-1.5 w-full rounded-full bg-white/5 overflow-hidden">
          <div
            className="h-full rounded-full transition-all"
            style={{
              width: `${worker.moral}%`,
              background: worker.moral > 60 ? "var(--gradient-vine)" : worker.moral > 30 ? "var(--gradient-amber)" : "oklch(0.62 0.24 25)",
            }}
          />
        </div>
      </div>
      <div className="text-[9px] text-muted-foreground">{costNote}</div>
      <motion.button
        whileTap={{ scale: 0.96 }}
        disabled={disabled}
        onClick={onAction}
        className={`flex items-center justify-center gap-1 rounded-lg px-2 py-1 text-[10px] font-bold disabled:opacity-40 ${
          actionTone === "green" ? "text-accent-foreground" : "text-white"
        }`}
        style={{
          background:
            actionTone === "green"
              ? "var(--gradient-vine)"
              : "linear-gradient(135deg, oklch(0.62 0.24 25), oklch(0.45 0.2 20))",
        }}
      >
        {actionIcon} {actionLabel}
      </motion.button>
    </motion.div>
  );
}
