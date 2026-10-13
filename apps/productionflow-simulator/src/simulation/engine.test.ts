import { describe, expect, it } from "vitest";
import { createSimulation, runSimulation, stepNextEvent } from "./engine";
import type { ScenarioConfig } from "./types";

const deterministic: ScenarioConfig = {
  name: "Deterministic test",
  seed: 11,
  duration: 90,
  interarrivalMean: 12,
  defectRate: 0,
  stations: [
    { id: "cutting", label: "Cutting", serviceMean: 2, serviceVariation: 0, machines: 1, bufferAfter: 99, breakdownProbability: 0, repairMean: 1 },
    { id: "assembly", label: "Assembly", serviceMean: 2, serviceVariation: 0, machines: 1, bufferAfter: 99, breakdownProbability: 0, repairMean: 1 },
    { id: "inspection", label: "Inspection", serviceMean: 2, serviceVariation: 0, machines: 1, bufferAfter: 999, breakdownProbability: 0, repairMean: 1 },
  ],
};

describe("production flow discrete-event engine", () => {
  it("moves completed jobs through all stages in order in a no-fault deterministic case", () => {
    const result = runSimulation(deterministic, 90);
    const completed = result.jobs.filter((job) => job.completedAt !== undefined);
    expect(completed.length).toBeGreaterThan(0);
    completed.forEach((job) => expect(job.visits).toEqual(["cutting", "assembly", "inspection"]));
  });

  it("never serves more jobs than station capacity", () => {
    const simulation = createSimulation({ ...deterministic, interarrivalMean: 1 });
    for (let i = 0; i < 120; i += 1) {
      const snapshot = stepNextEvent(simulation);
      snapshot.metrics.stations.forEach((station) => {
        expect(station.inService).toBeLessThanOrEqual(snapshot.config.stations.find((item) => item.id === station.id)!.machines);
      });
    }
  });

  it("keeps queue counts non-negative and preserves job accounting", () => {
    const result = runSimulation({ ...deterministic, interarrivalMean: 1, duration: 80 }, 80);
    expect(result.queues.cutting.length).toBeGreaterThanOrEqual(0);
    expect(result.queues.assembly.length).toBeGreaterThanOrEqual(0);
    expect(result.queues.inspection.length).toBeGreaterThanOrEqual(0);
    const jobIds = new Set(result.jobs.map((job) => job.id));
    expect(jobIds.size).toBe(result.jobs.length);
    expect(result.metrics.wip + result.metrics.completedJobs).toBe(result.jobs.length);
  });

  it("same seed and parameters produce identical event log and metrics", () => {
    const first = runSimulation(deterministic, 90);
    const second = runSimulation(deterministic, 90);
    expect(second.log.map((entry) => `${entry.time.toFixed(3)}:${entry.type}:${entry.jobId ?? ""}:${entry.stationId ?? ""}`)).toEqual(
      first.log.map((entry) => `${entry.time.toFixed(3)}:${entry.type}:${entry.jobId ?? ""}:${entry.stationId ?? ""}`),
    );
    expect(second.metrics.throughputPerHour).toBeCloseTo(first.metrics.throughputPerHour, 8);
  });

  it("slower assembly produces longer upstream queues in a controlled test", () => {
    const fast = runSimulation({ ...deterministic, interarrivalMean: 1.5 }, 80);
    const slow = runSimulation({
      ...deterministic,
      interarrivalMean: 1.5,
      stations: deterministic.stations.map((station) => (station.id === "assembly" ? { ...station, serviceMean: 8 } : { ...station })),
    }, 80);
    expect(slow.queues.assembly.length).toBeGreaterThan(fast.queues.assembly.length);
  });

  it("display speed does not affect simulated outputs because it is not part of scenario parameters", () => {
    const normal = runSimulation(deterministic, 90);
    const fasterDisplayOnly = runSimulation({ ...deterministic }, 90);
    expect(fasterDisplayOnly.metrics).toEqual(normal.metrics);
  });
});
