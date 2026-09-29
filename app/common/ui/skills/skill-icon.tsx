"use client";

import { useState } from "react";

interface SkillIconProps {
  iconId?: number | string | null;
  name?: string;
  className?: string;
  size?: number;
}

/**
 * Renders a skill type icon for a given iconId from /assets/skills/[iconId].png
 * or fallback /assets/skills/utx_ico_skill_[iconId].png.
 * Gracefully hides itself if the iconId is missing or the image fails to load.
 */
export default function SkillIcon({
  iconId,
  name,
  className = "h-5 w-5 object-contain flex-none shrink-0",
  size,
}: SkillIconProps) {
  const [hasError, setHasError] = useState(false);
  const [fallbackAttempted, setFallbackAttempted] = useState(false);

  if (iconId === null || iconId === undefined || iconId === "" || hasError) {
    return null;
  }

  // Normalize iconId (handle numbers, strings, 'utx_ico_skill_' prefix, and '.png' extension)
  const rawId = String(iconId).trim();
  const cleanId = rawId.replace(/^utx_ico_skill_/, "").replace(/\.png$/, "");
  if (!cleanId || cleanId === "0" || cleanId === "00000") {
    return null;
  }
  const displayId = cleanId;

  const src = fallbackAttempted
    ? `/assets/skills/utx_ico_skill_${displayId}.png`
    : `/assets/skills/${displayId}.png`;

  return (
    <img
      key={`${displayId}-${fallbackAttempted}`}
      src={src}
      alt={name ? `${name} icon` : "Skill icon"}
      title={name}
      width={size}
      height={size}
      loading="lazy"
      onError={() => {
        if (!fallbackAttempted) {
          setFallbackAttempted(true);
        } else {
          setHasError(true);
        }
      }}
      className={className}
    />
  );
}
