# Overhaul v5.0 — "Sistémica Riojana"

Esto es un salto enorme respecto a v4: pasamos de un tablero 5x5 con eventos por turno a un **simulador sistémico 20x20** con geografía, logística, vivienda, salud y simulación en tiempo real. Lo divido en bloques entregables y verificables, en el orden de ejecución que pediste.

---

## Bloque 1 — Motor de mapa 20x20 con geografía procedural

**Estado**
- `state.map`: matriz 20x20 de celdas `{ x, y, terrain, owned, building, road, waterRange, elevation }`.
- `terrain`: `'plain' | 'cerro' | 'rio' | 'piedra'`.
- Generación procedural (seed fija para que el guardado funcione): cerros agrupados en clusters, ríos como líneas Bezier, parches de piedra dispersos.
- Solo el área central 6x6 viene desbloqueada. Resto = "Parcela de Expansión" (costo escalonado, ej. $2M base × distancia al centro).

**Render `IsometricGrid.tsx`**
- Tiles base por terrain (sprites HD vía `imagegen`: `tile-cerro.png`, `tile-rio.png`, `tile-piedra.png`, `tile-locked.png`).
- Cerros con `transform: translateY(-elevation)` + sombra proyectada en isométrico.
- Cámara con zoom (0.4–2.5) y pan vía drag (ya existe en v4, lo extiendo). Viewport-culling para no renderizar 400 tiles de golpe.

**Interacción**
- Click en celda no-owned → modal "Comprar parcela: $X".
- Cerro → no construible. Río → requiere "Puente" (edificio). Piedra → requiere I+D "Limpieza de Suelo" desbloqueada.

---

## Bloque 2 — Logística: caminos, agua, maquinaria

**Caminos (modo construcción)**
- Toolbar con herramienta "Camino" (drag para trazar línea).
- Algoritmo BFS sobre celdas con `road=true` desde almacén central. Cada finca/edificio guarda `connected: boolean`.
- Si `connected===false` → producción y cosecha pausadas (badge rojo "Sin conexión vial" sobre la finca).

**Pozos de Agua**
- Edificio `pozo-agua.png`, radio 3 celdas (Chebyshev). Pre-calculo `state.waterCoverage: Set<"x,y">`.
- Fincas fuera de cobertura → multiplicador rendimiento × 0.5.

**Maquinaria**
- `state.vehiculos: { tractores: number, hilux: number, tanquesAgua: number }`.
- Comprar tractor → animación framer-motion recorriendo surcos + reduce `requiredPermanentes` por finca asignada en 5.

---

## Bloque 3 — Social Engine: vivienda, comedor, salud

**Viviendas (3 niveles)**
- `Campamento` ($800K, capacidad 10, moral base 40).
- `Casas de Finca` ($3M, capacidad 25, moral base 60).
- `Barrio Agrícola Pro` ($10M, capacidad 60, moral base 80).
- Botón "Mejorar" en el edificio.

**Soporte social**
- `Comedor Comunitario` ($1.5M, radio 4, +15 moral/mes a trabajadores en radio, -20% rotación).
- `Puesto de Salud` ($4M, radio 5, -50% bajas por enfermedad, mitiga -50% caída moral por Zonda).

**Lógica de proximidad**
- Cada trabajador asignado a una finca consulta su vivienda más cercana (Manhattan).
- Si distancia > 5 → `moral -= 10/mes` adicional. Visualización: línea punteada rosa entre vivienda y finca cuando la finca está seleccionada.

---

## Bloque 4 — Loop en tiempo real

- Reemplazo el avance manual por mes con un **tick de simulación cada N ms** (default 4s/mes, controles ⏸ ▶ ⏩ ⏩⏩).
- Toda la lógica económica existente (inflación, USD, retenciones 12%, exportación diferida) corre dentro del tick — no se rompe nada.
- Menús abiertos no pausan el tiempo (salvo botón pause explícito).

**Licitaciones**
- Cada 6 meses: evento "Licitación premium" con +20% USD si hay I+D `calidadPremium` desbloqueada. Cobro diferido 3 meses, liquidación al oficial vigente al momento del cobro (ya está la lógica base).

---

## Bloque 5 — RRHH y persistencia

- Dashboard RRHH (`RRHHPanel.tsx`) ya existe. Lo extiendo con:
  - Estado dinámico por trabajador: `feliz | neutral | descontento | enfermo | en huelga` (derivado de moral + cobertura salud + proximidad).
  - Indicador de vivienda asignada y tiempo de viaje.
- Persistencia: ya hay autosave en localStorage. Agrego `mapVersion: 5` para invalidar saves viejos y serializo `map`, `vehiculos`, `viviendas`, `infraSocial`.

---

## Bloque 6 — Estética High-Fidelity

- Fondo `#020617`, glassmorphism existente, fuente `Urbanist` (ya cargada).
- VFX:
  - Sombras de cerros con `filter: drop-shadow()` direccional.
  - Partículas Zonda: capa `<canvas>` con polvo naranja animado (ya existe overlay sepia, le sumo partículas).
  - Pulso suave en fincas sin conexión vial.
- Toolbar de construcción flotante (glass) con categorías: Caminos · Agua · Vivienda · Social · Industria.

---

## Detalle técnico

```text
src/game/
  MapEngine.ts          ← generación procedural 20x20 + helpers (BFS, radio, distancia)
  GameContext.tsx       ← extender state (map, vehiculos, viviendas, infraSocial, simSpeed)
  IsometricGrid.tsx     ← render 20x20 + culling + zoom/pan extendido
  BuildToolbar.tsx      ← nueva: catálogo de edificios drag-to-place
  ExpansionModal.tsx    ← compra de parcelas
  SimClock.tsx          ← tick loop + controles ⏸▶⏩⏩⏩
  RRHHPanel.tsx         ← extender con estados anímicos + proximidad
  ResearchPanel.tsx     ← agregar 'limpiezaSuelo' y 'calidadPremium'
  AmbientOverlay.tsx    ← + canvas partículas Zonda
src/assets/
  tile-cerro.png, tile-rio.png, tile-piedra.png, tile-locked.png
  build-pozo.png, build-puente.png, build-comedor.png, build-salud.png
  build-vivienda-1.png, build-vivienda-2.png, build-vivienda-3.png
```

**Sprites nuevos**: 11 PNG transparentes 768×768, isométricos 30°, vía `imagegen` calidad `standard`.

---

## Riesgos / decisiones

- **Performance 20x20 = 400 tiles**: uso `React.memo` por celda + viewport culling (solo renderizo lo visible según pan/zoom). Las animaciones framer-motion se reducen a tractores/trabajadores en fincas visibles.
- **Save migration**: los saves v4 quedan invalidados (bumpeo `mapVersion` y muestro toast "Nueva partida — overhaul v5"). No hay forma sensata de migrar un 5x5 a un 20x20 con geografía.
- **Scope**: este overhaul toca casi todos los archivos del juego. Si preferís que arranque solo por el **Bloque 1 + 3** (mapa + vivienda/salud, que es lo que pediste como primera instrucción de ejecución) y dejemos logística/loop tiempo real para una segunda iteración, decímelo. Si no, voy con todo de corrido.

---

¿Procedo con el overhaul completo, o querés que lo entregue por bloques (empezando por Bloque 1 + Bloque 3 como indicaste en la instrucción de ejecución)?
