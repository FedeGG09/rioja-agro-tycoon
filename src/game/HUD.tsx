import { motion } from "framer-motion";
import { useGame, fmtPesos, fmtUSD, monthName } from "./GameContext";
import { Pause, Play, TrendingUp, TrendingDown, DollarSign, Coins, Flame, Users, Calendar, AlertTriangle } from "lucide-react";

export function HUD() {
  const { state, dispatch } = useGame();
  const pendingUSD = state.pendingExports.reduce((s, p) => s + p.usd, 0);

  return (
    <div className="glass-strong rounded-2xl p-5">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black tracking-tight bg-gradient-to-r from-[var(--amber)] to-[var(--gold)] bg-clip-text text-transparent">
            🍇 La Rioja Agro-Tycoon
          </h1>
          <p className="text-xs text-muted-foreground">Famatina · Chilecito · Valle del Bermejo</p>
        </div>
        <motion.button
          whileTap={{ scale: 0.95 }}
          whileHover={{ scale: 1.03 }}
          onClick={() => dispatch({ type: "TOGGLE_PAUSE" })}
          className="flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-bold text-primary-foreground shadow-[var(--shadow-glow-amber)]"
          style={{ background: "var(--gradient-amber)" }}
        >
          {state.paused ? <Play size={16} /> : <Pause size={16} />}
          {state.paused ? "Reanudar" : "Pausar"}
        </motion.button>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
        <Stat icon={<Coins size={14} />} label="Pesos" value={fmtPesos(state.pesos)} tone="amber" />
        <Stat icon={<DollarSign size={14} />} label="Dólares" value={fmtUSD(state.dolares)} tone="green" />
        <Stat icon={<Calendar size={14} />} label="Mes" value={`${monthName(state.mes)} año ${Math.ceil(state.mes / 12)}`} />
        <Stat icon={<Flame size={14} />} label="Inflación mes" value={`${state.inflacionMensual}%`} tone="red" />
        <Stat icon={state.inflacionAcumulada > 50 ? <TrendingUp size={14} /> : <TrendingDown size={14} />} label="Inflación acum." value={`${state.inflacionAcumulada.toFixed(0)}%`} />
        <Stat icon={<DollarSign size={14} />} label="Dólar Oficial" value={`$${state.tipoDeCambio}`} />
        <Stat icon={<DollarSign size={14} />} label="Dólar Blue" value={`$${state.dolarBlue}`} tone="red" />
        <Stat label="Brecha" value={`${state.brecha}%`} />
        <Stat label="Retenciones" value={`${state.retenciones}%`} />
        <Stat icon={<Users size={14} />} label="Moral" value={`${state.moralTrabajadores}%`} tone={state.moralTrabajadores < 40 ? "red" : "green"} />
      </div>

      {pendingUSD > 0 && (
        <div className="mt-3 rounded-xl border border-[var(--amber)]/30 bg-[var(--amber)]/10 px-3 py-2 text-xs text-[var(--amber)]">
          ⏳ Cobros diferidos pendientes: <b>US${pendingUSD.toFixed(0)}</b> ({state.pendingExports.length} envíos)
        </div>
      )}

      {state.deuda > 0 && (
        <div className="mt-3 rounded-xl border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          🏛️ Deuda acumulada: <b>{fmtPesos(state.deuda)}</b>
          {state.deuda >= 14_000_000 && !state.moratoria.activa && (
            <button
              onClick={() => dispatch({ type: "TAKE_MORATORIA" })}
              className="ml-2 rounded-md bg-destructive/30 px-2 py-0.5 text-[10px] font-bold hover:bg-destructive/50"
            >
              Tomar Moratoria Riojana
            </button>
          )}
        </div>
      )}

      {state.huelga && (
        <div className="mt-3 flex items-center gap-2 rounded-xl bg-destructive/20 border border-destructive/40 px-3 py-2 text-sm font-bold text-destructive">
          <AlertTriangle size={16} /> HUELGA TOTAL — la moral colapsó. Aumentá salarios ya.
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, tone, icon }: { label: string; value: string; tone?: "amber" | "green" | "red"; icon?: React.ReactNode }) {
  const color =
    tone === "amber" ? "text-[var(--amber)]" :
    tone === "green" ? "text-[var(--vine-green)]" :
    tone === "red" ? "text-destructive" : "text-foreground";
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass rounded-xl px-3 py-2"
    >
      <div className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {icon}{label}
      </div>
      <div className={`text-base font-black tabular-nums ${color}`}>{value}</div>
    </motion.div>
  );
}
