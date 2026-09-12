import { describe, it, expect } from "bun:test";
import fs from "node:fs";
import path from "node:path";
import { type KyumaruInventoryDump, type KyumaruVeteranItem, type KyumaruSyncPayload } from "./kyumaru-types";
import { decodeFactor, calculateLineageBlueStars } from "./factor-decoder";

describe("Kyumaru Data Ingest & Integration", () => {
  const repoRoot = path.resolve(process.cwd(), "..");
  const inventoryPath = path.join(repoRoot, "kyumaru", "responses", "inventory.json");
  const veteransPath = path.join(repoRoot, "kyumaru", "responses", "veterans.json");

  it("successfully parses live production inventory.json fixture", () => {
    expect(fs.existsSync(inventoryPath)).toBe(true);
    const raw = fs.readFileSync(inventoryPath, "utf8");
    const data: KyumaruInventoryDump = JSON.parse(raw);

    expect(data.support_card_list).toBeDefined();
    expect(data.support_card_list.length).toBeGreaterThan(300);

    expect(data.card_list).toBeDefined();
    expect(data.card_list.length).toBeGreaterThan(40);

    // Test map conversion matching useOwnedCards and ImportPage
    const cardsMap: Record<string, number> = {};
    for (const c of data.support_card_list) {
      cardsMap[String(c.support_card_id)] = c.limit_break_count;
    }
    const mlbCount = Object.values(cardsMap).filter((lb) => lb === 4).length;
    expect(mlbCount).toBeGreaterThan(0);

    const umasMap: Record<string, [number, number]> = {};
    for (const u of data.card_list) {
      umasMap[String(u.card_id)] = [u.rarity, u.talent_level];
    }
    expect(Object.keys(umasMap).length).toBe(data.card_list.length);
  });

  it("successfully parses live production veterans.json fixture and decodes sparks", () => {
    expect(fs.existsSync(veteransPath)).toBe(true);
    const raw = fs.readFileSync(veteransPath, "utf8");
    const veterans: KyumaruVeteranItem[] = JSON.parse(raw);

    expect(veterans.length).toBe(99);

    for (const vet of veterans) {
      expect(vet.card_id).toBeDefined();
      expect(vet.speed).toBeGreaterThan(0);
      expect(vet.stamina).toBeGreaterThan(0);
      expect(vet.power).toBeGreaterThan(0);
      expect(vet.guts).toBeGreaterThan(0);
      expect(vet.wiz).toBeGreaterThan(0);
      expect(vet.rank_score).toBeGreaterThan(0);

      // Verify factor decoding
      if (vet.factor_info_array) {
        for (const factor of vet.factor_info_array) {
          const decoded = decodeFactor(factor.factor_id);
          expect(["blue", "pink", "green", "white"]).toContain(decoded.type);
          expect(decoded.stars).toBeGreaterThanOrEqual(1);
          expect(decoded.stars).toBeLessThanOrEqual(3);
        }
      }

      // Verify lineage blue calculation
      const lineage = calculateLineageBlueStars(vet);
      expect(lineage.total).toBeGreaterThanOrEqual(0);
    }
  });

  it("validates Deflate compression/decompression for compact #data= payload", async () => {
    const samplePayload: KyumaruSyncPayload = {
      cards: { "10001": 4, "30005": 1, "30308": 4 },
      umas: { "100101": [3, 1], "112901": [3, 5] },
    };

    const jsonStr = JSON.stringify(samplePayload);
    const jsonBytes = new TextEncoder().encode(jsonStr);

    // Compress with CompressionStream("deflate")
    const compStream = new Response(
      new Blob([jsonBytes]).stream().pipeThrough(new CompressionStream("deflate"))
    );
    const compressedBytes = await compStream.arrayBuffer();

    // Decompress with DecompressionStream("deflate")
    const decompStream = new Response(
      new Blob([compressedBytes]).stream().pipeThrough(new DecompressionStream("deflate"))
    );
    const unpacked: KyumaruSyncPayload = await decompStream.json();

    expect(unpacked.cards).toEqual(samplePayload.cards);
    expect(unpacked.umas).toEqual(samplePayload.umas);
  });
});
