// Same-document View Transitions for tab switches (DESIGN.md §13.7).
//
// The browser snapshots the old view, runs `update` synchronously, then
// animates old → new with the `::view-transition-*` rules in app/globals.css.
// Elements that carry the same `view-transition-name` on both sides (the deck
// slots, `deck-slot-0`…`deck-slot-5`) morph; everything else crossfades.
//
// Falls back to a plain synchronous update when the API is missing or the user
// prefers reduced motion, so callers never branch on support themselves.

export interface ViewTransitionEnvironment {
  startViewTransition?: (update: () => void | Promise<void>) => unknown;
  prefersReducedMotion: () => boolean;
}

function browserEnvironment(): ViewTransitionEnvironment | null {
  if (typeof document === "undefined" || typeof window === "undefined") return null;
  const doc = document as Document & { startViewTransition?: (update: () => void | Promise<void>) => unknown };
  return {
    startViewTransition: typeof doc.startViewTransition === "function" ? doc.startViewTransition.bind(doc) : undefined,
    prefersReducedMotion: () =>
      typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  };
}

/**
 * Run `update` inside a view transition when supported and motion is allowed.
 * `update` must apply the DOM change synchronously (wrap React state updates in
 * `flushSync`), or return a promise that settles once the new view is in the
 * DOM (route navigations). Returns true when a transition was started.
 */
export function runViewTransition(
  update: () => void | Promise<void>,
  env: ViewTransitionEnvironment | null = browserEnvironment(),
): boolean {
  if (!env?.startViewTransition || env.prefersReducedMotion()) {
    update();
    return false;
  }
  try {
    env.startViewTransition(update);
    return true;
  } catch {
    // An invalid/duplicate view-transition-name or a hidden document can make
    // the call throw before `update` runs; never lose the tab change.
    update();
    return false;
  }
}

/** The shared-element name for deck slot `index` (stable across Main and Parent Deck). */
export function deckSlotTransitionName(index: number): string {
  return `deck-slot-${index}`;
}
