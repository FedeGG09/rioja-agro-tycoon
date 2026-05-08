# Overhaul v4.0 — La Rioja Agro-Tycoon "Skylines Edition"

Trabajo grande con varias áreas independientes. Lo divido en bloques entregables y verificables.

## Alcance

### 1. Estética isométrica de alta fidelidad
- Aumentar tamaño de tile (TILE_W 192, TILE_H 110) y board más grande (5x5).
- Regenerar sprites con `imagegen` en calidad `standard` (transparent PNG) para:
  - `tile-vid.png`: filas de viñedos con postes, alambres y sombras
  - `tile-olivo.png`: árboles individuales con sombras dinámicas
  - `tile-nogal.png`: nogales adultos con copa frondosa
  - `tile-empty.png`: tierra arada con surcos
  - `build-bodega.png`, `build-almazara.png`, `build-nuez.png`: edificios industriales detallados
  - `vehicle-tractor.png`, `vehicle-hilux.png`, `vehicle-tank.png`: maquinaria
  - `road-tile.png`: camino de tierra isométrico
- Tractor anima recorrido por los surcos (loop framer-motion) en parcelas activas.
- Hilux y tanque australiano se ubican estáticos junto a fincas/almacén.

### 2. RRHH realista
- Nuevo archivo `src/game/NAMES.ts` con 50 nombres + 50 apellidos riojanos.
- Helper `generateWorker()` → `{ id, nombre, apellido, experiencia (1–10), moral (0–100), avatar (DiceBear url) }`.
- Extender `GameContext`:
  - `personalDisponible: Worker[]` (refresca cada mes, 6 perfiles)
  - `personalContratado: Worker[]`
  - Acciones `HIRE_WORKER(id)`, `FIRE_WORKER(id)`, `REFRESH_POOL`.
  - Mantengo contadores agregados para no romper la lógica económica existente.
- Nuevo componente `RRHHPanel.tsx` con:
  - Sección "Personal Disponible" (cards con avatar circular, nombre, experiencia ★, moral barra)
  - Sección "Plantilla actual"
  - Botones contratar/despedir individual

### 3. UI dashboards modernos
- Nuevo `Sidebar` colapsable usando shadcn `Sidebar` con glassmorphism (sin reemplazar layout principal — sidebar derecho colapsable que aloja SidePanel + RRHH + I+D).
- Iconos Lucide consistentes (Tractor, Users, Beaker, Newspaper, DollarSign, Wheat).
- `EventsLog` rediseñado como toast/notificación social en bottom-center con avatar, timestamp y icono.

### 4. Ambientación y clima
- Overlay global `AmbientOverlay.tsx`:
  - Ciclo día → atardecer dorado según `state.mes` (gradiente fijo radial naranja-rosa con `mix-blend-overlay`, opacidad ~0.25 en meses 9-12, suave resto).
  - Cuando `state.eventoActivo === 'zonda'` (o se dispare) renderiza partículas/polvo naranja con filtro `backdrop-filter: sepia` y CSS animado.

### 5. Infraestructura — caminos automáticos
- Calcular caminos: para cada finca, dibujar línea isométrica (segmentos de tile) hacia el almacén central usando algoritmo Manhattan en grid.
- Renderizar `road-tile.png` por cada celda de camino, debajo de fincas/edificios pero encima del piso vacío.

### Zoom y pan
- Wrapper con `useState({ scale, x, y })`, gesture con `onWheel` (zoom 0.5–2) y pointer drag fuera de tiles para pan. Botones +/-/reset en esquina.

### 6. I+D / Árbol tecnológico
- Nuevo `ResearchPanel.tsx` y estado `tech: { riegoGoteo, mecanizacion, drones }` (booleans + costo en pesos).
- Costos: Riego $5M (+20% rendimiento vid/olivo), Mecanización $12M (-30% costo cosecha), Drones $8M (+15% precio venta export).
- Aplicar efectos visuales:
  - Riego goteo → overlay de líneas azules sobre tiles cultivadas
  - Mecanización → más tractores activos
  - Drones → emoji 🛸 orbitando finca
- Integrar multiplicadores en reducer existente (HARVEST, EXPORT) sin romper inflación.

### 7. Moratoria / Crédito de Fomento Riojano
- Nueva acción `TAKE_MORATORIA`:
  - Refinancia deuda actual a 12 cuotas, congela intereses.
  - Establece objetivo `exportObjetivoUSD` (ej: USD equivalente a deuda × 0.5).
  - Si en 12 meses no se cumple → multa 30%; si se cumple → cancela 20% bonificado.
- Botón visible cuando `deuda >= 14_000_000` en HUD/panel finanzas.

## Detalles técnicos

```text
src/
  game/
    NAMES.ts              ← nombres+apellidos
    workers.ts            ← generateWorker, helpers
    GameContext.tsx       ← extender state (personal, tech, moratoria)
    IsometricGrid.tsx     ← board 5x5, sprites HD, caminos, vehículos, zoom/pan
    AmbientOverlay.tsx    ← atardecer + zonda
    RRHHPanel.tsx
    ResearchPanel.tsx
    SidePanel.tsx         ← reorganizar con tabs (Finca / RRHH / I+D / Finanzas)
    EventsAndChart.tsx    ← rediseño notificación social
  assets/                 ← regenerar 7 + nuevos sprites
```

Mantengo intacta toda la lógica económica (pesos, inflación, tipo de cambio, retenciones 12%, exportación diferida 2 meses).

## Lo que voy a generar con imagegen
8–10 sprites nuevos en calidad `standard`, transparent PNG, 768×768 cada uno, isométricos, mismo ángulo 30°, paleta cohesiva (tierra árida riojana + verdes saturados).

## Riesgos / aclaraciones
- El estado `personalContratado` no reemplaza los contadores agregados (`trabajadoresPermanentes`, `trabajadoresGolondrina`) — los mantengo sincronizados para no romper cálculos de salario.
- Zoom/pan se aplica solo al board, no a la UI.
- El sidebar shadcn requiere `SidebarProvider` en el layout — lo agrego sin romper rutas.

¿Procedo con esta implementación completa, o querés que arranque por algún bloque puntual primero (por ejemplo solo sprites HD + caminos, o solo RRHH + I+D)?