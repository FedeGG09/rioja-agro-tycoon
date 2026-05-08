import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, CartesianGrid, Area, AreaChart } from "recharts";
import { useGame } from "./GameContext";
import { ChevronDown, Newspaper, AlertTriangle, CheckCircle2, Info } from "lucide-react";

export function EventsLog() {
  const { state } = useGame();
  return (
    <div className="glass rounded-2xl p-3">
      <div className="mb-2 flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wider text-[var(--amber)]">
        <Newspaper size={13} /> Diario Riojano
      </div>
      <div className="max-h-56 space-y-2 overflow-y-auto pr-1">
        <AnimatePresence initial={false}>
          {state.eventos.map((e) => {
            const Icon = e.kind === "bad" ? AlertTriangle : e.kind === "good" ? CheckCircle2 : Info;
            const tone =
              e.kind === "bad" ? "text-destructive bg-destructive/10 border-destructive/30" :
              e.kind === "good" ? "text-[var(--vine-green)] bg-[var(--vine-green)]/10 border-[var(--vine-green)]/30" :
              "text-foreground bg-white/5 border-white/10";
            const initialLetter = e.title[0]?.toUpperCase() ?? "·";
            return (
              <motion.div
                key={e.id}
                initial={{ opacity: 0, y: -8, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, x: 20 }}
                className={`flex gap-2 rounded-2xl border px-3 py-2 ${tone}`}
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-black/40 text-sm font-black ring-1 ring-white/10">
                  {initialLetter}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2 text-[11px]">
                    <div className="flex items-center gap-1 font-bold">
                      <Icon size={11} /> {e.title}
                    </div>
                    <span className="text-[9px] opacity-60">M{e.month}</span>
                  </div>
                  <div className="text-[11px] opacity-90 leading-snug">{e.description}</div>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
}

export function Dashboard() {
  const { state } = useGame();
  const [open, setOpen] = useState(true);
  return (
    <div className="glass rounded-2xl p-3">
      <button onClick={() => setOpen(!open)} className="mb-2 flex w-full items-center justify-between text-[11px] font-black uppercase tracking-wider text-[var(--amber)]">
        📈 Patrimonio Neto vs Inflación
        <motion.span animate={{ rotate: open ? 0 : -90 }}><ChevronDown size={14} /></motion.span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="h-56 w-full">
              <ResponsiveContainer>
                <AreaChart data={state.history}>
                  <defs>
                    <linearGradient id="gPat" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="oklch(0.6 0.18 145)" stopOpacity={0.6} />
                      <stop offset="100%" stopColor="oklch(0.6 0.18 145)" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="gInf" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="oklch(0.78 0.17 70)" stopOpacity={0.5} />
                      <stop offset="100%" stopColor="oklch(0.78 0.17 70)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="oklch(1 0 0 / 0.06)" />
                  <XAxis dataKey="month" stroke="oklch(0.7 0.02 250)" fontSize={10} />
                  <YAxis yAxisId="l" stroke="oklch(0.78 0.17 70)" fontSize={10} />
                  <YAxis yAxisId="r" orientation="right" stroke="oklch(0.6 0.18 145)" fontSize={10} />
                  <Tooltip contentStyle={{ background: "oklch(0.18 0.04 265 / 0.95)", border: "1px solid oklch(0.5 0.04 260 / 0.4)", borderRadius: 8, fontSize: 11 }} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Area yAxisId="r" type="monotone" dataKey="patrimonio" name="Patrimonio Neto" stroke="oklch(0.6 0.18 145)" strokeWidth={2} fill="url(#gPat)" />
                  <Area yAxisId="l" type="monotone" dataKey="inflacion" name="Inflación acum. %" stroke="oklch(0.78 0.17 70)" strokeWidth={2} fill="url(#gInf)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
