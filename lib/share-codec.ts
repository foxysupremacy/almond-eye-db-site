// Share Codec V2: Ultra-compact Bit-Packed Binary / Base64URL Preset Serializer
//
// Packs DeckPreset (Main Deck, Parent Deck, Track Info, Event Choices, Name)
// into an ultra-compact URL-safe string (~25-38 chars) without any server-side database.

import type { DeckPreset, TrackInfo, RunningStyle } from "../components/store";

export const CODEC_VERSION = 1; // 2-bit version identifier (0b01)

/** 64-character compact alphanumeric alphabet for English preset names (6 bits per character) */
export const ASCII_64 = " ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
const ASCII_MAP = new Map<string, number>();
for (let i = 0; i < ASCII_64.length; i++) {
  ASCII_MAP.set(ASCII_64[i], i);
}

/** URL-safe Base64 encoding (RFC 4648 §5, without padding) */
export function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = "";
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  const base64 = btoa(binary);
  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** URL-safe Base64 decoding */
export function base64UrlToBytes(str: string): Uint8Array {
  let base64 = str.replace(/-/g, "+").replace(/_/g, "/");
  while (base64.length % 4 !== 0) {
    base64 += "=";
  }
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * Arbitrary bit-level writer into a growing Uint8Array buffer.
 */
export class BitWriter {
  private buffer: Uint8Array;
  private bitPos = 0;

  constructor(initialCapacity = 64) {
    this.buffer = new Uint8Array(initialCapacity);
  }

  private ensureCapacity(neededBits: number) {
    const neededBytes = Math.ceil((this.bitPos + neededBits) / 8);
    if (neededBytes > this.buffer.length) {
      const newBuf = new Uint8Array(Math.max(neededBytes * 2, this.buffer.length * 2));
      newBuf.set(this.buffer);
      this.buffer = newBuf;
    }
  }

  write(value: number, bits: number) {
    this.ensureCapacity(bits);
    for (let i = bits - 1; i >= 0; i--) {
      const bit = (value >>> i) & 1;
      const byteIdx = Math.floor(this.bitPos / 8);
      const bitIdx = 7 - (this.bitPos % 8);
      this.buffer[byteIdx] |= bit << bitIdx;
      this.bitPos++;
    }
  }

  getEncoded(): string {
    const bytesCount = Math.ceil(this.bitPos / 8);
    return bytesToBase64Url(this.buffer.subarray(0, bytesCount));
  }

  get bitLength(): number {
    return this.bitPos;
  }
}

/**
 * Arbitrary bit-level reader from a Uint8Array buffer.
 */
export class BitReader {
  private buffer: Uint8Array;
  private bitPos = 0;
  private totalBits: number;

  constructor(bytes: Uint8Array) {
    this.buffer = bytes;
    this.totalBits = bytes.length * 8;
  }

  read(bits: number): number {
    if (this.bitPos + bits > this.totalBits) {
      throw new Error("Unexpected end of bitstream");
    }
    let value = 0;
    for (let i = bits - 1; i >= 0; i--) {
      const byteIdx = Math.floor(this.bitPos / 8);
      const bitIdx = 7 - (this.bitPos % 8);
      const bit = (this.buffer[byteIdx] >>> bitIdx) & 1;
      value = (value << 1) | bit;
      this.bitPos++;
    }
    return value;
  }

  hasMoreBits(bits = 1): boolean {
    return this.bitPos + bits <= this.totalBits;
  }

  get remainingBits(): number {
    return Math.max(0, this.totalBits - this.bitPos);
  }
}

export interface SharedBuildData {
  name: string;
  mainDeckIds: (number | null)[];
  parentDeckIds: (number | null)[];
  trackInfo: TrackInfo;
  mainChainChoices?: Record<string, number>;
  parentChainChoices?: Record<string, number>;
}

/**
 * Encode a DeckPreset into an ultra-compact Base64URL string (V2 Bit-Packed).
 */
export function encodePresetToShareCode(preset: Partial<DeckPreset> & { trackInfo: TrackInfo }): string {
  const writer = new BitWriter(48);

  // 1. Header: Version (2 bits: 0b01)
  writer.write(CODEC_VERSION, 2);

  // 2. Track Info: 1-bit flag + (8 + 11 + 3 + 4 = 26 bits when present)
  const trackInfo = preset.trackInfo;
  const hasTrackInfo = Boolean(
    trackInfo &&
      ((trackInfo.trackId && trackInfo.trackId > 0) ||
        (trackInfo.courseId && trackInfo.courseId > 0) ||
        trackInfo.runningStyle),
  );

  writer.write(hasTrackInfo ? 1 : 0, 1);
  if (hasTrackInfo) {
    const trackOffset = Math.max(0, (trackInfo.trackId || 10000) - 10000);
    writer.write(Math.min(255, trackOffset), 8);

    const courseOffset = Math.max(0, (trackInfo.courseId || 10000) - 10000);
    writer.write(Math.min(2047, courseOffset), 11);

    const styleVal = trackInfo.runningStyle ? Math.min(5, Math.max(1, trackInfo.runningStyle)) : 0;
    writer.write(styleVal, 3);

    const racerCountVal = Math.max(0, Math.min(9, (trackInfo.racerCount || 12) - 9));
    writer.write(racerCountVal, 4);
  }

  // 3. Main Deck: 6 bits mask + (15 bits per occupied card)
  const mainIds = (preset.mainDeckIds || []).slice(0, 6);
  let mainMask = 0;
  for (let i = 0; i < 6; i++) {
    if (mainIds[i] && mainIds[i]! > 0) {
      mainMask |= 1 << (5 - i);
    }
  }
  writer.write(mainMask, 6);
  for (let i = 0; i < 6; i++) {
    const cid = mainIds[i];
    if (cid && cid > 0) {
      const cardOffset = Math.max(0, cid - 10000);
      writer.write(Math.min(32767, cardOffset), 15);
    }
  }

  // 4. Parent Deck: 1-bit presence flag + (6 bits mask + 15 bits per card when present)
  const parentIds = (preset.parentDeckIds || []).slice(0, 6);
  let parentMask = 0;
  for (let i = 0; i < 6; i++) {
    if (parentIds[i] && parentIds[i]! > 0) {
      parentMask |= 1 << (5 - i);
    }
  }
  const hasParentDeck = parentMask > 0;
  writer.write(hasParentDeck ? 1 : 0, 1);
  if (hasParentDeck) {
    writer.write(parentMask, 6);
    for (let i = 0; i < 6; i++) {
      const cid = parentIds[i];
      if (cid && cid > 0) {
        const cardOffset = Math.max(0, cid - 10000);
        writer.write(Math.min(32767, cardOffset), 15);
      }
    }
  }

  // 5. Event Choices: 3 bits count (0..7) + (4 bits slot + 2 bits choice per entry)
  const choiceEntries: { slotIndex: number; choiceIndex: number }[] = [];
  const mainChoices = preset.mainChainChoices || {};
  for (let i = 0; i < 6; i++) {
    const cid = mainIds[i];
    if (!cid) continue;
    for (const [k, val] of Object.entries(mainChoices)) {
      if ((k === String(cid) || k.startsWith(`${cid}:`)) && typeof val === "number") {
        choiceEntries.push({ slotIndex: i, choiceIndex: Math.max(1, Math.min(4, val)) });
        break;
      }
    }
  }
  const parentChoices = preset.parentChainChoices || {};
  for (let i = 0; i < 6; i++) {
    const cid = parentIds[i];
    if (!cid) continue;
    for (const [k, val] of Object.entries(parentChoices)) {
      if ((k === String(cid) || k.startsWith(`${cid}:`)) && typeof val === "number") {
        choiceEntries.push({ slotIndex: 6 + i, choiceIndex: Math.max(1, Math.min(4, val)) });
        break;
      }
    }
  }

  const limitedChoices = choiceEntries.slice(0, 7);
  writer.write(limitedChoices.length, 3);
  for (const c of limitedChoices) {
    writer.write(c.slotIndex, 4);
    writer.write(c.choiceIndex - 1, 2);
  }

  // 6. Preset Name: 6 bits length + 1 bit mode (1 = 6-bit ASCII, 0 = 8-bit UTF-8)
  const rawName = (preset.name || "Shared Build").trim();
  const cleanName = rawName.slice(0, 63);

  let canUseAscii = cleanName.length > 0;
  for (let i = 0; i < cleanName.length; i++) {
    if (!ASCII_MAP.has(cleanName[i])) {
      canUseAscii = false;
      break;
    }
  }

  if (cleanName.length === 0) {
    writer.write(0, 6);
  } else if (canUseAscii) {
    writer.write(cleanName.length, 6);
    writer.write(1, 1); // ASCII mode
    for (let i = 0; i < cleanName.length; i++) {
      writer.write(ASCII_MAP.get(cleanName[i])!, 6);
    }
  } else {
    const utf8Bytes = new TextEncoder().encode(cleanName);
    const safeBytes = utf8Bytes.slice(0, 63);
    writer.write(safeBytes.length, 6);
    writer.write(0, 1); // UTF-8 mode
    for (let i = 0; i < safeBytes.length; i++) {
      writer.write(safeBytes[i], 8);
    }
  }

  return writer.getEncoded();
}

/**
 * Decode a Base64URL share code into SharedBuildData.
 * Supports V2 (bit-packed) with fallback to V1 (byte-aligned).
 */
export function decodePresetFromShareCode(code: string): SharedBuildData | null {
  if (!code || typeof code !== "string") return null;

  try {
    const cleanCode = code.trim();
    const bytes = base64UrlToBytes(cleanCode);
    if (bytes.length === 0) return null;

    // Check if V1 format: byte 0 is 0x01 and length >= 32
    if (bytes[0] === 1 && bytes.length >= 32) {
      return decodePresetV1(bytes);
    }

    const reader = new BitReader(bytes);

    // 1. Version check (2 bits)
    const version = reader.read(2);
    if (version !== CODEC_VERSION) {
      return null;
    }

    // 2. Track Info
    const hasTrackInfo = reader.read(1) === 1;
    let trackId = 0;
    let courseId = 0;
    let runningStyle: RunningStyle | null = null;
    let racerCount = 12;

    if (hasTrackInfo) {
      trackId = reader.read(8) + 10000;
      courseId = reader.read(11) + 10000;
      const rawStyle = reader.read(3);
      runningStyle = rawStyle >= 1 && rawStyle <= 5 ? (rawStyle as RunningStyle) : null;
      racerCount = reader.read(4) + 9;
    }

    // 3. Main Deck (6 slots)
    const mainMask = reader.read(6);
    const mainDeckIds: (number | null)[] = [];
    for (let i = 0; i < 6; i++) {
      if ((mainMask >>> (5 - i)) & 1) {
        mainDeckIds.push(reader.read(15) + 10000);
      } else {
        mainDeckIds.push(null);
      }
    }

    // 4. Parent Deck (6 slots)
    const hasParentDeck = reader.read(1) === 1;
    const parentDeckIds: (number | null)[] = [];
    if (hasParentDeck) {
      const parentMask = reader.read(6);
      for (let i = 0; i < 6; i++) {
        if ((parentMask >>> (5 - i)) & 1) {
          parentDeckIds.push(reader.read(15) + 10000);
        } else {
          parentDeckIds.push(null);
        }
      }
    } else {
      for (let i = 0; i < 6; i++) parentDeckIds.push(null);
    }

    // 5. Event Choices
    const choiceCount = reader.read(3);
    const mainChainChoices: Record<string, number> = {};
    const parentChainChoices: Record<string, number> = {};

    for (let i = 0; i < choiceCount; i++) {
      const slotIndex = reader.read(4);
      const choiceIndex = reader.read(2) + 1;
      if (slotIndex < 6) {
        const cid = mainDeckIds[slotIndex];
        if (cid) mainChainChoices[String(cid)] = choiceIndex;
      } else if (slotIndex < 12) {
        const cid = parentDeckIds[slotIndex - 6];
        if (cid) parentChainChoices[String(cid)] = choiceIndex;
      }
    }

    // 6. Preset Name
    let name = "Shared Build";
    if (reader.hasMoreBits(6)) {
      const nameLen = reader.read(6);
      if (nameLen > 0 && reader.hasMoreBits(1)) {
        const isAscii = reader.read(1) === 1;
        if (isAscii) {
          let str = "";
          for (let i = 0; i < nameLen; i++) {
            if (!reader.hasMoreBits(6)) break;
            const idx = reader.read(6);
            str += ASCII_64[idx] ?? "";
          }
          if (str) name = str;
        } else {
          const utf8 = new Uint8Array(nameLen);
          for (let i = 0; i < nameLen; i++) {
            if (!reader.hasMoreBits(8)) break;
            utf8[i] = reader.read(8);
          }
          name = new TextDecoder().decode(utf8);
        }
      }
    }

    return {
      name,
      mainDeckIds,
      parentDeckIds,
      trackInfo: {
        trackId,
        courseId,
        runningStyle,
        racerCount: racerCount >= 9 && racerCount <= 18 ? racerCount : 12,
      },
      mainChainChoices,
      parentChainChoices,
    };
  } catch (err) {
    console.error("Failed to decode share code:", err);
    return null;
  }
}

/** Fallback decoder for legacy V1 byte-aligned share codes */
function decodePresetV1(bytes: Uint8Array): SharedBuildData | null {
  try {
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    let offset = 1; // skip version byte

    const trackId = view.getUint16(offset);
    offset += 2;
    const courseId = view.getUint16(offset);
    offset += 2;

    const rawStyle = view.getUint8(offset);
    const runningStyle: RunningStyle | null = rawStyle >= 1 && rawStyle <= 5 ? (rawStyle as RunningStyle) : null;
    offset += 1;

    const racerCount = view.getUint8(offset);
    offset += 1;

    const mainDeckIds: (number | null)[] = [];
    for (let i = 0; i < 6; i++) {
      const cid = view.getUint16(offset);
      mainDeckIds.push(cid > 0 ? cid : null);
      offset += 2;
    }

    const parentDeckIds: (number | null)[] = [];
    for (let i = 0; i < 6; i++) {
      const cid = view.getUint16(offset);
      parentDeckIds.push(cid > 0 ? cid : null);
      offset += 2;
    }

    const mainChainChoices: Record<string, number> = {};
    if (offset < bytes.byteLength) {
      const mainChoiceCount = view.getUint8(offset);
      offset += 1;
      for (let i = 0; i < mainChoiceCount && offset + 3 <= bytes.byteLength; i++) {
        const cid = view.getUint16(offset);
        offset += 2;
        const choice = view.getUint8(offset);
        offset += 1;
        if (cid > 0) mainChainChoices[String(cid)] = choice;
      }
    }

    const parentChainChoices: Record<string, number> = {};
    if (offset < bytes.byteLength) {
      const parentChoiceCount = view.getUint8(offset);
      offset += 1;
      for (let i = 0; i < parentChoiceCount && offset + 3 <= bytes.byteLength; i++) {
        const cid = view.getUint16(offset);
        offset += 2;
        const choice = view.getUint8(offset);
        offset += 1;
        if (cid > 0) parentChainChoices[String(cid)] = choice;
      }
    }

    let name = "Shared Build";
    if (offset < bytes.byteLength) {
      const nameLen = view.getUint8(offset);
      offset += 1;
      if (offset + nameLen <= bytes.byteLength) {
        const nameBytes = bytes.subarray(offset, offset + nameLen);
        name = new TextDecoder().decode(nameBytes);
      }
    }

    return {
      name,
      mainDeckIds,
      parentDeckIds,
      trackInfo: {
        trackId,
        courseId,
        runningStyle,
        racerCount: racerCount >= 9 && racerCount <= 18 ? racerCount : 12,
      },
      mainChainChoices,
      parentChainChoices,
    };
  } catch {
    return null;
  }
}

/**
 * Generate a complete shareable URL from a DeckPreset using `#s={code}`.
 */
export function buildShareUrl(preset: Partial<DeckPreset> & { trackInfo: TrackInfo }, baseUrl?: string): string {
  const code = encodePresetToShareCode(preset);
  const base =
    baseUrl ||
    (typeof window !== "undefined"
      ? `${window.location.origin}${window.location.pathname}`
      : "https://database.almond-eye.tech");

  // Use compact `#s={code}`
  return `${base}#s=${code}`;
}

/**
 * Extract share code from current URL hash, query parameter, or pathname.
 * Handles `#s=`, `?s=`, `/s/`, `#share=`, `?share=`, and `/share/`.
 */
export function extractShareCodeFromUrl(urlOrSearch: string): string | null {
  try {
    // 1. Check compact hash: #s=...
    const sHashMatch = urlOrSearch.match(/[#&]s=([^&]+)/);
    if (sHashMatch && sHashMatch[1]) {
      return decodeURIComponent(sHashMatch[1]);
    }

    // 2. Check compact query: ?s=...
    const sQueryMatch = urlOrSearch.match(/[?&]s=([^&#]+)/);
    if (sQueryMatch && sQueryMatch[1]) {
      return decodeURIComponent(sQueryMatch[1]);
    }

    // 3. Check legacy hash: #share=...
    const hashMatch = urlOrSearch.match(/[#&]share=([^&]+)/);
    if (hashMatch && hashMatch[1]) {
      return decodeURIComponent(hashMatch[1]);
    }

    // 4. Check legacy query: ?share=...
    const queryMatch = urlOrSearch.match(/[?&]share=([^&#]+)/);
    if (queryMatch && queryMatch[1]) {
      return decodeURIComponent(queryMatch[1]);
    }

    // 5. Check path: /s/:code or /share/:code
    const pathMatch = urlOrSearch.match(/\/(?:s|share)\/([A-Za-z0-9_-]+)/);
    if (pathMatch && pathMatch[1]) {
      return decodeURIComponent(pathMatch[1]);
    }
  } catch {}

  return null;
}

