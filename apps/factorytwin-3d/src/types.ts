export type MachineId = "cnc" | "assembly" | "inspection";

export type OperatingState = "normal" | "warning" | "critical" | "stopped";

export type MachineKind = "cnc" | "robot" | "inspection";

export interface MachineState {
  id: MachineId;
  name: string;
  kind: MachineKind;
  position: [number, number, number];
  temperature: number;
  vibration: number;
  rpm: number;
  workload: number;
  cooling: boolean;
  health: number;
  failureRisk: number;
  state: OperatingState;
  faultInjected: boolean;
  wear: number;
}

export interface ProductState {
  id: number;
  progress: number;
}

export interface SensorReading {
  timestamp: number;
  machineId: MachineId;
  temperature: number;
  vibration: number;
  rpm: number;
  workload: number;
  health: number;
  failureRisk: number;
}

export interface FactoryState {
  running: boolean;
  speed: 1 | 2 | 5;
  time: number;
  machines: MachineState[];
  products: ProductState[];
  history: SensorReading[];
  importedHistory: SensorReading[];
  dataMode: "live" | "imported";
}

export interface WhatIfScenario {
  machineId: MachineId;
  workload: number;
  rpm: number;
  cooling: boolean;
}

export interface WhatIfPoint {
  second: number;
  baselineTemp: number;
  scenarioTemp: number;
  baselineHealth: number;
  scenarioHealth: number;
  baselineRisk: number;
  scenarioRisk: number;
}
