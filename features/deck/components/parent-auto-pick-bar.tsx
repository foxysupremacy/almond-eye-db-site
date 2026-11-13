"use client";

// Parent Deck Auto Pick controls: scenario, Scenario Link card, counted skill
// groups and the run button, in one flat wrapping row. Pure view; the single
// `useParentAutoPickViewModel` instance lives in the `ParentAutoPick` container.

import { useId } from "react";
import { AppSelect } from "@/app/common/ui/controls/app-select";
import { AppButton } from "@/app/common/ui/controls/app-button";
import { SparklesIcon } from "@/app/common/ui/primitives/icons";
import { SKILL_GROUPS, SKILL_GROUP_LABELS } from "@/lib/parent-autopick";
import {
  useParentAutoPickViewModel,
  type AutoPickDisabledReason,
  type AutoPickWorkerFactory,
} from "../view-models";
import { OwnershipChip, ParentAutoPickPreview, type ParentAutoPickViewProps } from "./parent-auto-pick-preview";

const DISABLED_REASON_TEXT: Record<Exclude<AutoPickDisabledReason, null>, string> = {
  "no-owned-cards": "Import your cards first",
  "no-race": "Pick a race first",
  "no-style": "Pick a running style first",
};

export function ParentAutoPickBar({ state, commands }: ParentAutoPickViewProps) {
  const { scenarios, scenarioId, palOptions, palCardId, enabledGroups, disabledReason } = state;
  const enabled = new Set(enabledGroups);
  const reasonId = useId();

  return (
    <div className="flex flex-wrap items-center gap-2">
      <AppSelect
        label="Farming scenario"
        value={scenarioId === null ? "" : String(scenarioId)}
        onValueChange={(v) => commands.selectScenario(Number(v))}
        options={scenarios.map((s) => ({ value: String(s.id), label: s.en }))}
        className="w-44"
      />

      {palOptions.length > 1 && (
        <AppSelect
          label="Scenario Link card"
          value={palCardId === null ? "" : String(palCardId)}
          onValueChange={(v) => commands.selectPalCard(Number(v))}
          options={palOptions.map(({ card, limitBreak }) => ({
            value: String(card.id),
            label: card.nameEn || card.nameJp,
            icon: <OwnershipChip limitBreak={limitBreak} />,
          }))}
          className="w-52"
        />
      )}

      <div role="group" aria-label="Counted skill groups" className="flex flex-wrap items-center gap-1">
        {SKILL_GROUPS.map((group) => {
          const on = enabled.has(group);
          return (
            <button
              key={group}
              type="button"
              aria-pressed={on}
              onClick={() => commands.toggleGroup(group)}
              className={`min-h-11 md:min-h-8 rounded border px-2 py-1 text-[11px] font-medium transition-colors duration-150 ease-out-quart ${on
                ? "border-emerald-400 bg-emerald-50 text-emerald-900 dark:border-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-300"
                : "border-zinc-200 bg-white text-zinc-500 hover:text-zinc-700 dark:border-zinc-700 dark:bg-zinc-800/60 dark:text-zinc-400 dark:hover:text-zinc-200"}`}
            >
              {SKILL_GROUP_LABELS[group]}
            </button>
          );
        })}
      </div>

      <div className="flex items-center gap-2">
        <AppButton
          variant="primary"
          isDisabled={disabledReason !== null}
          onPress={commands.run}
          aria-describedby={disabledReason ? reasonId : undefined}
        >
          <SparklesIcon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          Auto pick
        </AppButton>
        {disabledReason === "no-owned-cards" ? (
          <a
            id={reasonId}
            href="/import"
            className="text-[11px] font-medium text-emerald-700 underline underline-offset-2 hover:text-emerald-800 dark:text-emerald-400 dark:hover:text-emerald-300"
          >
            {DISABLED_REASON_TEXT[disabledReason]}
          </a>
        ) : disabledReason ? (
          <span id={reasonId} className="text-[11px] text-zinc-500 dark:text-zinc-400">{DISABLED_REASON_TEXT[disabledReason]}</span>
        ) : null}
      </div>
    </div>
  );
}

/** Owns the single view-model instance shared by the bar and the preview. */
export function ParentAutoPick({ createWorker }: { createWorker?: AutoPickWorkerFactory }) {
  const { state, commands } = useParentAutoPickViewModel(createWorker);
  return (
    <>
      <ParentAutoPickBar state={state} commands={commands} />
      <ParentAutoPickPreview state={state} commands={commands} />
    </>
  );
}

export default ParentAutoPick;
