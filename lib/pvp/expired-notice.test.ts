import { expect, test } from "bun:test";
import { expiredNoticeKey, mergeHiddenNotices, parseHiddenNotices } from "./expired-notice";

test("notice key ties a preset to the specific ended event", () => {
  expect(expiredNoticeKey("preset-1", "cm-10")).toBe("preset-1::cm-10");
  expect(expiredNoticeKey("preset-1", null)).toBe("preset-1::");
});

test("stored hidden notices are validated before use", () => {
  expect(parseHiddenNotices(null)).toEqual([]);
  expect(parseHiddenNotices({ bad: true })).toEqual([]);
  expect(parseHiddenNotices(["a::b", 3, "", "c::d"])).toEqual(["a::b", "c::d"]);
});

test("merging hidden notices dedupes and keeps existing entries", () => {
  expect(mergeHiddenNotices(["a::b"], ["a::b", "c::d"])).toEqual(["a::b", "c::d"]);
});
