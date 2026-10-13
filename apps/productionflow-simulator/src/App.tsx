import { useEffect, useMemo, useRef, useState } from "react";
import { BarChart3, Download, Pause, Play, RotateCcw, Save, SkipForward } from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { compareScenarios, createSimulation, runSimulation, stepNextEvent } from "./simulation/engine";
import { cloneScenario, PRESETS } from "./simulation/presets";
import type { ScenarioConfig, SimulationSnapshot, StageId, StationConfig } from "./simulation/types";

const stageOrder: StageId[] = ["cutting", "assembly", "inspection"];

function App() {
  const [config, setConfig] = useState(() => cloneScenario(PRESETS.balanced));
  const [preset, setPreset] = useState("balanced");
  const [running, setRunning] = useState(false);
  const [speed, setSpeed] = useState(2);
  const [baseline, setBaseline] = useState<ScenarioConfig>(() => cloneScenario(PRESETS.balanced));
  const simulationRef = useRef(createSimulation(config));
  const [snapshot, setSnapshot] = useState<SimulationSnapshot>(() => stepNextEvent(simulationRef.current));

  const comparison = useMemo(() => compareScenarios(baseline, config, 12), [baseline, config]);
  const bottleneckLabel = labelFor(snapshot.metrics.bottleneck, config);

  useEffect(() => {
    if (!running) return;
    const timer = window.setInterval(() => {
      let latest = snapshot;
      for (let index = 0; index < speed; index += 1) {
        latest = stepNextEvent(simulationRef.current);
        if (latest.time >= config.duration) {
          setRunning(false);
          break;
        }
      }
      setSnapshot(latest);
    }, 420);
    return () => window.clearInterval(timer);
  }, [running, speed, config.duration, snapshot]);

  function reset(nextConfig = config) {
    const fresh = createSimulation(nextConfig);
    simulationRef.current = fresh;
    setSnapshot(stepNextEvent(fresh));
    setRunning(false);
  }

  function applyConfig(next: ScenarioConfig) {
    setConfig(next);
    reset(next);
  }

  function applyPreset(id: string) {
    const next = cloneScenario(PRESETS[id]);
    setPreset(id);
    applyConfig(next);
  }

  function patchConfig(update: Partial<ScenarioConfig>) {
    const next = { ...config, ...update, stations: config.stations.map((station) => ({ ...station })) };
    applyConfig(next);
  }

  function patchStation(id: StageId, update: Partial<StationConfig>) {
    const next = {
      ...config,
      stations: config.stations.map((station) => (station.id === id ? { ...station, ...update } : { ...station })),
    };
    applyConfig(next);
  }

  function step() {
    setSnapshot(stepNextEvent(simulationRef.current));
  }

  function runFixedDuration() {
    const result = runSimulation(config);
    setSnapshot(result);
    setRunning(false);
  }

  function saveBaseline() {
    setBaseline(cloneScenario(config));
  }

  function exportJson() {
    download(
      "productionflow-scenario-summary.json",
      JSON.stringify({ config, metrics: snapshot.metrics, comparison }, null, 2),
      "application/json",
    );
  }

  function exportCsv() {
    const lines = [
      "metric,baseline,scenario",
      `throughputPerHour,${comparison.baseline.throughputPerHour.toFixed(3)},${comparison.scenario.throughputPerHour.toFixed(3)}`,
      `averageLeadTime,${comparison.baseline.averageLeadTime.toFixed(3)},${comparison.scenario.averageLeadTime.toFixed(3)}`,
      `wip,${comparison.baseline.wip},${comparison.scenario.wip}`,
      `completedJobs,${comparison.baseline.completedJobs},${comparison.scenario.completedJobs}`,
      "",
      "seed,throughputPerHour,averageLeadTime,completedJobs",
      ...comparison.replications.map((row) => `${row.seed},${row.throughputPerHour.toFixed(3)},${row.averageLeadTime.toFixed(3)},${row.completedJobs}`),
    ];
    download("productionflow-summary.csv", lines.join("\n"), "text/csv");
  }

  return (
    <main className="min-h-screen bg-[#090d13] text-ink">
      <div className="grid min-h-screen gap-3 p-3 xl:grid-cols-[330px_minmax(0,1fr)_380px]">
        <aside className="panel space-y-4">
          <header>
            <div className="text-xs font-black uppercase tracking-[0.2em] text-cyanline">Simulation & Engineering Modelling</div>
            <h1 className="mt-2 text-3xl font-black leading-none tracking-normal text-white">ProductionFlow Simulator</h1>
            <p className="mt-3 text-sm leading-6 text-slate-300">
              Discrete-event manufacturing model for queues, utilisation, bottlenecks, WIP, stochastic variability, and scenario decisions.
            </p>
          </header>

          <section className="rounded-md border border-amber-400/30 bg-amber-400/10 p-3 text-sm text-amber-100">
            Simulated time is not wall-clock time. The display speed only changes how quickly events are shown; it does not change simulated outputs.
          </section>

          <section>
            <div className="section-title">Run controls</div>
            <div className="grid grid-cols-3 gap-2">
              <button className="command command-primary" onClick={() => setRunning(true)} title="Start simulation">
                <Play size={17} /> Start
              </button>
              <button className="command" onClick={() => setRunning(false)} title="Pause simulation">
                <Pause size={17} /> Pause
              </button>
              <button className="command" onClick={() => reset()} title="Reset simulation">
                <RotateCcw size={17} /> Reset
              </button>
              <button className="command" onClick={step} title="Step to next event">
                <SkipForward size={17} /> Step
              </button>
              <button className="command" onClick={runFixedDuration} title="Run fixed duration">
                <BarChart3 size={17} /> Run
              </button>
              <button className="command" onClick={saveBaseline} title="Save baseline">
                <Save size={17} /> Base
              </button>
            </div>
            <Control label={`Display speed: ${speed} events/tick`}>
              <input className="range" type="range" min={1} max={12} value={speed} onChange={(event) => setSpeed(Number(event.target.value))} />
            </Control>
          </section>

          <section>
            <div className="section-title">Scenario inputs</div>
            <label className="grid gap-2 text-sm text-slate-300">
              Preset
              <select className="input" value={preset} onChange={(event) => applyPreset(event.target.value)}>
                <option value="balanced">Balanced line</option>
                <option value="overloadedAssembly">Overloaded assembly</option>
                <option value="cuttingFailures">Frequent cutting failures</option>
              </select>
            </label>
            <Control label={`Seed: ${config.seed}`}>
              <input className="range" type="range" min={1} max={99999} step={1} value={config.seed} onChange={(event) => patchConfig({ seed: Number(event.target.value) })} />
            </Control>
            <Control label={`Duration: ${config.duration.toFixed(0)} min`}>
              <input className="range" type="range" min={120} max={1440} step={30} value={config.duration} onChange={(event) => patchConfig({ duration: Number(event.target.value) })} />
            </Control>
            <Control label={`Mean interarrival: ${config.interarrivalMean.toFixed(1)} min`}>
              <input className="range" type="range" min={1.5} max={12} step={0.1} value={config.interarrivalMean} onChange={(event) => patchConfig({ interarrivalMean: Number(event.target.value) })} />
            </Control>
            <Control label={`Defect/rework: ${(config.defectRate * 100).toFixed(0)}%`}>
              <input className="range" type="range" min={0} max={0.3} step={0.01} value={config.defectRate} onChange={(event) => patchConfig({ defectRate: Number(event.target.value) })} />
            </Control>
          </section>

          <section className="space-y-3">
            <div className="section-title">Stations</div>
            {config.stations.map((station) => (
              <StationControls key={station.id} station={station} onChange={(update) => patchStation(station.id, update)} />
            ))}
          </section>
        </aside>

        <section className="space-y-3">
          <div className="panel">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="section-title">Live top-down flow</div>
                <p className="max-w-3xl text-sm text-slate-300">
                  Engine events drive the queue counts and job tokens. Animation is explanatory only; the priority-queue event engine determines results.
                </p>
              </div>
              <div className="rounded-md border border-rose-400/30 bg-rose-400/10 px-3 py-2 text-sm font-bold text-rose-100">
                Bottleneck: {bottleneckLabel}
              </div>
            </div>
            <FlowMap snapshot={snapshot} />
          </div>

          <div className="grid gap-3 lg:grid-cols-2">
            <div className="panel">
              <div className="section-title">Queue length history</div>
              <Chart data={snapshot.samples} type="area" />
            </div>
            <div className="panel">
              <div className="section-title">Station utilisation</div>
              <Chart data={snapshot.metrics.stations} type="bar" />
            </div>
          </div>

          <div className="panel">
            <div className="section-title">Event log</div>
            <div className="max-h-64 overflow-auto rounded border border-slate-800 bg-slate-950/70">
              {snapshot.log.slice(-28).reverse().map((entry, index) => (
                <div key={`${entry.time}-${index}`} className="grid grid-cols-[80px_1fr] border-b border-slate-800 px-3 py-2 text-sm last:border-b-0">
                  <span className="font-mono text-cyanline">{entry.time.toFixed(2)}m</span>
                  <span className="text-slate-300">{entry.message}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        <aside className="space-y-3">
          <section className="panel">
            <div className="section-title">Dashboard</div>
            <div className="grid grid-cols-2 gap-2">
              <Metric label="Sim time" value={`${snapshot.metrics.time.toFixed(1)}m`} />
              <Metric label="Throughput/hr" value={snapshot.metrics.throughputPerHour.toFixed(1)} />
              <Metric label="WIP" value={String(snapshot.metrics.wip)} />
              <Metric label="Avg lead time" value={`${snapshot.metrics.averageLeadTime.toFixed(1)}m`} />
              <Metric label="Completed" value={String(snapshot.metrics.completedJobs)} />
              <Metric label="Defect estimate" value={`${(snapshot.metrics.defectRate * 100).toFixed(1)}%`} />
            </div>
          </section>

          <section className="panel">
            <div className="section-title">Baseline vs scenario</div>
            <div className="grid gap-2 text-sm">
              <CompareRow label="Throughput/hr" base={comparison.baseline.throughputPerHour} scenario={comparison.scenario.throughputPerHour} />
              <CompareRow label="Lead time" base={comparison.baseline.averageLeadTime} scenario={comparison.scenario.averageLeadTime} suffix="m" lowerIsBetter />
              <CompareRow label="WIP" base={comparison.baseline.wip} scenario={comparison.scenario.wip} lowerIsBetter />
            </div>
            <div className="mt-4 rounded-md border border-slate-700 bg-slate-950/60 p-3 text-sm text-slate-300">
              12 seeded replications: throughput mean {comparison.throughputMean.toFixed(1)}/hr, spread {comparison.throughputSpread.toFixed(1)}; lead time mean {comparison.leadTimeMean.toFixed(1)}m, spread {comparison.leadTimeSpread.toFixed(1)}m.
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <button className="command" onClick={exportJson}>
                <Download size={17} /> JSON
              </button>
              <button className="command" onClick={exportCsv}>
                <Download size={17} /> CSV
              </button>
            </div>
          </section>

          <section className="panel">
            <div className="section-title">Station state</div>
            <div className="space-y-2">
              {snapshot.metrics.stations.map((station) => (
                <div key={station.id} className="rounded-md border border-slate-700 bg-slate-950/60 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <strong>{station.label}</strong>
                    <span className="text-xs text-cyanline">{(station.utilisation * 100).toFixed(0)}% util</span>
                  </div>
                  <div className="mt-2 h-2 overflow-hidden rounded bg-slate-800">
                    <div className="h-full bg-cyanline" style={{ width: `${Math.min(100, station.utilisation * 100)}%` }} />
                  </div>
                  <div className="mt-2 grid grid-cols-3 gap-2 text-xs text-slate-400">
                    <span>Queue {station.queueLength}</span>
                    <span>Blocked {station.blockedTime.toFixed(0)}m</span>
                    <span>Starved {station.starvedTime.toFixed(0)}</span>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="panel">
            <div className="section-title">Tutorial</div>
            <ol className="list-decimal space-y-2 pl-5 text-sm leading-6 text-slate-300">
              <li>Run the balanced preset and note throughput.</li>
              <li>Switch to overloaded assembly and watch the assembly queue build.</li>
              <li>Add a second assembly machine and run the same seed again.</li>
              <li>Save baseline, change inputs, then compare replicated results.</li>
              <li>Use CSV/JSON export for a short operations note.</li>
            </ol>
          </section>
        </aside>
      </div>
    </main>
  );
}

function StationControls({ station, onChange }: { station: StationConfig; onChange: (update: Partial<StationConfig>) => void }) {
  return (
    <div className="rounded-md border border-slate-700 bg-slate-950/50 p-3">
      <div className="font-bold text-slate-100">{station.label}</div>
      <Control label={`Service mean: ${station.serviceMean.toFixed(1)}m`}>
        <input className="range" type="range" min={1} max={14} step={0.1} value={station.serviceMean} onChange={(event) => onChange({ serviceMean: Number(event.target.value) })} />
      </Control>
      <Control label={`Machines: ${station.machines}`}>
        <input className="range" type="range" min={1} max={4} step={1} value={station.machines} onChange={(event) => onChange({ machines: Number(event.target.value) })} />
      </Control>
      <Control label={`Buffer after: ${station.bufferAfter >= 999 ? "infinite" : station.bufferAfter}`}>
        <input className="range" type="range" min={1} max={station.id === "inspection" ? 999 : 14} step={1} value={station.bufferAfter} onChange={(event) => onChange({ bufferAfter: Number(event.target.value) })} />
      </Control>
      <Control label={`Breakdown chance: ${(station.breakdownProbability * 100).toFixed(0)}%`}>
        <input className="range" type="range" min={0} max={0.35} step={0.01} value={station.breakdownProbability} onChange={(event) => onChange({ breakdownProbability: Number(event.target.value) })} />
      </Control>
    </div>
  );
}

function FlowMap({ snapshot }: { snapshot: SimulationSnapshot }) {
  return (
    <div className="mt-4 grid gap-3 lg:grid-cols-[1fr_auto_1fr_auto_1fr]">
      {stageOrder.map((stage, index) => (
        <div key={stage} className="contents">
          <div className={`rounded-lg border p-4 ${snapshot.metrics.bottleneck === stage ? "border-rose-400 bg-rose-400/10" : "border-slate-700 bg-slate-950/50"}`}>
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-xl font-black capitalize">{stage}</h2>
              <span className="rounded bg-cyanline/15 px-2 py-1 text-xs font-black text-cyanline">Q {snapshot.queues[stage].length}</span>
            </div>
            <div className="mt-4 min-h-24 rounded border border-slate-800 bg-slate-950 p-2">
              <div className="mb-2 text-xs uppercase tracking-[0.14em] text-slate-500">FIFO buffer</div>
              <div className="flex flex-wrap gap-1">
                {snapshot.queues[stage].slice(0, 18).map((jobId) => (
                  <span key={jobId} className="inline-flex h-7 min-w-7 items-center justify-center rounded bg-cyanline text-xs font-black text-slate-950">
                    {jobId}
                  </span>
                ))}
                {snapshot.queues[stage].length === 0 && <span className="text-sm text-slate-500">empty</span>}
              </div>
            </div>
          </div>
          {index < stageOrder.length - 1 && <div className="hidden items-center text-3xl font-black text-cyanline lg:flex">→</div>}
        </div>
      ))}
    </div>
  );
}

function Chart({ data, type }: { data: unknown[]; type: "area" | "bar" }) {
  if (type === "bar") {
    return (
      <div className="h-72">
        <ResponsiveContainer>
          <BarChart data={data}>
            <CartesianGrid stroke="#243247" />
            <XAxis dataKey="label" stroke="#94a3b8" />
            <YAxis stroke="#94a3b8" />
            <Tooltip contentStyle={{ background: "#10161f", border: "1px solid #334155" }} />
            <Bar dataKey="utilisation" fill="#39c6d6" />
          </BarChart>
        </ResponsiveContainer>
      </div>
    );
  }
  return (
    <div className="h-72">
      <ResponsiveContainer>
        <AreaChart data={data}>
          <CartesianGrid stroke="#243247" />
          <XAxis dataKey="time" stroke="#94a3b8" />
          <YAxis stroke="#94a3b8" />
          <Tooltip contentStyle={{ background: "#10161f", border: "1px solid #334155" }} />
          <Legend />
          <Area dataKey="cutting" stackId="1" stroke="#39c6d6" fill="#39c6d6" fillOpacity={0.35} />
          <Area dataKey="assembly" stackId="1" stroke="#f59e0b" fill="#f59e0b" fillOpacity={0.35} />
          <Area dataKey="inspection" stackId="1" stroke="#ef4444" fill="#ef4444" fillOpacity={0.35} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

function Control({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="mt-3 grid gap-2 text-sm text-slate-300">
      <span className="flex justify-between gap-3">{label}</span>
      {children}
    </label>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="metric">
      <span className="metric-label">{label}</span>
      <strong className="metric-value">{value}</strong>
    </div>
  );
}

function CompareRow({ label, base, scenario, suffix = "", lowerIsBetter = false }: { label: string; base: number; scenario: number; suffix?: string; lowerIsBetter?: boolean }) {
  const delta = scenario - base;
  const good = lowerIsBetter ? delta <= 0 : delta >= 0;
  return (
    <div className="grid grid-cols-[1fr_auto] items-center gap-3 rounded border border-slate-700 bg-slate-950/60 p-3">
      <span className="text-slate-300">{label}</span>
      <strong className={good ? "text-emerald-300" : "text-rose-300"}>
        {base.toFixed(1)}
        {suffix} → {scenario.toFixed(1)}
        {suffix}
      </strong>
    </div>
  );
}

function labelFor(stage: StageId, config: ScenarioConfig) {
  return config.stations.find((station) => station.id === stage)?.label ?? stage;
}

function download(filename: string, content: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export default App;
