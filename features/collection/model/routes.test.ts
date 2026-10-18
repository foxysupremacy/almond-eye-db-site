import { describe, expect, test } from "bun:test";
import { parseCollectionRouteId, relatedCostumes } from "./routes";

describe("collection routes", () => {
  test("accepts only positive numeric card ids", () => {
    expect(parseCollectionRouteId("100101")).toBe(100101);
    expect(parseCollectionRouteId("100101-alt")).toBeNull();
    expect(parseCollectionRouteId("0")).toBeNull();
    expect(parseCollectionRouteId(undefined)).toBeNull();
  });

  test("relates costumes by charId while retaining distinct costume ids", () => {
    const first = { id: 100101, charId: 1001 } as never;
    const second = { id: 100102, charId: 1001 } as never;
    const other = { id: 100201, charId: 1002 } as never;
    expect(relatedCostumes([first, second, other], first)).toEqual([second]);
  });
});
