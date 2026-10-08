"use client";

import { useEffect, useRef, useState } from "react";
import { LineageIcon } from "./icons";

const portraitImageClass = "absolute inset-0 h-full w-full object-contain object-top drop-shadow-xs scale-[1.65] origin-top -translate-y-[17%]";

/** DESIGN.md §20: the top 90° sector can pop out; the other 270° stays clipped. */
export function CharacterPortrait({ src, className = "" }: { src: string; className?: string }) {
  const backRef = useRef<HTMLImageElement>(null);
  const [failedSource, setFailedSource] = useState<string | null>(null);
  const failed = !src || failedSource === src;

  useEffect(() => {
    const image = backRef.current;
    // An SSR image may have failed before hydration attached the error handler.
    if (image?.complete && image.naturalWidth === 0) setFailedSource(src);
  }, [src]);

  return (
    <div className={`relative ${className} flex-none overflow-visible rounded-full`}>
      <div data-portrait-layer="back" aria-hidden="true" className="absolute inset-0 z-0 overflow-hidden rounded-full">
        {failed ? (
          <div data-portrait-fallback="true" className="flex h-full w-full items-center justify-center bg-zinc-100 text-zinc-400 dark:bg-zinc-800 dark:text-zinc-500">
            <LineageIcon className="h-1/2 w-1/2" />
          </div>
        ) : (
          <img ref={backRef} src={src} alt="" loading="lazy" decoding="async" className={portraitImageClass} onError={() => setFailedSource(src)} />
        )}
      </div>
      <div data-portrait-layer="frame" aria-hidden="true" className="pointer-events-none absolute inset-0 z-10 rounded-full ring-[2.5px] ring-amber-400/95 dark:ring-amber-400/80" />
      <div
        aria-hidden="true"
        data-portrait-layer="front"
        className="pointer-events-none absolute inset-0 z-20 overflow-visible"
        style={{ clipPath: "polygon(0 -100%, 100% -100%, 100% 0, 50% 50%, 0 0)" }}
      >
        {!failed && <img src={src} alt="" loading="lazy" decoding="async" className={portraitImageClass} onError={() => setFailedSource(src)} />}
      </div>
    </div>
  );
}
