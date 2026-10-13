export function createSeededRandom(seed: number) {
  let value = seed >>> 0;
  return () => {
    value = (value * 1664525 + 1013904223) >>> 0;
    return value / 4294967296;
  };
}

export function exponential(mean: number, random: () => number) {
  return -Math.log(Math.max(1e-9, 1 - random())) * mean;
}

export function triangular(min: number, mode: number, max: number, random: () => number) {
  const u = random();
  const c = (mode - min) / (max - min);
  if (u < c) return min + Math.sqrt(u * (max - min) * (mode - min));
  return max - Math.sqrt((1 - u) * (max - min) * (max - mode));
}
