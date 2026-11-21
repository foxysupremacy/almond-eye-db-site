import { describe, expect, test } from "bun:test";
import { collectIconIds, gametoraIconUrl, isPng, localIconFileName, missingIconIds } from "./skill-icon-sync.ts";

describe("skill icon sync", () => {
  test("collects unique, valid icon ids from skills", () => {
    const skills = [{ iconId: 20016 }, { iconId: 20016 }, { iconId: 20386 }, { iconId: null }, { iconId: 0 }, {}, { iconId: "20013" }];
    expect(collectIconIds(skills)).toEqual([20013, 20016, 20386]);
  });

  test("an icon counts as present under either file name", () => {
    const files = new Set(["20016.png", "utx_ico_skill_20013.png", "notes.txt"]);
    expect(missingIconIds([20013, 20016, 20386], files)).toEqual([20386]);
  });

  test("uses GameTora's utx_ico_skill_ naming for both the URL and the saved file", () => {
    expect(gametoraIconUrl(20386)).toBe("https://gametora.com/images/umamusume/skill_icons/utx_ico_skill_20386.png");
    expect(localIconFileName(20386)).toBe("utx_ico_skill_20386.png");
  });

  test("only accepts real PNG bytes, not an HTML error page served with 200", () => {
    expect(isPng(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0]))).toBe(true);
    expect(isPng(new TextEncoder().encode("<!DOCTYPE html>"))).toBe(false);
    expect(isPng(new Uint8Array([0x89, 0x50]))).toBe(false);
  });
});
