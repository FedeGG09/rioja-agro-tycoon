import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { GameProvider, useGame, type Finca } from "@/game/GameContext";
import { IsometricGrid } from "@/game/IsometricGrid";
import { HUD } from "@/game/HUD";
import { SidePanel } from "@/game/SidePanel";
import { EventsLog, Dashboard } from "@/game/EventsAndChart";

export const Route = createFileRoute("/")({
  component: Index,
  head: () => ({
    meta: [
      { title: "La Rioja Agro-Tycoon — Simulador económico riojano" },
      { name: "description", content: "Simulación económica argentina: vid, olivo y nogal en La Rioja. Gestioná inflación, dólar, retenciones y cosecha golondrina." },
    ],
  }),
});

function GameUI() {
  const { state } = useGame();
  const [selectedId, setSelectedId] = useState<string | undefined>(undefined);
  const selected = state.fincas.find((f) => f.id === selectedId);
  return (
    <div className="min-h-screen p-4">
      <div className="mx-auto max-w-7xl space-y-4">
        <HUD />
        <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
          <div className="space-y-4">
            <IsometricGrid onSelect={(f: Finca) => setSelectedId(f.id)} selectedId={selectedId} />
            <Dashboard />
            <EventsLog />
          </div>
          <SidePanel selected={selected} />
        </div>
      </div>
    </div>
  );
}

function Index() {
  return (
    <GameProvider>
      <GameUI />
    </GameProvider>
  );
}
