import { describe, expect, it } from "vitest";
import { createInitialFactory, injectFault, runWhatIf, stepMachine } from "./engine";

describe("simulation engine", () => {
  it("cooling reduces temperature relative to identical conditions without cooling", () => {
    const base = createInitialFactory().machines[0];
    const cooled = stepMachine({ ...base, cooling: true, workload: 95, rpm: 2300 }, 5, () => 0.5);
    const uncooled = stepMachine({ ...base, cooling: false, workload: 95, rpm: 2300 }, 5, () => 0.5);
    expect(cooled.temperature).toBeLessThan(uncooled.temperature);
  });

  it("higher workload increases heat generation", () => {
    const base = createInitialFactory().machines[0];
    const low = stepMachine({ ...base, workload: 20 }, 5, () => 0.5);
    const high = stepMachine({ ...base, workload: 95 }, 5, () => 0.5);
    expect(high.temperature).toBeGreaterThan(low.temperature);
  });

  it("fault injection changes machine status", () => {
    const factory = createInitialFactory();
    const faulted = injectFault(factory, "cnc");
    expect(faulted.machines[0].faultInjected).toBe(true);
    expect(faulted.machines[0].state).toBe("critical");
  });

  it("reset restores initial conditions", () => {
    const initial = createInitialFactory();
    const changed = injectFault(initial, "assembly");
    const reset = createInitialFactory();
    expect(changed.machines[1].state).toBe("critical");
    expect(reset.machines[1].state).toBe("normal");
    expect(reset.time).toBe(0);
  });

  it("what-if simulation does not mutate the original state", () => {
    const machine = createInitialFactory().machines[0];
    const before = JSON.stringify(machine);
    const points = runWhatIf(machine, { machineId: "cnc", workload: 100, rpm: 2500, cooling: false });
    expect(points.length).toBeGreaterThan(0);
    expect(JSON.stringify(machine)).toBe(before);
  });
});
