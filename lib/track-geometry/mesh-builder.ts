import * as THREE from "three";
import type { Course } from "../skill-engine/types";
import type { SkillZoneResult } from "../skill-engine/zones";
import type { CompactShapeEntry } from "./types";
import { interpolateTrackPoint2D, clamp } from "./interpolation";
import { getExaggeratedElevation, getSlopeInfoAtDistance } from "./elevation";
import { getLoopPass } from "./loop-detector";

// Color palettes
export const TRACK_TURF_COLOR = new THREE.Color("#2e7d32"); // Lush grass green
export const TRACK_DIRT_COLOR = new THREE.Color("#8d6e63"); // Sandy clay brown
export const SLOPE_UP_COLOR = new THREE.Color("#ea580c");   // Warm vibrant amber/orange
export const SLOPE_DOWN_COLOR = new THREE.Color("#0284c7"); // Cool vibrant cyan/sky
export const INACTIVE_LAP_TINT = 0.35; // Dimming multiplier for non-active lap

export interface MeshBuilderOptions {
  course: Course;
  shape: CompactShapeEntry;
  elevationExaggeration?: number;
  trackWidth?: number;
  selectedLap?: "all" | 1 | 2;
  loopSplitRatio?: number | null;
  zones?: SkillZoneResult[] | null;
  zoneColors?: string[];
  hoverMeter?: number | null;
}

export interface TrackSceneObjects {
  group: THREE.Group;
  trackMesh: THREE.Mesh;
  gridHelper: THREE.GridHelper;
  landmarkGroup: THREE.Group;
  skillZoneGroup: THREE.Group;
  runnerMarker: THREE.Group;
  updateRunnerPosition: (meter: number | null) => void;
  bounds: { minX: number; maxX: number; minY: number; maxY: number; minZ: number; maxZ: number };
}

/**
 * Builds all Three.js meshes and groups for the 3D track ribbon,
 * slope tilts, ground grid, and skill activation arcs.
 */
export function buildTrackScene(options: MeshBuilderOptions): TrackSceneObjects {
  const {
    course,
    shape,
    elevationExaggeration = 4.5,
    trackWidth = 12,
    selectedLap = "all",
    loopSplitRatio = null,
    zones = null,
    zoneColors = ["#e03131", "#2f6fd0", "#0a8a5f", "#b367c9", "#e08900", "#0f766e"],
  } = options;

  const group = new THREE.Group();
  const isTurf = course.terrain === 1;
  const baseColor = isTurf ? TRACK_TURF_COLOR : TRACK_DIRT_COLOR;

  // 1. Build Extruded Track Ribbon Geometry
  const sampleCount = Math.max(300, Math.min(800, Math.round(course.length / 3)));
  const positions: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];

  let minX = Infinity, maxX = -Infinity;
  let minY = Infinity, maxY = -Infinity;
  let minZ = Infinity, maxZ = -Infinity;

  for (let i = 0; i < sampleCount; i++) {
    const ratio = i / (sampleCount - 1);
    const meter = ratio * course.length;

    const sample2D = interpolateTrackPoint2D(shape.points, ratio);
    const elevation = getExaggeratedElevation(course, meter, elevationExaggeration);

    // Track width offset along perpendicular normal vector
    const halfW = trackWidth / 2;
    const pLeftX = sample2D.x - sample2D.normalX * halfW;
    const pLeftZ = sample2D.z - sample2D.normalZ * halfW;
    const pRightX = sample2D.x + sample2D.normalX * halfW;
    const pRightZ = sample2D.z + sample2D.normalZ * halfW;

    positions.push(pLeftX, elevation, pLeftZ);
    positions.push(pRightX, elevation, pRightZ);

    // Update bounding box
    minX = Math.min(minX, pLeftX, pRightX);
    maxX = Math.max(maxX, pLeftX, pRightX);
    minY = Math.min(minY, elevation);
    maxY = Math.max(maxY, elevation);
    minZ = Math.min(minZ, pLeftZ, pRightZ);
    maxZ = Math.max(maxZ, pLeftZ, pRightZ);

    // Color: apply slope tint (Amber uphill ___/, Cyan downhill ---\, base flat)
    const slopeInfo = getSlopeInfoAtDistance(course, meter);
    let sampleColor = baseColor.clone();

    if (slopeInfo.isUp) {
      sampleColor.lerp(SLOPE_UP_COLOR, 0.75);
    } else if (slopeInfo.isDown) {
      sampleColor.lerp(SLOPE_DOWN_COLOR, 0.75);
    }

    // Check lap dimming
    const currentPass = getLoopPass(meter, course.length, loopSplitRatio);
    if (selectedLap !== "all" && currentPass !== selectedLap) {
      sampleColor.multiplyScalar(INACTIVE_LAP_TINT);
    }

    colors.push(sampleColor.r, sampleColor.g, sampleColor.b);
    colors.push(sampleColor.r, sampleColor.g, sampleColor.b);

    // Triangle indices
    if (i < sampleCount - 1) {
      const idxL0 = i * 2;
      const idxR0 = i * 2 + 1;
      const idxL1 = (i + 1) * 2;
      const idxR1 = (i + 1) * 2 + 1;

      indices.push(idxL0, idxL1, idxR0);
      indices.push(idxR0, idxL1, idxR1);
    }
  }

  const trackGeometry = new THREE.BufferGeometry();
  trackGeometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  trackGeometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  trackGeometry.setIndex(indices);
  trackGeometry.computeVertexNormals();

  const trackMaterial = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.65,
    metalness: 0.1,
    side: THREE.DoubleSide,
  });

  const trackMesh = new THREE.Mesh(trackGeometry, trackMaterial);
  trackMesh.receiveShadow = true;
  trackMesh.castShadow = true;
  group.add(trackMesh);

  // 2. Wireframe Ground Reference Grid
  const gridSpan = Math.max(maxX - minX, maxZ - minZ) * 1.35;
  const gridCenterY = minY - 6;
  const gridHelper = new THREE.GridHelper(gridSpan, 24, 0x52525b, 0x27272a);
  gridHelper.position.set((minX + maxX) / 2, gridCenterY, (minZ + maxZ) / 2);
  const gridMaterial = gridHelper.material as THREE.Material;
  gridMaterial.transparent = true;
  gridMaterial.opacity = 0.22;
  group.add(gridHelper);

  // 3. Skill Activation Zone Meshes (Luminous Floating Arcs +0.5 units)
  const skillZoneGroup = new THREE.Group();

  if (zones && zones.length > 0) {
    zones.forEach((zResult, groupIdx) => {
      const hexColor = zoneColors[groupIdx % zoneColors.length] ?? "#e03131";
      const zoneMat = new THREE.MeshStandardMaterial({
        color: new THREE.Color(hexColor),
        emissive: new THREE.Color(hexColor),
        emissiveIntensity: 0.5,
        roughness: 0.2,
        metalness: 0.2,
        transparent: true,
        opacity: 0.88,
        side: THREE.DoubleSide,
      });

      (zResult.regions ?? []).forEach((region) => {
        const startM = clamp(region.start, 0, course.length);
        const endM = clamp(region.end, 0, course.length);
        const spanM = endM - startM;
        if (spanM <= 0.5) return;

        const subSamples = Math.max(10, Math.round(spanM / 4));
        const arcPositions: number[] = [];
        const arcIndices: number[] = [];

        for (let j = 0; j < subSamples; j++) {
          const ratio = (startM + (j / (subSamples - 1)) * spanM) / course.length;
          const currentM = ratio * course.length;
          const s2D = interpolateTrackPoint2D(shape.points, ratio);
          const elev = getExaggeratedElevation(course, currentM, elevationExaggeration) + 0.5; // Float above track

          const zoneHalfW = (trackWidth * 0.88) / 2; // Slightly inset
          const lX = s2D.x - s2D.normalX * zoneHalfW;
          const lZ = s2D.z - s2D.normalZ * zoneHalfW;
          const rX = s2D.x + s2D.normalX * zoneHalfW;
          const rZ = s2D.z + s2D.normalZ * zoneHalfW;

          arcPositions.push(lX, elev, lZ);
          arcPositions.push(rX, elev, rZ);

          if (j < subSamples - 1) {
            const a0 = j * 2;
            const a1 = j * 2 + 1;
            const a2 = (j + 1) * 2;
            const a3 = (j + 1) * 2 + 1;
            arcIndices.push(a0, a2, a1);
            arcIndices.push(a1, a2, a3);
          }
        }

        const arcGeom = new THREE.BufferGeometry();
        arcGeom.setAttribute("position", new THREE.Float32BufferAttribute(arcPositions, 3));
        arcGeom.setIndex(arcIndices);
        arcGeom.computeVertexNormals();

        const arcMesh = new THREE.Mesh(arcGeom, zoneMat);
        skillZoneGroup.add(arcMesh);
      });
    });
  }
  group.add(skillZoneGroup);

  // 4. Landmarks: Start Gate Line, Spurt Start, Goal Line
  const landmarkGroup = new THREE.Group();

  function createCrossbar(meter: number, colorHex: string, labelHeight = 0.6) {
    const r = meter / course.length;
    const s2D = interpolateTrackPoint2D(shape.points, r);
    const elev = getExaggeratedElevation(course, meter, elevationExaggeration) + labelHeight;
    const halfW = trackWidth / 2 + 1;

    const p0 = new THREE.Vector3(s2D.x - s2D.normalX * halfW, elev, s2D.z - s2D.normalZ * halfW);
    const p1 = new THREE.Vector3(s2D.x + s2D.normalX * halfW, elev, s2D.z + s2D.normalZ * halfW);

    const geom = new THREE.BufferGeometry().setFromPoints([p0, p1]);
    const mat = new THREE.LineBasicMaterial({ color: new THREE.Color(colorHex), linewidth: 3 });
    return new THREE.Line(geom, mat);
  }

  // Start Gate (White line)
  landmarkGroup.add(createCrossbar(0, "#ffffff"));

  // Goal Line (Vivid gold/white checkered bar)
  landmarkGroup.add(createCrossbar(course.length, "#ffd700"));

  // Spurt Start Line (Magenta/Purple dashed crossbar)
  if (course.spurtStart?.meters && course.spurtStart.meters > 0) {
    landmarkGroup.add(createCrossbar(course.spurtStart.meters, "#d946ef", 0.7));
  }
  group.add(landmarkGroup);

  // 5. Interactive Runner Hover Marker
  const runnerMarker = new THREE.Group();
  runnerMarker.visible = false;

  const sphereGeom = new THREE.SphereGeometry(1.6, 16, 16);
  const sphereMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color("#facc15"), // Gold yellow
    emissive: new THREE.Color("#facc15"),
    emissiveIntensity: 0.6,
    roughness: 0.2,
  });
  const sphereMesh = new THREE.Mesh(sphereGeom, sphereMat);
  runnerMarker.add(sphereMesh);

  // Beacon vertical ring
  const ringGeom = new THREE.RingGeometry(1.8, 2.4, 24);
  const ringMat = new THREE.MeshBasicMaterial({
    color: 0xfacc15,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.7,
  });
  const ringMesh = new THREE.Mesh(ringGeom, ringMat);
  ringMesh.rotation.x = Math.PI / 2;
  runnerMarker.add(ringMesh);

  group.add(runnerMarker);

  function updateRunnerPosition(meter: number | null) {
    if (meter == null || meter < 0 || meter > course.length) {
      runnerMarker.visible = false;
      return;
    }
    const r = meter / course.length;
    const s2D = interpolateTrackPoint2D(shape.points, r);
    const elev = getExaggeratedElevation(course, meter, elevationExaggeration) + 2.0;

    runnerMarker.position.set(s2D.x, elev, s2D.z);
    runnerMarker.visible = true;
  }

  return {
    group,
    trackMesh,
    gridHelper,
    landmarkGroup,
    skillZoneGroup,
    runnerMarker,
    updateRunnerPosition,
    bounds: { minX, maxX, minY, maxY, minZ, maxZ },
  };
}
