# Digital Twin Exploration Lab

Digital Twin Exploration Lab is a public portfolio and learning repository for browser-based industrial simulation prototypes. The first application is **FactoryTwin 3D**, an interactive manufacturing digital twin MVP built with React, Vite, TypeScript, Three.js, React Three Fiber, Tailwind CSS, and Recharts.

## Roadmap

| Project | Status | Purpose |
| --- | --- | --- |
| FactoryTwin 3D | Available | 3D manufacturing line, simulated sensor monitoring, machine controls, faults, CSV replay, and what-if analysis. |
| PointCloud Lab | Coming soon | Point-cloud visualization and inspection concepts. |
| FactoryTwin Advanced | Coming soon | Larger factory simulation with richer line behavior and maintenance scenarios. |
| ProductionFlow Simulator | Coming soon | Throughput, queues, buffers, and line-balancing experiments. |
| MachineHealth AI | Coming soon | Predictive maintenance concepts using synthetic sensor data. |

## Current Structure

```text
digital-twin-exploration-lab/
├── apps/
│   └── factorytwin-3d/
├── portal/
├── docs/
├── datasets/
├── specifications/
├── scripts/
├── .github/
│   └── workflows/
└── README.md
```

## FactoryTwin 3D

FactoryTwin 3D demonstrates a virtual production line with:

- CNC cutting, robotic assembly, and quality inspection stations.
- Conveyor animation with moving products.
- Simulated temperature, vibration, RPM, workload, health, and failure risk.
- Start, pause, reset, speed, workload, RPM, cooling, fault injection, and repair controls.
- Solid model, wireframe, and synthetic point-cloud views.
- CSV import/sample download for historical sensor replay.
- What-if analysis that projects the next 60 seconds without mutating live state.
- PNG export of the current 3D scene.

The simulation is intentionally lightweight and deterministic. It is educational and illustrative, not physically validated and not connected to real industrial equipment.

## Local Setup

Install FactoryTwin dependencies:

```powershell
npm --prefix apps/factorytwin-3d install
```

Run FactoryTwin locally:

```powershell
npm run dev:factorytwin
```

Open the Vite URL shown in the terminal, usually `http://127.0.0.1:5173/`.

Run tests:

```powershell
npm run test
```

Build the complete static site:

```powershell
npm run build
```

The complete GitHub Pages artifact is emitted to `dist/`, with the portal at the root and FactoryTwin under `dist/factorytwin/`.

## GitHub Pages Deployment

The workflow at `.github/workflows/deploy-pages.yml`:

1. Checks out the repository.
2. Sets up Node.js.
3. Installs FactoryTwin dependencies with `npm ci`.
4. Runs FactoryTwin tests.
5. Builds FactoryTwin with `VITE_BASE_PATH=/digital-twin-exploration-lab/factorytwin/`.
6. Builds the portal and copies FactoryTwin into the static site output.
7. Uploads `dist/` as the GitHub Pages artifact.
8. Deploys using GitHub's official Pages actions.

Expected public URLs after deployment:

- Lab portal: `https://<github-username>.github.io/digital-twin-exploration-lab/`
- FactoryTwin 3D: `https://<github-username>.github.io/digital-twin-exploration-lab/factorytwin/`

The exact username should be confirmed from the deployed repository owner.

## Limitations

- No backend, database, authentication, or real hardware connection.
- No paid hosting or external APIs.
- All sensor readings are simulated.
- Synthetic point-cloud mode is generated from procedural points, not LiDAR or CAD data.
- The current app is a learning prototype and should not be used for real machine diagnostics.

## Recommended Next Step

After FactoryTwin is deployed and verified, add **PointCloud Lab** as a separate app under `apps/pointcloud-lab/`, then expose it through the portal route `/pointcloud/` without changing FactoryTwin's existing route.
