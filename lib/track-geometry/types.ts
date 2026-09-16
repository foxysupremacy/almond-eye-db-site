export interface CompactShapeEntry {
  distance: number;
  baseRatio: number;
  points: [number, number][]; // [x, z] coordinates from Unity
}

export interface TrackPointSample {
  x: number;
  y: number; // elevation in 3D (meters * exaggeration)
  z: number;
  tangentX: number;
  tangentZ: number;
  normalX: number;
  normalZ: number;
  distance: number;
  ratio: number;
}

export interface SlopeInfo {
  slope: number; // per-10000 (e.g. 20000 = +2%)
  gradePercent: number; // e.g. 2.0
  gradeFormatted: string; // e.g. "+2.0%" or "-1.5%"
  isUp: boolean;
  isDown: boolean;
  isFlat: boolean;
}

export interface LoopBounds {
  hasLoop: boolean;
  loopSplitRatio: number | null;
  loopSplitDistance: number | null;
}
