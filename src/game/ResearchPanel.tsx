import { motion } from "framer-motion";
import { useGame, TECH_INFO, fmtPesos, type TechId } from "./GameContext";
import { Beaker, Check, Lock } from "lucide-react";

export function ResearchPanel() {
  const { state, dispatch } = useGame();
  const techs: TechId[] = ["riego", "mecanizacion", "drones"];

  return (
    <div className="space-y-3">
      <div className="text-[11px] font-black uppercase tracking-wider text-[var(--amber)] flex items-center gap-1.5">
        <Beaker size={13} /> Árbol Tecnológico
      </div>
      <div className="space-y-2">
        {techs.map((id) => {
          const info = TECH_INFO[id];
          const owned = state.tech[id];
          const inProgress = state.researching?.tech === id;
          const otherInProgress = !!state.researching && !inProgress;
          const canBuy = !owned && !state.researching && state.pesos >= info.cost;
          return (
            <motion.div
              key={id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              className={`glass rounded-xl p-3 ${owned ? "ring-1 ring-[var(--vine-green)]/50" : inProgress ? "ring-1 ring-[var(--amber)]/60" : ""}`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-start gap-2 min-w-0">
                  <div className="text-2xl">{info.icon}</div>
                  <div className="min-w-0">
                    <div className="text-sm font-bold truncate">{info.name}</div>
                    <div className="text-[10px] text-muted-foreground">{info.desc}</div>
                    <div className="mt-1 flex gap-2 text-[10px] font-bold">
                      <span className="text-[var(--amber)]">{fmtPesos(info.cost)}</span>
                      <span className="text-muted-foreground">⏱ {info.meses}m</span>
                    </div>
                  </div>
                </div>
                {owned ? (
                  <div className="flex items-center gap-1 rounded-lg bg-[var(--vine-green)]/20 px-2 py-1 text-[10px] font-bold text-[var(--vine-green)]">
                    <Check size={11} /> Activa
                  </div>
                ) : inProgress ? (
                  <div className="flex flex-col items-end gap-1">
                    <div className="rounded-lg bg-[var(--amber)]/20 px-2 py-1 text-[10px] font-bold text-[var(--amber)]">
                      🧪 {state.researching?.mesesRestantes}m
                    </div>
                  </div>
                ) : (
                  <motion.button
                    whileTap={{ scale: 0.95 }}
                    disabled={!canBuy}
                    onClick={() => dispatch({ type: "RESEARCH", tech: id })}
                    className="flex items-center gap-1 rounded-lg px-2 py-1 text-[10px] font-bold text-primary-foreground disabled:opacity-40"
                    style={{ background: "var(--gradient-amber)" }}
                  >
                    {otherInProgress ? <><Lock size={11} /> Lab ocupado</> : canBuy ? "Investigar" : <><Lock size={11} /> Sin fondos</>}
                  </motion.button>
                )}
              </div>
              {inProgress && (
                <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-white/5">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${100 - ((state.researching?.mesesRestantes ?? 0) / info.meses) * 100}%`,
                      background: "var(--gradient-amber)",
                    }}
                  />
                </div>
              )}
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
