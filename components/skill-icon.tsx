"use client";

import { useState } from "react";

interface SkillIconProps {
  iconId?: number | null;
  name?: string;
  className?: string;
  size?: number;
}

/**
 * Renders a skill type icon for a given iconId from /assets/skills/[iconId].png.
 * Gracefully hides itself if the iconId is missing or the image fails to load.
 */
export default function SkillIcon({
  iconId,
  name,
  className = "h-5 w-5 object-contain flex-none shrink-0",
  size,
}: SkillIconProps) {
  const [hasError, setHasError] = useState(false);

  if (!iconId || hasError) {
    return null;
  }

  return (
    <img
      src={`/assets/skills/${iconId}.png`}
      alt={name ? `${name} icon` : "Skill icon"}
      title={name}
      width={size}
      height={size}
      loading="lazy"
      onError={() => setHasError(true)}
      className={className}
    />
  );
}
