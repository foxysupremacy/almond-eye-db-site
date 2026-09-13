import { describe, it, expect } from "bun:test";
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { type KyumaruInventoryDump, type KyumaruVeteranItem, type KyumaruSyncPayload } from "./kyumaru-types";
import { decodeFactor, calculateLineageBlueStars } from "./factor-decoder";
import { decodeKyumaruSyncPayload } from "./kyumaru-decode";

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

  it("decodes Kyumaru raw-DEFLATE (flate2) #data= payloads", async () => {
    const samplePayload: KyumaruSyncPayload = {
      cards: { "10001": 4, "30005": 1, "30308": 4 },
      umas: { "100101": [3, 1], "112901": [3, 5] },
    };

    // Kyumaru uses flate2::write::DeflateEncoder -> raw DEFLATE (RFC 1951)
    const rawDeflate = zlib.deflateRawSync(Buffer.from(JSON.stringify(samplePayload)));
    const b64 = Buffer.from(rawDeflate).toString("base64url");

    const unpacked = await decodeKyumaruSyncPayload(b64);
    expect(unpacked.cards).toEqual(samplePayload.cards);
    expect(unpacked.umas).toEqual(samplePayload.umas);
  });

  it("decodes a live production #data= payload captured from a failing link", async () => {
    // Captured from https://database.almond-eye.tech/import#data=... which
    // previously failed with "Failed to fetch" (deflate container mismatch).
    const b64 =
      "XZc7khwhEETvMvYanVl8dRWFDIXkypFC1sbeXUMDbxZ5SQP1gCGze94fP77__vnn8eX9oeu69PiS3m5lVKASKqMKqqIaqm-lCwVDMARDMARDMARDMATDMAzDMAzDMAzDMAzDMAwjYASMgBEwAkbACBgBI2AEjAQjwUgwEowEI8FIMBKMBCPByDAyjAwjw8gwMowMI8PIMDKMAqPAKDAKjAKjwCgwCowCo8CoMCqMCqPCqDAqjAqjwqgwKowGo8FoMBqMBqPBaDAajAajwegwOowOo8PoMDqMDqPD6DD6Zjw1SiijApVQGVVQFdVQMPC58Llwt3C3cLdwt3C3cLdwt3C3cLdwt3C3cLdwt3C3cLdwt3C38LTwtPC08LTwtPC08LTwtPC08LTwtPC08LTwtPC08LSWp01Sm6Q2SW2S2iS1SWqT1CapTVKbpDZJbZLaJLVJapPUJqlNUpukNkltktoktUlqk9QmqU1Sm3w2-Wzy2eSzyWeTzyafTT6bfDb5bPLZ5LPJZ5PPJp9NPptUNllssthksclik8Umi00Wmyw2WWyy2GSxyWKTxSaLTRabLDZZbLLYZLHJYpPFJotNFpssNllsstgzi2MqGBVGhVFhjCy-poJRYTQYDUZjHw1Gg9FgNBiNfTQYDUaH0WF0GB1Gh9FhdBgdxshiTdXXadxZ_FQxnXxNFah8z4jp2vWs8uxZz7cSM4YHl2KGKqptNZw3qwy_rWdU8Wtc3yroDeoF4xJVEuOGA5Yqe6WZcZlx4xbP3nET56oKcws7KnAL3HGb5ozKuMrOxx2alSszGuc87sGc2xqK_XbGdVbad5X7fblURu313W-_pejl7O_3lqbav-X9npm9kVB7H_e7Yql5w54q8ywzLrOCwgo4Uw2HTsVZqe6da7jHU7GC4ZmYqjCONTd2xAmpM7fvVXnc7Jhq91r7DKzXs4wq9Fae7V_GpjLnZ-6pxz31VFRO-wyc9n1xZsbKxKH2TXRhBXWfuCszVtIMFShWuhLkqfp2mVeCDJU2o-_VB96P9cYeKtP7GtdQmxESau8yFDwbOfTx9vj76_v-c3d_9X2NN31b_2SOZlnN_G19Vx-97Wz2o6n7G4S5miDv3jgqP7-EjrnlnHuC7JGJ9DodlX0uMvx_83PliLOZz8H1AKXzrNI5OJ-gfO4ol7NZF3c2y3X0lhNUzsrl_I3KWbleR-Uax-HU82Cbjl-htc-96__-q3ksQ9dR-fmx_5n7TLVjsPtnkPhRVvO4DEqvVX18_AM";

    const unpacked = await decodeKyumaruSyncPayload(b64);
    expect(Object.keys(unpacked.cards || {}).length).toBeGreaterThan(0);
    expect(Object.keys(unpacked.umas || {}).length).toBeGreaterThan(0);
  });
});
