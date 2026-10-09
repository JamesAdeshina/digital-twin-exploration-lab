import { describe, expect, it } from "vitest";
import { distance, generatePointCloud, getStats, parseCsvPoints, transformPoints, voxelDownsample } from "./geometry";

describe("point-cloud geometry", () => {
  it("translation changes centroid by the requested offset", () => {
    const points = generatePointCloud("cube", 1000, 0, 100);
    const before = getStats(points).centroid;
    const moved = transformPoints(points, { translateX: 2, translateY: -1, translateZ: 0.5, rotateX: 0, rotateY: 0, rotateZ: 0, scale: 1 });
    const after = getStats(moved).centroid;
    expect(after[0] - before[0]).toBeCloseTo(2, 6);
    expect(after[1] - before[1]).toBeCloseTo(-1, 6);
    expect(after[2] - before[2]).toBeCloseTo(0.5, 6);
  });

  it("rotation preserves pairwise distance", () => {
    const points = generatePointCloud("sphere", 100, 0, 100);
    const before = distance(points[0], points[1]);
    const rotated = transformPoints(points, { translateX: 0, translateY: 0, translateZ: 0, rotateX: 30, rotateY: 45, rotateZ: 90, scale: 1 });
    const after = distance(rotated[0], rotated[1]);
    expect(after).toBeCloseTo(before, 6);
  });

  it("voxel downsampling never increases point count", () => {
    const points = generatePointCloud("machine", 4000, 0.02, 100);
    const downsampled = voxelDownsample(points, 0.12);
    expect(downsampled.length).toBeLessThanOrEqual(points.length);
  });

  it("invalid CSV returns a readable error", () => {
    const result = parseCsvPoints("x,y,z\n1,2,nope");
    expect(result.points).toHaveLength(0);
    expect(result.error).toContain("Row 2");
  });
});
