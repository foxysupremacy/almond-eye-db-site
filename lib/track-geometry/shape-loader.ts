import type { CompactShapeEntry } from "./types";

let cachedShapes: Record<string, CompactShapeEntry> | null = null;
let loadPromise: Promise<Record<string, CompactShapeEntry>> | null = null;

/**
 * Dynamically loads the pre-extracted 251-point course shapes dataset.
 * Code-split: loaded only when the user opens the Visualizer tab.
 */
export async function loadCourseShapes(): Promise<Record<string, CompactShapeEntry>> {
  if (cachedShapes) return cachedShapes;
  if (loadPromise) return loadPromise;

  loadPromise = (async () => {
    try {
      const mod = await import("../data/course-shapes.json");
      cachedShapes = (mod.default ?? mod) as unknown as Record<string, CompactShapeEntry>;
      return cachedShapes;
    } catch (err) {
      loadPromise = null;
      console.error("Failed to load course shapes dataset", err);
      throw err;
    }
  })();

  return loadPromise;
}

/**
 * Returns a cached course shape synchronously if already loaded.
 */
export function getCachedCourseShape(courseId: number | string): CompactShapeEntry | null {
  return cachedShapes?.[String(courseId)] ?? null;
}
