import { describe, expect, test } from "bun:test";
import { ApiCallError, api, distanceLabel, flattenCourse } from "./index";

describe("public in-memory API", () => {
  test("exposes loaded cards through the stable API entry point", async () => {
    const cards = await api.listCardIndex();
    expect(cards.length).toBeGreaterThan(500);
    expect(cards.some((card) => card.id === 30308)).toBe(true);
  });

  test("uses the public not-found error for unknown skills", async () => {
    let error: unknown;
    try {
      await api.skill(-1);
    } catch (caught) {
      error = caught;
    }
    expect(error instanceof ApiCallError).toBe(true);
    expect((error as ApiCallError).status).toBe(404);
  });

  test("keeps course helpers on the public API surface", () => {
    expect(distanceLabel(2, 1600)).toBe("Mile 1600m");
    expect(typeof flattenCourse).toBe("function");
  });
});
