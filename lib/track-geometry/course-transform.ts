import type { Course } from "../skill-engine/types";
import type { CompactShapeEntry } from "./types";

export interface TransformedPoint {
  x: number;
  y: number;
  distance: number;
  tangentX: number;
  tangentY: number;
  normalX: number;
  normalY: number; // Left-side orthogonal normal
}

export interface CourseTransformResult {
  points: TransformedPoint[];
  bounds: {
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
    width: number;
    height: number;
  };
  scale: number;
  offsetX: number;
  offsetY: number;
  rotationAngle: number;
  finalStraightY: number;
  isLeftHanded: boolean;
  totalDistance: number;
}

/**
 * Calculates transformed 2D canvas coordinates for any racecourse spline.
 * Guarantees that the Final Straight is strictly horizontal parallel to the bottom canvas edge.
 *
 * Natural Chirality Preservation:
 * - Hakuraku base space: (x0 = -rx, y0 = rz). In this space, the grandstand is at the bottom,
 *   and all loops naturally extend upwards (avgY < finishY).
 * - Right-handed courses (turn === 1, Clockwise): Horses run Right-to-Left along the bottom
 *   straight into the finish line on the bottom-left. (Target angle = Math.PI, vector (-1, 0)).
 * - Left-handed courses (turn === 2, Counter-clockwise): Horses run Left-to-Right along the bottom
 *   straight into the finish line on the bottom-right. (Target angle = 0, vector (1, 0)).
 * - Straight courses (turn === 4): Horses run Left-to-Right horizontally (Target angle = 0).
 *
 * NO REFLECTIONS (p.y = -p.y) are applied, ensuring 100% physically accurate turn chirality.
 */
export function transformCourseSpline(
  shape: CompactShapeEntry,
  course: Course,
  canvasWidth: number,
  canvasHeight: number,
  padding = { top: 75, bottom: 60, left: 65, right: 65 }
): CourseTransformResult {
  const rawPoints = shape.points;
  const numPoints = rawPoints.length;
  const totalDistance = course.length || shape.distance;

  // 1. Convert to Hakuraku viewer coordinate space: x0 = -rx, y0 = rz
  // In this space, the spectator view has the home straight at the bottom and loop above.
  const basePoints: { x: number; y: number }[] = rawPoints.map(([rx, rz]) => ({
    x: -rx,
    y: rz,
  }));

  // 2. Identify final straight vector leading to the finish line (index numPoints - 1)
  const finishIdx = numPoints - 1;
  const sampleOffset = Math.min(25, Math.max(10, Math.floor(numPoints * 0.12)));
  const preFinishIdx = Math.max(0, finishIdx - sampleOffset);

  const pFinish = basePoints[finishIdx];
  const pPre = basePoints[preFinishIdx];

  const dxFinal = pFinish.x - pPre.x;
  const dyFinal = pFinish.y - pPre.y;
  const currentAngle = Math.atan2(dyFinal, dxFinal);

  // 3. Determine target angle to align final straight horizontally
  // - Right-handed (turn 1, Clockwise): runs Right-to-Left into finish at bottom-left -> targetAngle = Math.PI
  // - Left-handed (turn 2, Counter-clockwise): runs Left-to-Right into finish at bottom-right -> targetAngle = 0
  // - Straight (turn 4): runs Left-to-Right horizontally -> targetAngle = 0
  const isLeftHanded = course.turn === 2;
  const targetAngle = isLeftHanded ? 0 : Math.PI;
  const rotationAngle = targetAngle - currentAngle;

  const cosR = Math.cos(rotationAngle);
  const sinR = Math.sin(rotationAngle);

  // 4. Pure rigid 2D rotation (preserves chirality strictly)
  const rotated: { x: number; y: number }[] = basePoints.map((p) => ({
    x: p.x * cosR - p.y * sinR,
    y: p.x * sinR + p.y * cosR,
  }));

  // 5. Compute rotated bounding box
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;

  for (const p of rotated) {
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  }

  const rawWidth = Math.max(1, maxX - minX);
  const rawHeight = Math.max(1, maxY - minY);

  // 6. Scale and translate into canvas viewport
  const availWidth = Math.max(100, canvasWidth - padding.left - padding.right);
  const availHeight = Math.max(100, canvasHeight - padding.top - padding.bottom);

  const scale = Math.min(availWidth / rawWidth, availHeight / rawHeight);

  // Center horizontally
  const contentWidth = rawWidth * scale;
  const offsetX = padding.left + (availWidth - contentWidth) / 2 - minX * scale;

  // Align final straight near the bottom (maxY is placed at canvasHeight - padding.bottom)
  const offsetY = canvasHeight - padding.bottom - maxY * scale;

  // 7. Generate transformed points with unit tangents and left orthogonal normals
  const transformedPoints: TransformedPoint[] = [];

  for (let i = 0; i < numPoints; i++) {
    const d = (i / (numPoints - 1)) * totalDistance;
    const px = rotated[i].x * scale + offsetX;
    const py = rotated[i].y * scale + offsetY;

    // Tangent via central difference
    const prevIdx = Math.max(0, i - 1);
    const nextIdx = Math.min(numPoints - 1, i + 1);
    const tx = (rotated[nextIdx].x - rotated[prevIdx].x) * scale;
    const ty = (rotated[nextIdx].y - rotated[prevIdx].y) * scale;
    const tLen = Math.hypot(tx, ty) || 1;
    const unitTx = tx / tLen;
    const unitTy = ty / tLen;

    // Left orthogonal normal in 2D screen coordinates (-unitTy, unitTx)
    const unitNx = -unitTy;
    const unitNy = unitTx;

    transformedPoints.push({
      x: px,
      y: py,
      distance: d,
      tangentX: unitTx,
      tangentY: unitTy,
      normalX: unitNx,
      normalY: unitNy,
    });
  }

  const finalStraightY = transformedPoints[finishIdx].y;

  return {
    points: transformedPoints,
    bounds: {
      minX: minX * scale + offsetX,
      maxX: maxX * scale + offsetX,
      minY: minY * scale + offsetY,
      maxY: maxY * scale + offsetY,
      width: contentWidth,
      height: rawHeight * scale,
    },
    scale,
    offsetX,
    offsetY,
    rotationAngle,
    finalStraightY,
    isLeftHanded,
    totalDistance,
  };
}

/**
 * Interpolates point coordinates and orthogonal normal at any distance d (0 <= d <= totalDistance)
 */
export function interpolateCoursePoint(
  transformedPoints: TransformedPoint[],
  totalDistance: number,
  distance: number
): TransformedPoint {
  const clampedD = Math.max(0, Math.min(totalDistance, distance));
  const numPoints = transformedPoints.length;
  const ratio = clampedD / totalDistance;
  const fIndex = ratio * (numPoints - 1);
  const idx = Math.floor(fIndex);
  const nextIdx = Math.min(numPoints - 1, idx + 1);
  const t = fIndex - idx;

  const p0 = transformedPoints[idx];
  const p1 = transformedPoints[nextIdx];

  const x = p0.x + (p1.x - p0.x) * t;
  const y = p0.y + (p1.y - p0.y) * t;
  const tangentX = p0.tangentX + (p1.tangentX - p0.tangentX) * t;
  const tangentY = p0.tangentY + (p1.tangentY - p0.tangentY) * t;
  const normalX = p0.normalX + (p1.normalX - p0.normalX) * t;
  const normalY = p0.normalY + (p1.normalY - p0.normalY) * t;

  const tLen = Math.hypot(tangentX, tangentY) || 1;
  const nLen = Math.hypot(normalX, normalY) || 1;

  return {
    x,
    y,
    distance: clampedD,
    tangentX: tangentX / tLen,
    tangentY: tangentY / tLen,
    normalX: normalX / nLen,
    normalY: normalY / nLen,
  };
}
