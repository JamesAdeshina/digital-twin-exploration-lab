import type { FactoryState, MachineId, MachineState, SensorReading, WhatIfPoint, WhatIfScenario } from "../types";
import { createSeededRandom } from "./rng";

const random = createSeededRandom(74291);

export const INITIAL_MACHINES: MachineState[] = [
  {
    id: "cnc",
    name: "CNC Cutting Machine",
    kind: "cnc",
    position: [-4.2, 0, 0],
    temperature: 42,
    vibration: 1.4,
    rpm: 1850,
    workload: 62,
    cooling: true,
    health: 96,
    failureRisk: 8,
    state: "normal",
    faultInjected: false,
    wear: 4,
  },
  {
    id: "assembly",
    name: "Robotic Assembly Station",
    kind: "robot",
    position: [0, 0, 0],
    temperature: 39,
    vibration: 1.1,
    rpm: 1220,
    workload: 58,
    cooling: true,
    health: 98,
    failureRisk: 5,
    state: "normal",
    faultInjected: false,
    wear: 2,
  },
  {
    id: "inspection",
    name: "Quality Inspection Station",
    kind: "inspection",
    position: [4.2, 0, 0],
    temperature: 36,
    vibration: 0.8,
    rpm: 760,
    workload: 48,
    cooling: true,
    health: 99,
    failureRisk: 4,
    state: "normal",
    faultInjected: false,
    wear: 1,
  },
];

export function cloneMachine(machine: MachineState): MachineState {
  return { ...machine, position: [...machine.position] as [number, number, number] };
}

export function createInitialFactory(): FactoryState {
  return {
    running: false,
    speed: 1,
    time: 0,
    machines: INITIAL_MACHINES.map(cloneMachine),
    products: [
      { id: 1, progress: 0.05 },
      { id: 2, progress: 0.28 },
      { id: 3, progress: 0.52 },
      { id: 4, progress: 0.76 },
    ],
    history: [],
    importedHistory: [],
    dataMode: "live",
  };
}

export function evaluateState(machine: MachineState): MachineState["state"] {
  if (machine.workload <= 0) return "stopped";
  if (machine.faultInjected || machine.temperature >= 88 || machine.vibration >= 6.8 || machine.health <= 28) return "critical";
  if (machine.temperature >= 72 || machine.vibration >= 4.2 || machine.health <= 58 || machine.failureRisk >= 55) return "warning";
  return "normal";
}

export function stepMachine(machine: MachineState, dtSeconds: number, noise = random): MachineState {
  const next = cloneMachine(machine);
  const workloadFactor = next.workload / 100;
  const rpmFactor = next.rpm / 2500;
  const coolingEffect = next.cooling ? 0.82 : 0.18;
  const faultHeat = next.faultInjected ? 3.4 : 0;
  const noiseValue = (noise() - 0.5) * 0.8;

  // Illustrative equations only: heat rises with load and RPM, then is offset by cooling and ambient dissipation.
  const heatGenerated = 0.12 * next.workload + 3.5 * rpmFactor + faultHeat;
  const coolingRemoved = coolingEffect * (6 + Math.max(0, next.temperature - 28) * 0.08);
  const ambientDrift = (24 - next.temperature) * 0.015;
  next.temperature = clamp(next.temperature + (heatGenerated - coolingRemoved + ambientDrift) * dtSeconds * 0.16 + noiseValue, 22, 115);

  const adverseHeat = Math.max(0, next.temperature - 68) * 0.018;
  const adverseVibration = Math.max(0, next.vibration - 3.6) * 0.028;
  const workloadWear = workloadFactor * 0.018;
  next.wear = clamp(next.wear + (workloadWear + adverseHeat + adverseVibration + (next.faultInjected ? 0.08 : 0)) * dtSeconds, 0, 100);

  next.vibration = clamp(0.45 + rpmFactor * 2.2 + next.wear * 0.035 + (next.faultInjected ? 1.8 : 0) + (noise() - 0.5) * 0.25, 0.1, 10);
  next.health = clamp(next.health - (next.wear * 0.004 + adverseHeat * 0.55 + adverseVibration * 0.45 + (next.faultInjected ? 0.1 : 0)) * dtSeconds, 0, 100);
  next.failureRisk = clamp(100 - next.health + Math.max(0, next.temperature - 64) * 0.85 + Math.max(0, next.vibration - 3) * 6 + (next.faultInjected ? 25 : 0), 0, 100);
  next.state = evaluateState(next);
  return next;
}

export function stepFactory(factory: FactoryState): FactoryState {
  if (!factory.running) return factory;
  let next = factory;
  for (let i = 0; i < factory.speed; i += 1) {
    const machines = next.machines.map((machine) => stepMachine(machine, 1));
    const blocked = machines.some((machine) => machine.state === "critical");
    const products = next.products.map((product) => ({
      ...product,
      progress: blocked ? product.progress : (product.progress + 0.022) % 1,
    }));
    const time = next.time + 1;
    const readings = machines.map<SensorReading>((machine) => ({
      timestamp: time,
      machineId: machine.id,
      temperature: round(machine.temperature),
      vibration: round(machine.vibration),
      rpm: machine.rpm,
      workload: machine.workload,
      health: round(machine.health),
      failureRisk: round(machine.failureRisk),
    }));
    next = {
      ...next,
      time,
      machines,
      products,
      history: [...next.history, ...readings].slice(-540),
    };
  }
  return next;
}

export function updateMachine(factory: FactoryState, machineId: MachineId, update: Partial<MachineState>): FactoryState {
  return {
    ...factory,
    machines: factory.machines.map((machine) => {
      if (machine.id !== machineId) return machine;
      const patched = { ...machine, ...update };
      patched.state = evaluateState(patched);
      return patched;
    }),
  };
}

export function injectFault(factory: FactoryState, machineId: MachineId): FactoryState {
  return updateMachine(factory, machineId, { faultInjected: true, failureRisk: 92, state: "critical" });
}

export function repairFault(factory: FactoryState, machineId: MachineId): FactoryState {
  return updateMachine(factory, machineId, { faultInjected: false, health: 82, failureRisk: 18, wear: 12, state: "normal" });
}

export function runWhatIf(machine: MachineState, scenario: WhatIfScenario): WhatIfPoint[] {
  let baseline = cloneMachine(machine);
  let projected = { ...cloneMachine(machine), workload: scenario.workload, rpm: scenario.rpm, cooling: scenario.cooling };
  const baselineNoise = createSeededRandom(1201);
  const scenarioNoise = createSeededRandom(1201);
  const points: WhatIfPoint[] = [];

  for (let second = 1; second <= 60; second += 1) {
    baseline = stepMachine(baseline, 1, baselineNoise);
    projected = stepMachine(projected, 1, scenarioNoise);
    if (second % 5 === 0 || second === 1 || second === 60) {
      points.push({
        second,
        baselineTemp: round(baseline.temperature),
        scenarioTemp: round(projected.temperature),
        baselineHealth: round(baseline.health),
        scenarioHealth: round(projected.health),
        baselineRisk: round(baseline.failureRisk),
        scenarioRisk: round(projected.failureRisk),
      });
    }
  }
  return points;
}

export function parseSensorCsv(text: string): SensorReading[] {
  const lines = text.trim().split(/\r?\n/);
  const [, ...rows] = lines;
  return rows
    .map((row) => row.split(",").map((cell) => cell.trim()))
    .filter((cells) => cells.length >= 6)
    .map((cells) => ({
      timestamp: Number(cells[0]),
      machineId: cells[1] as MachineId,
      temperature: Number(cells[2]),
      vibration: Number(cells[3]),
      rpm: Number(cells[4]),
      workload: Number(cells[5]),
      health: 0,
      failureRisk: 0,
    }))
    .filter((reading) => Number.isFinite(reading.timestamp) && Boolean(reading.machineId));
}

function round(value: number) {
  return Math.round(value * 10) / 10;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}
