// Client-side route navigations (Supports / Characters / back home) wrapped in
// a view transition (DESIGN.md §13.7). The App Router's push() returns nothing,
// so the transition holds its old snapshot until the pathname actually changes
// (the provider calls `notify()` from a usePathname effect), with a timeout so
// a slow or failed fetch never freezes the page.

import { runViewTransition } from "./view-transition";

/** How long a route transition may hold the old view before giving up. */
export const ROUTE_TRANSITION_TIMEOUT_MS = 1000;

export interface RouteChangeWaiter {
  /** Resolves on the next `notify()`, or after `timeoutMs`. */
  wait(timeoutMs: number): Promise<void>;
  /** Signal that the new route has rendered. */
  notify(): void;
}

export function createRouteChangeWaiter(): RouteChangeWaiter {
  let pending: Array<() => void> = [];
  return {
    wait(timeoutMs) {
      return new Promise<void>((resolve) => {
        let finished = false;
        const finish = () => {
          if (finished) return;
          finished = true;
          clearTimeout(timer);
          resolve();
        };
        const timer = setTimeout(finish, timeoutMs);
        pending.push(finish);
      });
    },
    notify() {
      const resolvers = pending;
      pending = [];
      for (const resolve of resolvers) resolve();
    },
  };
}

export interface RouteTransitionDeps {
  push: (href: string) => void;
  waiter: RouteChangeWaiter;
  transition?: (update: () => void | Promise<void>) => boolean;
  timeoutMs?: number;
}

/** Push `href` inside a view transition that lasts until the new route renders. */
export function navigateWithTransition(href: string, deps: RouteTransitionDeps): void {
  const transition = deps.transition ?? ((update) => runViewTransition(update));
  const timeoutMs = deps.timeoutMs ?? ROUTE_TRANSITION_TIMEOUT_MS;
  transition(() => {
    const rendered = deps.waiter.wait(timeoutMs);
    deps.push(href);
    return rendered;
  });
}
