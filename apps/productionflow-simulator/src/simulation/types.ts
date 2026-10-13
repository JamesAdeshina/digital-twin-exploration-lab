export type StageId = "cutting" | "assembly" | "inspection";
export type EventType = "arrival" | "service-start" | "service-complete" | "breakdown" | "repair" | "departure";

export interface StationConfig {
  id: StageId;
  label: string;
  serviceMean: number;
  serviceVariation: number;
  machines: number;
  bufferAfter: number;
  breakdownProbability: number;
  repairMean: number;
}

export interface ScenarioConfig {
  name: string;
  seed: number;
  duration: number;
  interarrivalMean: number;
  defectRate: number;
  stations: StationConfig[];
}

export interface JobRecord {
  id: number;
  createdAt: number;
  currentStage: StageId | "complete";
  visits: StageId[];
  reworked: boolean;
  completedAt?: number;
}

export interface SimEvent {
  time: number;
  type: EventType;
  stationId?: StageId;
  jobId?: number;
  machineIndex?: number;
}

export interface EventLogEntry extends SimEvent {
  message: string;
}

export interface QueueSample {
  time: number;
  cutting: number;
  assembly: number;
  inspection: number;
  completed: number;
  throughputPerHour: number;
}

export interface StationMetrics {
  id: StageId;
  label: string;
  utilisation: number;
  queueLength: number;
  blockedTime: number;
  starvedTime: number;
  inService: number;
}

export interface SimulationMetrics {
  time: number;
  completedJobs: number;
  throughputPerHour: number;
  wip: number;
  averageLeadTime: number;
  defectRate: number;
  bottleneck: StageId;
  stations: StationMetrics[];
}

export interface SimulationSnapshot {
  config: ScenarioConfig;
  time: number;
  eventCount: number;
  queues: Record<StageId, number[]>;
  jobs: JobRecord[];
  log: EventLogEntry[];
  samples: QueueSample[];
  metrics: SimulationMetrics;
  nextEvent?: SimEvent;
}

export interface ReplicationSummary {
  seed: number;
  throughputPerHour: number;
  averageLeadTime: number;
  completedJobs: number;
}

export interface ScenarioComparison {
  baseline: SimulationMetrics;
  scenario: SimulationMetrics;
  replications: ReplicationSummary[];
  throughputMean: number;
  throughputSpread: number;
  leadTimeMean: number;
  leadTimeSpread: number;
}
