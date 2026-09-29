"use client";

import { useState } from "react";

const TYPE_TO_ICON: Record<string, string> = {
  speed: "/assets/icons/utx_ico_obtain_00.png",
  stamina: "/assets/icons/utx_ico_obtain_01.png",
  power: "/assets/icons/utx_ico_obtain_02.png",
  guts: "/assets/icons/utx_ico_obtain_03.png",
  intelligence: "/assets/icons/utx_ico_obtain_04.png",
  wit: "/assets/icons/utx_ico_obtain_04.png",
  friend: "/assets/icons/utx_ico_obtain_05.png",
  group: "/assets/icons/utx_ico_obtain_06.png",
};

/** Normalizes card type display names (e.g. intelligence -> wit). */
export function formatCardType(type: string | undefined | null): string {
  if (!type) return "";
  const lower = type.toLowerCase();
  if (lower === "intelligence") return "wit";
  return lower;
}

interface CardTypeIconProps {
  /** Card type; null while a card awaits its first GameTora crawl. */
  type?: string | null;
  className?: string;
  size?: number;
}

/**
 * Renders support card type icon (speed, stamina, power, guts, wit/intelligence, friend, group)
 * from /assets/icons/utx_ico_obtain_0[0-6].png.
 */
export default function CardTypeIcon({
  type,
  className = "h-3.5 w-3.5 object-contain inline-block shrink-0",
  size,
}: CardTypeIconProps) {
  const [hasError, setHasError] = useState(false);

  if (!type || hasError) return null;

  const iconSrc = TYPE_TO_ICON[type.toLowerCase()];
  if (!iconSrc) return null;

  const displayLabel = formatCardType(type);

  return (
    <img
      src={iconSrc}
      alt={`${displayLabel} type`}
      title={`${displayLabel.charAt(0).toUpperCase() + displayLabel.slice(1)} type`}
      width={size}
      height={size}
      loading="lazy"
      onError={() => setHasError(true)}
      className={className}
    />
  );
}
