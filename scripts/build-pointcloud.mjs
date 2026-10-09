import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const appDir = path.join(root, "apps", "pointcloud-lab");
const child = spawn(process.platform === "win32" ? "npm run build" : "npm", process.platform === "win32" ? [] : ["run", "build"], {
  cwd: appDir,
  env: {
    ...process.env,
    VITE_BASE_PATH: "/digital-twin-exploration-lab/pointcloud/",
  },
  shell: process.platform === "win32",
  stdio: "inherit",
});

child.on("exit", (code) => {
  process.exit(code ?? 1);
});
