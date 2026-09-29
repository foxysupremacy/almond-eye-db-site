// Share Codec V4: Section-based (TLV) Bit-Packed Binary / Base64URL Preset Serializer
//
// Packs DeckPreset (Main Deck, Parent Deck, Track Info, Event Choices, Name)
// into an ultra-compact URL-safe string without any server-side database.
//
// The only supported format uses a 2-bit 0b11 header followed by
// self-describing sections {tag: 4 bits, bitLength: 16 bits, payload}.

import type { DeckPreset, TrackInfo, RunningStyle } from "../deck/types";

/** 2-bit discriminator emitted by the sole supported codec format (0b11). */
export const CODEC_VERSION = 3;

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

  /** Append every bit of another writer's payload bit-for-bit. */
  writeRawBits(other: BitWriter) {
    for (let i = 0; i < other.bitPos; i++) {
      const bit = (other.buffer[Math.floor(i / 8)] >>> (7 - (i % 8))) & 1;
      this.ensureCapacity(1);
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

// ---------------------------------------------------------------------------
// Encoding (always emits the sole supported format)
// ---------------------------------------------------------------------------

/**
 * V4 layout: discriminator(2) + one CORE section (tag 0) carrying preset data
 * field layout, optionally followed by extension sections for fields added
 * later. Extension sections keep {tag: 4 bits, bitLength: 16 bits, payload}:
 * decoders that don't know a tag skip it, so new fields never break old
 * links again.
 */
const SECTION_TAG = {
  CORE: 0,
} as const;

const TAG_BITS = 4;
const LENGTH_BITS = 16;

/** Write one section: {tag: 4 bits, bitLength: 16 bits, payload}. */
function writeSection(writer: BitWriter, tag: number, payload: (w: BitWriter) => void) {
  const body = new BitWriter(96);
  payload(body);
  writer.write(tag, TAG_BITS);
  writer.write(body.bitLength, LENGTH_BITS);
  writer.writeRawBits(body);
}

function writeCorePayload(writer: BitWriter, preset: Partial<DeckPreset> & { trackInfo: TrackInfo }) {
  // 1. Track Info: 1-bit flag + (8 + 11 + 3 + 4 = 26 bits when present)
  const trackInfo = preset.trackInfo;
  const hasTrackInfo = Boolean(
    trackInfo &&
      ((trackInfo.trackId && trackInfo.trackId > 0) ||
        (trackInfo.courseId && trackInfo.courseId > 0) ||
        trackInfo.runningStyle),
  );
  writer.write(hasTrackInfo ? 1 : 0, 1);
  if (hasTrackInfo && trackInfo) {
    const trackOffset = Math.max(0, (trackInfo.trackId || 10000) - 10000);
    writer.write(Math.min(255, trackOffset), 8);
    const courseOffset = Math.max(0, (trackInfo.courseId || 10000) - 10000);
    writer.write(Math.min(2047, courseOffset), 11);
    const styleVal = trackInfo.runningStyle ? Math.min(5, Math.max(1, trackInfo.runningStyle)) : 0;
    writer.write(styleVal, 3);
    const racerCountVal = Math.max(0, Math.min(9, (trackInfo.racerCount || 12) - 9));
    writer.write(racerCountVal, 4);
  }

  // 2. Main Deck: 6 bits mask + 15 bits per occupied card
  const mainIds = (preset.mainDeckIds || []).slice(0, 6);
  let mainMask = 0;
  for (let i = 0; i < 6; i++) {
    if (mainIds[i] && mainIds[i]! > 0) mainMask |= 1 << (5 - i);
  }
  writer.write(mainMask, 6);
  for (let i = 0; i < 6; i++) {
    const cid = mainIds[i];
    if (cid && cid > 0) writer.write(Math.max(0, cid - 10000), 15);
  }

  // 3. Parent Deck: 1-bit presence flag + (6 bits mask + 15 bits per card)
  const parentIds = (preset.parentDeckIds || []).slice(0, 6);
  let parentMask = 0;
  for (let i = 0; i < 6; i++) {
    if (parentIds[i] && parentIds[i]! > 0) parentMask |= 1 << (5 - i);
  }
  writer.write(parentMask > 0 ? 1 : 0, 1);
  if (parentMask > 0) {
    writer.write(parentMask, 6);
    for (let i = 0; i < 6; i++) {
      const cid = parentIds[i];
      if (cid && cid > 0) writer.write(Math.max(0, cid - 10000), 15);
    }
  }

  // 4. Event Choices: 3 bits count (0..7) + (4 bits slot + 2 bits choice)
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

  // 5. Preset Name: 6 bits length + 1 bit mode (1 = 6-bit ASCII, 0 = 8-bit UTF-8)
  writeNamePayload(writer, preset.name || "Shared Build");
}

function writeNamePayload(writer: BitWriter, rawName: string) {
  const cleanName = (rawName || "Shared Build").trim().slice(0, 63);
  if (cleanName.length === 0) {
    writer.write(0, 6);
    return;
  }
  let canUseAscii = true;
  for (let i = 0; i < cleanName.length; i++) {
    if (!ASCII_MAP.has(cleanName[i])) {
      canUseAscii = false;
      break;
    }
  }
  if (canUseAscii) {
    writer.write(cleanName.length, 6);
    writer.write(1, 1); // ASCII mode
    for (let i = 0; i < cleanName.length; i++) {
      writer.write(ASCII_MAP.get(cleanName[i])!, 6);
    }
  } else {
    const utf8Bytes = new TextEncoder().encode(cleanName).slice(0, 63);
    writer.write(utf8Bytes.length, 6);
    writer.write(0, 1); // UTF-8 mode
    for (let i = 0; i < utf8Bytes.length; i++) {
      writer.write(utf8Bytes[i], 8);
    }
  }
}

/**
 * Encode a DeckPreset into an ultra-compact Base64URL string (V4).
 */
export function encodePresetToShareCode(preset: Partial<DeckPreset> & { trackInfo: TrackInfo }): string {
  const writer = new BitWriter(64);

  // 1. Header: sole format discriminator (2 bits: 0b11)
  writer.write(CODEC_VERSION, 2);

  // 2. Core section — extension sections can carry future fields.
  writeSection(writer, SECTION_TAG.CORE, (w) => writeCorePayload(w, preset));

  return writer.getEncoded();
}

// ---------------------------------------------------------------------------
// Decoding (V4 only)
// ---------------------------------------------------------------------------

/** Read `bitLength` bits into an isolated reader, advancing the parent stream. */
function subReader(parent: BitReader, bitLength: number): BitReader {
  const byteCount = Math.ceil(bitLength / 8);
  const buf = new Uint8Array(byteCount);
  for (let i = 0; i < bitLength; i++) {
    if (parent.read(1)) {
      buf[Math.floor(i / 8)] |= 1 << (7 - (i % 8));
    }
  }
  return new BitReader(buf);
}

/** Decode the sole supported section-based format. Unknown sections are skipped. */
function decodePresetV4(bytes: Uint8Array): SharedBuildData | null {
  const reader = new BitReader(bytes);

  const version = reader.read(2);
  if (version !== CODEC_VERSION) return null;

  let decoded: SharedBuildData | null = null;

  while (reader.remainingBits >= TAG_BITS + LENGTH_BITS) {
    const tag = reader.read(TAG_BITS);
    const bitLength = reader.read(LENGTH_BITS);
    if (bitLength > reader.remainingBits) break; // truncated / corrupt tail
    if (tag === SECTION_TAG.CORE) {
      decoded = readCorePayload(subReader(reader, bitLength));
    } else {
      // Unknown extension section — skip and keep decoding.
      for (let i = 0; i < bitLength && reader.remainingBits > 0; i++) {
        reader.read(1);
      }
    }
  }

  return decoded;
}

/** Parse the CORE section payload. */
function readCorePayload(reader: BitReader): SharedBuildData {
  // 1. Track Info
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

  // 2. Main Deck (6 slots)
  const mainMask = reader.read(6);
  const mainDeckIds: (number | null)[] = [];
  for (let i = 0; i < 6; i++) {
    mainDeckIds.push((mainMask >>> (5 - i)) & 1 ? reader.read(15) + 10000 : null);
  }

  // 3. Parent Deck (6 slots)
  const hasParentDeck = reader.read(1) === 1;
  const parentDeckIds: (number | null)[] = [];
  if (hasParentDeck) {
    const parentMask = reader.read(6);
    for (let i = 0; i < 6; i++) {
      parentDeckIds.push((parentMask >>> (5 - i)) & 1 ? reader.read(15) + 10000 : null);
    }
  } else {
    for (let i = 0; i < 6; i++) parentDeckIds.push(null);
  }

  // 4. Event Choices
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

  // 5. Preset Name
  let name = "Shared Build";
  if (reader.hasMoreBits(6)) {
    const nameLen = reader.read(6);
    if (nameLen > 0 && reader.hasMoreBits(1)) {
      const isAscii = reader.read(1) === 1;
      if (isAscii) {
        let str = "";
        for (let i = 0; i < nameLen; i++) {
          if (!reader.hasMoreBits(6)) break;
          str += ASCII_64[reader.read(6)] ?? "";
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
}

/**
 * Decode a Base64URL share code into SharedBuildData.
 * Accepts only the current V4 format. Legacy versioned links return `null`.
 */
export function decodePresetFromShareCode(code: string): SharedBuildData | null {
  if (!code || typeof code !== "string") return null;

  try {
    const cleanCode = code.trim();
    const bytes = base64UrlToBytes(cleanCode);
    if (bytes.length === 0) return null;

    const version = new BitReader(bytes).read(2);
    if (version === CODEC_VERSION) {
      return decodePresetV4(bytes);
    }
    return null;
  } catch (err) {
    console.error("Failed to decode share code:", err);
    return null;
  }
}
