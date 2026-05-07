import { useState } from "react";
import { motion } from "framer-motion";
import { useGame, fmtPesos, fmtUSD, type Finca, type CropType } from "./GameContext";
import { Slider } from "@/components/ui/slider";

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
    <div className="flex flex-col gap-3">
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
                Vender local (ARS)
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
                </div>
              </div>
            )}
          </div>
        ) : <div className="text-xs text-muted-foreground">Hacé click en una finca del mapa.</div>}
      </Card>

      <Card title="💵 Aduana / Liquidación voluntaria">
        <div className="text-xs text-muted-foreground">USD disponibles: <b className="text-[var(--vine-green)]">{fmtUSD(state.dolares)}</b></div>
        <div className="text-xs">Oficial ${state.tipoDeCambio} · Blue ${state.dolarBlue}</div>
        <div className="mt-2 flex gap-1">
          <Input value={liqAmt} onChange={setLiqAmt} />
          <Btn onClick={() => dispatch({ type: "LIQUIDAR", usd: liqAmt })} variant="amber">Liquidar</Btn>
        </div>
      </Card>

      <Card title="👷 RRHH">
        <div className="grid grid-cols-2 gap-2 text-xs">
          <Pill label="Permanentes" value={String(state.trabajadoresPermanentes)} />
          <Pill label="Golondrina" value={String(state.trabajadoresGolondrina)} />
        </div>
        <div className="text-xs">Salario: <b>{fmtPesos(state.salarioMensual)}</b></div>

        {harvestSeason ? (
          <div className="mt-2 rounded-xl border border-[var(--vine-green)]/30 bg-[var(--vine-green)]/5 p-2">
            <div className="text-[11px] font-bold text-[var(--vine-green)]">🌞 Cosecha activa — Contratá temporales</div>
            <div className="mt-2">
              <Slider value={hireSlider} onValueChange={setHireSlider} min={0} max={50} step={1} />
              <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
                <span>0</span><span><b>{hireSlider[0]}</b> trab. · {fmtPesos(hireSlider[0] * 80_000)}</span><span>50</span>
              </div>
              <Btn onClick={() => dispatch({ type: "HIRE_GOLONDRINA", count: hireSlider[0] })} variant="green">
                Contratar {hireSlider[0]} golondrina
              </Btn>
            </div>
          </div>
        ) : (
          <div className="mt-2 rounded-xl bg-muted/30 p-2 text-[11px] text-muted-foreground">
            Fuera de temporada (Ene–Mar). No se contratan golondrinas.
          </div>
        )}

        <Btn onClick={() => dispatch({ type: "FIRE_GOLONDRINA" })} variant="ghost">Despedir temporales</Btn>

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
