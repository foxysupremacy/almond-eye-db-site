import type { DeckPreset, TrackInfo } from "../deck/types";
import { encodePresetToShareCode } from "./codec";

/** Generate a complete shareable URL from a preset using the compact `#s=` form. */
export function buildShareUrl(
  preset: Partial<DeckPreset> & { trackInfo: TrackInfo },
  baseUrl?: string,
): string {
  const code = encodePresetToShareCode(preset);
  const base =
    baseUrl ||
    (typeof window !== "undefined"
      ? `${window.location.origin}${window.location.pathname}`
      : "https://database.almond-eye.tech");

  return `${base}#s=${code}`;
}

/** Extract compact or legacy share codes from a URL, search string, or path. */
export function extractShareCodeFromUrl(urlOrSearch: string): string | null {
  try {
    const sHashMatch = urlOrSearch.match(/[#&]s=([^&]+)/);
    if (sHashMatch?.[1]) return decodeURIComponent(sHashMatch[1]);

    const sQueryMatch = urlOrSearch.match(/[?&]s=([^&#]+)/);
    if (sQueryMatch?.[1]) return decodeURIComponent(sQueryMatch[1]);

    const hashMatch = urlOrSearch.match(/[#&]share=([^&]+)/);
    if (hashMatch?.[1]) return decodeURIComponent(hashMatch[1]);

    const queryMatch = urlOrSearch.match(/[?&]share=([^&#]+)/);
    if (queryMatch?.[1]) return decodeURIComponent(queryMatch[1]);

    const pathMatch = urlOrSearch.match(/\/(?:s|share)\/([A-Za-z0-9_-]+)/);
    if (pathMatch?.[1]) return decodeURIComponent(pathMatch[1]);
  } catch {
    // Malformed percent-encoding is not a share code.
  }

  return null;
}
