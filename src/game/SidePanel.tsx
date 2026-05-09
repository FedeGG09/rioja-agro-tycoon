import { useState } from "react";
import { motion } from "framer-motion";
import { useGame, fmtPesos, fmtUSD, type Finca, type CropType } from "./GameContext";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Wheat, Users, Beaker, Banknote } from "lucide-react";
import { RRHHPanel } from "./RRHHPanel";
import { ResearchPanel } from "./ResearchPanel";

export function SidePanel({ selected }: { selected?: Finca }) {
  const { state, dispatch, cropLabel, factoryLabel, factoryFor } = useGame();
  const [sellAmt, setSellAmt] = useState(100);
  const [procAmt, setProcAmt] = useState(100);
  const [expAmt, setExpAmt] = useState(50);
  const [liqAmt, setLiqAmt] = useState(100);
  const [hireSlider, setHireSlider] = useState<number[]>([10]);
  const [salario, setSalario] = useState(state.salarioMensual);
  const [newCrop, setNewCrop] = useState<CropType>("vid");

  const factoryOnTile = selected && state.factories.find((f) => f.x === selected.x && f.y === selected.y);
  const harvestSeason = ((state.mes - 1) % 12) + 1 <= 3;

  return (
    <div className="glass-strong rounded-2xl p-3">
      <Tabs defaultValue="finca">
        <TabsList className="grid w-full grid-cols-4 bg-white/5">
          <TabsTrigger value="finca" className="text-[10px]"><Wheat size={12} className="mr-1" />Finca</TabsTrigger>
          <TabsTrigger value="rrhh" className="text-[10px]"><Users size={12} className="mr-1" />RRHH</TabsTrigger>
          <TabsTrigger value="id" className="text-[10px]"><Beaker size={12} className="mr-1" />I+D</TabsTrigger>
          <TabsTrigger value="fin" className="text-[10px]"><Banknote size={12} className="mr-1" />$</TabsTrigger>
        </TabsList>

        <TabsContent value="finca" className="mt-3 space-y-3 max-h-[70vh] overflow-y-auto pr-1">
          <Card title="🏞️ Finca seleccionada">
            {selected ? (
              <div className="space-y-2 text-sm">
                <div className="font-bold text-[var(--vine-green)]">{selected.name}</div>
                <div className="text-xs text-muted-foreground">{cropLabel[selected.type]}</div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <Pill label="Maduración" value={`${selected.growth}%`} />
                  <Pill label="Stock" value={`${selected.stock}`} />
                </div>
                <Btn onClick={() => dispatch({ type: "HARVEST", fincaId: selected.id })} disabled={selected.growth < 50} variant="green">
                  🌾 Cosechar manual
                </Btn>
                <div className="flex gap-1">
                  <Input value={sellAmt} onChange={setSellAmt} />
                  <Btn onClick={() => dispatch({ type: "SELL_LOCAL", fincaId: selected.id, amount: sellAmt })} variant="amber">
                    Vender (ARS)
                  </Btn>
                </div>
                {!factoryOnTile && state.fincas.reduce((s, f) => s + f.stock, 0) >= 5000 && (
                  <Btn onClick={() => dispatch({ type: "BUILD_FACTORY", factoryType: factoryFor[selected.type], fincaId: selected.id })} variant="terra">
                    🏭 Construir {factoryLabel[factoryFor[selected.type]]} ({fmtPesos(1_500_000)})
                  </Btn>
                )}
                {factoryOnTile && (
                  <div className="rounded-xl border border-[var(--amber)]/20 bg-[var(--amber)]/5 p-2">
                    <div className="text-xs font-bold text-[var(--amber)]">
                      {factoryLabel[factoryOnTile.type]} · Elaborado: {factoryOnTile.processed}
                    </div>
                    <div className="mt-2 flex gap-1">
                      <Input value={procAmt} onChange={setProcAmt} />
                      <Btn onClick={() => dispatch({ type: "PROCESS", factoryId: factoryOnTile.id, fincaId: selected.id, amount: procAmt })} variant="green">Procesar</Btn>
                    </div>
                    <div className="mt-1 flex gap-1">
                      <Input value={expAmt} onChange={setExpAmt} />
                      <Btn onClick={() => dispatch({ type: "EXPORT", factoryId: factoryOnTile.id, amount: expAmt })} variant="amber">
                        🚢 Exportar (USD, +2m)
                      </Btn>
                    </div>
                    <div className="mt-1 text-[10px] text-muted-foreground">
                      Retención {state.retenciones}% · Liquida automático al oficial al cobrar.
                      {state.tech.drones && <span className="text-[var(--vine-green)]"> · 🛸 +15% precio</span>}
                    </div>
                  </div>
                )}
              </div>
            ) : <div className="text-xs text-muted-foreground">Hacé click en una finca del mapa.</div>}
          </Card>

          <Card title="🌱 Comprar Finca · $800.000">
            <select value={newCrop} onChange={(e) => setNewCrop(e.target.value as CropType)}
              className="w-full rounded-lg border border-border bg-input/40 px-2 py-1.5 text-xs text-foreground backdrop-blur">
              <option value="vid">Vid Torrontés</option>
              <option value="olivo">Olivo Arauco</option>
              <option value="nogal">Nogal</option>
            </select>
            <Btn onClick={() => dispatch({ type: "BUY_FINCA", cropType: newCrop })} variant="terra">
              Adquirir parcela
            </Btn>
          </Card>
        </TabsContent>

        <TabsContent value="rrhh" className="mt-3 max-h-[70vh] overflow-y-auto pr-1">
          {harvestSeason && (
            <div className="mb-3 rounded-xl border border-[var(--vine-green)]/30 bg-[var(--vine-green)]/5 p-2">
              <div className="text-[11px] font-bold text-[var(--vine-green)]">🌞 Cosecha activa — Brigada rápida</div>
              <Slider value={hireSlider} onValueChange={setHireSlider} min={0} max={50} step={1} className="mt-2" />
              <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
                <span>0</span><span><b>{hireSlider[0]}</b> trab. · {fmtPesos(hireSlider[0] * 80_000)}</span><span>50</span>
              </div>
              <div className="mt-2 flex gap-1">
                <Btn onClick={() => dispatch({ type: "HIRE_GOLONDRINA", count: hireSlider[0] })} variant="green">
                  +{hireSlider[0]} golondrina
                </Btn>
                <Btn onClick={() => dispatch({ type: "FIRE_GOLONDRINA" })} variant="ghost">Despedir</Btn>
              </div>
            </div>
          )}
          <RRHHPanel />
        </TabsContent>

        <TabsContent value="id" className="mt-3 max-h-[70vh] overflow-y-auto pr-1">
          <ResearchPanel />
        </TabsContent>

        <TabsContent value="fin" className="mt-3 space-y-3 max-h-[70vh] overflow-y-auto pr-1">
          <Card title="📒 Libro de Exportaciones Pendientes">
            {state.pendingExports.length === 0 ? (
              <div className="text-[11px] text-muted-foreground">Sin envíos en curso. Procesá stock y exportá desde una fábrica.</div>
            ) : (
              <div className="space-y-1.5">
                {state.pendingExports.map((p) => {
                  const meses = p.monthDue - state.mes;
                  const bruto = p.usd / (1 - state.retenciones / 100);
                  const ret = bruto - p.usd;
                  return (
                    <div key={p.id} className="rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-[11px]">
                      <div className="flex justify-between">
                        <span className="font-bold capitalize">{p.factoryType}</span>
                        <span className="tabular-nums text-[var(--vine-green)]">{fmtUSD(p.usd)}</span>
                      </div>
                      <div className="flex justify-between text-[10px] text-muted-foreground">
                        <span>FOB bruto US${bruto.toFixed(0)} · retención {state.retenciones}% (US${ret.toFixed(0)})</span>
                      </div>
                      <div className="flex justify-between text-[10px]">
                        <span className="text-muted-foreground">Liquida en M{p.monthDue} ({meses}m)</span>
                        <span className="text-[var(--amber)]">≈ {fmtPesos(p.usd * state.tipoDeCambio)}</span>
                      </div>
                    </div>
                  );
                })}
                <div className="mt-1 text-[10px] text-muted-foreground">
                  Total a cobrar: <b className="text-[var(--vine-green)]">{fmtUSD(state.pendingExports.reduce((s, p) => s + p.usd, 0))}</b> · liquidación automática al oficial.
                </div>
              </div>
            )}
          </Card>

          <Card title="💵 Aduana / Liquidación voluntaria">
            <div className="text-xs text-muted-foreground">USD disponibles: <b className="text-[var(--vine-green)]">{fmtUSD(state.dolares)}</b></div>
            <div className="text-xs">Oficial ${state.tipoDeCambio} · Blue ${state.dolarBlue}</div>
            <div className="mt-2 flex gap-1">
              <Input value={liqAmt} onChange={setLiqAmt} />
              <Btn onClick={() => dispatch({ type: "LIQUIDAR", usd: liqAmt })} variant="amber">Liquidar</Btn>
            </div>
          </Card>

          <Card title="💰 Sueldos">
            <div className="text-xs">Salario base: <b>{fmtPesos(state.salarioMensual)}</b></div>
            <div className="mt-2 flex gap-1">
              <Btn onClick={() => dispatch({ type: "PAY_RAISE", pct: 5 })} variant="ghost">+5%</Btn>
              <Btn onClick={() => dispatch({ type: "PAY_RAISE", pct: 10 })} variant="ghost">+10%</Btn>
              <Btn onClick={() => dispatch({ type: "PAY_RAISE", pct: 20 })} variant="ghost">+20%</Btn>
            </div>
            <div className="mt-2 flex gap-1">
              <Input value={salario} onChange={setSalario} wide />
              <Btn onClick={() => dispatch({ type: "SET_SALARIO", value: salario })} variant="amber">Fijar</Btn>
            </div>
          </Card>

          {state.deuda > 0 && (
            <Card title="🏛️ Crédito de Fomento Riojano">
              <div className="text-xs text-destructive">Deuda actual: <b>{fmtPesos(state.deuda)}</b></div>
              {state.deuda >= 14_000_000 && !state.moratoria.activa && (
                <>
                  <div className="text-[10px] text-muted-foreground">
                    Refinanciá en 12 cuotas a cambio de cumplir un objetivo de exportación. Cumplido: bonus 20%. Incumplido: multa 30%.
                  </div>
                  <Btn onClick={() => dispatch({ type: "TAKE_MORATORIA" })} variant="terra">
                    Tomar moratoria
                  </Btn>
                </>
              )}
            </Card>
          )}

          {state.moratoria.activa && (
            <Card title="📋 Moratoria activa">
              <div className="text-xs">Cuotas restantes: <b>{state.moratoria.cuotasRestantes}/12</b></div>
              <div className="text-xs">Cuota: <b>{fmtPesos(state.moratoria.cuotaMensual)}</b></div>
              <div className="text-xs">
                Objetivo: <b className="text-[var(--vine-green)]">{fmtUSD(state.moratoria.objetivoUSD)}</b>
              </div>
              <div className="text-xs">
                Exportado: <b className={state.moratoria.exportadoUSD >= state.moratoria.objetivoUSD ? "text-[var(--vine-green)]" : "text-[var(--amber)]"}>
                  {fmtUSD(state.moratoria.exportadoUSD)}
                </b>
              </div>
              <div className="h-2 w-full rounded-full bg-white/5 overflow-hidden">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${Math.min(100, (state.moratoria.exportadoUSD / Math.max(1, state.moratoria.objetivoUSD)) * 100)}%`,
                    background: "var(--gradient-vine)",
                  }}
                />
              </div>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="glass rounded-2xl p-3">
      <div className="mb-2 text-[11px] font-black uppercase tracking-wider text-[var(--amber)]">{title}</div>
      <div className="space-y-2">{children}</div>
    </motion.div>
  );
}

function Pill({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-white/5 px-2 py-1">
      <div className="text-[9px] uppercase text-muted-foreground">{label}</div>
      <div className="text-sm font-bold tabular-nums">{value}</div>
    </div>
  );
}

function Input({ value, onChange, wide }: { value: number; onChange: (n: number) => void; wide?: boolean }) {
  return (
    <input type="number" value={value} onChange={(e) => onChange(+e.target.value)}
      className={`${wide ? "flex-1" : "w-20"} rounded-lg border border-border bg-input/40 px-2 py-1.5 text-xs tabular-nums text-foreground backdrop-blur focus:outline-none focus:ring-2 focus:ring-[var(--amber)]/50`} />
  );
}

function Btn({ children, onClick, disabled, variant = "amber" }: { children: React.ReactNode; onClick: () => void; disabled?: boolean; variant?: "amber" | "green" | "terra" | "ghost" }) {
  const cls =
    variant === "amber" ? "text-primary-foreground shadow-[var(--shadow-glow-amber)]" :
    variant === "green" ? "text-accent-foreground" :
    variant === "terra" ? "text-white" :
    "text-foreground";
  const bg =
    variant === "amber" ? { background: "var(--gradient-amber)" } :
    variant === "green" ? { background: "var(--gradient-vine)" } :
    variant === "terra" ? { background: "linear-gradient(135deg, var(--terracotta), oklch(0.45 0.18 35))" } :
    { background: "oklch(1 0 0 / 0.05)" };
  return (
    <motion.button whileTap={{ scale: 0.96 }} whileHover={{ scale: disabled ? 1 : 1.02 }}
      onClick={onClick} disabled={disabled}
      style={bg}
      className={`flex-1 rounded-lg px-3 py-1.5 text-xs font-bold transition disabled:opacity-40 disabled:saturate-50 ${cls}`}>
      {children}
    </motion.button>
  );
}
