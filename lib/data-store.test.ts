import { describe, expect, test } from "bun:test";
import { flattenCourse, initDataStore } from "./data-store";

describe("data-store", () => {
  test("initDataStore hydrates all datasets and memoizes the instance", async () => {
    const store = await initDataStore();
    expect(await initDataStore()).toBe(store);

    expect(store.cards.length).toBeGreaterThan(500);
    expect(store.characters.length).toBeGreaterThan(200);
    expect(store.skills.length).toBeGreaterThan(2000); // base + inherit
    expect(store.racetracks.length).toBeGreaterThan(10);

    const tokyo = store.getTrack(10006);
    expect(tokyo?.nameEn).toBe("Tokyo");
    expect(tokyo!.courses.length).toBeGreaterThan(0);
    const course = store.getCourse(tokyo!.courses[0].id);
    expect(course?.trackId).toBe(10006);
  });

  test("getCardSkills resolves event skills with event/choice metadata", async () => {
    const store = await initDataStore();
    const withEvents = store.cards.find(
      (c) => c.eventSkills.length > 0 && (c.eventDetails?.length ?? 0) > 0
    )!;
    const cs = store.getCardSkills(withEvents.id);
    expect(cs.eventSkills.length).toBe(withEvents.eventSkills.length);
    const withMeta = cs.eventSkills.find((s) => s.eventMeta);
    expect(withMeta?.eventMeta?.totalChoices).toBeGreaterThanOrEqual(1);
    expect(cs.hintSkills.length).toBe(withEvents.hintSkills.length);
  });

  test("getCardSkills falls back to placeholder summaries for unknown ids", async () => {
    const store = await initDataStore();
    expect(store.getCardSkills(99999999)).toEqual({ eventSkills: [], hintSkills: [] });
    const anyCard = store.cards[0];
    const cs = store.getCardSkills(anyCard.id);
    for (const s of cs.eventSkills) {
      expect(s.nameEn).toBeTruthy();
    }
  });
});

describe("flattenCourse", () => {
  test("promotes geometry blobs onto the flat course shape", async () => {
    const store = await initDataStore();
    const row = store.racetracks.flatMap((t) => t.courses).find((c) => (c.data.corners?.length ?? 0) > 0);
    if (!row) return; // no geometry data present — nothing to assert
    const flat = flattenCourse(row);
    expect(flat.id).toBe(row.id);
    expect(flat.corners?.length).toBeGreaterThan(0);
    expect(flat.trackId).toBe(row.trackId);
  });
});
