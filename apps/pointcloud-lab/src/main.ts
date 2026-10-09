import * as THREE from "three";
import "./styles.css";

type ShapeMode = "inspection-panel" | "pipe" | "blade" | "bearing";
type ColorMode = "height" | "deviation" | "intensity";

interface PointSample {
  x: number;
  y: number;
  z: number;
  intensity: number;
  deviation: number;
}

interface LabState {
  shape: ShapeMode;
  colorMode: ColorMode;
  pointCount: number;
  noise: number;
  anomaly: number;
  pointSize: number;
  imported: boolean;
}

const state: LabState = {
  shape: "inspection-panel",
  colorMode: "deviation",
  pointCount: 9000,
  noise: 0.045,
  anomaly: 34,
  pointSize: 0.025,
  imported: false,
};

const app = document.querySelector<HTMLDivElement>("#app");
if (!app) throw new Error("App root not found");

app.innerHTML = `
  <div class="layout">
    <aside class="panel">
      <div class="eyebrow">Digital Twin Exploration Lab</div>
      <h1>PointCloud Lab</h1>
      <p>Inspect synthetic XYZ point clouds, surface noise, and anomaly clusters as a practical 3D sensing exercise.</p>
      <div class="note">Synthetic data only. This is not LiDAR, CT, metrology, or validated inspection output.</div>

      <label class="control">
        <span class="control-row"><span>Surface preset</span></span>
        <select id="shape">
          <option value="inspection-panel">Inspection panel</option>
          <option value="pipe">Process pipe</option>
          <option value="blade">Turbine blade section</option>
          <option value="bearing">Bearing race</option>
        </select>
      </label>

      <label class="control">
        <span class="control-row"><span>Color by</span></span>
        <select id="colorMode">
          <option value="deviation">Deviation</option>
          <option value="height">Height</option>
          <option value="intensity">Intensity</option>
        </select>
      </label>

      <label class="control">
        <span class="control-row"><span>Point count</span><output id="pointCountOut">9000</output></span>
        <input id="pointCount" type="range" min="1500" max="24000" step="500" value="9000" />
      </label>

      <label class="control">
        <span class="control-row"><span>Sensor noise</span><output id="noiseOut">0.045</output></span>
        <input id="noise" type="range" min="0" max="0.16" step="0.005" value="0.045" />
      </label>

      <label class="control">
        <span class="control-row"><span>Anomaly strength</span><output id="anomalyOut">34%</output></span>
        <input id="anomaly" type="range" min="0" max="100" step="1" value="34" />
      </label>

      <label class="control">
        <span class="control-row"><span>Point size</span><output id="pointSizeOut">0.025</output></span>
        <input id="pointSize" type="range" min="0.008" max="0.07" step="0.001" value="0.025" />
      </label>

      <div class="button-grid">
        <button class="button" id="regenerate">Regenerate</button>
        <button class="button" id="resetCamera">Reset camera</button>
        <button class="button" id="downloadSample">Sample XYZ</button>
        <label class="file-label">Import XYZ/CSV<input class="hidden" id="fileInput" type="file" accept=".xyz,.csv,.txt" /></label>
      </div>
    </aside>

    <section class="viewer" id="viewer">
      <div class="scene-label" id="sceneLabel">Synthetic point cloud</div>
    </section>

    <aside class="panel">
      <section>
        <div class="section-title">Scan summary</div>
        <div class="metric-grid">
          <div class="metric"><span>Points</span><strong id="metricPoints">0</strong></div>
          <div class="metric"><span>Anomalies</span><strong id="metricAnomalies">0</strong></div>
          <div class="metric"><span>Width</span><strong id="metricWidth">0 m</strong></div>
          <div class="metric"><span>Depth</span><strong id="metricDepth">0 m</strong></div>
          <div class="metric"><span>Height range</span><strong id="metricHeight">0 m</strong></div>
          <div class="metric"><span>RMS deviation</span><strong id="metricRms">0 mm</strong></div>
        </div>
      </section>

      <section class="control">
        <div class="section-title">Interpretation</div>
        <p id="interpretation">Deviation colors highlight raised or recessed regions compared with the generated nominal surface.</p>
      </section>

      <section class="control">
        <div class="section-title">Color legend</div>
        <div class="legend">
          <div class="legend-item"><span class="swatch" style="background:#2dd4bf"></span> Nominal / low values</div>
          <div class="legend-item"><span class="swatch" style="background:#f59e0b"></span> Moderate variation</div>
          <div class="legend-item"><span class="swatch" style="background:#ef4444"></span> High deviation / likely defect</div>
        </div>
      </section>

      <section class="control">
        <div class="section-title">Digital twin angle</div>
        <p>A production digital twin can combine geometry, sensor readings, and inspection history. This app focuses on the geometry and inspection-data layer.</p>
      </section>
    </aside>
  </div>
`;

const viewer = document.querySelector<HTMLDivElement>("#viewer")!;
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setClearColor(0x05080d);
viewer.prepend(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(48, 1, 0.01, 120);
const controls = createOrbitControls(camera, renderer.domElement);
const grid = new THREE.GridHelper(8, 16, 0x334155, 0x1f2937);
grid.position.y = -1.3;
scene.add(grid);
scene.add(new THREE.AmbientLight(0xffffff, 0.7));

let currentPoints: THREE.Points | undefined;
let currentSamples: PointSample[] = [];

bindControls();
resize();
generateAndRender();
animate();

window.addEventListener("resize", resize);

function bindControls() {
  bindSelect<ShapeMode>("shape", (value) => {
    state.shape = value;
    state.imported = false;
    generateAndRender();
  });
  bindSelect<ColorMode>("colorMode", (value) => {
    state.colorMode = value;
    renderSamples(currentSamples);
  });
  bindRange("pointCount", "pointCountOut", (value) => {
    state.pointCount = value;
    state.imported = false;
    generateAndRender();
  });
  bindRange("noise", "noiseOut", (value) => {
    state.noise = value;
    state.imported = false;
    generateAndRender();
  });
  bindRange("anomaly", "anomalyOut", (value) => {
    state.anomaly = value;
    state.imported = false;
    generateAndRender();
  }, (value) => `${value}%`);
  bindRange("pointSize", "pointSizeOut", (value) => {
    state.pointSize = value;
    if (currentPoints) (currentPoints.material as THREE.PointsMaterial).size = value;
  });

  document.querySelector("#regenerate")?.addEventListener("click", () => {
    state.imported = false;
    generateAndRender();
  });
  document.querySelector("#resetCamera")?.addEventListener("click", resetCamera);
  document.querySelector("#downloadSample")?.addEventListener("click", downloadSample);
  document.querySelector<HTMLInputElement>("#fileInput")?.addEventListener("change", (event) => {
    const input = event.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    file.text().then((text: string) => {
      const parsed = parsePointText(text);
      if (parsed.length > 0) {
        state.imported = true;
        currentSamples = parsed;
        renderSamples(parsed);
      }
    });
  });
}

function bindSelect<T extends string>(id: string, onChange: (value: T) => void) {
  document.querySelector<HTMLSelectElement>(`#${id}`)?.addEventListener("change", (event) => {
    const select = event.currentTarget as HTMLSelectElement;
    onChange(select.value as T);
  });
}

function bindRange(id: string, outputId: string, onInput: (value: number) => void, format = (value: number) => String(value)) {
  const input = document.querySelector<HTMLInputElement>(`#${id}`);
  const output = document.querySelector<HTMLOutputElement>(`#${outputId}`);
  input?.addEventListener("input", (event) => {
    const range = event.currentTarget as HTMLInputElement;
    const value = Number(range.value);
    if (output) output.value = format(value);
    onInput(value);
  });
}

function generateAndRender() {
  currentSamples = generateSamples(state);
  renderSamples(currentSamples);
}

function renderSamples(samples: PointSample[]) {
  if (currentPoints) {
    scene.remove(currentPoints);
    currentPoints.geometry.dispose();
    (currentPoints.material as THREE.Material).dispose();
  }

  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(samples.length * 3);
  const colors = new Float32Array(samples.length * 3);
  const bounds = getBounds(samples);

  samples.forEach((sample, index) => {
    positions[index * 3] = sample.x;
    positions[index * 3 + 1] = sample.y;
    positions[index * 3 + 2] = sample.z;
    const color = colorForSample(sample, bounds);
    colors[index * 3] = color.r;
    colors[index * 3 + 1] = color.g;
    colors[index * 3 + 2] = color.b;
  });

  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  geometry.computeBoundingSphere();

  currentPoints = new THREE.Points(
    geometry,
    new THREE.PointsMaterial({
      size: state.pointSize,
      vertexColors: true,
      sizeAttenuation: true,
    }),
  );
  scene.add(currentPoints);
  updateMetrics(samples, bounds);
  updateLabel();
}

function generateSamples(config: LabState): PointSample[] {
  const samples: PointSample[] = [];
  const rand = mulberry32(3107 + config.pointCount + Math.round(config.noise * 1000) + config.anomaly);
  for (let i = 0; i < config.pointCount; i += 1) {
    const sample = sampleShape(config.shape, rand);
    const anomaly = anomalyField(sample.x, sample.z, config.anomaly / 100);
    const noise = (rand() - 0.5) * config.noise;
    sample.y += noise + anomaly;
    sample.deviation = Math.abs(noise + anomaly);
    sample.intensity = clamp(0.4 + rand() * 0.35 + anomaly * 2.2, 0, 1);
    samples.push(sample);
  }
  return samples;
}

function sampleShape(shape: ShapeMode, rand: () => number): PointSample {
  if (shape === "pipe") {
    const length = rand() * 5 - 2.5;
    const theta = rand() * Math.PI * 2;
    const radius = 0.85 + Math.sin(length * 1.7) * 0.025;
    return {
      x: length,
      y: Math.cos(theta) * radius,
      z: Math.sin(theta) * radius,
      intensity: 0,
      deviation: 0,
    };
  }

  if (shape === "blade") {
    const u = rand();
    const v = rand();
    const x = (u - 0.5) * 4.8;
    const z = (v - 0.5) * (0.5 + 1.4 * (1 - u));
    const camber = Math.sin(u * Math.PI) * 0.42;
    return {
      x,
      y: camber + z * z * 0.16 - u * 0.45,
      z,
      intensity: 0,
      deviation: 0,
    };
  }

  if (shape === "bearing") {
    const theta = rand() * Math.PI * 2;
    const radius = 1.55 + (rand() - 0.5) * 0.32;
    return {
      x: Math.cos(theta) * radius,
      y: Math.sin(theta * 12) * 0.025,
      z: Math.sin(theta) * radius,
      intensity: 0,
      deviation: 0,
    };
  }

  const x = rand() * 4.8 - 2.4;
  const z = rand() * 3.2 - 1.6;
  return {
    x,
    y: Math.sin(x * 1.4) * 0.08 + Math.cos(z * 1.9) * 0.06,
    z,
    intensity: 0,
    deviation: 0,
  };
}

function anomalyField(x: number, z: number, strength: number) {
  const dent = Math.exp(-((x - 0.9) ** 2 + (z + 0.35) ** 2) / 0.18) * -0.35 * strength;
  const raised = Math.exp(-((x + 1.15) ** 2 + (z - 0.55) ** 2) / 0.12) * 0.26 * strength;
  return dent + raised;
}

function colorForSample(sample: PointSample, bounds: ReturnType<typeof getBounds>) {
  let value: number;
  if (state.colorMode === "height") value = normalize(sample.y, bounds.minY, bounds.maxY);
  else if (state.colorMode === "intensity") value = sample.intensity;
  else value = clamp(sample.deviation / 0.22, 0, 1);

  const low = new THREE.Color("#2dd4bf");
  const mid = new THREE.Color("#f59e0b");
  const high = new THREE.Color("#ef4444");
  return value < 0.5 ? low.lerp(mid, value * 2) : mid.lerp(high, (value - 0.5) * 2);
}

function updateMetrics(samples: PointSample[], bounds: ReturnType<typeof getBounds>) {
  const rms = Math.sqrt(samples.reduce((sum, sample) => sum + sample.deviation ** 2, 0) / Math.max(samples.length, 1));
  const anomalies = samples.filter((sample) => sample.deviation > 0.15).length;
  setText("metricPoints", samples.length.toLocaleString());
  setText("metricAnomalies", anomalies.toLocaleString());
  setText("metricWidth", `${(bounds.maxX - bounds.minX).toFixed(2)} m`);
  setText("metricDepth", `${(bounds.maxZ - bounds.minZ).toFixed(2)} m`);
  setText("metricHeight", `${(bounds.maxY - bounds.minY).toFixed(2)} m`);
  setText("metricRms", `${(rms * 1000).toFixed(0)} mm`);

  const text = state.imported
    ? "Imported XYZ/CSV data is displayed as a static point cloud. Metrics are computed directly from the file values."
    : "Deviation colors compare points with the generated nominal surface and highlight synthetic raised or recessed regions.";
  setText("interpretation", text);
}

function updateLabel() {
  setText("sceneLabel", state.imported ? "Imported point cloud" : `Synthetic ${state.shape.replace("-", " ")} point cloud`);
}

function getBounds(samples: PointSample[]) {
  return samples.reduce(
    (bounds, sample) => ({
      minX: Math.min(bounds.minX, sample.x),
      maxX: Math.max(bounds.maxX, sample.x),
      minY: Math.min(bounds.minY, sample.y),
      maxY: Math.max(bounds.maxY, sample.y),
      minZ: Math.min(bounds.minZ, sample.z),
      maxZ: Math.max(bounds.maxZ, sample.z),
    }),
    { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity, minZ: Infinity, maxZ: -Infinity },
  );
}

function parsePointText(text: string): PointSample[] {
  return text
    .trim()
    .split(/\r?\n/)
    .map((line) => line.split(/[,\s]+/).map(Number))
    .filter((values) => values.length >= 3 && values.slice(0, 3).every(Number.isFinite))
    .slice(0, 60000)
    .map(([x, y, z, intensity = 0.65]) => ({
      x,
      y,
      z,
      intensity: clamp(intensity, 0, 1),
      deviation: Math.abs(y),
    }));
}

function downloadSample() {
  const rows = currentSamples.slice(0, 2500).map((sample) => `${sample.x.toFixed(5)},${sample.y.toFixed(5)},${sample.z.toFixed(5)},${sample.intensity.toFixed(3)}`);
  const blob = new Blob([`x,y,z,intensity\n${rows.join("\n")}`], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "pointcloud-lab-sample.csv";
  link.click();
  URL.revokeObjectURL(url);
}

function createOrbitControls(cam: THREE.PerspectiveCamera, element: HTMLElement) {
  const target = new THREE.Vector3(0, 0, 0);
  let dragging = false;
  let previousX = 0;
  let previousY = 0;
  let theta = -0.8;
  let phi = 1.05;
  let radius = 6.2;

  function update() {
    cam.position.set(
      Math.sin(phi) * Math.sin(theta) * radius,
      Math.cos(phi) * radius,
      Math.sin(phi) * Math.cos(theta) * radius,
    );
    cam.lookAt(target);
  }

  element.addEventListener("pointerdown", (event) => {
    dragging = true;
    previousX = event.clientX;
    previousY = event.clientY;
    element.setPointerCapture(event.pointerId);
  });
  element.addEventListener("pointermove", (event) => {
    if (!dragging) return;
    theta -= (event.clientX - previousX) * 0.006;
    phi = clamp(phi + (event.clientY - previousY) * 0.006, 0.2, Math.PI - 0.2);
    previousX = event.clientX;
    previousY = event.clientY;
    update();
  });
  element.addEventListener("pointerup", () => {
    dragging = false;
  });
  element.addEventListener("wheel", (event) => {
    radius = clamp(radius + event.deltaY * 0.006, 2.2, 14);
    update();
  }, { passive: true });

  update();
  return { update, reset: () => { theta = -0.8; phi = 1.05; radius = 6.2; update(); } };
}

function resetCamera() {
  controls.reset();
}

function resize() {
  const rect = viewer.getBoundingClientRect();
  renderer.setSize(rect.width, rect.height, false);
  camera.aspect = rect.width / Math.max(rect.height, 1);
  camera.updateProjectionMatrix();
}

function animate() {
  requestAnimationFrame(animate);
  if (currentPoints) currentPoints.rotation.y += 0.0015;
  renderer.render(scene, camera);
}

function setText(id: string, value: string) {
  const element = document.querySelector(`#${id}`);
  if (element) element.textContent = value;
}

function mulberry32(seed: number) {
  return () => {
    let value = (seed += 0x6d2b79f5);
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function normalize(value: number, min: number, max: number) {
  if (max === min) return 0;
  return clamp((value - min) / (max - min), 0, 1);
}
