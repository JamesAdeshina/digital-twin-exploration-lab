# Digital Twin Exploration Lab

Digital Twin Exploration Lab is a public portfolio and learning repository for browser-based industrial simulation prototypes. It currently includes **FactoryTwin 3D**, an interactive manufacturing digital twin MVP, and **PointCloud Lab**, a browser-based 3D computer vision and spatial-data explorer.

## Roadmap

| Project | Status | Purpose |
| --- | --- | --- |
| FactoryTwin 3D | Available | 3D manufacturing line, simulated sensor monitoring, machine controls, faults, CSV replay, and what-if analysis. |
| PointCloud Lab | Available | Point-cloud generation, transforms, segmentation, voxel filtering, side-by-side comparison, and XYZ/CSV import/export. |
| FactoryTwin Advanced | Coming soon | Larger factory simulation with richer line behavior and maintenance scenarios. |
| ProductionFlow Simulator | Coming soon | Throughput, queues, buffers, and line-balancing experiments. |
| MachineHealth AI | Coming soon | Predictive maintenance concepts using synthetic sensor data. |

## Current Structure

```text
digital-twin-exploration-lab/
├── apps/
│   ├── factorytwin-3d/
│   └── pointcloud-lab/
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

## PointCloud Lab

PointCloud Lab demonstrates a 3D sensing and inspection-data layer with:

- Procedural datasets for cube, cylinder, sphere, machine-like assembly, and warehouse shelf scenes.
- Orbit, zoom, grid, axes, camera reset, point-cloud, wireframe, and solid preview modes.
- Adjustable point count, density, sensor noise, point size, color mode, voxel size, clipping range, and segmentation plane.
- Translation, rotation, and scale controls with a live 4x4 homogeneous transform matrix.
- Side-by-side original versus processed views.
- Bounding box, centroid, dimensions, nearest-neighbor sample, and cluster-count metrics.
- XYZ/CSV import validation and processed CSV export.
- PNG scene export and in-app guided experiments.

PointCloud Lab uses synthetic geometry and optional user-imported text files. It is not a validated metrology, LiDAR, CT, or industrial inspection system.

## Local Setup

Install app dependencies:

```powershell
npm --prefix apps/factorytwin-3d install
npm --prefix apps/pointcloud-lab install
```

Run FactoryTwin locally:

```powershell
npm run dev:factorytwin
```

Open the Vite URL shown in the terminal, usually `http://127.0.0.1:5173/`.

Run PointCloud Lab locally:

```powershell
npm run dev:pointcloud
```

Run tests:

```powershell
npm run test
```

Build the complete static site:

```powershell
npm run build
```

The complete GitHub Pages artifact is emitted to `dist/`, with the portal at the root, FactoryTwin under `dist/factorytwin/`, and PointCloud Lab under `dist/pointcloud/`.

## GitHub Pages Deployment

The workflow at `.github/workflows/deploy-pages.yml`:

1. Checks out the repository.
2. Sets up Node.js.
3. Installs FactoryTwin and PointCloud Lab dependencies with `npm ci`.
4. Runs FactoryTwin and PointCloud Lab tests.
5. Builds FactoryTwin with `VITE_BASE_PATH=/digital-twin-exploration-lab/factorytwin/`.
6. Builds PointCloud Lab with `VITE_BASE_PATH=/digital-twin-exploration-lab/pointcloud/`.
7. Builds the portal and copies both apps into the static site output.
8. Uploads `dist/` as the GitHub Pages artifact.
9. Deploys using GitHub's official Pages actions.

Expected public URLs after deployment:

- Lab portal: `https://<github-username>.github.io/digital-twin-exploration-lab/`
- FactoryTwin 3D: `https://<github-username>.github.io/digital-twin-exploration-lab/factorytwin/`
- PointCloud Lab: `https://<github-username>.github.io/digital-twin-exploration-lab/pointcloud/`

The exact username should be confirmed from the deployed repository owner.

## Limitations

- No backend, database, authentication, or real hardware connection.
- No paid hosting or external APIs.
- All sensor readings are simulated.
- Synthetic point-cloud data is generated from procedural points, not LiDAR, CT, metrology, or CAD data.
- The current app is a learning prototype and should not be used for real machine diagnostics.

## Recommended Next Step

Build **FactoryTwin Advanced** as the third app under `apps/factorytwin-advanced/`, then expose it through the portal route `/factorytwin-advanced/` without changing the existing FactoryTwin or PointCloud routes.
