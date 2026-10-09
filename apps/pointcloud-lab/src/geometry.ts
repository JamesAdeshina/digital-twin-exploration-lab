export type ShapeMode = "cube" | "cylinder" | "sphere" | "machine" | "shelf";
export type ColorMode = "height" | "cluster" | "intensity";
export type ViewMode = "points" | "wireframe" | "solid";

export interface PointSample {
  x: number;
  y: number;
  z: number;
  intensity: number;
  cluster: number;
}

export interface TransformConfig {
  translateX: number;
  translateY: number;
  translateZ: number;
  rotateX: number;
  rotateY: number;
  rotateZ: number;
  scale: number;
}

export interface Bounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  minZ: number;
  maxZ: number;
}

export interface PointStats {
  count: number;
  centroid: [number, number, number];
  bounds: Bounds;
  dimensions: [number, number, number];
}

export function createSeededRandom(seed: number) {
  let value = seed >>> 0;
  return () => {
    value = (value * 1664525 + 1013904223) >>> 0;
    return value / 4294967296;
  };
}

export function generatePointCloud(shape: ShapeMode, count: number, noise: number, density: number, seed = 42019): PointSample[] {
  const rand = createSeededRandom(seed + count + Math.round(noise * 1000) + Math.round(density * 10));
  const samples: PointSample[] = [];
  const keepEvery = Math.max(1, Math.round(100 / Math.max(1, density)));

  for (let i = 0; samples.length < count && i < count * keepEvery * 2; i += 1) {
    if (i % keepEvery !== 0) continue;
    const point = sampleShape(shape, rand);
    point.x += (rand() - 0.5) * noise;
    point.y += (rand() - 0.5) * noise;
    point.z += (rand() - 0.5) * noise;
    samples.push(point);
  }

  return samples;
}

export function transformPoints(points: PointSample[], config: TransformConfig): PointSample[] {
  const rx = degreesToRadians(config.rotateX);
  const ry = degreesToRadians(config.rotateY);
  const rz = degreesToRadians(config.rotateZ);
  const sx = Math.sin(rx);
  const cx = Math.cos(rx);
  const sy = Math.sin(ry);
  const cy = Math.cos(ry);
  const sz = Math.sin(rz);
  const cz = Math.cos(rz);

  return points.map((point) => {
    let x = point.x * config.scale;
    let y = point.y * config.scale;
    let z = point.z * config.scale;

    [y, z] = [y * cx - z * sx, y * sx + z * cx];
    [x, z] = [x * cy + z * sy, -x * sy + z * cy];
    [x, y] = [x * cz - y * sz, x * sz + y * cz];

    return {
      ...point,
      x: x + config.translateX,
      y: y + config.translateY,
      z: z + config.translateZ,
    };
  });
}

export function transformMatrix(config: TransformConfig): number[][] {
  const rx = degreesToRadians(config.rotateX);
  const ry = degreesToRadians(config.rotateY);
  const rz = degreesToRadians(config.rotateZ);
  const sx = Math.sin(rx);
  const cx = Math.cos(rx);
  const sy = Math.sin(ry);
  const cy = Math.cos(ry);
  const sz = Math.sin(rz);
  const cz = Math.cos(rz);
  const s = config.scale;

  const r00 = cy * cz;
  const r01 = cz * sx * sy - cx * sz;
  const r02 = sx * sz + cx * cz * sy;
  const r10 = cy * sz;
  const r11 = cx * cz + sx * sy * sz;
  const r12 = cx * sy * sz - cz * sx;
  const r20 = -sy;
  const r21 = cy * sx;
  const r22 = cx * cy;

  return [
    [r00 * s, r01 * s, r02 * s, config.translateX],
    [r10 * s, r11 * s, r12 * s, config.translateY],
    [r20 * s, r21 * s, r22 * s, config.translateZ],
    [0, 0, 0, 1],
  ];
}

export function voxelDownsample(points: PointSample[], voxelSize: number): PointSample[] {
  if (voxelSize <= 0) return points.slice();
  const buckets = new Map<string, { point: PointSample; count: number }>();
  for (const point of points) {
    const key = `${Math.floor(point.x / voxelSize)},${Math.floor(point.y / voxelSize)},${Math.floor(point.z / voxelSize)}`;
    const bucket = buckets.get(key);
    if (!bucket) {
      buckets.set(key, { point: { ...point }, count: 1 });
      continue;
    }
    bucket.count += 1;
    bucket.point.x += (point.x - bucket.point.x) / bucket.count;
    bucket.point.y += (point.y - bucket.point.y) / bucket.count;
    bucket.point.z += (point.z - bucket.point.z) / bucket.count;
    bucket.point.intensity += (point.intensity - bucket.point.intensity) / bucket.count;
  }
  return [...buckets.values()].map((bucket) => bucket.point);
}

export function clipByHeight(points: PointSample[], minY: number, maxY: number): PointSample[] {
  return points.filter((point) => point.y >= minY && point.y <= maxY);
}

export function planeSeparate(points: PointSample[], threshold: number): PointSample[] {
  return points.map((point) => ({ ...point, cluster: point.y > threshold ? 2 : point.cluster }));
}

export function nearestDistance(points: PointSample[]): number {
  if (points.length < 2) return 0;
  let best = Infinity;
  const limit = Math.min(points.length, 600);
  for (let i = 0; i < limit; i += 1) {
    for (let j = i + 1; j < limit; j += 1) {
      best = Math.min(best, distance(points[i], points[j]));
    }
  }
  return best;
}

export function getStats(points: PointSample[]): PointStats {
  const bounds = getBounds(points);
  const centroid = points.reduce<[number, number, number]>(
    (sum, point) => [sum[0] + point.x, sum[1] + point.y, sum[2] + point.z],
    [0, 0, 0],
  );
  const divisor = Math.max(points.length, 1);
  return {
    count: points.length,
    centroid: [centroid[0] / divisor, centroid[1] / divisor, centroid[2] / divisor],
    bounds,
    dimensions: [bounds.maxX - bounds.minX, bounds.maxY - bounds.minY, bounds.maxZ - bounds.minZ],
  };
}

export function parseCsvPoints(text: string): { points: PointSample[]; error?: string } {
  const trimmed = text.trim();
  if (!trimmed) return { points: [], error: "The file is empty." };
  if (trimmed.length > 2_000_000) return { points: [], error: "File is too large for this browser demo." };

  const lines = trimmed.split(/\r?\n/);
  const header = lines[0].toLowerCase().split(/[,\s]+/);
  const hasHeader = header.includes("x") && header.includes("y") && header.includes("z");
  const start = hasHeader ? 1 : 0;
  const xIndex = hasHeader ? header.indexOf("x") : 0;
  const yIndex = hasHeader ? header.indexOf("y") : 1;
  const zIndex = hasHeader ? header.indexOf("z") : 2;
  const iIndex = hasHeader ? header.indexOf("intensity") : 3;
  const points: PointSample[] = [];

  for (let rowIndex = start; rowIndex < lines.length; rowIndex += 1) {
    const cells = lines[rowIndex].trim().split(/[,\s]+/);
    if (cells.length < 3 || cells.every((cell) => cell === "")) continue;
    const x = Number(cells[xIndex]);
    const y = Number(cells[yIndex]);
    const z = Number(cells[zIndex]);
    const intensity = iIndex >= 0 ? Number(cells[iIndex]) : 0.6;
    if (![x, y, z].every(Number.isFinite)) {
      return { points: [], error: `Row ${rowIndex + 1} has a non-numeric x, y, or z value.` };
    }
    points.push({ x, y, z, intensity: Number.isFinite(intensity) ? clamp(intensity, 0, 1) : 0.6, cluster: 0 });
    if (points.length > 60_000) return { points: [], error: "Imported files are limited to 60,000 points for this demo." };
  }

  if (points.length === 0) return { points: [], error: "No valid points were found. Use columns x, y, z." };
  return { points };
}

export function pointsToCsv(points: PointSample[]): string {
  return `x,y,z,r,g,b\n${points
    .map((point) => {
      const [r, g, b] = point.cluster === 2 ? [239, 68, 68] : [45, 212, 191];
      return `${point.x.toFixed(5)},${point.y.toFixed(5)},${point.z.toFixed(5)},${r},${g},${b}`;
    })
    .join("\n")}`;
}

export function distance(a: PointSample, b: PointSample): number {
  return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
}

function sampleShape(shape: ShapeMode, rand: () => number): PointSample {
  if (shape === "cylinder") {
    const theta = rand() * Math.PI * 2;
    const y = rand() * 2.6 - 1.3;
    const radius = 0.9;
    return { x: Math.cos(theta) * radius, y, z: Math.sin(theta) * radius, intensity: rand(), cluster: 0 };
  }
  if (shape === "sphere") {
    const theta = rand() * Math.PI * 2;
    const phi = Math.acos(rand() * 2 - 1);
    const radius = 1.15;
    return {
      x: Math.sin(phi) * Math.cos(theta) * radius,
      y: Math.cos(phi) * radius,
      z: Math.sin(phi) * Math.sin(theta) * radius,
      intensity: rand(),
      cluster: 1,
    };
  }
  if (shape === "machine") {
    const part = rand();
    if (part < 0.52) return boxPoint(rand, [-1.3, -0.6, -0.7], [1.3, 0.2, 0.7], 0);
    if (part < 0.78) return boxPoint(rand, [-0.8, 0.2, -0.45], [0.8, 1.0, 0.45], 1);
    const theta = rand() * Math.PI * 2;
    return { x: 1.15 + Math.cos(theta) * 0.25, y: 0.15 + rand() * 1.2, z: Math.sin(theta) * 0.25, intensity: 0.8, cluster: 2 };
  }
  if (shape === "shelf") {
    const bay = Math.floor(rand() * 4);
    const shelf = Math.floor(rand() * 3);
    return boxPoint(rand, [-1.8 + bay * 1.2, -0.8 + shelf * 0.7, -0.45], [-1.0 + bay * 1.2, -0.45 + shelf * 0.7, 0.45], shelf);
  }
  return boxPoint(rand, [-1, -1, -1], [1, 1, 1], 0);
}

function boxPoint(rand: () => number, min: [number, number, number], max: [number, number, number], cluster: number): PointSample {
  const face = Math.floor(rand() * 6);
  const x = face === 0 ? min[0] : face === 1 ? max[0] : lerp(min[0], max[0], rand());
  const y = face === 2 ? min[1] : face === 3 ? max[1] : lerp(min[1], max[1], rand());
  const z = face === 4 ? min[2] : face === 5 ? max[2] : lerp(min[2], max[2], rand());
  return { x, y, z, intensity: 0.35 + rand() * 0.55, cluster };
}

function getBounds(points: PointSample[]): Bounds {
  if (points.length === 0) return { minX: 0, maxX: 0, minY: 0, maxY: 0, minZ: 0, maxZ: 0 };
  return points.reduce(
    (bounds, point) => ({
      minX: Math.min(bounds.minX, point.x),
      maxX: Math.max(bounds.maxX, point.x),
      minY: Math.min(bounds.minY, point.y),
      maxY: Math.max(bounds.maxY, point.y),
      minZ: Math.min(bounds.minZ, point.z),
      maxZ: Math.max(bounds.maxZ, point.z),
    }),
    { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity, minZ: Infinity, maxZ: -Infinity },
  );
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function degreesToRadians(value: number): number {
  return (value * Math.PI) / 180;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
