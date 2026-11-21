import { base64UrlToBytes, bytesToBase64Url } from "./codec";

export type DeflateFormat = "deflate" | "deflate-raw";

async function pipeBytes(bytes: Uint8Array, transform: CompressionStream | DecompressionStream): Promise<Uint8Array> {
  const stream = new Response(new Blob([bytes as BlobPart]).stream().pipeThrough(transform));
  return new Uint8Array(await stream.arrayBuffer());
}

/** Compress a UTF-8 string and return unpadded URL-safe Base64. */
export async function deflateToBase64Url(text: string, format: DeflateFormat = "deflate-raw"): Promise<string> {
  const compressed = await pipeBytes(new TextEncoder().encode(text), new CompressionStream(format));
  return bytesToBase64Url(compressed);
}

/** Inverse of `deflateToBase64Url`. Throws on malformed Base64 or corrupt data. */
export async function inflateFromBase64Url(encoded: string, format: DeflateFormat = "deflate-raw"): Promise<string> {
  if (!/^[A-Za-z0-9_-]*$/.test(encoded)) throw new Error("Invalid URL-safe Base64");
  const decompressed = await pipeBytes(base64UrlToBytes(encoded), new DecompressionStream(format));
  return new TextDecoder().decode(decompressed);
}
