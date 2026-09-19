import type { Course } from "../skill-engine/types";
import type { SkillZoneResult } from "../skill-engine/zones";
import type { CompactShapeEntry } from "./types";
import {
  interpolateCoursePoint,
  type CourseTransformResult,
  type TransformedPoint,
} from "./course-transform";

export interface CourseMapRenderOptions {
  hoverMeter: number | null;
  activeSkillZones?: SkillZoneResult[] | null;
  selectedSkillId?: string | null;
  viewOffset?: { x: number; y: number };
  zoom?: number;
  isDark?: boolean;
}

// 4 Racing Phases Colors (Uma Musume standard)
export const PHASE_COLORS = {
  phase0: "#eab308", // Yellow - Early leg (0 to 1/6)
  phase1: "#8b5cf6", // Purple - Mid leg (1/6 to 2/3)
  phase2: "#06b6d4", // Cyan - Late leg (2/3 to 5/6)
  phase3: "#ef4444", // Red - Final stretch (5/6 to finish)
};

export const SLOPE_COLORS = {
  up: "#f59e0b", // Warm amber
  upDark: "#92400e",
  upLight: "#fde68a",
  down: "#06b6d4", // Cool cyan
  downDark: "#0e7490",
  downLight: "#a5f3fc",
};

// 2.5D upward projection vector
const EXTRUDE_X = 0.2;
const EXTRUDE_Y = -1.0;
const E_LEN = Math.hypot(EXTRUDE_X, EXTRUDE_Y) || 1;
const EX = EXTRUDE_X / E_LEN;
const EY = EXTRUDE_Y / E_LEN;

/**
 * Computes raw cumulative elevation at distance d by accumulating all slopes up to d.
 */
function getRawCumulativeElevation(course: Course, d: number): number {
  if (!course.slopes || course.slopes.length === 0) return 0;
  let elev = 0;
  for (const s of course.slopes) {
    if (d <= s.start) continue;
    const activeLen = Math.min(d, s.end) - s.start;
    if (activeLen > 0) {
      // s.slope is in per-10000 units (e.g. 20000 = +2%)
      const grade = s.slope / 10000;
      elev += (grade / 100) * activeLen;
    }
  }
  return elev;
}

export interface ElevationProfile {
  minElev: number;
  maxElev: number;
  span: number;
  scale: number;
}

function computeElevationProfile(course: Course, totalDistance: number): ElevationProfile {
  if (!course.slopes || course.slopes.length === 0) {
    return { minElev: 0, maxElev: 0, span: 0, scale: 0 };
  }

  let minElev = Infinity;
  let maxElev = -Infinity;
  const numCheckSamples = 100;

  for (let i = 0; i <= numCheckSamples; i++) {
    const d = (i / numCheckSamples) * totalDistance;
    const e = getRawCumulativeElevation(course, d);
    if (e < minElev) minElev = e;
    if (e > maxElev) maxElev = e;
  }

  // Also evaluate at all slope boundaries
  for (const s of course.slopes) {
    const e1 = getRawCumulativeElevation(course, s.start);
    const e2 = getRawCumulativeElevation(course, s.end);
    if (e1 < minElev) minElev = e1;
    if (e1 > maxElev) maxElev = e1;
    if (e2 < minElev) minElev = e2;
    if (e2 > maxElev) maxElev = e2;
  }

  const span = Math.max(0, maxElev - minElev);
  // Pixel height scale: 28px max height for visual clarity
  const scale = span > 0.1 ? Math.min(28, Math.max(12, span * 4.0)) / span : 0;

  return { minElev, maxElev, span, scale };
}

/**
 * Returns pixel elevation h >= 0 for distance d.
 */
function getPixelElevation(course: Course, d: number, profile: ElevationProfile): number {
  if (profile.span <= 0.1 || profile.scale <= 0) return 0;
  const rawE = getRawCumulativeElevation(course, d);
  return Math.max(0, (rawE - profile.minElev) * profile.scale);
}

/**
 * Main 2D / 2.5D Course Map Renderer with Continuous Cumulative Elevation.
 * - Final straight is strictly horizontal at the bottom.
 * - Chirality is 100% preserved.
 * - Track elevation is continuous: uphills rise to a plateau, track continues at elevated height,
 *   downhills taper down smoothly without empty gaps.
 */
export function renderCourseMap(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  dpr: number,
  course: Course,
  shape: CompactShapeEntry,
  transform: CourseTransformResult,
  options: CourseMapRenderOptions
) {
  const {
    hoverMeter,
    activeSkillZones,
    selectedSkillId,
    viewOffset = { x: 0, y: 0 },
    zoom = 1,
    isDark = true,
  } = options;

  ctx.save();
  ctx.scale(dpr, dpr);

  // Clear background
  ctx.clearRect(0, 0, width, height);

  // Apply Pan & Zoom transformations
  ctx.save();
  ctx.translate(width / 2 + viewOffset.x, height / 2 + viewOffset.y);
  ctx.scale(zoom, zoom);
  ctx.translate(-width / 2, -height / 2);

  const totalDistance = transform.totalDistance;
  const laneWidth = 32;
  const halfW = laneWidth / 2;

  // Compute continuous elevation profile
  const elevProfile = computeElevationProfile(course, totalDistance);

  // 1. Draw 3D Depth Side Walls connecting ground to elevated track
  if (elevProfile.span > 0.1) {
    draw3DDepthWalls(ctx, transform, course, elevProfile, totalDistance, halfW, isDark);
  }

  // 2. Draw Continuous Elevated Track Surface (4 Phases with Section Hover Highlight)
  drawContinuousPhases(ctx, transform, course, elevProfile, totalDistance, halfW, hoverMeter);

  // 3. Draw Active Slope Intervals (45-degree diagonal striping & hover highlight)
  if (course.slopes && course.slopes.length > 0) {
    drawSlopeIntervals(ctx, width, height, transform, course, elevProfile, totalDistance, halfW, isDark, hoverMeter);
  }

  // 3b. Draw Active Corner Intervals (opposite -45-degree diagonal striping & hover highlight)
  if (course.corners && course.corners.length > 0) {
    drawCornerIntervals(ctx, width, height, transform, course, elevProfile, totalDistance, halfW, isDark, hoverMeter);
  }

  // 4. Draw Continuous Turf Rails along the elevated surface
  drawElevatedTurfRails(ctx, transform, course, elevProfile, totalDistance, halfW, isDark);

  // 5. Draw Active Skill Zones (Dual: Glowing Lane Overlay + Outer Neon Ribbon + Pin)
  if (activeSkillZones && activeSkillZones.length > 0) {
    drawSkillZones(ctx, transform, course, elevProfile, activeSkillZones, selectedSkillId, halfW);
  }

  // 6. Draw Milestones, Corners, Start Flag, and Finish Line (with corner hover highlight)
  drawMilestonesAndCorners(ctx, transform, course, elevProfile, totalDistance, halfW, isDark, hoverMeter);

  // 7. Draw Hover Marker Bead & Tooltip HUD
  if (hoverMeter != null && hoverMeter >= 0 && hoverMeter <= totalDistance) {
    drawHoverMarker(ctx, transform, course, elevProfile, hoverMeter, halfW, isDark);
  }

  ctx.restore();
  ctx.restore();
}

/**
 * 1. Draws 3D Depth Side Walls connecting ground base to elevated track surface.
 * Creates an authentic architectural relief sa bàn appearance.
 */
function draw3DDepthWalls(
  ctx: CanvasRenderingContext2D,
  transform: CourseTransformResult,
  course: Course,
  elevProfile: ElevationProfile,
  totalDist: number,
  halfW: number,
  isDark: boolean
) {
  const numSteps = Math.min(250, Math.max(80, Math.ceil(totalDist / 8)));
  const baseColor = isDark ? "#1e293b" : "#cbd5e1";
  const ribColor = isDark ? "rgba(255, 255, 255, 0.25)" : "rgba(0, 0, 0, 0.2)";

  ctx.save();

  // Connect base to top on the front-facing edge
  for (let i = 0; i < numSteps; i++) {
    const d0 = (i / numSteps) * totalDist;
    const d1 = ((i + 1) / numSteps) * totalDist;

    const h0 = getPixelElevation(course, d0, elevProfile);
    const h1 = getPixelElevation(course, d1, elevProfile);

    if (h0 <= 0.5 && h1 <= 0.5) continue;

    const p0 = interpolateCoursePoint(transform.points, totalDist, d0);
    const p1 = interpolateCoursePoint(transform.points, totalDist, d1);

    // Front-facing side is the one with positive Y normal component (facing downwards on screen)
    const sign = p0.normalY >= 0 ? 1 : -1;

    const bx0 = p0.x + p0.normalX * halfW * sign;
    const by0 = p0.y + p0.normalY * halfW * sign;
    const bx1 = p1.x + p1.normalX * halfW * sign;
    const by1 = p1.y + p1.normalY * halfW * sign;

    const tx0 = bx0 + EX * h0;
    const ty0 = by0 + EY * h0;
    const tx1 = bx1 + EX * h1;
    const ty1 = by1 + EY * h1;

    // Side wall quad
    ctx.beginPath();
    ctx.moveTo(bx0, by0);
    ctx.lineTo(bx1, by1);
    ctx.lineTo(tx1, ty1);
    ctx.lineTo(tx0, ty0);
    ctx.closePath();

    ctx.fillStyle = baseColor;
    ctx.fill();

    // Technical wireframe rib
    if (i % 3 === 0) {
      ctx.beginPath();
      ctx.moveTo(bx0, by0);
      ctx.lineTo(tx0, ty0);
      ctx.strokeStyle = ribColor;
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  }

  ctx.restore();
}

/**
 * 2. Draws the 4 phase colored segments on the continuous elevated track surface.
 */
function drawContinuousPhases(
  ctx: CanvasRenderingContext2D,
  transform: CourseTransformResult,
  course: Course,
  elevProfile: ElevationProfile,
  totalDist: number,
  halfW: number,
  hoverMeter: number | null = null
) {
  const p0End = totalDist / 6;
  const p1End = (totalDist * 2) / 3;
  const p2End = (totalDist * 5) / 6;

  const hoverPhaseIdx =
    hoverMeter != null && hoverMeter >= 0 && hoverMeter <= totalDist
      ? hoverMeter < p0End
        ? 0
        : hoverMeter < p1End
        ? 1
        : hoverMeter < p2End
        ? 2
        : 3
      : null;

  const phases = [
    { idx: 0, start: 0, end: p0End, color: PHASE_COLORS.phase0 },
    { idx: 1, start: p0End, end: p1End, color: PHASE_COLORS.phase1 },
    { idx: 2, start: p1End, end: p2End, color: PHASE_COLORS.phase2 },
    { idx: 3, start: p2End, end: totalDist, color: PHASE_COLORS.phase3 },
  ];

  const stepMeters = 8;

  for (const phase of phases) {
    if (phase.start >= phase.end) continue;

    const isHovered = hoverPhaseIdx === phase.idx;

    ctx.save();
    ctx.beginPath();
    const leftPts: { x: number; y: number }[] = [];
    const rightPts: { x: number; y: number }[] = [];

    const numSteps = Math.max(4, Math.ceil((phase.end - phase.start) / stepMeters));
    for (let i = 0; i <= numSteps; i++) {
      const d = phase.start + (i / numSteps) * (phase.end - phase.start);
      const pt = interpolateCoursePoint(transform.points, totalDist, d);
      const h = getPixelElevation(course, d, elevProfile);

      leftPts.push({
        x: pt.x + pt.normalX * halfW + EX * h,
        y: pt.y + pt.normalY * halfW + EY * h,
      });
      rightPts.push({
        x: pt.x - pt.normalX * halfW + EX * h,
        y: pt.y - pt.normalY * halfW + EY * h,
      });
    }

    // Left edge forward
    ctx.moveTo(leftPts[0].x, leftPts[0].y);
    for (let i = 1; i < leftPts.length; i++) ctx.lineTo(leftPts[i].x, leftPts[i].y);
    // Right edge backward
    for (let i = rightPts.length - 1; i >= 0; i--) ctx.lineTo(rightPts[i].x, rightPts[i].y);
    ctx.closePath();

    ctx.fillStyle = phase.color;
    // When a phase is hovered, other phases dim to 0.65; hovered stays at full 1.0
    ctx.globalAlpha = hoverPhaseIdx == null ? 1.0 : isHovered ? 1.0 : 0.65;
    ctx.fill();

    // Extra highlight glow outline for hovered section
    if (isHovered) {
      ctx.strokeStyle = "rgba(255, 255, 255, 0.45)";
      ctx.lineWidth = 2;
      ctx.stroke();
    }
    ctx.restore();
  }
}

/**
 * 3. Draws active slope intervals on the elevated surface, wireframe ribs, and % badges.
 */
function drawSlopeIntervals(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  transform: CourseTransformResult,
  course: Course,
  elevProfile: ElevationProfile,
  totalDist: number,
  halfW: number,
  isDark: boolean,
  hoverMeter: number | null = null
) {
  const centerX = width / 2;
  const centerY = height / 2;

  for (const slope of course.slopes || []) {
    const startM = slope.start;
    const endM = slope.end;
    const lenM = endM - startM;
    if (lenM <= 10) continue;

    const isHoveredSlope = hoverMeter != null && hoverMeter >= startM && hoverMeter <= endM;
    const isUp = slope.slope > 0;
    const absPercent = Math.abs(slope.slope / 10000);

    const mainColor = isUp ? SLOPE_COLORS.up : SLOPE_COLORS.down;
    const darkColor = isUp ? SLOPE_COLORS.upDark : SLOPE_COLORS.downDark;

    const numSteps = Math.max(6, Math.ceil(lenM / 10));

    // A. Collect perimeter points of the slope track polygon
    const leftPts: { x: number; y: number }[] = [];
    const rightPts: { x: number; y: number }[] = [];

    for (let i = 0; i <= numSteps; i++) {
      const d = startM + (i / numSteps) * lenM;
      const pt = interpolateCoursePoint(transform.points, totalDist, d);
      const h = getPixelElevation(course, d, elevProfile);

      leftPts.push({
        x: pt.x + pt.normalX * halfW + EX * h,
        y: pt.y + pt.normalY * halfW + EY * h,
      });
      rightPts.push({
        x: pt.x - pt.normalX * halfW + EX * h,
        y: pt.y - pt.normalY * halfW + EY * h,
      });
    }

    // B. Draw 45-degree diagonal stripes within the clipped slope surface
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(leftPts[0].x, leftPts[0].y);
    for (let i = 1; i < leftPts.length; i++) ctx.lineTo(leftPts[i].x, leftPts[i].y);
    for (let i = rightPts.length - 1; i >= 0; i--) ctx.lineTo(rightPts[i].x, rightPts[i].y);
    ctx.closePath();

    // If hovered, give the slope a subtle glowing tint
    if (isHoveredSlope) {
      ctx.fillStyle = mainColor;
      ctx.globalAlpha = 0.22;
      ctx.fill();
    }

    ctx.clip(); // Restrict all stripes strictly to the slope surface

    // Draw 45-degree stripes across the slope:
    // With track width 32px (2 * halfW), a 45-degree angle corresponds to tangent shift of 2 * halfW.
    const pxSpacing = 16;
    const meterStep = Math.max(6, Math.round(pxSpacing / (transform.scale || 0.25)));
    const extendM = meterStep * 2;

    ctx.strokeStyle = mainColor;
    ctx.lineWidth = isHoveredSlope ? 9 : 7.5;
    ctx.lineCap = "butt";
    ctx.globalAlpha = isHoveredSlope ? 0.95 : 0.85;

    if (isHoveredSlope) {
      ctx.shadowColor = mainColor;
      ctx.shadowBlur = 10;
    }

    for (let d = startM - extendM; d <= endM + extendM; d += meterStep) {
      const clampedD = Math.max(0, Math.min(totalDist, d));
      const pt = interpolateCoursePoint(transform.points, totalDist, clampedD);
      const h = getPixelElevation(course, clampedD, elevProfile);

      // 45-degree diagonal vector: from left rail shifted back to right rail shifted forward
      const pLeftX = pt.x + pt.normalX * halfW - pt.tangentX * halfW + EX * h;
      const pLeftY = pt.y + pt.normalY * halfW - pt.tangentY * halfW + EY * h;
      const pRightX = pt.x - pt.normalX * halfW + pt.tangentX * halfW + EX * h;
      const pRightY = pt.y - pt.normalY * halfW + pt.tangentY * halfW + EY * h;

      ctx.beginPath();
      ctx.moveTo(pLeftX, pLeftY);
      ctx.lineTo(pRightX, pRightY);
      ctx.stroke();
    }
    ctx.restore(); // Undo clip

    // C. Clean white boundary lines only at start and end of slope
    ctx.save();
    const boundaryColor = isDark ? "rgba(255, 255, 255, 0.9)" : "rgba(255, 255, 255, 0.95)";
    ctx.strokeStyle = boundaryColor;
    ctx.lineWidth = isHoveredSlope ? 3.5 : 2.5;
    ctx.lineCap = "round";

    if (isHoveredSlope) {
      ctx.shadowColor = "#ffffff";
      ctx.shadowBlur = 8;
    }

    // Slope start boundary line
    ctx.beginPath();
    ctx.moveTo(leftPts[0].x, leftPts[0].y);
    ctx.lineTo(rightPts[0].x, rightPts[0].y);
    ctx.stroke();

    // Slope end boundary line
    ctx.beginPath();
    ctx.moveTo(leftPts[numSteps].x, leftPts[numSteps].y);
    ctx.lineTo(rightPts[numSteps].x, rightPts[numSteps].y);
    ctx.stroke();
    ctx.restore();

    // D. Slope Badge & Leader Line (offset inward toward course interior/infield)
    const midD = (startM + endM) / 2;
    const midPt = interpolateCoursePoint(transform.points, totalDist, midD);
    const midH = getPixelElevation(course, midD, elevProfile);

    // Determine which normal direction points inward toward course center (infield)
    const testOffset = 30;
    const pPos = { x: midPt.x + midPt.normalX * testOffset, y: midPt.y + midPt.normalY * testOffset };
    const pNeg = { x: midPt.x - midPt.normalX * testOffset, y: midPt.y - midPt.normalY * testOffset };
    const distPos = Math.hypot(pPos.x - centerX, pPos.y - centerY);
    const distNeg = Math.hypot(pNeg.x - centerX, pNeg.y - centerY);
    const inwardSign = distPos <= distNeg ? 1 : -1;

    const inwardNx = midPt.normalX * inwardSign;
    const inwardNy = midPt.normalY * inwardSign;

    const edgeX = midPt.x + inwardNx * halfW + EX * midH;
    const edgeY = midPt.y + inwardNy * halfW + EY * midH;

    const badgeDist = halfW + (isHoveredSlope ? 25 : 22);
    const badgeX = midPt.x + inwardNx * badgeDist + EX * midH;
    const badgeY = midPt.y + inwardNy * badgeDist + EY * midH;

    // Leader line from inner edge to badge
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(edgeX, edgeY);
    ctx.lineTo(badgeX, badgeY);
    ctx.strokeStyle = isDark ? mainColor : darkColor;
    ctx.lineWidth = isHoveredSlope ? 2.5 : 1.5;
    if (isHoveredSlope) {
      ctx.shadowColor = mainColor;
      ctx.shadowBlur = 8;
    }
    ctx.stroke();

    // Small anchor dot at track edge
    ctx.beginPath();
    ctx.arc(edgeX, edgeY, isHoveredSlope ? 3.5 : 2.5, 0, Math.PI * 2);
    ctx.fillStyle = isDark ? mainColor : darkColor;
    ctx.fill();
    ctx.restore();

    const badgeText = `${isUp ? "↗" : "↘"} ${isUp ? "+" : "-"}${absPercent.toFixed(1)}%`;
    drawSlopeBadge(ctx, badgeX, badgeY, badgeText, mainColor, darkColor, isHoveredSlope);
  }
}

/**
 * 3b. Draws active corner intervals with opposite 45-degree diagonal stripes and hover highlight.
 */
function drawCornerIntervals(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  transform: CourseTransformResult,
  course: Course,
  elevProfile: ElevationProfile,
  totalDist: number,
  halfW: number,
  isDark: boolean,
  hoverMeter: number | null = null
) {
  if (!course.corners || course.corners.length === 0) return;

  const cornerColor = "#f97316"; // Vivid orange

  for (const corner of course.corners) {
    const startM = corner.start;
    const endM = corner.end;
    const lenM = endM - startM;
    if (lenM <= 10) continue;

    const isHoveredCorner = hoverMeter != null && hoverMeter >= startM && hoverMeter <= endM;
    const numSteps = Math.max(6, Math.ceil(lenM / 10));

    // A. Collect perimeter points of the corner track polygon
    const leftPts: { x: number; y: number }[] = [];
    const rightPts: { x: number; y: number }[] = [];

    for (let i = 0; i <= numSteps; i++) {
      const d = startM + (i / numSteps) * lenM;
      const pt = interpolateCoursePoint(transform.points, totalDist, d);
      const h = getPixelElevation(course, d, elevProfile);

      leftPts.push({
        x: pt.x + pt.normalX * halfW + EX * h,
        y: pt.y + pt.normalY * halfW + EY * h,
      });
      rightPts.push({
        x: pt.x - pt.normalX * halfW + EX * h,
        y: pt.y - pt.normalY * halfW + EY * h,
      });
    }

    // B. Draw opposite 45-degree diagonal stripes within the clipped corner surface
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(leftPts[0].x, leftPts[0].y);
    for (let i = 1; i < leftPts.length; i++) ctx.lineTo(leftPts[i].x, leftPts[i].y);
    for (let i = rightPts.length - 1; i >= 0; i--) ctx.lineTo(rightPts[i].x, rightPts[i].y);
    ctx.closePath();

    // If hovered, subtle tint fill across whole corner
    if (isHoveredCorner) {
      ctx.fillStyle = cornerColor;
      ctx.globalAlpha = 0.22;
      ctx.fill();
    }

    ctx.clip(); // Restrict all stripes strictly to the corner surface

    // Opposite 45-degree stripes:
    // Left rail shifted forward (+tangent * halfW), right rail shifted backward (-tangent * halfW).
    // Vector = -2 * halfW * normal - 2 * halfW * tangent (slanting in reverse direction to slopes)
    const pxSpacing = 16;
    const meterStep = Math.max(6, Math.round(pxSpacing / (transform.scale || 0.25)));
    const extendM = meterStep * 2;

    ctx.strokeStyle = cornerColor;
    ctx.lineWidth = isHoveredCorner ? 9 : 7.5;
    ctx.lineCap = "butt";
    ctx.globalAlpha = isHoveredCorner ? 0.95 : 0.82;

    if (isHoveredCorner) {
      ctx.shadowColor = cornerColor;
      ctx.shadowBlur = 10;
    }

    for (let d = startM - extendM; d <= endM + extendM; d += meterStep) {
      const clampedD = Math.max(0, Math.min(totalDist, d));
      const pt = interpolateCoursePoint(transform.points, totalDist, clampedD);
      const h = getPixelElevation(course, clampedD, elevProfile);

      // OPPOSITE 45-degree diagonal vector
      const pLeftX = pt.x + pt.normalX * halfW + pt.tangentX * halfW + EX * h;
      const pLeftY = pt.y + pt.normalY * halfW + pt.tangentY * halfW + EY * h;
      const pRightX = pt.x - pt.normalX * halfW - pt.tangentX * halfW + EX * h;
      const pRightY = pt.y - pt.normalY * halfW - pt.tangentY * halfW + EY * h;

      ctx.beginPath();
      ctx.moveTo(pLeftX, pLeftY);
      ctx.lineTo(pRightX, pRightY);
      ctx.stroke();
    }
    ctx.restore(); // Undo clip

    // C. Clean boundary lines only at start and end of corner
    ctx.save();
    const boundaryColor = isDark ? "rgba(255, 255, 255, 0.85)" : "rgba(255, 255, 255, 0.9)";
    ctx.strokeStyle = boundaryColor;
    ctx.lineWidth = isHoveredCorner ? 3.5 : 2.5;
    ctx.lineCap = "round";

    if (isHoveredCorner) {
      ctx.shadowColor = cornerColor;
      ctx.shadowBlur = 8;
    }

    // Corner start boundary line
    ctx.beginPath();
    ctx.moveTo(leftPts[0].x, leftPts[0].y);
    ctx.lineTo(rightPts[0].x, rightPts[0].y);
    ctx.stroke();

    // Corner end boundary line
    ctx.beginPath();
    ctx.moveTo(leftPts[numSteps].x, leftPts[numSteps].y);
    ctx.lineTo(rightPts[numSteps].x, rightPts[numSteps].y);
    ctx.stroke();
    ctx.restore();
  }
}

/**
 * 4. Draws continuous green turf rails along the elevated track edges.
 */
function drawElevatedTurfRails(
  ctx: CanvasRenderingContext2D,
  transform: CourseTransformResult,
  course: Course,
  elevProfile: ElevationProfile,
  totalDist: number,
  halfW: number,
  isDark: boolean
) {
  const points = transform.points;
  const railColor = isDark ? "#166534" : "#15803d";
  const railWidth = 2.5;

  ctx.save();
  ctx.strokeStyle = railColor;
  ctx.lineWidth = railWidth;
  ctx.lineJoin = "round";
  ctx.lineCap = "round";

  // Left Rail
  ctx.beginPath();
  for (let i = 0; i < points.length; i++) {
    const pt = points[i];
    const h = getPixelElevation(course, pt.distance, elevProfile);
    const lx = pt.x + pt.normalX * halfW + EX * h;
    const ly = pt.y + pt.normalY * halfW + EY * h;
    if (i === 0) ctx.moveTo(lx, ly);
    else ctx.lineTo(lx, ly);
  }
  ctx.stroke();

  // Right Rail
  ctx.beginPath();
  for (let i = 0; i < points.length; i++) {
    const pt = points[i];
    const h = getPixelElevation(course, pt.distance, elevProfile);
    const rx = pt.x - pt.normalX * halfW + EX * h;
    const ry = pt.y - pt.normalY * halfW + EY * h;
    if (i === 0) ctx.moveTo(rx, ry);
    else ctx.lineTo(rx, ry);
  }
  ctx.stroke();
  ctx.restore();
}

/**
 * Draws floating rounded slope pill badge.
 */
function drawSlopeBadge(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  text: string,
  bgColor: string,
  borderColor: string,
  isHovered = false
) {
  ctx.save();
  if (isHovered) {
    ctx.shadowColor = bgColor;
    ctx.shadowBlur = 10;
  }
  ctx.font = isHovered ? "bold 11px Inter, system-ui, sans-serif" : "bold 10px Inter, system-ui, sans-serif";
  const metrics = ctx.measureText(text);
  const pw = metrics.width + (isHovered ? 14 : 10);
  const ph = isHovered ? 19 : 16;
  const rx = x - pw / 2;
  const ry = y - ph / 2;

  ctx.fillStyle = bgColor;
  ctx.beginPath();
  roundRect(ctx, rx, ry, pw, ph, 8);
  ctx.fill();

  ctx.strokeStyle = isHovered ? "#ffffff" : borderColor;
  ctx.lineWidth = isHovered ? 2 : 1;
  ctx.stroke();

  ctx.fillStyle = "#ffffff";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, x, y + 0.5);
  ctx.restore();
}

/**
 * 5. Draws Active Skill Activation Zones on the continuous elevated surface.
 */
function drawSkillZones(
  ctx: CanvasRenderingContext2D,
  transform: CourseTransformResult,
  course: Course,
  elevProfile: ElevationProfile,
  zones: SkillZoneResult[],
  selectedSkillId: string | null | undefined,
  halfW: number
) {
  const totalDist = transform.totalDistance;
  const palette = ["#ec4899", "#3b82f6", "#10b981", "#a855f7", "#f59e0b", "#06b6d4"];

  zones.forEach((zone, zIdx) => {
    if (!zone.regions || zone.regions.length === 0) return;
    const color = palette[zIdx % palette.length];

    for (const region of zone.regions) {
      const startM = Math.max(0, region.start);
      const endM = Math.min(totalDist, region.end);
      if (startM >= endM) continue;

      const numSteps = Math.max(4, Math.ceil((endM - startM) / 6));

      // A. Illuminated Lane Overlay on elevated surface
      ctx.save();
      ctx.beginPath();
      const leftPts: { x: number; y: number }[] = [];
      const rightPts: { x: number; y: number }[] = [];

      for (let i = 0; i <= numSteps; i++) {
        const d = startM + (i / numSteps) * (endM - startM);
        const pt = interpolateCoursePoint(transform.points, totalDist, d);
        const h = getPixelElevation(course, d, elevProfile);

        leftPts.push({
          x: pt.x + pt.normalX * (halfW - 1) + EX * h,
          y: pt.y + pt.normalY * (halfW - 1) + EY * h,
        });
        rightPts.push({
          x: pt.x - pt.normalX * (halfW - 1) + EX * h,
          y: pt.y - pt.normalY * (halfW - 1) + EY * h,
        });
      }

      ctx.moveTo(leftPts[0].x, leftPts[0].y);
      for (let i = 1; i < leftPts.length; i++) ctx.lineTo(leftPts[i].x, leftPts[i].y);
      for (let i = rightPts.length - 1; i >= 0; i--) ctx.lineTo(rightPts[i].x, rightPts[i].y);
      ctx.closePath();

      ctx.fillStyle = color;
      ctx.globalAlpha = 0.42;
      ctx.fill();

      // B. Outer Neon Rail Ribbon
      const railOffset = halfW + 5;
      ctx.beginPath();
      for (let i = 0; i <= numSteps; i++) {
        const d = startM + (i / numSteps) * (endM - startM);
        const pt = interpolateCoursePoint(transform.points, totalDist, d);
        const h = getPixelElevation(course, d, elevProfile);

        const rx = pt.x + pt.normalX * railOffset + EX * h;
        const ry = pt.y + pt.normalY * railOffset + EY * h;
        if (i === 0) ctx.moveTo(rx, ry);
        else ctx.lineTo(rx, ry);
      }
      ctx.strokeStyle = color;
      ctx.lineWidth = 3.5;
      ctx.globalAlpha = 0.9;
      ctx.stroke();

      // C. Pin Marker at Start
      const startPt = interpolateCoursePoint(transform.points, totalDist, startM);
      const startH = getPixelElevation(course, startM, elevProfile);
      const baseX = startPt.x + startPt.normalX * halfW + EX * startH;
      const baseY = startPt.y + startPt.normalY * halfW + EY * startH;
      const pinX = startPt.x + startPt.normalX * (railOffset + 8) + EX * startH;
      const pinY = startPt.y + startPt.normalY * (railOffset + 8) + EY * startH;

      drawSkillPin(ctx, baseX, baseY, pinX, pinY, color);
      ctx.restore();
    }
  });
}

function drawSkillPin(
  ctx: CanvasRenderingContext2D,
  baseX: number,
  baseY: number,
  pinX: number,
  pinY: number,
  color: string
) {
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(baseX, baseY);
  ctx.lineTo(pinX, pinY);
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.5;
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(pinX, pinY, 4.5, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.restore();
}

/**
 * 6. Draws Landmarks & Badges on the elevated track surface.
 */
function drawMilestonesAndCorners(
  ctx: CanvasRenderingContext2D,
  transform: CourseTransformResult,
  course: Course,
  elevProfile: ElevationProfile,
  totalDist: number,
  halfW: number,
  isDark: boolean,
  hoverMeter: number | null = null
) {
  // A. Start Flag (Red Flag at meter 0)
  const startPt = interpolateCoursePoint(transform.points, totalDist, 0);
  const startH = getPixelElevation(course, 0, elevProfile);
  drawStartFlag(ctx, startPt, startH, halfW);

  // B. Finish Line Checkered Bar & Flag (at meter totalDist)
  const finishPt = interpolateCoursePoint(transform.points, totalDist, totalDist);
  const finishH = getPixelElevation(course, totalDist, elevProfile);
  drawFinishFlag(ctx, finishPt, finishH, halfW);

  // C. Corner Badges (Orange circle with corner numbers 1, 2, 3, 4)
  if (course.corners && course.corners.length > 0) {
    for (const corner of course.corners) {
      const isHoveredCorner = hoverMeter != null && hoverMeter >= corner.start && hoverMeter <= corner.end;
      const midM = (corner.start + corner.end) / 2;
      const pt = interpolateCoursePoint(transform.points, totalDist, midM);
      const h = getPixelElevation(course, midM, elevProfile);
      const cornerNum = corner.number ?? 0;
      const badgeOffset = halfW + 16;
      const bx = pt.x + pt.normalX * badgeOffset + EX * h;
      const by = pt.y + pt.normalY * badgeOffset + EY * h;

      drawCornerBadge(ctx, bx, by, cornerNum, isHoveredCorner);
    }
  }

  // D. Distance Remaining Milestones (e.g. 800m left, 400m left, 200m left)
  const milestones = [800, 400, 200];
  for (const mLeft of milestones) {
    const d = totalDist - mLeft;
    if (d > 50 && d < totalDist - 50) {
      const pt = interpolateCoursePoint(transform.points, totalDist, d);
      const h = getPixelElevation(course, d, elevProfile);
      drawDistanceMilestone(ctx, pt, h, halfW, `${mLeft}m left`, isDark);
    }
  }

  // E. Direction Arrow (Red chevron on backstretch showing running direction)
  const backstretchM = totalDist * 0.45;
  const dirPt = interpolateCoursePoint(transform.points, totalDist, backstretchM);
  const dirH = getPixelElevation(course, backstretchM, elevProfile);
  drawDirectionChevron(ctx, dirPt, dirH, halfW);
}

function drawStartFlag(
  ctx: CanvasRenderingContext2D,
  pt: TransformedPoint,
  h: number,
  halfW: number
) {
  ctx.save();
  const px = pt.x + EX * h;
  const py = pt.y + EY * h;

  // Start line across track
  ctx.beginPath();
  ctx.moveTo(px + pt.normalX * halfW, py + pt.normalY * halfW);
  ctx.lineTo(px - pt.normalX * halfW, py - pt.normalY * halfW);
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 3;
  ctx.stroke();

  // Pole & Red Banner Flag
  const poleBaseX = px + pt.normalX * (halfW + 2);
  const poleBaseY = py + pt.normalY * (halfW + 2);
  const poleTopX = poleBaseX;
  const poleTopY = poleBaseY - 18;

  ctx.beginPath();
  ctx.moveTo(poleBaseX, poleBaseY);
  ctx.lineTo(poleTopX, poleTopY);
  ctx.strokeStyle = "#94a3b8";
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.fillStyle = "#ef4444";
  ctx.beginPath();
  ctx.moveTo(poleTopX, poleTopY);
  ctx.lineTo(poleTopX + 12 * pt.tangentX, poleTopY + 5);
  ctx.lineTo(poleTopX, poleTopY + 10);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawFinishFlag(
  ctx: CanvasRenderingContext2D,
  pt: TransformedPoint,
  h: number,
  halfW: number
) {
  ctx.save();
  const px = pt.x + EX * h;
  const py = pt.y + EY * h;

  // Checkered Finish Line across track
  const numChecks = 6;
  const lx = px + pt.normalX * halfW;
  const ly = py + pt.normalY * halfW;
  const rx = px - pt.normalX * halfW;
  const ry = py - pt.normalY * halfW;

  for (let i = 0; i < numChecks; i++) {
    const t0 = i / numChecks;
    const t1 = (i + 1) / numChecks;
    ctx.beginPath();
    ctx.moveTo(lx + (rx - lx) * t0, ly + (ry - ly) * t0);
    ctx.lineTo(lx + (rx - lx) * t1, ly + (ry - ly) * t1);
    ctx.strokeStyle = i % 2 === 0 ? "#ffffff" : "#000000";
    ctx.lineWidth = 3.5;
    ctx.stroke();
  }

  // Pole and checkered flag on outer rail
  const poleX = px + pt.normalX * (halfW + 2);
  const poleY = py + pt.normalY * (halfW + 2);
  const topY = poleY - 18;

  ctx.beginPath();
  ctx.moveTo(poleX, poleY);
  ctx.lineTo(poleX, topY);
  ctx.strokeStyle = "#475569";
  ctx.lineWidth = 2;
  ctx.stroke();

  const fw = 12;
  const fh = 10;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(poleX - fw, topY, fw, fh);
  ctx.fillStyle = "#000000";
  ctx.fillRect(poleX - fw, topY, fw / 2, fh / 2);
  ctx.fillRect(poleX - fw / 2, topY + fh / 2, fw / 2, fh / 2);
  ctx.strokeStyle = "#1e293b";
  ctx.lineWidth = 1;
  ctx.strokeRect(poleX - fw, topY, fw, fh);
  ctx.restore();
}

function drawCornerBadge(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  cornerNum: number,
  isHovered = false
) {
  ctx.save();
  const radius = isHovered ? 13 : 10;

  if (isHovered) {
    ctx.shadowColor = "#f97316";
    ctx.shadowBlur = 12;
  }

  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fillStyle = "#f97316";
  ctx.fill();

  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = isHovered ? 2.5 : 1.5;
  ctx.stroke();

  ctx.fillStyle = "#ffffff";
  ctx.font = isHovered ? "bold 11px Inter, system-ui, sans-serif" : "bold 10px Inter, system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(`C${cornerNum || "?"}`, x, y + 0.5);
  ctx.restore();
}

function drawDistanceMilestone(
  ctx: CanvasRenderingContext2D,
  pt: TransformedPoint,
  h: number,
  halfW: number,
  label: string,
  isDark: boolean
) {
  ctx.save();
  const px = pt.x + EX * h;
  const py = pt.y + EY * h;

  // Tick across track
  ctx.beginPath();
  ctx.moveTo(px + pt.normalX * (halfW + 4), py + pt.normalY * (halfW + 4));
  ctx.lineTo(px - pt.normalX * (halfW + 4), py - pt.normalY * (halfW + 4));
  ctx.strokeStyle = isDark ? "rgba(255, 255, 255, 0.4)" : "rgba(0, 0, 0, 0.35)";
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Label pill
  const lx = px + pt.normalX * (halfW + 18);
  const ly = py + pt.normalY * (halfW + 18);

  ctx.font = "9px Inter, system-ui, sans-serif";
  ctx.fillStyle = isDark ? "#94a3b8" : "#475569";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(label, lx, ly);
  ctx.restore();
}

function drawDirectionChevron(
  ctx: CanvasRenderingContext2D,
  pt: TransformedPoint,
  h: number,
  halfW: number
) {
  ctx.save();
  const px = pt.x + EX * h;
  const py = pt.y + EY * h;
  const cx = px + pt.normalX * (halfW + 14);
  const cy = py + pt.normalY * (halfW + 14);
  const tx = pt.tangentX;
  const ty = pt.tangentY;

  ctx.beginPath();
  ctx.moveTo(cx - tx * 8 - pt.normalX * 5, cy - ty * 8 - pt.normalY * 5);
  ctx.lineTo(cx + tx * 8, cy + ty * 8);
  ctx.lineTo(cx - tx * 8 + pt.normalX * 5, cy - ty * 8 + pt.normalY * 5);
  ctx.strokeStyle = "#ef4444";
  ctx.lineWidth = 3;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.stroke();
  ctx.restore();
}

/**
 * 7. Draws Hover Marker Bead & Tooltip HUD on the elevated track surface.
 */
function drawHoverMarker(
  ctx: CanvasRenderingContext2D,
  transform: CourseTransformResult,
  course: Course,
  elevProfile: ElevationProfile,
  hoverMeter: number,
  halfW: number,
  isDark: boolean
) {
  const pt = interpolateCoursePoint(transform.points, transform.totalDistance, hoverMeter);
  const h = getPixelElevation(course, hoverMeter, elevProfile);
  const px = pt.x + EX * h;
  const py = pt.y + EY * h;

  ctx.save();
  // Crosshair line across lane
  ctx.beginPath();
  ctx.moveTo(px + pt.normalX * halfW, py + pt.normalY * halfW);
  ctx.lineTo(px - pt.normalX * halfW, py - pt.normalY * halfW);
  ctx.strokeStyle = "#fbbf24";
  ctx.lineWidth = 3;
  ctx.stroke();

  // Pulsating Gold Bead
  ctx.beginPath();
  ctx.arc(px, py, 6, 0, Math.PI * 2);
  ctx.fillStyle = "#fbbf24";
  ctx.fill();
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 2;
  ctx.stroke();

  // Outer glow ring
  ctx.beginPath();
  ctx.arc(px, py, 10, 0, Math.PI * 2);
  ctx.strokeStyle = "rgba(251, 191, 36, 0.4)";
  ctx.lineWidth = 2;
  ctx.stroke();

  // HUD Tooltip Card
  const remaining = Math.round(transform.totalDistance - hoverMeter);
  const activeSlope = course.slopes?.find(
    (s) => hoverMeter >= s.start && hoverMeter <= s.end
  );
  const slopeText = activeSlope
    ? `${activeSlope.slope > 0 ? "↗ +" : "↘ -"}${Math.abs(activeSlope.slope / 10000).toFixed(1)}%`
    : "Flat (0%)";

  const activeCorner = course.corners?.find(
    (c) => hoverMeter >= c.start && hoverMeter <= c.end
  );
  const cornerText = activeCorner ? ` • Corner ${activeCorner.number ?? ""}` : "";

  const hudText = `${Math.round(hoverMeter)}m (${remaining}m left) • ${slopeText}${cornerText}`;

  ctx.font = "bold 11px Inter, system-ui, sans-serif";
  const metrics = ctx.measureText(hudText);
  const bw = metrics.width + 16;
  const bh = 22;
  const bx = px - bw / 2;
  const by = py - halfW - 28;

  ctx.fillStyle = isDark ? "rgba(15, 23, 42, 0.92)" : "rgba(255, 255, 255, 0.95)";
  ctx.beginPath();
  roundRect(ctx, bx, by, bw, bh, 6);
  ctx.fill();

  ctx.strokeStyle = "#fbbf24";
  ctx.lineWidth = 1.5;
  ctx.stroke();

  ctx.fillStyle = isDark ? "#f8fafc" : "#0f172a";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(hudText, px, by + bh / 2);

  ctx.restore();
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
