// Minimal type shims for `bun:test` so `npx tsc --noEmit` stays clean without
// installing bun-types. The real runner is `bun test`; these only satisfy the
// typecheck gate (tsconfig has no "bun" in its types array).
declare module "bun:test" {
  export function describe(name: string, fn: () => void): void;
  export function test(name: string, fn: () => void): void;
  export function it(name: string, fn: () => void): void;
  export function expect<T>(actual: T): {
    toBe(expected: unknown): void;
    toEqual(expected: unknown): void;
    toHaveLength(length: number): void;
    toBeGreaterThan(expected: number): void;
    toBeLessThan(expected: number): void;
    toContain(expected: unknown): void;
    not: { toThrow(): void };
    toThrow(): void;
  };
}
