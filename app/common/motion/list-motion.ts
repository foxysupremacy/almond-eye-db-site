// List row motion (DESIGN.md §13.8): rows glide in/out/reorder when a filter,
// sort, or deck change alters a list. Powered by @formkit/auto-animate, which
// already disables itself under prefers-reduced-motion.

/** Lists longer than this render without row motion to keep filtering snappy. */
export const LIST_MOTION_MAX_ROWS = 80;

export const LIST_MOTION_OPTIONS = {
  duration: 200,
  // --ease-out-quart in app/globals.css
  easing: "cubic-bezier(0.165, 0.84, 0.44, 1)",
} as const;

export function shouldAnimateList(rowCount: number): boolean {
  return rowCount <= LIST_MOTION_MAX_ROWS;
}
