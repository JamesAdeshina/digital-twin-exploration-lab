import { useEffect, useMemo, useState } from "react";
import { Activity, AlertTriangle, Download, Pause, Play, RotateCcw, Wrench } from "lucide-react";
import type { MachineId, MachineState, SensorReading, WhatIfScenario } from "./types";
import {
  createInitialFactory,
  injectFault,
  parseSensorCsv,
  repairFault,
  runWhatIf,
  stepFactory,
  updateMachine,
} from "./simulation/engine";
import { FactoryScene } from "./components/FactoryScene";
import { SensorChart, WhatIfChart } from "./components/Charts";
import { SAMPLE_CSV } from "./data/sampleCsv";

const statusTone = {
  normal: "text-emerald-300 bg-emerald-400/10 border-emerald-400/30",
  warning: "text-amber-300 bg-amber-400/10 border-amber-400/30",
  critical: "text-rose-300 bg-rose-400/10 border-rose-400/30",
  stopped: "text-slate-300 bg-slate-400/10 border-slate-400/30",
};

function App() {
  const [factory, setFactory] = useState(createInitialFactory);
  const [selectedId, setSelectedId] = useState<MachineId>("cnc");
  const [viewMode, setViewMode] = useState<"solid" | "wireframe" | "pointcloud">("solid");
  const [scenario, setScenario] = useState<WhatIfScenario>({
    machineId: "cnc",
    workload: 80,
    rpm: 2100,
    cooling: true,
  });

  useEffect(() => {
    const timer = window.setInterval(() => {
      setFactory((current) => stepFactory(current));
    }, 1000);
    return () => window.clearInterval(timer);
  }, []);

  const selectedMachine = factory.machines.find((machine) => machine.id === selectedId) ?? factory.machines[0];
  const chartData = useMemo(() => readingsForMachine(factory.dataMode === "live" ? factory.history : factory.importedHistory, selectedId), [factory, selectedId]);
  const whatIfData = useMemo(() => runWhatIf(selectedMachine, { ...scenario, machineId: selectedId }), [selectedMachine, scenario, selectedId]);
  const lineBlocked = factory.machines.some((machine) => machine.state === "critical");

  function patchSelected(update: Partial<MachineState>) {
    setFactory((current) => updateMachine(current, selectedId, update));
  }

  function downloadSampleCsv() {
    const blob = new Blob([SAMPLE_CSV], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "factorytwin-sample-sensor-data.csv";
    link.click();
    URL.revokeObjectURL(url);
  }

  function importCsv(file: File | undefined) {
    if (!file) return;
    file.text().then((text) => {
      const importedHistory = parseSensorCsv(text);
      setFactory((current) => ({ ...current, importedHistory, dataMode: "imported" }));
    });
  }

  function applyScenario() {
    setFactory((current) =>
      updateMachine(current, selectedId, {
        workload: scenario.workload,
        rpm: scenario.rpm,
        cooling: scenario.cooling,
      }),
    );
  }

  return (
    <main className="min-h-screen bg-[#090d13] text-ink">
      <div className="flex min-h-screen flex-col gap-3 p-3 lg:grid lg:grid-cols-[310px_minmax(0,1fr)_360px]">
        <aside className="panel flex flex-col gap-3">
          <Header />
          <section className="rounded border border-cyanline/25 bg-cyanline/10 p-3">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-cyanline">
              <Activity size={16} /> Simulated Data
            </div>
            <p className="mt-2 text-sm text-slate-300">
              FactoryTwin 3D mirrors equipment state, sensor history, and operating changes in a virtual factory. The equations are illustrative and are not physically validated.
            </p>
          </section>
          <section>
            <div className="section-title">Factory Overview</div>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <Metric label="Runtime" value={`${factory.time}s`} />
              <Metric label="Speed" value={`${factory.speed}x`} />
              <Metric label="Line" value={lineBlocked ? "Blocked" : factory.running ? "Running" : "Paused"} danger={lineBlocked} />
              <Metric label="Products" value={String(factory.products.length)} />
            </div>
          </section>
          <section>
            <div className="section-title">Production Controls</div>
            <div className="grid grid-cols-3 gap-2">
              <button className="command" onClick={() => setFactory((current) => ({ ...current, running: true }))} title="Start simulation">
                <Play size={18} /> Start
              </button>
              <button className="command" onClick={() => setFactory((current) => ({ ...current, running: false }))} title="Pause simulation">
                <Pause size={18} /> Pause
              </button>
              <button className="command" onClick={() => setFactory(createInitialFactory())} title="Reset factory">
                <RotateCcw size={18} /> Reset
              </button>
            </div>
            <div className="mt-3 flex rounded border border-slate-700 bg-slate-950 p-1">
              {[1, 2, 5].map((speed) => (
                <button
                  key={speed}
                  className={`flex-1 rounded px-3 py-2 text-sm ${factory.speed === speed ? "bg-cyanline text-slate-950" : "text-slate-300"}`}
                  onClick={() => setFactory((current) => ({ ...current, speed: speed as 1 | 2 | 5 }))}
                >
                  {speed}x
                </button>
              ))}
            </div>
          </section>
          <section>
            <div className="section-title">Machines</div>
            <div className="space-y-2">
              {factory.machines.map((machine) => (
                <button
                  key={machine.id}
                  onClick={() => {
                    setSelectedId(machine.id);
                    setScenario((current) => ({ ...current, machineId: machine.id, workload: machine.workload, rpm: machine.rpm, cooling: machine.cooling }));
                  }}
                  className={`w-full rounded border p-3 text-left transition ${selectedId === machine.id ? "border-cyanline bg-cyanline/10" : "border-slate-700 bg-slate-900/70 hover:border-slate-500"}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold">{machine.name}</span>
                    <span className={`rounded border px-2 py-1 text-[11px] uppercase ${statusTone[machine.state]}`}>{machine.state}</span>
                  </div>
                  <div className="mt-2 text-xs text-slate-400">Health {machine.health.toFixed(0)}% · Risk {machine.failureRisk.toFixed(0)}%</div>
                </button>
              ))}
            </div>
          </section>
          <StatusLegend />
        </aside>

        <section className="flex min-h-[520px] flex-col overflow-hidden rounded border border-slate-800 bg-slate-950 shadow-glow">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 px-4 py-3">
            <div>
              <h1 className="text-xl font-bold">FactoryTwin 3D</h1>
              <p className="text-sm text-slate-400">Interactive manufacturing digital twin prototype</p>
            </div>
            <div className="flex gap-2">
              {(["solid", "wireframe", "pointcloud"] as const).map((mode) => (
                <button key={mode} className={`chip ${viewMode === mode ? "chip-active" : ""}`} onClick={() => setViewMode(mode)}>
                  {mode === "pointcloud" ? "Synthetic point cloud" : mode}
                </button>
              ))}
            </div>
          </div>
          <FactoryScene
            machines={factory.machines}
            products={factory.products}
            selectedId={selectedId}
            viewMode={viewMode}
            running={factory.running && !lineBlocked}
            onSelect={setSelectedId}
          />
          <div className="border-t border-slate-800 px-4 py-3 text-sm text-slate-300">
            Changing workload and RPM increases generated heat and vibration. Cooling removes heat; sustained heat, vibration, and injected faults increase wear and failure risk.
          </div>
        </section>

        <aside className="panel flex flex-col gap-3">
          <section>
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="section-title">Selected Machine</div>
                <h2 className="text-lg font-bold">{selectedMachine.name}</h2>
              </div>
              <span className={`rounded border px-2 py-1 text-xs uppercase ${statusTone[selectedMachine.state]}`}>{selectedMachine.state}</span>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <Metric label="Temp" value={`${selectedMachine.temperature.toFixed(1)} C`} />
              <Metric label="Vibration" value={`${selectedMachine.vibration.toFixed(1)} mm/s`} />
              <Metric label="RPM" value={String(selectedMachine.rpm)} />
              <Metric label="Workload" value={`${selectedMachine.workload}%`} />
              <Metric label="Health" value={`${selectedMachine.health.toFixed(0)}%`} />
              <Metric label="Failure Risk" value={`${selectedMachine.failureRisk.toFixed(0)}%`} danger={selectedMachine.failureRisk > 55} />
              <Metric label="Cooling" value={selectedMachine.cooling ? "Enabled" : "Disabled"} danger={!selectedMachine.cooling} />
              <Metric label="Mode" value={factory.dataMode} />
            </div>
          </section>
          <MachineControls machine={selectedMachine} onChange={patchSelected} onFault={() => setFactory((current) => injectFault(current, selectedId))} onRepair={() => setFactory((current) => repairFault(current, selectedId))} />
          <section>
            <div className="section-title">Historical Sensor Graph</div>
            <SensorChart data={chartData} />
            <div className="mt-2 flex flex-wrap gap-2">
              <label className="command cursor-pointer">
                Import CSV
                <input className="hidden" type="file" accept=".csv,text/csv" onChange={(event) => importCsv(event.target.files?.[0])} />
              </label>
              <button className="command" onClick={downloadSampleCsv}>
                <Download size={16} /> Sample CSV
              </button>
              <button className="command" onClick={() => setFactory((current) => ({ ...current, dataMode: "live" }))}>Live</button>
              <button className="command" onClick={() => setFactory((current) => ({ ...current, dataMode: "imported" }))}>Imported</button>
            </div>
          </section>
          <section>
            <div className="section-title">What-if Analysis</div>
            <Control label="Hypothetical workload" value={scenario.workload} min={0} max={100} step={1} onChange={(value) => setScenario((current) => ({ ...current, workload: value }))} />
            <Control label="Hypothetical RPM" value={scenario.rpm} min={200} max={2600} step={50} onChange={(value) => setScenario((current) => ({ ...current, rpm: value }))} />
            <label className="mt-3 flex items-center justify-between rounded border border-slate-700 bg-slate-900 px-3 py-2 text-sm">
              Cooling enabled
              <input type="checkbox" checked={scenario.cooling} onChange={(event) => setScenario((current) => ({ ...current, cooling: event.target.checked }))} />
            </label>
            <WhatIfChart data={whatIfData} />
            <button className="command mt-2 w-full justify-center" onClick={applyScenario}>
              <Wrench size={16} /> Apply Scenario
            </button>
          </section>
        </aside>
      </div>
    </main>
  );
}

function Header() {
  return (
    <div>
      <div className="inline-flex rounded border border-cyanline/40 bg-cyanline/10 px-2 py-1 text-xs font-bold uppercase tracking-[0.2em] text-cyanline">
        MVP
      </div>
      <h1 className="mt-2 text-2xl font-bold">FactoryTwin 3D</h1>
      <p className="text-sm text-slate-400">Monitor, stress test, and replay a virtual production line.</p>
    </div>
  );
}

function MachineControls({ machine, onChange, onFault, onRepair }: { machine: MachineState; onChange: (update: Partial<MachineState>) => void; onFault: () => void; onRepair: () => void }) {
  return (
    <section>
      <div className="section-title">Machine Controls</div>
      <Control label="Workload" value={machine.workload} min={0} max={100} step={1} onChange={(workload) => onChange({ workload })} />
      <Control label="RPM" value={machine.rpm} min={200} max={2600} step={50} onChange={(rpm) => onChange({ rpm })} />
      <label className="mt-3 flex items-center justify-between rounded border border-slate-700 bg-slate-900 px-3 py-2 text-sm">
        Cooling
        <input type="checkbox" checked={machine.cooling} onChange={(event) => onChange({ cooling: event.target.checked })} />
      </label>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <button className="command border-rose-500/50 text-rose-200" onClick={onFault}>
          <AlertTriangle size={16} /> Inject Fault
        </button>
        <button className="command border-emerald-500/50 text-emerald-200" onClick={onRepair}>
          <Wrench size={16} /> Repair
        </button>
      </div>
    </section>
  );
}

function Control({ label, value, min, max, step, onChange }: { label: string; value: number; min: number; max: number; step: number; onChange: (value: number) => void }) {
  return (
    <label className="mt-3 block">
      <div className="mb-1 flex justify-between text-sm text-slate-300">
        <span>{label}</span>
        <span>{value}</span>
      </div>
      <input className="w-full accent-cyanline" type="range" value={value} min={min} max={max} step={step} onChange={(event) => onChange(Number(event.target.value))} />
    </label>
  );
}

function Metric({ label, value, danger = false }: { label: string; value: string; danger?: boolean }) {
  return (
    <div className={`rounded border p-3 ${danger ? "border-rose-500/40 bg-rose-500/10" : "border-slate-700 bg-slate-900"}`}>
      <div className="text-[11px] uppercase tracking-[0.14em] text-slate-500">{label}</div>
      <div className="mt-1 truncate text-sm font-semibold">{value}</div>
    </div>
  );
}

function StatusLegend() {
  return (
    <section>
      <div className="section-title">Status Legend</div>
      <div className="grid grid-cols-2 gap-2 text-sm">
        <Legend color="bg-emerald-400" label="Normal" />
        <Legend color="bg-amber-400" label="Warning" />
        <Legend color="bg-rose-500" label="Critical" />
        <Legend color="bg-slate-500" label="Stopped" />
      </div>
    </section>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-2 rounded border border-slate-700 bg-slate-900 px-3 py-2">
      <span className={`h-3 w-3 rounded-full ${color}`} />
      {label}
    </div>
  );
}

function readingsForMachine(readings: SensorReading[], machineId: MachineId) {
  return readings.filter((reading) => reading.machineId === machineId).slice(-80);
}

export default App;
