import React from "react";
import type { SlotPrimaryFactors } from "@/lib/lineage/factor-decoder";

export interface FactorPillsProps {
  factors?: SlotPrimaryFactors | null;
  className?: string;
  compact?: boolean;
}

export function FactorPills({ factors, className = "", compact = false }: FactorPillsProps) {
  const blue = factors?.blue;
  const pink = factors?.pink;
  const green = factors?.green;
  const genes = factors?.genes ?? [];

  if (compact) {
    const labels = [
      { code: "B", value: blue ? String(blue.stars) : "·", name: blue ? `${blue.nameEn} ${blue.stars}★` : "No blue factor", tone: "bg-sky-500" },
      { code: "P", value: pink ? String(pink.stars) : "·", name: pink ? `${pink.nameEn} ${pink.stars}★` : "No aptitude factor", tone: "bg-pink-500" },
      { code: "U", value: green ? String(green.stars) : "·", name: green ? `Unique ${green.stars}★` : "No unique factor", tone: "bg-emerald-600" },
      { code: "G", value: genes.length ? String(genes.length) : "·", name: genes.length ? genes.map((gene) => `${gene.nameEn} ${gene.stars}★`).join(", ") : "No gene factors", tone: "bg-violet-600" },
    ];
    return <div className={`grid grid-cols-4 gap-0.5 w-full mt-1 ${className}`} aria-label="Factor summary">
      {labels.map((factor) => <span key={factor.code} title={factor.name} aria-label={factor.name} className={`${factor.tone} rounded text-center text-[6px] sm:text-[8px] leading-3 font-bold text-white truncate`}>{factor.code}{factor.value}</span>)}
    </div>;
  }

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
      {genes.length > 0 && <div className="px-1 py-0.2 rounded text-[9px] font-bold bg-violet-600 text-white truncate shadow-2xs" title={genes.map((gene) => `${gene.nameEn} ${gene.stars}★`).join(", ")}>
        {genes.map((gene) => `${gene.nameEn} ${"★".repeat(gene.stars)}`).join(" · ")}
      </div>}
    </div>
  );
}
