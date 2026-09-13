import type { KyumaruSyncPayload } from "./kyumaru-types";

/**
 * Kyumaru packs its #data= payload with flate2's DeflateEncoder, which emits
 * raw DEFLATE (RFC 1951). The browser's DecompressionStream("deflate") expects
 * zlib-wrapped (RFC 1950) data, so raw payloads must use "deflate-raw".
 * "deflate" is kept as a fallback for zlib-wrapped payloads (e.g. anything
 * compressed via the browser CompressionStream path or older flows).
 */
export async function decodeKyumaruSyncPayload(b64: string): Promise<KyumaruSyncPayload> {
  const unescaped = b64.replace(/-/g, "+").replace(/_/g, "/");
  const padded = unescaped.padEnd(unescaped.length + ((4 - (unescaped.length % 4)) % 4), "=");
  const binaryStr = atob(padded);
  const bytes = Uint8Array.from(binaryStr, (c) => c.charCodeAt(0));

  for (const format of ["deflate-raw", "deflate"] as const) {
    try {
      const stream = new Response(
        new Blob([bytes as BlobPart]).stream().pipeThrough(new DecompressionStream(format))
      );
      const buf = await stream.arrayBuffer();
      return JSON.parse(new TextDecoder().decode(buf)) as KyumaruSyncPayload;
    } catch {
      // Wrong container format or corrupt data — try the next one.
    }
  }

  throw new Error("Failed to decompress Kyumaru sync payload. The link may be truncated or corrupted.");
}
