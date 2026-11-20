import { describe, expect, test } from "bun:test";
import { createRouteChangeWaiter, navigateWithTransition } from "./route-transition";

describe("createRouteChangeWaiter", () => {
  test("resolves pending waits when the route changes", async () => {
    const waiter = createRouteChangeWaiter();
    let settled = false;
    const done = waiter.wait(10_000).then(() => {
      settled = true;
    });
    await Promise.resolve();
    expect(settled).toBe(false);
    waiter.notify();
    await done;
    expect(settled).toBe(true);
  });

  test("falls back to the timeout when the route never changes", async () => {
    const waiter = createRouteChangeWaiter();
    const started = Date.now();
    await waiter.wait(20);
    expect(Date.now() - started).toBeGreaterThanOrEqual(15);
  });

  test("notify without pending waits is harmless", () => {
    expect(() => createRouteChangeWaiter().notify()).not.toThrow();
  });
});

describe("navigateWithTransition", () => {
  test("pushes inside the transition and holds it until the route changes", async () => {
    const waiter = createRouteChangeWaiter();
    const calls: string[] = [];
    let transitionDone: Promise<void> | undefined;

    navigateWithTransition("/supports", {
      push: (href) => {
        calls.push(`push ${href}`);
        // The router commits the new route a moment later.
        setTimeout(() => waiter.notify(), 0);
      },
      waiter,
      transition: (update) => {
        calls.push("transition");
        transitionDone = update() ?? undefined;
        return true;
      },
    });

    expect(calls).toEqual(["transition", "push /supports"]);
    expect(transitionDone instanceof Promise).toBe(true);
    await transitionDone;
  });

  test("still navigates when transitions are unavailable", () => {
    const pushed: string[] = [];
    navigateWithTransition("/characters", {
      push: (href) => pushed.push(href),
      waiter: createRouteChangeWaiter(),
      transition: (update) => {
        void update();
        return false;
      },
    });
    expect(pushed).toEqual(["/characters"]);
  });
});
