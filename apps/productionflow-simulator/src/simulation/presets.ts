import type { ScenarioConfig, StageId } from "./types";

const baseStations = [
  station("cutting", "Cutting", 4.2, 0.25, 1, 6, 0.02, 8),
  station("assembly", "Assembly", 5.0, 0.3, 1, 6, 0.01, 10),
  station("inspection", "Inspection", 3.0, 0.2, 1, 999, 0.005, 6),
];

export const PRESETS: Record<string, ScenarioConfig> = {
  balanced: {
    name: "Balanced line",
    seed: 24013,
    duration: 480,
    interarrivalMean: 5.8,
    defectRate: 0.04,
    stations: baseStations,
  },
  overloadedAssembly: {
    name: "Overloaded assembly",
    seed: 24013,
    duration: 480,
    interarrivalMean: 4.4,
    defectRate: 0.06,
    stations: [
      station("cutting", "Cutting", 3.8, 0.2, 1, 5, 0.01, 8),
      station("assembly", "Assembly", 8.2, 0.35, 1, 4, 0.01, 10),
      station("inspection", "Inspection", 3.2, 0.2, 1, 999, 0.005, 6),
    ],
  },
  cuttingFailures: {
    name: "Frequent cutting failures",
    seed: 24013,
    duration: 480,
    interarrivalMean: 5.6,
    defectRate: 0.04,
    stations: [
      station("cutting", "Cutting", 4.1, 0.25, 1, 6, 0.16, 18),
      station("assembly", "Assembly", 5.1, 0.25, 1, 6, 0.01, 10),
      station("inspection", "Inspection", 3.0, 0.2, 1, 999, 0.005, 6),
    ],
  },
};

export function cloneScenario(config: ScenarioConfig): ScenarioConfig {
  return {
    ...config,
    stations: config.stations.map((stationConfig) => ({ ...stationConfig })),
  };
}

function station(
  id: StageId,
  label: string,
  serviceMean: number,
  serviceVariation: number,
  machines: number,
  bufferAfter: number,
  breakdownProbability: number,
  repairMean: number,
) {
  return { id, label, serviceMean, serviceVariation, machines, bufferAfter, breakdownProbability, repairMean };
}
