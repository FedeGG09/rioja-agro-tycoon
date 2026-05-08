import { NOMBRES, APELLIDOS } from "./NAMES";

export interface Worker {
  id: string;
  nombre: string;
  apellido: string;
  experiencia: number; // 1..10
  moral: number; // 0..100
  tipo: "permanente" | "golondrina";
  salario: number;
  avatar: string; // url DiceBear
}

let nameSeed = 0;
const usedNames = new Set<string>();

function pickUniqueName(): { nombre: string; apellido: string } {
  for (let i = 0; i < 200; i++) {
    const n = NOMBRES[Math.floor(Math.random() * NOMBRES.length)];
    const a = APELLIDOS[Math.floor(Math.random() * APELLIDOS.length)];
    const key = `${n} ${a}`;
    if (!usedNames.has(key)) {
      usedNames.add(key);
      return { nombre: n, apellido: a };
    }
  }
  // fallback con sufijo
  nameSeed++;
  return {
    nombre: NOMBRES[nameSeed % NOMBRES.length],
    apellido: `${APELLIDOS[nameSeed % APELLIDOS.length]} ${nameSeed}`,
  };
}

export function generateWorker(tipo: Worker["tipo"] = "golondrina", baseSalario = 350_000): Worker {
  const { nombre, apellido } = pickUniqueName();
  const exp = Math.max(1, Math.min(10, Math.round(1 + Math.random() * 9)));
  const seed = encodeURIComponent(`${nombre}-${apellido}`);
  return {
    id: `w_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    nombre,
    apellido,
    experiencia: exp,
    moral: 60 + Math.round(Math.random() * 30),
    tipo,
    salario: Math.round(baseSalario * (0.8 + exp * 0.05)),
    avatar: `https://api.dicebear.com/7.x/personas/svg?seed=${seed}&backgroundColor=f4a261,e76f51,2a9d8f,e9c46a&backgroundType=gradientLinear`,
  };
}

export function generatePool(n: number, baseSalario = 350_000): Worker[] {
  return Array.from({ length: n }, () => generateWorker("golondrina", baseSalario));
}
