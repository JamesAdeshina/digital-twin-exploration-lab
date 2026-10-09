# FactoryTwin 3D

FactoryTwin 3D is a locally runnable React, Vite, TypeScript, and Three.js manufacturing digital twin MVP. It shows a CNC machine, robotic assembly station, inspection station, conveyor, moving products, simulated sensors, fault controls, CSV replay, what-if analysis, and PNG scene export.

## Run Locally

```powershell
npm install
npm run dev
```

Open the Vite URL shown in the terminal, normally `http://127.0.0.1:5173/`.

## Useful Commands

```powershell
npm run test
npm run build
npm run preview
```

## Controls

- Start, pause, reset, and change simulation speed from the left panel.
- Click a machine in the 3D scene or left panel to inspect it.
- Change workload, RPM, and cooling in the right panel.
- Inject a fault to force a critical state and block the conveyor.
- Repair a fault to return the selected machine to a healthy state.
- Switch between solid mesh, wireframe, and synthetic point-cloud views.
- Use the PNG button in the 3D scene to export a screenshot.
- Import CSV data with columns `timestamp,machine_id,temperature,vibration,rpm,workload`.
- Download the sample CSV from the right panel.

## Architecture

- `src/simulation/engine.ts` contains deterministic time-step simulation logic.
- `src/components/FactoryScene.tsx` contains the React Three Fiber scene.
- `src/components/Charts.tsx` contains Recharts visualizations.
- `src/App.tsx` binds controls, charts, CSV import, and what-if analysis.
- `src/simulation/engine.test.ts` covers the main simulation behaviours.

## Simulation Notes

Sensor values are simulated and illustrative. The equations model simple relationships:

- Higher workload and RPM increase heat generation.
- Cooling removes heat and slows temperature rise.
- Heat, vibration, and injected faults increase wear.
- Wear reduces health and raises failure risk.
- Critical machine states block product movement.

These equations are not physically validated and should not be used for real engineering decisions.

## Why This Is A Digital Twin Prototype

It is more than a static 3D animation because the virtual equipment has state, live sensor values, operational controls, history, failure behaviour, and what-if scenarios. User actions change both the 3D representation and the simulated operating data, which demonstrates the feedback loop expected from a basic digital twin.

## Limitations

- No backend, database, authentication, or real hardware connection.
- Procedural geometry only, no CAD or LiDAR import.
- Point-cloud mode is synthetic and generated from procedural surface points.
- CSV import is a replay/visualization aid and is kept separate from live simulation data.
