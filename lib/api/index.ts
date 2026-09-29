/** Stable public entry point for the in-memory game data API. */
export * from "./client";

// Synchronous lookups are needed by render-time projections. Keep these
// registry-backed reads behind the same public boundary as the async API.
export {
  charactersByCharId,
  charactersById,
  skillsById,
  uniqueInheritMap,
} from "../data/registry";
