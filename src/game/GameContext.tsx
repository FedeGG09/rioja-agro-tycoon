import { createContext, useContext, useEffect, useReducer, useRef, type ReactNode } from "react";

export type CropType = "vid" | "olivo" | "nogal";
export type FactoryType = "bodega" | "almazara" | "nuez";

export interface Finca {
  id: string;
  x: number;
  y: number;
  type: CropType;
  name: string;
  stock: number; // raw materia prima
  growth: number; // 0-100
}

export interface Factory {
  id: string;
  type: FactoryType;
  x: number;
  y: number;
  processed: number; // productos elaborados
}

export interface PendingExport {
  id: string;
  factoryType: FactoryType;
  usd: number;
  monthDue: number; // mes en que se cobra
}

export interface GameEvent {
  id: string;
  title: string;
  description: string;
  kind: "good" | "bad" | "info";
  month: number;
}

export interface HistoryPoint {
  month: number;
  inflacion: number;
  patrimonio: number;
}

export interface GameState {
  pesos: number;
  dolares: number;
  inflacionMensual: number; // %
  inflacionAcumulada: number; // %
  tipoDeCambio: number; // ARS per USD
  brecha: number; // % blue gap
  dolarBlue: number; // ARS per USD blue (oficial * (1 + brecha/100))
  retenciones: number; // %
  moralTrabajadores: number; // 0-100
  trabajadoresPermanentes: number;
  trabajadoresGolondrina: number;
  salarioMensual: number; // pesos
  ultimoAumento: number; // % aplicado este mes
  mes: number; // 1..
  fincas: Finca[];
  factories: Factory[];
  eventos: GameEvent[];
  history: HistoryPoint[];
  paused: boolean;
  huelga: boolean;
  pendingExports: PendingExport[];
  costoInsumosMensual: number; // pesos, deducido cada mes (escala con dólar blue)
}

const FINCA_NAMES = ["Famatina", "Chilecito", "Valle del Bermejo", "Nonogasta", "Vichigasta", "Anguinán"];

const initial: GameState = {
  pesos: 2_500_000,
  dolares: 0,
  inflacionMensual: 6,
  inflacionAcumulada: 0,
  tipoDeCambio: 1000,
  brecha: 40,
  dolarBlue: 1400,
  retenciones: 12,
  moralTrabajadores: 75,
  trabajadoresPermanentes: 8,
  trabajadoresGolondrina: 0,
  salarioMensual: 350_000,
  ultimoAumento: 0,
  mes: 1,
  fincas: [
    { id: "f1", x: 0, y: 0, type: "vid", name: "Famatina", stock: 0, growth: 30 },
    { id: "f2", x: 1, y: 0, type: "olivo", name: "Chilecito", stock: 0, growth: 50 },
    { id: "f3", x: 0, y: 1, type: "nogal", name: "Valle del Bermejo", stock: 0, growth: 20 },
    { id: "f4", x: 1, y: 1, type: "vid", name: "Nonogasta", stock: 0, growth: 45 },
  ],
  factories: [],
  eventos: [
    { id: "e0", title: "Bienvenido a La Rioja", description: "Comienza la temporada en el Valle del Bermejo. Que el Zonda te sea leve.", kind: "info", month: 1 },
  ],
  history: [],
  paused: false,
  huelga: false,
  pendingExports: [],
  costoInsumosMensual: 120_000,
};

type Action =
  | { type: "TICK" }
  | { type: "TOGGLE_PAUSE" }
  | { type: "HARVEST"; fincaId: string }
  | { type: "SELL_LOCAL"; fincaId: string; amount: number }
  | { type: "EXPORT"; factoryId: string; amount: number }
  | { type: "PROCESS"; factoryId: string; fincaId: string; amount: number }
  | { type: "BUILD_FACTORY"; factoryType: FactoryType; fincaId: string }
  | { type: "HIRE_GOLONDRINA"; count: number }
  | { type: "FIRE_GOLONDRINA" }
  | { type: "SET_SALARIO"; value: number }
  | { type: "PAY_RAISE"; pct: number }
  | { type: "LIQUIDAR"; usd: number }
  | { type: "BUY_FINCA"; cropType: CropType };

const factoryFor: Record<CropType, FactoryType> = {
  vid: "bodega",
  olivo: "almazara",
  nogal: "nuez",
};

const cropLabel: Record<CropType, string> = {
  vid: "Vid Torrontés",
  olivo: "Olivo Arauco",
  nogal: "Nogal",
};

const factoryLabel: Record<FactoryType, string> = {
  bodega: "Bodega Boutique",
  almazara: "Almazara de Aceite",
  nuez: "Planta de Nuez",
};

function isHarvestMonth(mes: number) {
  const m = ((mes - 1) % 12) + 1;
  return m >= 1 && m <= 3; // verano (sur)
}

function rand(min: number, max: number) {
  return Math.random() * (max - min) + min;
}

function reducer(state: GameState, action: Action): GameState {
  switch (action.type) {
    case "TOGGLE_PAUSE":
      return { ...state, paused: !state.paused };

    case "TICK": {
      if (state.paused) return state;
      const mes = state.mes + 1;
      const harvest = isHarvestMonth(mes);
      // crecimiento o cosecha automática parcial
      const capacidad = (state.trabajadoresPermanentes + state.trabajadoresGolondrina) * 200;
      let usadoCap = 0;
      const fincas = state.fincas.map((f) => {
        let growth = Math.min(100, f.growth + (harvest ? 8 : 4));
        let stock = f.stock;
        if (harvest && growth >= 80) {
          const potencial = Math.floor(growth * 15 * (state.moralTrabajadores / 100));
          const restante = Math.max(0, capacidad - usadoCap);
          const cosechado = Math.min(potencial, restante);
          const perdido = potencial - cosechado;
          usadoCap += cosechado;
          stock += cosechado;
          growth = perdido > 0 ? 50 : 30;
        }
        // Pudrición: si stock excede capacidad mensual de los trabajadores, pierde 20%
        if (stock > capacidad && capacidad >= 0) {
          const exceso = stock - capacidad;
          stock = capacidad + Math.floor(exceso * 0.8);
        }
        return { ...f, growth, stock };
      });

      // costos: salarios + insumos importados (escalan con dólar blue / oficial)
      const totalTrab = state.trabajadoresPermanentes + state.trabajadoresGolondrina;
      const costoSalarios = totalTrab * state.salarioMensual;
      const ratioBlue = state.dolarBlue / state.tipoDeCambio;
      const costoInsumos = Math.round(state.costoInsumosMensual * ratioBlue * state.factories.length || state.costoInsumosMensual);
      let pesos = state.pesos - costoSalarios - costoInsumos;

      // inflación
      const inflacionMensual = Math.max(2, state.inflacionMensual + rand(-0.6, 0.8));
      const inflacionAcumulada = state.inflacionAcumulada + state.inflacionMensual;

      // tipo de cambio sube con inflación
      const tipoDeCambio = Math.round(state.tipoDeCambio * (1 + state.inflacionMensual / 100 - 0.005));
      const brecha = Math.max(10, Math.min(120, state.brecha + rand(-3, 3)));
      const dolarBlue = Math.round(tipoDeCambio * (1 + brecha / 100));

      // moral: comparar último aumento vs inflación mensual
      const moralDelta = (state.ultimoAumento - state.inflacionMensual) * 0.8;
      const moralTrabajadores = Math.max(0, Math.min(100, state.moralTrabajadores + moralDelta - 1));
      const huelga = moralTrabajadores <= 0;

      // eventos aleatorios
      const eventos = [...state.eventos];
      if (Math.random() < 0.18) {
        const roll = Math.random();
        if (roll < 0.33) {
          eventos.unshift({ id: `ev${mes}a`, title: "Viento Zonda", description: "Ráfagas calientes desbordan los viñedos. La moral cae.", kind: "bad", month: mes });
        } else if (roll < 0.66) {
          eventos.unshift({ id: `ev${mes}b`, title: "Helada Tardía", description: "Pérdida del 30% de stock en todas las fincas.", kind: "bad", month: mes });
        } else {
          eventos.unshift({ id: `ev${mes}c`, title: "Devaluación", description: "El BCRA ajusta el dólar oficial.", kind: "info", month: mes });
        }
      }
      let fincas2 = fincas;
      let moral2 = moralTrabajadores;
      let tc2 = tipoDeCambio;
      const last = eventos[0];
      if (last && last.month === mes) {
        if (last.title === "Viento Zonda") moral2 = Math.max(0, moral2 - 15);
        if (last.title === "Helada Tardía") fincas2 = fincas.map((f) => ({ ...f, stock: Math.floor(f.stock * 0.7) }));
        if (last.title === "Devaluación") tc2 = Math.round(tc2 * 1.15);
      }

      // Cobros diferidos: liquidar exportaciones que vencen este mes (auto al oficial)
      const due = state.pendingExports.filter((p) => p.monthDue <= mes);
      const pendingExports = state.pendingExports.filter((p) => p.monthDue > mes);
      let pesosCobrados = 0;
      for (const d of due) {
        pesosCobrados += d.usd * tc2;
      }
      pesos += pesosCobrados;
      if (due.length > 0) {
        eventos.unshift({
          id: `cobro${mes}`,
          title: "Cobro de Exportación",
          description: `Se acreditan ${due.reduce((s, d) => s + d.usd, 0).toFixed(0)} USD liquidados al oficial.`,
          kind: "good",
          month: mes,
        });
      }

      const patrimonio = pesos + state.dolares * tc2 +
        fincas2.reduce((s, f) => s + f.stock * 50, 0) +
        state.factories.reduce((s, fa) => s + fa.processed * 200, 0) +
        pendingExports.reduce((s, p) => s + p.usd * tc2, 0);

      const history = [...state.history, { month: mes, inflacion: Math.round(inflacionAcumulada), patrimonio: Math.round(patrimonio) }].slice(-36);

      return {
        ...state,
        mes,
        fincas: fincas2,
        pesos,
        inflacionMensual: Number(inflacionMensual.toFixed(2)),
        inflacionAcumulada: Number(inflacionAcumulada.toFixed(2)),
        tipoDeCambio: tc2,
        brecha: Number(brecha.toFixed(1)),
        dolarBlue,
        moralTrabajadores: Math.round(moral2),
        ultimoAumento: 0,
        eventos: eventos.slice(0, 20),
        history,
        huelga,
        pendingExports,
      };
    }

    case "HARVEST": {
      const f = state.fincas.find((x) => x.id === action.fincaId);
      if (!f || f.growth < 50) return state;
      const cosechado = Math.floor(f.growth * 12 * (state.moralTrabajadores / 100));
      return {
        ...state,
        fincas: state.fincas.map((x) => x.id === f.id ? { ...x, stock: x.stock + cosechado, growth: 20 } : x),
      };
    }

    case "SELL_LOCAL": {
      const f = state.fincas.find((x) => x.id === action.fincaId);
      if (!f) return state;
      const amt = Math.min(action.amount, f.stock);
      const precio = f.type === "vid" ? 1200 : f.type === "olivo" ? 900 : 1500;
      const ingreso = amt * precio;
      return {
        ...state,
        pesos: state.pesos + ingreso,
        fincas: state.fincas.map((x) => x.id === f.id ? { ...x, stock: x.stock - amt } : x),
      };
    }

    case "PROCESS": {
      const fa = state.factories.find((x) => x.id === action.factoryId);
      const fi = state.fincas.find((x) => x.id === action.fincaId);
      if (!fa || !fi) return state;
      if (factoryFor[fi.type] !== fa.type) return state;
      const amt = Math.min(action.amount, fi.stock);
      const cost = amt * 100; // pesos
      if (state.pesos < cost) return state;
      return {
        ...state,
        pesos: state.pesos - cost,
        factories: state.factories.map((x) => x.id === fa.id ? { ...x, processed: x.processed + Math.floor(amt * 0.7) } : x),
        fincas: state.fincas.map((x) => x.id === fi.id ? { ...x, stock: x.stock - amt } : x),
      };
    }

    case "EXPORT": {
      const fa = state.factories.find((x) => x.id === action.factoryId);
      if (!fa) return state;
      const amt = Math.min(action.amount, fa.processed);
      if (amt <= 0) return state;
      const precioFOB = fa.type === "bodega" ? 8 : fa.type === "almazara" ? 6 : 12; // USD/u
      const bruto = amt * precioFOB;
      const neto = bruto * (1 - state.retenciones / 100);
      // Cobro diferido a 2 meses
      const pending: PendingExport = {
        id: `pe${Date.now()}`,
        factoryType: fa.type,
        usd: neto,
        monthDue: state.mes + 2,
      };
      return {
        ...state,
        factories: state.factories.map((x) => x.id === fa.id ? { ...x, processed: x.processed - amt } : x),
        pendingExports: [...state.pendingExports, pending],
        eventos: [
          { id: `exp${Date.now()}`, title: "Exportación enviada", description: `${amt} u FOB · cobro de US$${neto.toFixed(0)} en 2 meses (retención ${state.retenciones}%).`, kind: "info" as const, month: state.mes },
          ...state.eventos,
        ].slice(0, 20),
      };
    }

    case "LIQUIDAR": {
      const usd = Math.min(action.usd, state.dolares);
      const pesos = state.pesos + usd * state.tipoDeCambio;
      return { ...state, dolares: state.dolares - usd, pesos };
    }

    case "BUILD_FACTORY": {
      const cost = 1_500_000;
      if (state.pesos < cost) return state;
      const totalStock = state.fincas.reduce((s, f) => s + f.stock, 0);
      if (totalStock < 5000) return state;
      const fi = state.fincas.find((f) => f.id === action.fincaId);
      if (!fi) return state;
      const id = `fa${Date.now()}`;
      return {
        ...state,
        pesos: state.pesos - cost,
        factories: [...state.factories, { id, type: action.factoryType, x: fi.x, y: fi.y, processed: 0 }],
      };
    }

    case "HIRE_GOLONDRINA": {
      const cost = action.count * 80_000;
      if (state.pesos < cost) return state;
      return { ...state, pesos: state.pesos - cost, trabajadoresGolondrina: state.trabajadoresGolondrina + action.count };
    }

    case "FIRE_GOLONDRINA":
      return { ...state, trabajadoresGolondrina: 0 };

    case "SET_SALARIO":
      return { ...state, salarioMensual: action.value };

    case "PAY_RAISE": {
      const newSal = Math.round(state.salarioMensual * (1 + action.pct / 100));
      return { ...state, salarioMensual: newSal, ultimoAumento: state.ultimoAumento + action.pct };
    }

    case "BUY_FINCA": {
      const cost = 800_000;
      if (state.pesos < cost) return state;
      const used = new Set(state.fincas.map((f) => `${f.x},${f.y}`));
      let pos: { x: number; y: number } | null = null;
      for (let y = 0; y < 4 && !pos; y++) {
        for (let x = 0; x < 4 && !pos; x++) {
          if (!used.has(`${x},${y}`)) pos = { x, y };
        }
      }
      if (!pos) return state;
      const name = FINCA_NAMES[state.fincas.length % FINCA_NAMES.length];
      return {
        ...state,
        pesos: state.pesos - cost,
        fincas: [...state.fincas, { id: `f${Date.now()}`, x: pos.x, y: pos.y, type: action.cropType, name, stock: 0, growth: 10 }],
      };
    }
  }
}

interface Ctx {
  state: GameState;
  dispatch: React.Dispatch<Action>;
  cropLabel: typeof cropLabel;
  factoryLabel: typeof factoryLabel;
  factoryFor: typeof factoryFor;
  isHarvestMonth: typeof isHarvestMonth;
}

const GameCtx = createContext<Ctx | null>(null);

export function GameProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initial);
  const stateRef = useRef(state);
  stateRef.current = state;

  useEffect(() => {
    const id = setInterval(() => {
      if (!stateRef.current.paused) dispatch({ type: "TICK" });
    }, 20_000);
    return () => clearInterval(id);
  }, []);

  return (
    <GameCtx.Provider value={{ state, dispatch, cropLabel, factoryLabel, factoryFor, isHarvestMonth }}>
      {children}
    </GameCtx.Provider>
  );
}

export function useGame() {
  const ctx = useContext(GameCtx);
  if (!ctx) throw new Error("useGame must be used inside GameProvider");
  return ctx;
}

export function monthName(mes: number) {
  const names = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
  return names[(mes - 1) % 12];
}

export function fmtPesos(n: number) {
  return "$" + Math.round(n).toLocaleString("es-AR");
}

export function fmtUSD(n: number) {
  return "US$" + n.toLocaleString("es-AR", { maximumFractionDigits: 0 });
}