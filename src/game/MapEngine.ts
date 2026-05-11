// Procedural 20x20 map for La Rioja Agro-Tycoon v5
// Generación determinística con seed para que el guardado sea estable.

export type Terrain = "plain" | "cerro" | "rio" | "piedra";

export interface Cell {
  x: number;
  y: number;
  terrain: Terrain;
  elevation: number; // 0..3 (cerros)
  owned: boolean;
  road?: boolean;
}

export const MAP_SIZE = 20;
export const CENTER = { x: 10, y: 10 };
export const UNLOCKED_RADIUS = 3; // celdas a la redonda → 7x7 desbloqueado

// Mulberry32 — PRNG determinístico
function rng(seed: number) {
  let t = seed >>> 0;
  return () => {
    t |= 0; t = (t + 0x6D2B79F5) | 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

export function generateMap(seed = 42): Cell[][] {
  const r = rng(seed);
  const grid: Cell[][] = [];
  for (let y = 0; y < MAP_SIZE; y++) {
    const row: Cell[] = [];
    for (let x = 0; x < MAP_SIZE; x++) {
      const dx = x - CENTER.x;
      const dy = y - CENTER.y;
      const dist = Math.max(Math.abs(dx), Math.abs(dy));
      const owned = dist <= UNLOCKED_RADIUS;
      row.push({ x, y, terrain: "plain", elevation: 0, owned });
    }
    grid.push(row);
  }

  // Cerros: 3 clusters, fuera del centro
  for (let c = 0; c < 4; c++) {
    const cx = Math.floor(r() * MAP_SIZE);
    const cy = Math.floor(r() * MAP_SIZE);
    const size = 2 + Math.floor(r() * 3);
    for (let dy = -size; dy <= size; dy++) {
      for (let dx = -size; dx <= size; dx++) {
        const x = cx + dx;
        const y = cy + dy;
        if (x < 0 || x >= MAP_SIZE || y < 0 || y >= MAP_SIZE) continue;
        if (Math.hypot(dx, dy) > size) continue;
        // No bloquear el centro inicial
        const fromCenter = Math.max(Math.abs(x - CENTER.x), Math.abs(y - CENTER.y));
        if (fromCenter <= UNLOCKED_RADIUS) continue;
        if (r() < 0.85) {
          grid[y][x].terrain = "cerro";
          grid[y][x].elevation = 1 + Math.floor(r() * 3);
        }
      }
    }
  }

  // Río serpenteante (Bezier-ish, una columna que se mueve en y)
  let rx = Math.floor(r() * MAP_SIZE);
  for (let y = 0; y < MAP_SIZE; y++) {
    const fromCenter = Math.max(Math.abs(rx - CENTER.x), Math.abs(y - CENTER.y));
    if (fromCenter > UNLOCKED_RADIUS && grid[y][rx].terrain === "plain") {
      grid[y][rx].terrain = "rio";
    }
    if (r() < 0.45) rx += r() < 0.5 ? -1 : 1;
    rx = Math.max(0, Math.min(MAP_SIZE - 1, rx));
  }

  // Parches de piedra (~6%)
  for (let y = 0; y < MAP_SIZE; y++) {
    for (let x = 0; x < MAP_SIZE; x++) {
      const fromCenter = Math.max(Math.abs(x - CENTER.x), Math.abs(y - CENTER.y));
      if (fromCenter <= UNLOCKED_RADIUS) continue;
      if (grid[y][x].terrain === "plain" && r() < 0.06) {
        grid[y][x].terrain = "piedra";
      }
    }
  }

  return grid;
}

// Costo de comprar parcela según distancia al centro
export function parcelCost(x: number, y: number) {
  const d = Math.max(Math.abs(x - CENTER.x), Math.abs(y - CENTER.y));
  const base = 800_000;
  return Math.round(base * Math.max(1, d - UNLOCKED_RADIUS) * 1.6);
}

// Distancia Manhattan
export function manhattan(a: { x: number; y: number }, b: { x: number; y: number }) {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

// Cobertura por radio (Chebyshev)
export function inRange(a: { x: number; y: number }, b: { x: number; y: number }, radius: number) {
  return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y)) <= radius;
}

export function isBuildable(cell: Cell) {
  return cell.owned && cell.terrain === "plain";
}

// BFS sobre celdas con road=true desde CENTER. Devuelve set "x,y" alcanzables.
export function computeRoadNetwork(map: Cell[][]): Set<string> {
  const reach = new Set<string>();
  const startKey = `${CENTER.x},${CENTER.y}`;
  reach.add(startKey);
  const queue: Array<{ x: number; y: number }> = [{ x: CENTER.x, y: CENTER.y }];
  const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  while (queue.length) {
    const { x, y } = queue.shift()!;
    for (const [dx, dy] of dirs) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || nx >= MAP_SIZE || ny < 0 || ny >= MAP_SIZE) continue;
      const k = `${nx},${ny}`;
      if (reach.has(k)) continue;
      const c = map[ny][nx];
      if (!c.road) continue;
      reach.add(k);
      queue.push({ x: nx, y: ny });
    }
  }
  return reach;
}

// Edificio "conectado" si está sobre tile road alcanzable, o si una celda vecina lo está.
export function isConnected(x: number, y: number, reach: Set<string>): boolean {
  if (reach.has(`${x},${y}`)) return true;
  return reach.has(`${x+1},${y}`) || reach.has(`${x-1},${y}`) || reach.has(`${x},${y+1}`) || reach.has(`${x},${y-1}`);
}
