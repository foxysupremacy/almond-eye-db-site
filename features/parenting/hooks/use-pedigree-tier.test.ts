import { expect, test } from "bun:test";
import { tierForWidth } from "./use-pedigree-tier";

test("tier boundaries", () => {
  expect(tierForWidth(1)).toBe("phone");
  expect(tierForWidth(599)).toBe("phone");
  expect(tierForWidth(600)).toBe("tablet");
  expect(tierForWidth(959)).toBe("tablet");
  expect(tierForWidth(960)).toBe("desktop");
});
