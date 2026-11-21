"use client";

import { useState } from "react";

interface SkillIconProps {
  iconId?: number | string | null;
  name?: string;
  className?: string;
  size?: number;
}

const PATHS = [(id: string) => `/assets/skills/${id}.png`, (id: string) => `/assets/skills/utx_ico_skill_${id}.png`];

/**
 * Renders a skill type icon for a given iconId from /assets/skills/[iconId].png
 * or fallback /assets/skills/utx_ico_skill_[iconId].png.
 * When neither file exists it renders a neutral tile of the same size, so the row
 * keeps its alignment instead of showing a broken image.
 */
export default function SkillIcon({
  iconId,
  name,
  className = "h-5 w-5 object-contain flex-none shrink-0",
  size,
}: SkillIconProps) {
  const cleanId = iconId === null || iconId === undefined ? "" : String(iconId).trim().replace(/^utx_ico_skill_/, "").replace(/\.png$/, "");
  // Attempt index is tracked per icon id, so a new id always starts from the first path.
  const [attempt, setAttempt] = useState<{ id: string; index: number }>({ id: cleanId, index: 0 });
  const index = attempt.id === cleanId ? attempt.index : 0;

  const fail = () => setAttempt({ id: cleanId, index: index + 1 });

  if (!cleanId || cleanId === "0" || cleanId === "00000") return null;

  if (index >= PATHS.length) {
    return (
      <span
        data-skill-icon-missing=""
        aria-hidden="true"
        title={name}
        style={size ? { width: size, height: size } : undefined}
        className={`inline-block rounded-md bg-zinc-200/80 dark:bg-zinc-700/60 ${className}`}
      />
    );
  }

  return (
    <img
      key={`${cleanId}-${index}`}
      src={PATHS[index](cleanId)}
      alt={name ? `${name} icon` : "Skill icon"}
      title={name}
      width={size}
      height={size}
      loading="lazy"
      onError={fail}
      className={className}
    />
  );
}
