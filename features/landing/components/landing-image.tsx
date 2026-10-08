"use client";

import { useState } from "react";

interface LandingImageProps {
  src: string;
  alt: string;
  className?: string;
  priority?: boolean;
  width: number;
  height: number;
}

export function LandingImage({ src, alt, className, priority = false, width, height }: LandingImageProps) {
  const [failed, setFailed] = useState(false);
  return (
    <img
      src={failed ? "/assets/icon.png" : src}
      alt={alt}
      width={width}
      height={height}
      className={className}
      data-fallback={failed || undefined}
      loading={priority ? "eager" : "lazy"}
      fetchPriority={priority ? "high" : undefined}
      decoding="async"
      onError={failed ? undefined : () => setFailed(true)}
    />
  );
}
