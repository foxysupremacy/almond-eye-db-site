import React from "react";
import type { SlotPrimaryFactors } from "../../lib/factor-decoder";

export interface FactorPillsProps {
  factors?: SlotPrimaryFactors | null;
  className?: string;
}

export function FactorPills({ factors, className = "" }: FactorPillsProps) {
  const blue = factors?.blue;
  const pink = factors?.pink;
  const green = factors?.green;

  return (
    <div className={`flex flex-col gap-0.5 w-full mt-1 ${className}`}>
      <div className="px-1 py-0.2 rounded text-[9px] font-bold bg-sky-500 text-white truncate shadow-2xs">
        {blue ? `${blue.nameEn} ${"★".repeat(blue.stars)}` : "--"}
      </div>
      <div className="px-1 py-0.2 rounded text-[9px] font-bold bg-pink-500 text-white truncate shadow-2xs">
        {pink ? `${pink.nameEn} ${"★".repeat(pink.stars)}` : "--"}
      </div>
      <div className="px-1 py-0.2 rounded text-[9px] font-bold bg-emerald-600 text-white truncate shadow-2xs">
        {green ? `Unique ${"★".repeat(green.stars)}` : "--"}
      </div>
    </div>
  );
}
