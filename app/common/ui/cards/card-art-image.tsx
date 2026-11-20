"use client";

import { useState, type ImgHTMLAttributes } from "react";

type Stage = "art" | "portrait" | "none";

export interface CardArtImageProps extends Omit<ImgHTMLAttributes<HTMLImageElement>, "src" | "onError"> {
  /** Full card art (CDN variant 01). */
  src: string;
  /** Shown when the full art fails to load — usually the square portrait (variant 02). */
  fallbackSrc?: string;
}

/**
 * Support-card art that degrades gracefully. Newly released cards sometimes
 * have their portrait on the CDN before the full art is uploaded; instead of a
 * broken-image icon and alt text, this swaps to `fallbackSrc` and, if that
 * fails too, hides the image so the slot's own background shows.
 */
export function CardArtImage({ src, fallbackSrc, alt = "", style, ...imgProps }: CardArtImageProps) {
  // Keyed by src so a different card starts over at its full art.
  const [failure, setFailure] = useState<{ src: string; stage: Stage }>({ src, stage: "art" });
  const stage: Stage = failure.src === src ? failure.stage : "art";

  const handleError = () => {
    setFailure({ src, stage: stage === "art" && fallbackSrc && fallbackSrc !== src ? "portrait" : "none" });
  };

  return (
    <img
      {...imgProps}
      alt={alt}
      src={stage === "portrait" && fallbackSrc ? fallbackSrc : src}
      data-art-fallback={stage === "art" ? undefined : stage}
      style={stage === "none" ? { ...style, visibility: "hidden" } : style}
      onError={handleError}
    />
  );
}
