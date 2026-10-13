# ProductionFlow Simulator

ProductionFlow Simulator is a browser-only discrete-event manufacturing model for learning operations concepts: queues, finite buffers, station capacity, throughput, utilisation, WIP, lead time, blocking, starvation, defects, downtime, and scenario comparison.

## Architecture

- `src/simulation/engine.ts` contains the typed discrete-event engine, priority-ordered event list, FIFO queues, blocking rule, metrics, and scenario replication helpers.
- `src/simulation/presets.ts` defines the balanced line, overloaded assembly, and frequent cutting failures presets.
- `src/simulation/engine.test.ts` covers deterministic routing, capacity limits, queue accounting, seeded reproducibility, assembly bottlenecks, and display-speed independence.
- `src/App.tsx` renders controls, charts, flow visualisation, dashboard metrics, event log, baseline comparison, replications, and export buttons.

## Model

Jobs arrive stochastically, then flow through Cutting, Assembly, and Inspection. Each station has a configurable service time, capacity, breakdown probability, and downstream buffer capacity.

Blocking rule: when a station finishes a job but the next finite buffer is full, the upstream machine holds the completed job and remains blocked until downstream queue space opens. This is a simple manufacturing blocking model, not a physical conveyor model.

## Controls

- Start, pause, reset, and step next event.
- Display speed changes event playback only.
- Seed, simulation duration, arrival rate, defect/rework rate.
- Per-station service mean, machine count, downstream buffer, and breakdown probability.
- Save baseline, run fixed duration, compare baseline and scenario, export JSON or CSV.

## Sample Walkthrough

1. Open the balanced preset and run it to observe baseline throughput.
2. Switch to overloaded assembly and watch Assembly queue length rise.
3. Add a second Assembly machine and rerun the same seed.
4. Save baseline, modify inputs, and compare replicated throughput and lead time.
5. Export JSON or CSV for a short operations note.

## Data Provenance

All data is generated in the browser from seeded synthetic distributions. No server, external API, hardware feed, or proprietary dataset is required.

## Limitations

This is an educational operations model with assumed distributions. It is not calibrated to a real factory, does not model every material-handling detail, and should not be used for real production planning without validation.

## Commands

```powershell
npm install
npm run dev
npm run test
npm run build
```

## Troubleshooting

- If results look unchanged after editing inputs, reset or run the fixed-duration scenario. Input edits reset the live engine automatically.
- If charts look noisy, compare replicated means and spread instead of trusting one stochastic run.
- If a queue explodes, check arrival rate, service time, machine count, and downstream buffer capacity.
