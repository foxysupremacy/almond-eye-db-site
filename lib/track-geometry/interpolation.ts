export function clamp(val: number, min: number, max: number): number {
  return Math.min(Math.max(val, min), max);
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/**
 * Interpolates a point along the 251-point [x, z] spline.
 * Returns the position [x, z], normalized tangent (dx, dz), and unit left-normal (-dz, dx).
 */
export function interpolateTrackPoint2D(points: [number, number][], ratio: number) {
  if (points.length === 0) {
    return { x: 0, z: 0, tangentX: 1, tangentZ: 0, normalX: 0, normalZ: 1 };
  }
  if (points.length === 1) {
    return { x: points[0][0], z: points[0][1], tangentX: 1, tangentZ: 0, normalX: 0, normalZ: 1 };
  }

  const maxIndex = points.length - 1;
  const scaledIndex = clamp(ratio, 0, 1) * maxIndex;
  const lowerIndex = Math.floor(scaledIndex);
  const upperIndex = Math.min(maxIndex, Math.ceil(scaledIndex));
  const alpha = scaledIndex - lowerIndex;

  const lower = points[lowerIndex];
  const upper = points[upperIndex];

  const x = lower[0] + (upper[0] - lower[0]) * alpha;
  const z = lower[1] + (upper[1] - lower[1]) * alpha;

  const prev = points[Math.max(0, lowerIndex - 1)];
  const next = points[Math.min(maxIndex, upperIndex + 1)];
  const dx = next[0] - prev[0];
  const dz = next[1] - prev[1];
  const length = Math.hypot(dx, dz) || 1;

  const tangentX = dx / length;
  const tangentZ = dz / length;
  const normalX = -dz / length;
  const normalZ = dx / length;

  return {
    x,
    z,
    tangentX,
    tangentZ,
    normalX,
    normalZ,
  };
}
