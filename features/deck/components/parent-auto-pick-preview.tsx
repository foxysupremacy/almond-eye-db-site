"use client";

// Auto pick preview: the proposed Parent Deck, one 2-row candidate row per card
// (DESIGN.md §4) with the counted skills it adds underneath. Pure view over
// `useParentAutoPickViewModel`; every interaction routes to `commands.*`.

import { useState } from "react";
import type { CardIndexEntry } from "@/lib/data/types";
import { AppDialog } from "@/app/common/ui/controls/app-dialog";
import { AppButton } from "@/app/common/ui/controls/app-button";
import CardTypeIcon, { formatCardType } from "@/app/common/ui/cards/card-type-icon";
import SkillIcon from "@/app/common/ui/skills/skill-icon";
import { RARITY_META } from "@/app/common/ui/skills/skill-rarity";
import { SKILL_GROUP_LABELS } from "@/lib/parent-autopick";
import CardSkillsSheet from "./card-skills-sheet";
import type { AutoPickPreviewRow, ParentAutoPickViewModel } from "../view-models";

export interface ParentAutoPickViewProps {
  state: ParentAutoPickViewModel["state"];
  commands: ParentAutoPickViewModel["commands"];
}

/** Fixed-width ownership chip (DESIGN.md §4.5): `Unowned` / `0 LB`–`3 LB` / `MLB`. */
export function OwnershipChip({ limitBreak }: { limitBreak: number | undefined }) {
  if (limitBreak === undefined) {
    return (
      <span className="inline-flex w-11 shrink-0 items-center justify-center rounded bg-zinc-100 py-0.5 text-[10px] font-medium text-zinc-400 dark:bg-zinc-800">
        Unowned
      </span>
    );
  }
  if (limitBreak >= 4) {
    return (
      <span className="inline-flex w-11 shrink-0 items-center justify-center rounded border border-amber-500/40 bg-amber-500/20 py-0.5 text-[10px] font-bold text-amber-800 dark:text-amber-300">
        MLB
      </span>
    );
  }
  return (
    <span className="inline-flex w-11 shrink-0 items-center justify-center rounded border border-sky-500/30 bg-sky-500/20 py-0.5 text-[10px] font-bold text-sky-800 dark:text-sky-300">
      {limitBreak} LB
    </span>
  );
}

function PreviewRow({ row, onInspect }: { row: AutoPickPreviewRow; onInspect: (card: CardIndexEntry) => void }) {
  const { card } = row;
  const name = card.nameEn || card.nameJp;
  return (
    <li className="px-4 py-3 sm:px-5">
      <div className="flex w-full items-center gap-3">
        <img src={card.portraitUrl || card.imgUrl} alt="" className="h-10 w-10 shrink-0 object-contain" loading="lazy" />
        <div className="min-w-0 flex-1">
          {/* Row 1: rarity, name, badge | gain, ownership, type, Skills ↗ */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
              <span className={`shrink-0 rounded px-1.5 text-[10px] font-bold uppercase ${RARITY_META[card.rarity]?.chip ?? RARITY_META[1].chip}`}>
                {RARITY_META[card.rarity]?.label ?? "R"}
              </span>
              <span className="truncate text-[13px] font-semibold text-zinc-900 dark:text-zinc-100">{name}</span>
              {row.locked && (
                <span className="shrink-0 rounded border border-emerald-500/30 bg-emerald-50 px-1.5 text-[10px] font-bold text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                  Scenario Link
                </span>
              )}
            </div>
            <div className="flex shrink-0 items-center gap-1.5">
              <span className="text-[11px] font-bold tabular-nums text-emerald-700 dark:text-emerald-400">+{row.gain.toFixed(2)}</span>
              <OwnershipChip limitBreak={row.limitBreak} />
              <span className="inline-flex items-center" title={`${formatCardType(card.type)} type`}>
                <CardTypeIcon type={card.type} className="h-4 w-4 object-contain" />
              </span>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onInspect(card); }}
                className="rounded-lg border border-zinc-200/90 bg-white px-2 py-0.5 text-[12px] font-semibold text-zinc-600 shadow-2xs transition-colors hover:border-emerald-500 hover:text-emerald-700 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:text-emerald-400"
                title="Inspect all skills and events from this card"
                aria-label={`Skills of ${name}`}
              >
                Skills ↗
              </button>
            </div>
          </div>
          {/* Row 2: Japanese name | release */}
          <div className="mt-1 flex items-center justify-between gap-2">
            <span className="min-w-0 flex-1 truncate text-[11px] text-zinc-400 dark:text-zinc-500">{card.nameJp}</span>
            {card.release && (
              <span className="shrink-0 font-mono text-[11px] text-zinc-400 dark:text-zinc-500">Release: {card.release}</span>
            )}
          </div>
        </div>
      </div>

      {row.skills.length > 0 && (
        <ul className="mt-2 divide-y divide-zinc-100 pl-[52px] dark:divide-zinc-800/80">
          {row.skills.map((s) => (
            <li key={s.skillId} className="flex items-center justify-between gap-3 py-1.5">
              <div className="flex min-w-0 items-center gap-2.5">
                <SkillIcon iconId={s.iconId} name={s.nameEn} className="h-6 w-6 flex-none shrink-0 object-contain drop-shadow-2xs" />
                <div className="min-w-0">
                  <p className="truncate text-xs font-semibold leading-snug text-zinc-900 dark:text-zinc-100">{s.nameEn}</p>
                  {s.nameJp && (
                    <p className="mt-0.5 truncate text-[10px] font-normal leading-tight text-zinc-400 dark:text-zinc-500">{s.nameJp}</p>
                  )}
                  {s.groups.length > 0 && (
                    <p className="mt-0.5 truncate text-[10px] leading-tight text-zinc-500 dark:text-zinc-400">
                      {s.groups.map((g) => SKILL_GROUP_LABELS[g]).join(" · ")}
                    </p>
                  )}
                  {s.source === "event" && s.choiceTextEn && (
                    <p className="mt-0.5 truncate text-[10px] leading-tight text-violet-700 dark:text-violet-300" title={s.choiceTextEn}>
                      {s.choiceTextEn}
                    </p>
                  )}
                </div>
              </div>
              <span className="shrink-0 text-xs font-semibold tabular-nums text-zinc-700 dark:text-zinc-300">
                {`+${s.value.toFixed(2)}${s.flat ? " flat" : ""}`}
              </span>
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}

export function ParentAutoPickPreview({ state, commands }: ParentAutoPickViewProps) {
  const [inspectCard, setInspectCard] = useState<CardIndexEntry | null>(null);
  const { status, progress, errorMessage, rows, emptySlots, total, flatValue, summary } = state;
  const summaryLine = [summary.raceLabel, summary.styleLabel, summary.scenarioLabel].filter(Boolean).join(" · ");
  const ready = status === "ready";
  const determinate = progress !== null && progress.total > 0;
  const pct = determinate ? Math.round((progress.done / progress.total) * 100) : 0;

  return (
    <>
      <AppDialog
        isOpen={state.previewOpen}
        onOpenChange={(open) => { if (!open) commands.cancel(); }}
        title="Auto pick preview"
        description={(ready || summaryLine) ? (
          <>
            {ready && <span className="block font-semibold tabular-nums text-emerald-700 dark:text-emerald-400">{`+${total.toFixed(2)} Bashin`}</span>}
            {summaryLine && <span className="mt-0.5 block truncate text-[11px] text-zinc-500 dark:text-zinc-400">{summaryLine}</span>}
          </>
        ) : undefined}
        overlayLayer="picker"
        size="lg"
        footer={
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="min-w-0 flex-1 text-[11px] text-zinc-500 dark:text-zinc-400">
              {ready && flatValue !== null ? `flat = counted as one average speed skill (${flatValue.toFixed(2)})` : ""}
            </p>
            <div className="flex shrink-0 items-center gap-2">
              <AppButton variant="secondary" onPress={commands.cancel}>Cancel</AppButton>
              <AppButton variant="primary" isDisabled={!ready || rows.length === 0} onPress={commands.apply}>Apply</AppButton>
            </div>
          </div>
        }
      >
        {status === "scoring" && (
          <div className="flex flex-col gap-1 px-5 py-4">
            <p className="text-xs tabular-nums text-zinc-500 dark:text-zinc-400">
              {determinate ? `Scoring ${progress.done} / ${progress.total} skills…` : "Scoring skills…"}
            </p>
            <div
              role="progressbar"
              aria-label="Auto pick progress"
              aria-valuemin={0}
              aria-valuemax={determinate ? progress.total : 100}
              aria-valuenow={determinate ? progress.done : undefined}
              className="h-0.5 w-full overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800"
            >
              <div className="h-full bg-emerald-600 transition-[width] duration-150 ease-out-quart dark:bg-emerald-500" style={{ width: `${pct}%` }} />
            </div>
          </div>
        )}

        {status === "error" && errorMessage && (
          <p role="alert" className="px-5 py-4 text-sm text-rose-700 dark:text-rose-300">{errorMessage}</p>
        )}

        {ready && (
          <>
            <ul className="divide-y divide-zinc-100 dark:divide-zinc-800/80">
              {rows.map((row) => (
                <PreviewRow key={row.card.id} row={row} onInspect={setInspectCard} />
              ))}
            </ul>
            {emptySlots > 0 && (
              <p className="border-t border-zinc-100 px-5 py-3 text-xs text-zinc-500 dark:border-zinc-800/80 dark:text-zinc-400">
                No remaining owned card adds a counted skill.
              </p>
            )}
          </>
        )}
      </AppDialog>

      {inspectCard && (
        <CardSkillsSheet card={inspectCard} isOpen onClose={() => setInspectCard(null)} mode="parent" />
      )}
    </>
  );
}
