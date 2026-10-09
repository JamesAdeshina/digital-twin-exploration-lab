import * as THREE from "three";
import {
  clipByHeight,
  generatePointCloud,
  getStats,
  nearestDistance,
  parseCsvPoints,
  planeSeparate,
  pointsToCsv,
  transformMatrix,
  transformPoints,
  voxelDownsample,
  type ColorMode,
  type PointSample,
  type ShapeMode,
  type TransformConfig,
  type ViewMode,
} from "./geometry";
import "./styles.css";

interface LabState {
  shape: ShapeMode;
  colorMode: ColorMode;
  viewMode: ViewMode;
  pointCount: number;
  noise: number;
  density: number;
  pointSize: number;
  voxelSize: number;
  clipMin: number;
  clipMax: number;
  planeThreshold: number;
  imported: boolean;
  transform: TransformConfig;
}

const state: LabState = {
  shape: "machine",
  colorMode: "cluster",
  viewMode: "points",
  pointCount: 9000,
  noise: 0.035,
  density: 100,
  pointSize: 0.024,
  voxelSize: 0,
  clipMin: -2,
  clipMax: 2,
  planeThreshold: 0.25,
  imported: false,
  transform: { translateX: 0, translateY: 0, translateZ: 0, rotateX: 0, rotateY: 0, rotateZ: 0, scale: 1 },
};

const app = document.querySelector<HTMLDivElement>("#app");
if (!app) throw new Error("App root not found");

app.innerHTML = `
  <div class="layout">
    <aside class="panel">
      <div class="eyebrow">3D Computer Vision & Spatial Data</div>
      <h1>PointCloud Lab</h1>
      <p>Inspect, transform, segment, measure, compare, import, and export synthetic XYZ point clouds.</p>
      <div class="note">SYNTHETIC SCAN. This is not LiDAR, CT, metrology, or a validated industrial inspection result.</div>

      <section class="control">
        <div class="section-title">Dataset</div>
        <label class="control-row">Preset</label>
        <select id="shape" aria-label="Dataset preset">
          <option value="cube">Cube surface</option>
          <option value="cylinder">Cylinder / pipe</option>
          <option value="sphere">Sphere scan</option>
          <option value="machine" selected>Machine-like assembly</option>
          <option value="shelf">Noisy warehouse shelf</option>
        </select>
        <label class="control-row">Color by</label>
        <select id="colorMode" aria-label="Color by">
          <option value="cluster" selected>Cluster</option>
          <option value="height">Height</option>
          <option value="intensity">Intensity</option>
        </select>
        <label class="control-row">Render as</label>
        <select id="viewMode" aria-label="Render mode">
          <option value="points" selected>Point cloud</option>
          <option value="wireframe">Procedural wireframe</option>
          <option value="solid">Procedural solid mesh</option>
        </select>
      </section>

      <section class="control">
        <div class="section-title">Sampling</div>
        ${range("pointCount", "Point count", 2000, 30000, 500, 9000)}
        ${range("density", "Density", 20, 100, 5, 100, "%")}
        ${range("noise", "Noise", 0, 0.18, 0.005, 0.035)}
        ${range("pointSize", "Point size", 0.008, 0.07, 0.001, 0.024)}
      </section>

      <section class="control">
        <div class="section-title">Processing</div>
        ${range("voxelSize", "Voxel grid", 0, 0.35, 0.01, 0)}
        ${range("clipMin", "Clip min Y", -2, 2, 0.05, -2)}
        ${range("clipMax", "Clip max Y", -2, 2, 0.05, 2)}
        ${range("planeThreshold", "Plane split Y", -1.5, 1.5, 0.05, 0.25)}
      </section>

      <section class="control">
        <div class="section-title">Transform</div>
        ${range("translateX", "Translate X", -3, 3, 0.05, 0)}
        ${range("translateY", "Translate Y", -3, 3, 0.05, 0)}
        ${range("translateZ", "Translate Z", -3, 3, 0.05, 0)}
        ${range("rotateX", "Rotate X", -180, 180, 5, 0, "deg")}
        ${range("rotateY", "Rotate Y", -180, 180, 5, 0, "deg")}
        ${range("rotateZ", "Rotate Z", -180, 180, 5, 0, "deg")}
        ${range("scale", "Scale", 0.4, 2, 0.05, 1)}
      </section>

      <div class="button-grid">
        <button class="button" id="regenerate">Regenerate</button>
        <button class="button" id="resetCamera">Reset camera</button>
        <button class="button" id="exportCsv">Export CSV</button>
        <button class="button" id="screenshot">PNG scene</button>
        <label class="file-label">Import CSV<input class="hidden" id="fileInput" type="file" accept=".csv,.xyz,.txt" /></label>
      </div>
      <p class="error" id="errorMessage" role="status"></p>
    </aside>

    <section class="viewer" id="viewer">
      <div class="scene-label" id="sceneLabel">Synthetic scan: original left, processed right</div>
    </section>

    <aside class="panel">
      <section>
        <div class="section-title">Comparison stats</div>
        <div class="metric-grid">
          <div class="metric"><span>Original points</span><strong id="originalCount">0</strong></div>
          <div class="metric"><span>Processed points</span><strong id="processedCount">0</strong></div>
          <div class="metric"><span>Centroid</span><strong id="centroid">0,0,0</strong></div>
          <div class="metric"><span>Dimensions</span><strong id="dimensions">0 m</strong></div>
          <div class="metric"><span>Nearest sample</span><strong id="nearest">0 m</strong></div>
          <div class="metric"><span>Clusters</span><strong id="clusters">0</strong></div>
        </div>
      </section>

      <section class="control">
        <div class="section-title">4x4 transform matrix</div>
        <pre class="matrix" id="matrix"></pre>
      </section>

      <section class="control">
        <div class="section-title">Definitions</div>
        <div class="tutorial">
          <strong>XYZ coordinates</strong><span>Each point stores a position in 3D space.</span>
          <strong>Coordinate frame</strong><span>The origin and axes used to describe those XYZ values.</span>
          <strong>Homogeneous transform</strong><span>A 4x4 matrix that combines translation, rotation, and scale.</span>
          <strong>Voxelisation</strong><span>Grouping nearby points into 3D grid cells to reduce density.</span>
          <strong>Segmentation</strong><span>Separating points into meaningful groups, here with a simple height threshold.</span>
        </div>
      </section>

      <section class="control">
        <div class="section-title">Guided experiments</div>
        <ol class="steps">
          <li>Load machine-like assembly and orbit the scan.</li>
          <li>Increase noise and notice thicker surfaces.</li>
          <li>Raise voxel grid size and compare before/after counts.</li>
          <li>Translate X by 2 and watch the centroid shift.</li>
          <li>Export CSV and explain x,y,z,r,g,b columns.</li>
        </ol>
      </section>

      <section class="control">
        <div class="section-title">Rendering note</div>
        <p>Wireframe and solid modes show the procedural source geometry. That is not the same as reconstructing a mesh from an arbitrary scan.</p>
      </section>
    </aside>
  </div>
`;

const viewer = document.querySelector<HTMLDivElement>("#viewer")!;
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setClearColor(0x05080d);
viewer.prepend(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(48, 1, 0.01, 160);
const controls = createOrbitControls(camera, renderer.domElement);
scene.add(new THREE.GridHelper(10, 20, 0x334155, 0x1f2937));
scene.add(new THREE.AxesHelper(2.2));
scene.add(new THREE.AmbientLight(0xffffff, 0.7));
const keyLight = new THREE.DirectionalLight(0xffffff, 1.4);
keyLight.position.set(3, 5, 4);
scene.add(keyLight);

let originalSamples: PointSample[] = [];
let processedSamples: PointSample[] = [];
let originalObject: THREE.Object3D | undefined;
let processedObject: THREE.Object3D | undefined;

bindControls();
resize();
regenerate();
animate();

window.addEventListener("resize", resize);

function range(id: string, label: string, min: number, max: number, step: number, value: number, suffix = "") {
  return `
    <label class="control">
      <span class="control-row"><span>${label}</span><output id="${id}Out">${value}${suffix}</output></span>
      <input id="${id}" type="range" min="${min}" max="${max}" step="${step}" value="${value}" aria-label="${label}" />
    </label>
  `;
}

function bindControls() {
  bindSelect<ShapeMode>("shape", (value) => {
    state.shape = value;
    state.imported = false;
    regenerate();
  });
  bindSelect<ColorMode>("colorMode", (value) => {
    state.colorMode = value;
    render();
  });
  bindSelect<ViewMode>("viewMode", (value) => {
    state.viewMode = value;
    render();
  });
  bindRange("pointCount", (value) => {
    state.pointCount = value;
    state.imported = false;
    regenerate();
  });
  bindRange("density", (value) => {
    state.density = value;
    state.imported = false;
    regenerate();
  }, (value) => `${value}%`);
  bindRange("noise", (value) => {
    state.noise = value;
    state.imported = false;
    regenerate();
  });
  bindRange("pointSize", (value) => {
    state.pointSize = value;
    render();
  });
  bindRange("voxelSize", (value) => {
    state.voxelSize = value;
    processAndRender();
  });
  bindRange("clipMin", (value) => {
    state.clipMin = value;
    processAndRender();
  });
  bindRange("clipMax", (value) => {
    state.clipMax = value;
    processAndRender();
  });
  bindRange("planeThreshold", (value) => {
    state.planeThreshold = value;
    processAndRender();
  });

  (["translateX", "translateY", "translateZ", "rotateX", "rotateY", "rotateZ", "scale"] as const).forEach((key) => {
    bindRange(key, (value) => {
      state.transform[key] = value;
      processAndRender();
    }, key.startsWith("rotate") ? (value) => `${value}deg` : undefined);
  });

  document.querySelector("#regenerate")?.addEventListener("click", regenerate);
  document.querySelector("#resetCamera")?.addEventListener("click", () => controls.reset());
  document.querySelector("#exportCsv")?.addEventListener("click", exportCsv);
  document.querySelector("#screenshot")?.addEventListener("click", exportPng);
  document.querySelector<HTMLInputElement>("#fileInput")?.addEventListener("change", (event) => {
    const input = event.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    file.text().then((text) => {
      const result = parseCsvPoints(text);
      setError(result.error ?? "");
      if (result.points.length > 0) {
        state.imported = true;
        originalSamples = result.points;
        processAndRender();
      }
    });
  });
}

function bindSelect<T extends string>(id: string, onChange: (value: T) => void) {
  document.querySelector<HTMLSelectElement>(`#${id}`)?.addEventListener("change", (event) => {
    onChange((event.currentTarget as HTMLSelectElement).value as T);
  });
}

function bindRange(id: string, onInput: (value: number) => void, format = (value: number) => String(value)) {
  document.querySelector<HTMLInputElement>(`#${id}`)?.addEventListener("input", (event) => {
    const value = Number((event.currentTarget as HTMLInputElement).value);
    const output = document.querySelector<HTMLOutputElement>(`#${id}Out`);
    if (output) output.value = format(value);
    onInput(value);
  });
}

function regenerate() {
  setError("");
  originalSamples = generatePointCloud(state.shape, state.pointCount, state.noise, state.density);
  processAndRender();
}

function processAndRender() {
  const minY = Math.min(state.clipMin, state.clipMax);
  const maxY = Math.max(state.clipMin, state.clipMax);
  const clipped = clipByHeight(originalSamples, minY, maxY);
  const downsampled = voxelDownsample(clipped, state.voxelSize);
  const segmented = planeSeparate(downsampled, state.planeThreshold);
  processedSamples = transformPoints(segmented, state.transform);
  render();
  updateMetrics();
}

function render() {
  if (originalObject) disposeObject(originalObject);
  if (processedObject) disposeObject(processedObject);
  originalObject = objectForSamples(originalSamples, -2.9);
  processedObject = objectForSamples(processedSamples, 2.9);
  scene.add(originalObject, processedObject);
  setText("sceneLabel", `${state.imported ? "Imported" : "Synthetic"} scan: original left, processed right`);
}

function objectForSamples(samples: PointSample[], xOffset: number): THREE.Object3D {
  if (state.viewMode === "solid" || state.viewMode === "wireframe") {
    const mesh = proceduralMesh(state.shape, state.viewMode === "wireframe");
    mesh.position.x = xOffset;
    return mesh;
  }
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(samples.length * 3);
  const colors = new Float32Array(samples.length * 3);
  const stats = getStats(samples);
  samples.forEach((sample, index) => {
    positions[index * 3] = sample.x + xOffset;
    positions[index * 3 + 1] = sample.y;
    positions[index * 3 + 2] = sample.z;
    const color = colorFor(sample, stats);
    colors[index * 3] = color.r;
    colors[index * 3 + 1] = color.g;
    colors[index * 3 + 2] = color.b;
  });
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  geometry.computeBoundingSphere();
  return new THREE.Points(geometry, new THREE.PointsMaterial({ size: state.pointSize, vertexColors: true, sizeAttenuation: true }));
}

function proceduralMesh(shape: ShapeMode, wireframe: boolean): THREE.Object3D {
  const material = new THREE.MeshStandardMaterial({ color: "#39c6d6", roughness: 0.48, metalness: 0.22, wireframe, transparent: true, opacity: wireframe ? 0.9 : 0.72 });
  if (shape === "cylinder") return new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, 2.6, 36, 1), material);
  if (shape === "sphere") return new THREE.Mesh(new THREE.SphereGeometry(1.15, 36, 20), material);
  if (shape === "shelf" || shape === "machine") {
    const group = new THREE.Group();
    const boxes = shape === "shelf"
      ? [[-0.6, -0.45, 0, 0.8, 0.35, 0.9], [0.6, 0.25, 0, 0.8, 0.35, 0.9], [1.8, 0.95, 0, 0.8, 0.35, 0.9]]
      : [[0, -0.2, 0, 2.6, 0.8, 1.4], [0, 0.6, 0, 1.6, 0.8, 0.9], [1.15, 0.75, 0, 0.5, 1.2, 0.5]];
    boxes.forEach(([x, y, z, w, h, d]) => {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material.clone());
      mesh.position.set(x, y, z);
      group.add(mesh);
    });
    return group;
  }
  return new THREE.Mesh(new THREE.BoxGeometry(2, 2, 2), material);
}

function colorFor(sample: PointSample, stats: ReturnType<typeof getStats>): THREE.Color {
  if (state.colorMode === "height") return gradient(normalize(sample.y, stats.bounds.minY, stats.bounds.maxY));
  if (state.colorMode === "intensity") return gradient(sample.intensity);
  const palette = ["#2dd4bf", "#38bdf8", "#ef4444", "#f59e0b"];
  return new THREE.Color(palette[Math.abs(sample.cluster) % palette.length]);
}

function gradient(value: number): THREE.Color {
  const low = new THREE.Color("#2dd4bf");
  const mid = new THREE.Color("#f59e0b");
  const high = new THREE.Color("#ef4444");
  return value < 0.5 ? low.lerp(mid, value * 2) : mid.lerp(high, (value - 0.5) * 2);
}

function updateMetrics() {
  const original = getStats(originalSamples);
  const processed = getStats(processedSamples);
  setText("originalCount", original.count.toLocaleString());
  setText("processedCount", processed.count.toLocaleString());
  setText("centroid", processed.centroid.map((value) => value.toFixed(2)).join(", "));
  setText("dimensions", processed.dimensions.map((value) => `${value.toFixed(2)}m`).join(" x "));
  setText("nearest", `${nearestDistance(processedSamples).toFixed(3)} m`);
  setText("clusters", String(new Set(processedSamples.map((sample) => sample.cluster)).size));
  setText("matrix", transformMatrix(state.transform).map((row) => row.map((value) => value.toFixed(2).padStart(6, " ")).join(" ")).join("\n"));
}

function exportCsv() {
  const blob = new Blob([pointsToCsv(processedSamples)], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "pointcloud-lab-processed.csv";
  link.click();
  URL.revokeObjectURL(url);
}

function exportPng() {
  const link = document.createElement("a");
  link.href = renderer.domElement.toDataURL("image/png");
  link.download = "pointcloud-lab-scene.png";
  link.click();
}

function disposeObject(object: THREE.Object3D) {
  scene.remove(object);
  object.traverse((child) => {
    const mesh = child as THREE.Mesh;
    mesh.geometry?.dispose();
    const material = mesh.material as THREE.Material | THREE.Material[] | undefined;
    if (Array.isArray(material)) material.forEach((item) => item.dispose());
    else material?.dispose();
  });
}

function createOrbitControls(cam: THREE.PerspectiveCamera, element: HTMLElement) {
  const target = new THREE.Vector3(0, 0, 0);
  let dragging = false;
  let previousX = 0;
  let previousY = 0;
  let theta = -0.75;
  let phi = 1.05;
  let radius = 8.4;

  function update() {
    cam.position.set(Math.sin(phi) * Math.sin(theta) * radius, Math.cos(phi) * radius, Math.sin(phi) * Math.cos(theta) * radius);
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
    radius = clamp(radius + event.deltaY * 0.008, 3.2, 18);
    update();
  }, { passive: true });

  update();
  return { reset: () => { theta = -0.75; phi = 1.05; radius = 8.4; update(); } };
}

function resize() {
  const rect = viewer.getBoundingClientRect();
  renderer.setSize(rect.width, rect.height, false);
  camera.aspect = rect.width / Math.max(rect.height, 1);
  camera.updateProjectionMatrix();
}

function animate() {
  requestAnimationFrame(animate);
  renderer.render(scene, camera);
}

function setText(id: string, value: string) {
  const element = document.querySelector(`#${id}`);
  if (element) element.textContent = value;
}

function setError(value: string) {
  setText("errorMessage", value);
}

function normalize(value: number, min: number, max: number) {
  if (min === max) return 0;
  return clamp((value - min) / (max - min), 0, 1);
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}
