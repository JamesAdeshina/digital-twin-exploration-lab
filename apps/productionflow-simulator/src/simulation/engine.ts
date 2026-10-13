import { createSeededRandom, exponential, triangular } from "./rng";
import type {
  EventLogEntry,
  JobRecord,
  QueueSample,
  ReplicationSummary,
  ScenarioComparison,
  ScenarioConfig,
  SimEvent,
  SimulationMetrics,
  SimulationSnapshot,
  StageId,
  StationConfig,
} from "./types";

const STAGES: StageId[] = ["cutting", "assembly", "inspection"];

interface MachineState {
  jobId?: number;
  busyUntil?: number;
  downUntil?: number;
  blockedSince?: number;
}

interface StationRuntime {
  config: StationConfig;
  queue: number[];
  machines: MachineState[];
  busyTime: number;
  blockedTime: number;
  starvedTime: number;
}

interface InternalSimulation {
  config: ScenarioConfig;
  random: () => number;
  time: number;
  nextJobId: number;
  sequence: number;
  eventCount: number;
  events: Array<SimEvent & { sequence: number }>;
  stations: Record<StageId, StationRuntime>;
  jobs: Map<number, JobRecord>;
  completed: JobRecord[];
  log: EventLogEntry[];
  samples: QueueSample[];
}

export function createSimulation(config: ScenarioConfig): InternalSimulation {
  const simulation: InternalSimulation = {
    config: cloneConfig(config),
    random: createSeededRandom(config.seed),
    time: 0,
    nextJobId: 1,
    sequence: 0,
    eventCount: 0,
    events: [],
    stations: {
      cutting: runtimeFor(config.stations.find((station) => station.id === "cutting")!),
      assembly: runtimeFor(config.stations.find((station) => station.id === "assembly")!),
      inspection: runtimeFor(config.stations.find((station) => station.id === "inspection")!),
    },
    jobs: new Map(),
    completed: [],
    log: [],
    samples: [],
  };
  schedule(simulation, { time: 0, type: "arrival" });
  return simulation;
}

function runtimeFor(station: StationConfig): StationRuntime {
  return {
    config: { ...station },
    queue: [],
    machines: Array.from({ length: station.machines }, () => ({})),
    busyTime: 0,
    blockedTime: 0,
    starvedTime: 0,
  };
}

export function stepNextEvent(simulation: InternalSimulation): SimulationSnapshot {
  const event = simulation.events.shift();
  if (!event) return snapshot(simulation);
  simulation.time = event.time;
  simulation.eventCount += 1;

  if (event.type === "arrival") handleArrival(simulation);
  if (event.type === "service-start" && event.stationId !== undefined) startService(simulation, event.stationId, event.machineIndex ?? 0);
  if (event.type === "breakdown" && event.stationId !== undefined) log(simulation, event, `${label(simulation, event.stationId)} machine ${event.machineIndex! + 1} broke down.`);
  if (event.type === "repair" && event.stationId !== undefined) log(simulation, event, `${label(simulation, event.stationId)} machine ${event.machineIndex! + 1} was repaired.`);
  if (event.type === "service-complete" && event.stationId !== undefined) completeService(simulation, event.stationId, event.machineIndex ?? 0);
  if (event.type === "departure" && event.jobId !== undefined) depart(simulation, event.jobId);

  releaseBlocked(simulation);
  tryStartAll(simulation);
  sample(simulation);
  return snapshot(simulation);
}

export function runSimulation(config: ScenarioConfig, duration = config.duration): SimulationSnapshot {
  const simulation = createSimulation(config);
  while (simulation.events.length > 0 && simulation.time <= duration) {
    const next = simulation.events[0];
    if (next.time > duration) break;
    stepNextEvent(simulation);
  }
  simulation.time = duration;
  sample(simulation);
  return snapshot(simulation);
}

export function compareScenarios(baseline: ScenarioConfig, scenario: ScenarioConfig, replications = 12): ScenarioComparison {
  const baselineRun = runSimulation(baseline);
  const scenarioRun = runSimulation(scenario);
  const results: ReplicationSummary[] = [];

  for (let index = 0; index < replications; index += 1) {
    const run = runSimulation({ ...scenario, seed: scenario.seed + index * 9973, stations: scenario.stations.map((station) => ({ ...station })) });
    results.push({
      seed: scenario.seed + index * 9973,
      throughputPerHour: run.metrics.throughputPerHour,
      averageLeadTime: run.metrics.averageLeadTime,
      completedJobs: run.metrics.completedJobs,
    });
  }

  return {
    baseline: baselineRun.metrics,
    scenario: scenarioRun.metrics,
    replications: results,
    throughputMean: mean(results.map((item) => item.throughputPerHour)),
    throughputSpread: spread(results.map((item) => item.throughputPerHour)),
    leadTimeMean: mean(results.map((item) => item.averageLeadTime)),
    leadTimeSpread: spread(results.map((item) => item.averageLeadTime)),
  };
}

export function nextStage(stage: StageId): StageId | "complete" {
  const index = STAGES.indexOf(stage);
  return STAGES[index + 1] ?? "complete";
}

function handleArrival(simulation: InternalSimulation) {
  const job: JobRecord = {
    id: simulation.nextJobId,
    createdAt: simulation.time,
    currentStage: "cutting",
    visits: [],
    reworked: false,
  };
  simulation.nextJobId += 1;
  simulation.jobs.set(job.id, job);
  simulation.stations.cutting.queue.push(job.id);
  log(simulation, { time: simulation.time, type: "arrival", jobId: job.id }, `Job ${job.id} arrived.`);
  schedule(simulation, { time: simulation.time + exponential(simulation.config.interarrivalMean, simulation.random), type: "arrival" });
}

function startService(simulation: InternalSimulation, stationId: StageId, machineIndex: number) {
  const station = simulation.stations[stationId];
  const machine = station.machines[machineIndex];
  if (machine.jobId !== undefined || isDown(machine, simulation.time)) return;
  const jobId = station.queue.shift();
  if (jobId === undefined) {
    station.starvedTime += 1;
    return;
  }

  const duration = serviceDuration(station.config, simulation.random);
  const willBreak = simulation.random() < station.config.breakdownProbability;
  const repairDuration = willBreak ? serviceDuration({ ...station.config, serviceMean: station.config.repairMean, serviceVariation: 0.35 }, simulation.random) : 0;
  const completeAt = simulation.time + duration + repairDuration;
  machine.jobId = jobId;
  machine.busyUntil = completeAt;
  station.busyTime += duration;
  simulation.jobs.get(jobId)!.visits.push(stationId);
  simulation.jobs.get(jobId)!.currentStage = stationId;

  log(simulation, { time: simulation.time, type: "service-start", stationId, jobId, machineIndex }, `Job ${jobId} started ${label(simulation, stationId)}.`);
  if (willBreak) {
    const breakdownAt = simulation.time + duration / 2;
    machine.downUntil = breakdownAt + repairDuration;
    schedule(simulation, { time: breakdownAt, type: "breakdown", stationId, jobId, machineIndex });
    schedule(simulation, { time: breakdownAt + repairDuration, type: "repair", stationId, jobId, machineIndex });
  }
  schedule(simulation, { time: completeAt, type: "service-complete", stationId, jobId, machineIndex });
}

function completeService(simulation: InternalSimulation, stationId: StageId, machineIndex: number) {
  const station = simulation.stations[stationId];
  const machine = station.machines[machineIndex];
  const jobId = machine.jobId;
  if (jobId === undefined) return;
  const target = nextStage(stationId);

  if (target !== "complete" && simulation.stations[target].queue.length >= station.config.bufferAfter) {
    machine.blockedSince = machine.blockedSince ?? simulation.time;
    log(simulation, { time: simulation.time, type: "service-complete", stationId, jobId, machineIndex }, `Job ${jobId} is blocked after ${label(simulation, stationId)} because the next buffer is full.`);
    return;
  }

  releaseMachine(simulation, stationId, machineIndex, jobId);
}

function releaseMachine(simulation: InternalSimulation, stationId: StageId, machineIndex: number, jobId: number) {
  const station = simulation.stations[stationId];
  const machine = station.machines[machineIndex];
  if (machine.blockedSince !== undefined) {
    station.blockedTime += simulation.time - machine.blockedSince;
  }
  machine.jobId = undefined;
  machine.busyUntil = undefined;
  machine.blockedSince = undefined;

  const target = nextStage(stationId);
  log(simulation, { time: simulation.time, type: "service-complete", stationId, jobId, machineIndex }, `Job ${jobId} completed ${label(simulation, stationId)}.`);
  if (target === "complete") {
    schedule(simulation, { time: simulation.time, type: "departure", jobId });
    return;
  }
  const job = simulation.jobs.get(jobId)!;
  job.currentStage = target;
  simulation.stations[target].queue.push(jobId);
}

function releaseBlocked(simulation: InternalSimulation) {
  for (const stage of STAGES) {
    const station = simulation.stations[stage];
    for (let index = 0; index < station.machines.length; index += 1) {
      const machine = station.machines[index];
      if (machine.jobId === undefined || machine.blockedSince === undefined) continue;
      const target = nextStage(stage);
      if (target === "complete" || simulation.stations[target].queue.length < station.config.bufferAfter) {
        releaseMachine(simulation, stage, index, machine.jobId);
      }
    }
  }
}

function depart(simulation: InternalSimulation, jobId: number) {
  const job = simulation.jobs.get(jobId);
  if (!job || job.completedAt !== undefined) return;
  if (!job.reworked && simulation.random() < simulation.config.defectRate) {
    job.reworked = true;
    job.currentStage = "assembly";
    simulation.stations.assembly.queue.push(job.id);
    log(simulation, { time: simulation.time, type: "departure", jobId }, `Job ${jobId} failed inspection and re-entered assembly.`);
    return;
  }
  job.currentStage = "complete";
  job.completedAt = simulation.time;
  simulation.completed.push(job);
  log(simulation, { time: simulation.time, type: "departure", jobId }, `Job ${jobId} departed complete.`);
}

function tryStartAll(simulation: InternalSimulation) {
  for (const stage of STAGES) {
    const station = simulation.stations[stage];
    station.machines.forEach((machine, index) => {
      if (machine.jobId === undefined && !isDown(machine, simulation.time) && station.queue.length > 0) {
        schedule(simulation, { time: simulation.time, type: "service-start", stationId: stage, machineIndex: index });
      }
    });
  }
}

function sample(simulation: InternalSimulation) {
  const last = simulation.samples[simulation.samples.length - 1];
  if (last && Math.abs(last.time - simulation.time) < 0.001) return;
  const metrics = metricsFor(simulation);
  simulation.samples.push({
    time: Number(simulation.time.toFixed(2)),
    cutting: simulation.stations.cutting.queue.length,
    assembly: simulation.stations.assembly.queue.length,
    inspection: simulation.stations.inspection.queue.length,
    completed: simulation.completed.length,
    throughputPerHour: metrics.throughputPerHour,
  });
}

function metricsFor(simulation: InternalSimulation): SimulationMetrics {
  const time = Math.max(simulation.time, 1);
  const completedLeadTimes = simulation.completed.map((job) => (job.completedAt ?? simulation.time) - job.createdAt);
  const stationMetrics = STAGES.map((stage) => {
    const station = simulation.stations[stage];
    const capacityTime = Math.max(time * station.config.machines, 1);
    return {
      id: stage,
      label: station.config.label,
      utilisation: clamp(station.busyTime / capacityTime, 0, 1),
      queueLength: station.queue.length,
      blockedTime: station.blockedTime,
      starvedTime: station.starvedTime,
      inService: station.machines.filter((machine) => machine.jobId !== undefined).length,
    };
  });
  const bottleneck = [...stationMetrics].sort((a, b) => b.utilisation + b.queueLength * 0.03 - (a.utilisation + a.queueLength * 0.03))[0].id;
  return {
    time: simulation.time,
    completedJobs: simulation.completed.length,
    throughputPerHour: (simulation.completed.length / time) * 60,
    wip: [...simulation.jobs.values()].filter((job) => job.completedAt === undefined).length,
    averageLeadTime: mean(completedLeadTimes),
    defectRate: simulation.completed.length === 0 ? 0 : simulation.completed.filter((job) => job.reworked).length / simulation.completed.length,
    bottleneck,
    stations: stationMetrics,
  };
}

function snapshot(simulation: InternalSimulation): SimulationSnapshot {
  return {
    config: cloneConfig(simulation.config),
    time: simulation.time,
    eventCount: simulation.eventCount,
    queues: {
      cutting: [...simulation.stations.cutting.queue],
      assembly: [...simulation.stations.assembly.queue],
      inspection: [...simulation.stations.inspection.queue],
    },
    jobs: [...simulation.jobs.values()].map((job) => ({ ...job, visits: [...job.visits] })),
    log: simulation.log.slice(-80),
    samples: [...simulation.samples],
    metrics: metricsFor(simulation),
    nextEvent: simulation.events[0] ? { ...simulation.events[0] } : undefined,
  };
}

function schedule(simulation: InternalSimulation, event: SimEvent) {
  simulation.sequence += 1;
  simulation.events.push({ ...event, sequence: simulation.sequence });
  simulation.events.sort((a, b) => a.time - b.time || a.sequence - b.sequence);
}

function log(simulation: InternalSimulation, event: SimEvent, message: string) {
  simulation.log.push({ ...event, message });
  if (simulation.log.length > 300) simulation.log.shift();
}

function serviceDuration(station: StationConfig, random: () => number) {
  const variation = station.serviceMean * station.serviceVariation;
  return Math.max(0.1, triangular(station.serviceMean - variation, station.serviceMean, station.serviceMean + variation, random));
}

function isDown(machine: MachineState, time: number) {
  return machine.downUntil !== undefined && machine.downUntil > time;
}

function label(simulation: InternalSimulation, stationId: StageId) {
  return simulation.stations[stationId].config.label;
}

function cloneConfig(config: ScenarioConfig): ScenarioConfig {
  return { ...config, stations: config.stations.map((station) => ({ ...station })) };
}

function mean(values: number[]) {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function spread(values: number[]) {
  if (values.length <= 1) return 0;
  const average = mean(values);
  return Math.sqrt(mean(values.map((value) => (value - average) ** 2)));
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}
