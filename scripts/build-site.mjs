import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const dist = path.join(root, "dist");
const portal = path.join(root, "portal");
const docs = path.join(root, "docs");
const factoryDist = path.join(root, "apps", "factorytwin-3d", "dist");
const pointcloudDist = path.join(root, "apps", "pointcloud-lab", "dist");
const repository = process.env.GITHUB_REPOSITORY ?? "OWNER/digital-twin-exploration-lab";

if (!existsSync(factoryDist)) {
  throw new Error("FactoryTwin build output was not found. Run npm run build:factorytwin first.");
}

if (!existsSync(pointcloudDist)) {
  throw new Error("PointCloud Lab build output was not found. Run npm run build:pointcloud first.");
}

await rm(dist, { recursive: true, force: true });
await mkdir(dist, { recursive: true });
await cp(portal, dist, { recursive: true });
await cp(docs, path.join(dist, "docs"), { recursive: true });
await mkdir(path.join(dist, "factorytwin"), { recursive: true });
await cp(factoryDist, path.join(dist, "factorytwin"), { recursive: true });
await mkdir(path.join(dist, "pointcloud"), { recursive: true });
await cp(pointcloudDist, path.join(dist, "pointcloud"), { recursive: true });
await cp(path.join(portal, "index.html"), path.join(dist, "404.html"));

for (const file of [path.join(dist, "index.html"), path.join(dist, "404.html")]) {
  const html = await readFile(file, "utf8");
  await writeFile(file, html.replaceAll("OWNER/digital-twin-exploration-lab", repository));
}

console.log("Built Digital Twin Exploration Lab site into dist/");
