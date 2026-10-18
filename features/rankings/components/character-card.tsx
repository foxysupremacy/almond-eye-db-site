"use client";

import { CharacterPortrait } from "@/app/common/ui/primitives/character-portrait";
import SkillIcon from "@/app/common/ui/skills/skill-icon";
import type { Tier } from "@/app/common/hooks/use-tier";
import type { RankingMetric } from "@/lib/rankings";

export type PillSlot = "Unique" | "Evolution 1" | "Evolution 2" | "Evolution 3";
export type PillBadge = "Banned" | "Partially modeled" | "Not modeled";
export interface PillModel {
  slot: PillSlot;
  skillId: number | null;
  name: string;
  iconId: number | null;
  bashin: number;
  badge?: PillBadge;
}
export interface CharacterCardModel {
  costumeId: number;
  rank: number;
  name: string;
  nameJp: string;
  portraitUrl: string;
  chips: string[];
  styleLabel: string;
  /** Sum of expected (average) Bashin. */
  total: number;
  /** Sum of best-point Bashin (Best case). */
  totalMax: number;
  /** The active score metric: its value is primary, the other is muted. */
  metric: RankingMetric;
  recoveryHpPercent: number | null;
  pills: PillModel[];
}

interface CharacterCardProps {
  model: CharacterCardModel;
  tier: Tier;
  selected: boolean;
  onSelect(costumeId: number): void;
  onOpen(costumeId: number, skillId: number): void;
}

const fmt = (n: number) => n.toFixed(2);
const PRIMARY_TOTAL = "text-sm font-semibold tabular-nums text-zinc-900 dark:text-zinc-100";
const MUTED_TOTAL = "text-[11px] tabular-nums text-zinc-500 dark:text-zinc-400";

function Pill({ pill, onOpen }: { pill: PillModel; onOpen(skillId: number): void }) {
  if (pill.skillId == null) {
    return (
      <span
        className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-dashed border-zinc-200 px-3 text-[11px] text-zinc-400 md:min-h-8 dark:border-zinc-700 dark:text-zinc-500"
      >
        <span className="text-[10px] text-zinc-400 dark:text-zinc-500">{pill.slot}</span>
        <span aria-hidden="true">—</span>
        <span>No eligible option</span>
      </span>
    );
  }
  const skillId = pill.skillId;
  return (
    <button
      type="button"
      aria-label={`${pill.slot}: ${pill.name}, ${fmt(pill.bashin)} Bashin`}
      onClick={() => onOpen(skillId)}
      className="inline-flex min-h-11 min-w-0 max-w-full items-center gap-1.5 rounded-full border border-zinc-200 px-2.5 text-[11px] font-semibold text-zinc-700 outline-none transition-colors duration-150 hover:bg-zinc-50 focus-visible:ring-2 focus-visible:ring-emerald-500/70 md:min-h-8 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
    >
      <SkillIcon iconId={pill.iconId} name={pill.name} className="h-5 w-5 flex-none shrink-0 object-contain" />
      <span className="min-w-0 truncate">{pill.name}</span>
      <span className="flex-none tabular-nums font-normal text-zinc-500 dark:text-zinc-400">{fmt(pill.bashin)}</span>
      {pill.badge ? (
        <span className="flex-none rounded bg-amber-50 px-1 text-[10px] font-medium text-amber-800 dark:bg-amber-950/50 dark:text-amber-300">{pill.badge}</span>
      ) : null}
    </button>
  );
}

/** One flat ranked row: identity/total button on top, the skill pills below (three, or four with an Evolution 3). */
export function CharacterCard({ model, tier, selected, onSelect, onOpen }: CharacterCardProps) {
  const phone = tier === "phone";
  const unique = model.pills.find((p) => p.slot === "Unique")?.skillId ?? null;
  const mainLabel = phone ? `Open details for ${model.name}, rank ${model.rank}` : `Select ${model.name}, rank ${model.rank}`;
  return (
    <li aria-label={`Rank ${model.rank}: ${model.name}`} className={`py-2 transition-colors duration-150 ${selected ? "bg-emerald-50/60 dark:bg-emerald-950/30" : ""}`}>
      <button
        type="button"
        aria-label={mainLabel}
        aria-pressed={phone ? undefined : selected}
        onClick={() => {
          if (!phone) onSelect(model.costumeId);
          else if (unique != null) onOpen(model.costumeId, unique);
        }}
        className="flex min-h-11 w-full items-center gap-3 rounded-md px-2 pt-2 text-left outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/70"
      >
        <span className="w-6 flex-none text-right text-sm font-semibold tabular-nums text-zinc-500 dark:text-zinc-400">{model.rank}</span>
        <CharacterPortrait src={model.portraitUrl} className="h-10 w-10" />
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-sm font-semibold text-zinc-900 dark:text-zinc-100">{model.name}</span>
          {model.nameJp && model.nameJp !== model.name ? (
            <span className="mt-0.5 truncate text-[11px] text-zinc-400 dark:text-zinc-500">{model.nameJp}</span>
          ) : null}
          <span className="mt-1 flex flex-wrap items-center gap-1">
            {model.chips.map((chip) => (
              <span key={chip} className="rounded bg-zinc-100 px-1.5 text-[10px] font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">{chip}</span>
            ))}
            <span className="rounded bg-zinc-100 px-1.5 text-[10px] font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">{model.styleLabel}</span>
          </span>
        </span>
        <span className="flex flex-none flex-col items-end">
          {/* Both totals in a fixed order (avg · max); only the active metric is emphasised. */}
          <span className="flex flex-wrap items-baseline justify-end gap-x-1 tabular-nums">
            <span className={model.metric === "average" ? PRIMARY_TOTAL : MUTED_TOTAL}>{fmt(model.total)} avg</span>
            <span aria-hidden="true" className="text-[11px] text-zinc-400 dark:text-zinc-500">·</span>
            <span className={model.metric === "best" ? PRIMARY_TOTAL : MUTED_TOTAL}>{fmt(model.totalMax)} max</span>
          </span>
          {model.recoveryHpPercent != null ? (
            <span className="mt-0.5 text-[11px] tabular-nums text-emerald-700 dark:text-emerald-400">+{model.recoveryHpPercent.toFixed(1)}% HP</span>
          ) : null}
        </span>
      </button>
      <div className="mt-1 flex flex-wrap gap-1.5 pl-11 pr-2 sm:pl-[5.25rem]">
        {model.pills.map((pill) => (
          <Pill key={pill.slot} pill={pill} onOpen={(skillId) => onOpen(model.costumeId, skillId)} />
        ))}
      </div>
    </li>
  );
}
