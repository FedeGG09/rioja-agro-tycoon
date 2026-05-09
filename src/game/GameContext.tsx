import { createContext, useContext, useEffect, useReducer, useRef, type ReactNode } from "react";
import { generatePool, generateWorker, type Worker } from "./workers";

export type CropType = "vid" | "olivo" | "nogal";
export type FactoryType = "bodega" | "almazara" | "nuez";
export type TechId = "riego" | "mecanizacion" | "drones";

export interface Finca {
  id: string;
  x: number;
  y: number;
  type: CropType;
  name: string;
  stock: number;
  growth: number;
}

export interface Factory {
  id: string;
  type: FactoryType;
  x: number;
  y: number;
  processed: number;
}

export interface PendingExport {
  id: string;
  factoryType: FactoryType;
  usd: number;
  monthDue: number;
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
  deuda?: number;
}

export interface Tech {
  riego: boolean;       // +20% rendimiento vid/olivo
  mecanizacion: boolean; // -30% costo proceso
  drones: boolean;       // +15% precio export
}

export interface Moratoria {
  activa: boolean;
  cuotasRestantes: number;     // de 12
  cuotaMensual: number;
  objetivoUSD: number;
  exportadoUSD: number;
  cumplida: boolean;
}

export interface Researching {
  tech: TechId;
  mesesRestantes: number;
}

export interface GameState {
  pesos: number;
  dolares: number;
  deuda: number;
  inflacionMensual: number;
  inflacionAcumulada: number;
  tipoDeCambio: number;
  brecha: number;
  dolarBlue: number;
  retenciones: number;
  moralTrabajadores: number;
  trabajadoresPermanentes: number;
  trabajadoresGolondrina: number;
  salarioMensual: number;
  ultimoAumento: number;
  mes: number;
  fincas: Finca[];
  factories: Factory[];
  eventos: GameEvent[];
  history: HistoryPoint[];
  paused: boolean;
  huelga: boolean;
  pendingExports: PendingExport[];
  costoInsumosMensual: number;
  // RRHH detallado
  personalDisponible: Worker[];
  personalContratado: Worker[];
  // I+D
  tech: Tech;
  researching: Researching | null;
  // Moratoria
  moratoria: Moratoria;
}

const FINCA_NAMES = ["Famatina", "Chilecito", "Valle del Bermejo", "Nonogasta", "Vichigasta", "Anguinán", "Sañogasta", "Malligasta"];

const initialPermanentes: Worker[] = [
  generateWorker("permanente", 350_000),
  generateWorker("permanente", 350_000),
  generateWorker("permanente", 350_000),
  generateWorker("permanente", 350_000),
  generateWorker("permanente", 350_000),
  generateWorker("permanente", 350_000),
  generateWorker("permanente", 350_000),
  generateWorker("permanente", 350_000),
];

const initial: GameState = {
  pesos: 2_500_000,
  dolares: 0,
  deuda: 0,
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
    { id: "f2", x: 2, y: 0, type: "olivo", name: "Chilecito", stock: 0, growth: 50 },
    { id: "f3", x: 0, y: 2, type: "nogal", name: "Valle del Bermejo", stock: 0, growth: 20 },
    { id: "f4", x: 2, y: 2, type: "vid", name: "Nonogasta", stock: 0, growth: 45 },
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
  personalDisponible: generatePool(6, 350_000),
  personalContratado: initialPermanentes,
  tech: { riego: false, mecanizacion: false, drones: false },
  researching: null,
  moratoria: { activa: false, cuotasRestantes: 0, cuotaMensual: 0, objetivoUSD: 0, exportadoUSD: 0, cumplida: false },
};

type Action =
  | { type: "TICK" }
  | { type: "TOGGLE_PAUSE" }
  | { type: "HARVEST"; fincaId: string }
  | { type: "SELL_LOCAL"; fincaId: string; amount: number }
  | { type: "EXPORT"; factoryId: string; amount: number }
  | { type: "PROCESS"; factoryId: string; fincaId: string; amount: number }
  | { type: "BUILD_FACTORY"; factoryType: FactoryType; fincaId: string }
  | { type: "PLACE_FACTORY"; factoryType: FactoryType; fincaId: string }
  | { type: "HIRE_GOLONDRINA"; count: number }
  | { type: "FIRE_GOLONDRINA" }
  | { type: "HIRE_WORKER"; workerId: string }
  | { type: "FIRE_WORKER"; workerId: string }
  | { type: "REFRESH_POOL" }
  | { type: "SET_SALARIO"; value: number }
  | { type: "PAY_RAISE"; pct: number }
  | { type: "LIQUIDAR"; usd: number }
  | { type: "BUY_FINCA"; cropType: CropType }
  | { type: "RESEARCH"; tech: TechId }
  | { type: "TAKE_MORATORIA" }
  | { type: "RESET_GAME" }
  | { type: "LOAD_STATE"; state: GameState };

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

export const TECH_INFO: Record<TechId, { name: string; cost: number; meses: number; desc: string; icon: string }> = {
  riego: { name: "Riego por Goteo", cost: 5_000_000, meses: 2, desc: "+20% rendimiento en vid/olivo. Reduce costo operativo.", icon: "💧" },
  mecanizacion: { name: "Mecanización Pesada", cost: 12_000_000, meses: 3, desc: "-30% costo de procesamiento. Tractores duplicados, menos golondrinas.", icon: "🚜" },
  drones: { name: "Drones de Monitoreo", cost: 8_000_000, meses: 2, desc: "+15% precio FOB. Mitiga impacto de inflación y clima.", icon: "🛸" },
};

function isHarvestMonth(mes: number) {
  const m = ((mes - 1) % 12) + 1;
  return m >= 1 && m <= 3;
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
      const yieldMult = state.tech.riego ? 1.2 : 1;
      const capacidad = (state.trabajadoresPermanentes + state.trabajadoresGolondrina) * 200;
      let usadoCap = 0;
      const fincas = state.fincas.map((f) => {
        let growth = Math.min(100, f.growth + (harvest ? 8 : 4));
        let stock = f.stock;
        if (harvest && growth >= 80) {
          const baseRend = (f.type === "vid" || f.type === "olivo") ? yieldMult : 1;
          const potencial = Math.floor(growth * 15 * (state.moralTrabajadores / 100) * baseRend);
          const restante = Math.max(0, capacidad - usadoCap);
          const cosechado = Math.min(potencial, restante);
          const perdido = potencial - cosechado;
          usadoCap += cosechado;
          stock += cosechado;
          growth = perdido > 0 ? 50 : 30;
        }
        if (stock > capacidad && capacidad >= 0) {
          const exceso = stock - capacidad;
          stock = capacidad + Math.floor(exceso * 0.8);
        }
        return { ...f, growth, stock };
      });

      const totalTrab = state.trabajadoresPermanentes + state.trabajadoresGolondrina;
      const costoSalarios = totalTrab * state.salarioMensual;
      const ratioBlue = state.dolarBlue / state.tipoDeCambio;
      const insumosMult = state.tech.riego ? 0.85 : 1;
      const inflacionMitigada = state.tech.drones ? 0.7 : 1;
      const costoInsumos = Math.round(state.costoInsumosMensual * ratioBlue * insumosMult * (state.factories.length || 1));
      const salariosImpagos = costoSalarios > state.pesos;
      let pesos = state.pesos - costoSalarios - costoInsumos;

      const inflacionMensual = Math.max(2, state.inflacionMensual + rand(-0.6, 0.8) * inflacionMitigada);
      const inflacionAcumulada = state.inflacionAcumulada + state.inflacionMensual;

      const tipoDeCambio = Math.round(state.tipoDeCambio * (1 + state.inflacionMensual / 100 - 0.005));
      const brecha = Math.max(10, Math.min(120, state.brecha + rand(-3, 3)));
      const dolarBlue = Math.round(tipoDeCambio * (1 + brecha / 100));

      const moralDelta = (state.ultimoAumento - state.inflacionMensual) * 0.8;
      const moralPenalSalarios = salariosImpagos ? 25 : 0;
      const moralTrabajadores = Math.max(0, Math.min(100, state.moralTrabajadores + moralDelta - 1 - moralPenalSalarios));
      const huelga = moralTrabajadores <= 20;

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

      const due = state.pendingExports.filter((p) => p.monthDue <= mes);
      const pendingExports = state.pendingExports.filter((p) => p.monthDue > mes);
      let pesosCobrados = 0;
      for (const d of due) pesosCobrados += d.usd * tc2;
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

      // Moratoria: cobrar cuota mensual y verificar objetivo
      let moratoria = state.moratoria;
      if (moratoria.activa) {
        pesos -= moratoria.cuotaMensual;
        const cuotasRestantes = moratoria.cuotasRestantes - 1;
        if (cuotasRestantes <= 0) {
          if (moratoria.exportadoUSD >= moratoria.objetivoUSD) {
            // Cumple → bonificación 20% del total refinanciado
            const bonus = moratoria.cuotaMensual * 12 * 0.2;
            pesos += bonus;
            eventos.unshift({ id: `mor${mes}`, title: "Moratoria CUMPLIDA", description: `Cumpliste el objetivo de exportación. Bonificación de ${Math.round(bonus).toLocaleString("es-AR")} pesos.`, kind: "good", month: mes });
            moratoria = { ...moratoria, activa: false, cuotasRestantes: 0, cumplida: true };
          } else {
            // Falla → penalidad 30%
            const multa = moratoria.cuotaMensual * 12 * 0.3;
            pesos -= multa;
            eventos.unshift({ id: `mor${mes}`, title: "Moratoria INCUMPLIDA", description: `No alcanzaste el objetivo. Multa de ${Math.round(multa).toLocaleString("es-AR")} pesos.`, kind: "bad", month: mes });
            moratoria = { ...moratoria, activa: false, cuotasRestantes: 0 };
          }
        } else {
          moratoria = { ...moratoria, cuotasRestantes };
        }
      }

      // Deuda: si pesos < 0, acumula con interés mensual del 8%
      let deuda = state.deuda;
      if (pesos < 0) {
        deuda += Math.abs(pesos);
        pesos = 0;
      }
      deuda = Math.round(deuda * 1.08);

      // Refresh pool de RRHH cada 3 meses
      let personalDisponible = state.personalDisponible;
      if (mes % 3 === 0) personalDisponible = generatePool(6, state.salarioMensual);

      // I+D en progreso
      let researching = state.researching;
      let tech = state.tech;
      if (researching) {
        const r = researching.mesesRestantes - 1;
        if (r <= 0) {
          tech = { ...tech, [researching.tech]: true };
          eventos.unshift({ id: `tdone${mes}`, title: `I+D Completada: ${TECH_INFO[researching.tech].name}`, description: TECH_INFO[researching.tech].desc, kind: "good", month: mes });
          researching = null;
        } else {
          researching = { ...researching, mesesRestantes: r };
        }
      }

      if (salariosImpagos) {
        eventos.unshift({ id: `imp${mes}`, title: "Sueldos impagos", description: "No alcanzaron los pesos para pagar la planilla. La moral se desplomó.", kind: "bad", month: mes });
      }

      const patrimonio = pesos + state.dolares * tc2 - deuda +
        fincas2.reduce((s, f) => s + f.stock * 50, 0) +
        state.factories.reduce((s, fa) => s + fa.processed * 200, 0) +
        pendingExports.reduce((s, p) => s + p.usd * tc2, 0);

      const history = [...state.history, { month: mes, inflacion: Math.round(inflacionAcumulada), patrimonio: Math.round(patrimonio), deuda: Math.round(deuda) }].slice(-36);

      return {
        ...state,
        mes,
        fincas: fincas2,
        pesos,
        deuda,
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
        personalDisponible,
        moratoria,
        researching,
        tech,
      };
    }

    case "HARVEST": {
      const f = state.fincas.find((x) => x.id === action.fincaId);
      if (!f || f.growth < 50) return state;
      const mult = state.tech.riego && (f.type === "vid" || f.type === "olivo") ? 1.2 : 1;
      const cosechado = Math.floor(f.growth * 12 * (state.moralTrabajadores / 100) * mult);
      return {
        ...state,
        fincas: state.fincas.map((x) => x.id === f.id ? { ...x, stock: x.stock + cosechado, growth: 20 } : x),
      };
    }

    case "SELL_LOCAL": {
      const f = state.fincas.find((x) => x.id === action.fincaId);
      if (!f) return state;
      const amt = Math.min(action.amount, f.stock);
      const precio = f.type === "vid" ? 1200 : f.type === "olivo" ? 900 : 2400;
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
      const baseCost = state.tech.mecanizacion ? 70 : 100;
      const cost = amt * baseCost;
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
      const baseFOB = fa.type === "bodega" ? 8 : fa.type === "almazara" ? 6 : 22;
      const precioFOB = state.tech.drones ? baseFOB * 1.15 : baseFOB;
      const bruto = amt * precioFOB;
      const neto = bruto * (1 - state.retenciones / 100);
      const pending: PendingExport = {
        id: `pe${Date.now()}`,
        factoryType: fa.type,
        usd: neto,
        monthDue: state.mes + 2,
      };
      const moratoria = state.moratoria.activa
        ? { ...state.moratoria, exportadoUSD: state.moratoria.exportadoUSD + neto }
        : state.moratoria;
      return {
        ...state,
        moratoria,
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

    case "BUILD_FACTORY":
    case "PLACE_FACTORY": {
      const cost = 1_500_000;
      if (state.pesos < cost) return state;
      const fi = state.fincas.find((f) => f.id === action.fincaId);
      if (!fi) return state;
      if (factoryFor[fi.type] !== action.factoryType) return state;
      if (state.factories.some((fa) => fa.x === fi.x && fa.y === fi.y)) return state;
      const id = `fa${Date.now()}`;
      return {
        ...state,
        pesos: state.pesos - cost,
        factories: [...state.factories, { id, type: action.factoryType, x: fi.x, y: fi.y, processed: 0 }],
        eventos: [
          { id: `bld${Date.now()}`, title: "Construcción", description: `Se levantó una ${factoryLabel[action.factoryType]} en ${fi.name}.`, kind: "good" as const, month: state.mes },
          ...state.eventos,
        ].slice(0, 20),
      };
    }

    case "HIRE_GOLONDRINA": {
      const cost = action.count * 80_000;
      if (state.pesos < cost) return state;
      const nuevos = generatePool(action.count, state.salarioMensual).map((w) => ({ ...w, tipo: "golondrina" as const }));
      return {
        ...state,
        pesos: state.pesos - cost,
        trabajadoresGolondrina: state.trabajadoresGolondrina + action.count,
        personalContratado: [...state.personalContratado, ...nuevos],
      };
    }

    case "FIRE_GOLONDRINA":
      return {
        ...state,
        trabajadoresGolondrina: 0,
        personalContratado: state.personalContratado.filter((w) => w.tipo !== "golondrina"),
      };

    case "HIRE_WORKER": {
      const w = state.personalDisponible.find((x) => x.id === action.workerId);
      if (!w) return state;
      const cost = w.salario * 0.5;
      if (state.pesos < cost) return state;
      const isHarvest = isHarvestMonth(state.mes);
      const tipo: Worker["tipo"] = isHarvest ? "golondrina" : "permanente";
      return {
        ...state,
        pesos: state.pesos - cost,
        personalDisponible: state.personalDisponible.filter((x) => x.id !== w.id),
        personalContratado: [...state.personalContratado, { ...w, tipo }],
        trabajadoresPermanentes: tipo === "permanente" ? state.trabajadoresPermanentes + 1 : state.trabajadoresPermanentes,
        trabajadoresGolondrina: tipo === "golondrina" ? state.trabajadoresGolondrina + 1 : state.trabajadoresGolondrina,
      };
    }

    case "FIRE_WORKER": {
      const w = state.personalContratado.find((x) => x.id === action.workerId);
      if (!w) return state;
      return {
        ...state,
        personalContratado: state.personalContratado.filter((x) => x.id !== w.id),
        trabajadoresPermanentes: w.tipo === "permanente" ? Math.max(0, state.trabajadoresPermanentes - 1) : state.trabajadoresPermanentes,
        trabajadoresGolondrina: w.tipo === "golondrina" ? Math.max(0, state.trabajadoresGolondrina - 1) : state.trabajadoresGolondrina,
      };
    }

    case "REFRESH_POOL":
      return { ...state, personalDisponible: generatePool(6, state.salarioMensual) };

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
      for (let y = 0; y < 5 && !pos; y++) {
        for (let x = 0; x < 5 && !pos; x++) {
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

    case "RESEARCH": {
      const info = TECH_INFO[action.tech];
      if (state.tech[action.tech]) return state;
      if (state.researching) return state;
      if (state.pesos < info.cost) return state;
      return {
        ...state,
        pesos: state.pesos - info.cost,
        researching: { tech: action.tech, mesesRestantes: info.meses },
        eventos: [
          { id: `tech${Date.now()}`, title: `I+D iniciada: ${info.name}`, description: `Inversión de ${(info.cost / 1_000_000).toFixed(1)}M. Lista en ${info.meses} mes(es).`, kind: "info" as const, month: state.mes },
          ...state.eventos,
        ].slice(0, 20),
      };
    }

    case "TAKE_MORATORIA": {
      if (state.moratoria.activa || state.deuda < 14_000_000) return state;
      const refinanciado = state.deuda;
      const cuotaMensual = Math.round(refinanciado / 12);
      // objetivo: equivalente USD oficial al 50% del refinanciado
      const objetivoUSD = Math.round((refinanciado * 0.5) / state.tipoDeCambio);
      return {
        ...state,
        deuda: 0,
        moratoria: {
          activa: true,
          cuotasRestantes: 12,
          cuotaMensual,
          objetivoUSD,
          exportadoUSD: 0,
          cumplida: false,
        },
        eventos: [
          { id: `mortake${Date.now()}`, title: "Crédito de Fomento Riojano", description: `Refinanciado ${(refinanciado / 1_000_000).toFixed(1)}M en 12 cuotas. Objetivo: exportar US$${objetivoUSD.toLocaleString("es-AR")} en 12 meses.`, kind: "info" as const, month: state.mes },
          ...state.eventos,
        ].slice(0, 20),
      };
    }

    case "RESET_GAME":
      return initial;

    case "LOAD_STATE":
      return action.state;
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
