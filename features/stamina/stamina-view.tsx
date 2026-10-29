"use client";

import { useId, type ReactNode } from "react";
import { RUNNING_STYLE_LABELS } from "@/lib/deck/constants";
import { RACE_CONDITION_OPTIONS } from "@/lib/deck/race-conditions";
import type { Motivation, Proficiency } from "@/lib/race-impact/adjusted-stats";
import type { Course } from "@/lib/skill-engine/types";
import { GREEN_BUCKETS, HP_LOSS_BUCKETS, RECOVERY_BUCKETS, type StaminaInput } from "@/lib/stamina-sim";
import { LoadingAnimation } from "@/app/common/ui/controls/loading-animation";
import { AppButton } from "@/app/common/ui/controls/app-button";
import { AppSelect } from "@/app/common/ui/controls/app-select";
import { BucketCounter } from "./components/bucket-counter";
import { MechanicToggles } from "./components/mechanic-toggles";
import { ResultCircles } from "./components/result-circles";
import { StatInputs } from "./components/stat-inputs";
import { GREEN_KEYS, GROUNDS, MOTIVATIONS, PROFICIENCIES, STYLES } from "./model/stamina-prefs";
import { useStaminaCalculator, useStaminaViewModel, type StaminaViewModel } from "./view-models/use-stamina-view-model";
import type { StaminaRunner } from "./view-models/use-stamina-sim";

type Ground = StaminaInput["groundCondition"];

// Site-wide ground names (race conditions), with the in-game JP mark as a muted suffix.
const GROUND_JP: Record<Ground, string> = { 1: "良", 2: "稍重", 3: "重", 4: "不良" };
const groundLabel = (g: Ground) => `${RACE_CONDITION_OPTIONS.groundCondition[g - 1]} (${GROUND_JP[g]})`;
const MOOD_LABELS: Record<Motivation, string> = { best: "Great", good: "Good", normal: "Normal", bad: "Bad", worst: "Awful" };
const GREEN_LABELS: Record<keyof typeof GREEN_BUCKETS, string> = { spd60: "Speed", spd40: "Speed", sta60: "Stamina", sta40: "Stamina" };

const isGround = (v: unknown): v is Ground => GROUNDS.includes(v as Ground);
const proficiencyOptions = PROFICIENCIES.map((p) => ({ value: p, label: p }));

function Section({ title, caption, children }: { title: string; caption?: string; children: ReactNode }) {
  const id = useId();
  return (
    <section aria-labelledby={id} className="flex flex-col gap-2 px-4 py-3.5 sm:px-5">
      <div>
        <h2 id={id} className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">{title}</h2>
        {caption ? <p className="mt-0.5 text-[11px] text-zinc-500 dark:text-zinc-400">{caption}</p> : null}
      </div>
      {children}
    </section>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <span aria-hidden="true" className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400">{label}</span>
      {children}
    </div>
  );
}

const PROVISIONAL_NOTE =
  "Estimates, calibrated on Champions Meeting races. Provisional parts: Zenkai Spurt, the Stamina Keep activation chance, " +
  "and Spot Struggle, Dueling and repositioning, which are inferred from game parameters. Position keeping and Secure Lead run against a simplified generic field. " +
  "Pace Up Ex, blocking, and the exact entry rules for Dueling and Spot Struggle are not modelled.";

export interface StaminaViewProps {
  course: Course | null;
  loading: boolean;
  /** Ground condition set by the active race (1..4), or null when the race leaves it open. */
  raceGround: number | null;
  caption?: string;
  runner?: StaminaRunner;
}

function StaminaScreen({ vm }: { vm: StaminaViewModel }) {
  const { state, commands } = vm;
  const { course, loading, caption, input, status, result, error, stale } = state;
  const { update, setCount, resetInputs, calculate } = commands;

  if (!course) {
    return (
      <section aria-label="Stamina" className="relative flex flex-col gap-3">
        {!loading && (
          <p className="py-10 text-center text-sm text-zinc-500 dark:text-zinc-400">Pick a race in the header to calculate stamina.</p>
        )}
        <LoadingAnimation active={loading} label="Loading race…" />
      </section>
    );
  }

  return (
    <section aria-label="Stamina" className="flex flex-col gap-3">
      {caption ? <p className="text-xs font-semibold text-zinc-700 dark:text-zinc-200">{caption}</p> : null}
      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_16rem] lg:items-start">
        <form
          aria-label="Stamina inputs"
          onSubmit={(e) => { e.preventDefault(); calculate(); }}
          className="divide-y divide-zinc-100 rounded-xl border border-zinc-200 bg-white dark:divide-zinc-800/80 dark:border-zinc-800 dark:bg-zinc-900"
        >
          <Section title="Stats" caption="Raw stats as shown in game, 1–2500.">
            <StatInputs stats={input.stats} onChange={(stats) => update({ stats })} />
            <div className="grid grid-cols-2 gap-2 pt-1 sm:grid-cols-5">
              <Field label="Strategy">
                <AppSelect label="Strategy" value={String(input.style)} onValueChange={(v) => update({ style: STYLES.find((s) => String(s) === v) ?? input.style })} options={STYLES.map((s) => ({ value: String(s), label: RUNNING_STYLE_LABELS[s] }))} className="w-full" />
              </Field>
              <Field label="Mood">
                <AppSelect label="Mood" value={input.motivation} onValueChange={(v) => update({ motivation: MOTIVATIONS.find((m) => m === v) ?? input.motivation })} options={MOTIVATIONS.map((m) => ({ value: m, label: MOOD_LABELS[m] }))} className="w-full" />
              </Field>
              {(["ground", "distance", "style"] as const).map((k) => (
                <Field key={k} label={k === "ground" ? "Track aptitude" : k === "distance" ? "Distance aptitude" : "Strategy aptitude"}>
                  <AppSelect
                    label={k === "ground" ? "Track aptitude" : k === "distance" ? "Distance aptitude" : "Strategy aptitude"}
                    value={input.aptitude[k]}
                    onValueChange={(v) => update({ aptitude: { ...input.aptitude, [k]: (PROFICIENCIES.find((p) => p === v) ?? input.aptitude[k]) as Proficiency } })}
                    options={proficiencyOptions}
                    className="w-full"
                  />
                </Field>
              ))}
            </div>
          </Section>

          <Section title="Green skills" caption="Passive stat skills, always active.">
            <div className="grid grid-cols-1 gap-x-6 min-[420px]:grid-cols-2 md:grid-cols-4">
              {GREEN_KEYS.map((k) => {
                const [, bonus] = GREEN_BUCKETS[k];
                return <BucketCounter key={k} label={`+${bonus}`} sublabel={GREEN_LABELS[k]} name={`${GREEN_LABELS[k]} +${bonus}`} value={input.greens[k]} onChange={(n) => update({ greens: { ...input.greens, [k]: n } })} />;
              })}
            </div>
          </Section>

          <Section title="Recovery skills" caption="Heals, as % of max HP. Count each skill; each activates at a random mid-race point.">
            <div className="grid grid-cols-1 gap-x-6 min-[420px]:grid-cols-2 md:grid-cols-4">
              {RECOVERY_BUCKETS.map((pct, i) => (
                <BucketCounter key={pct} label={`${pct}%`} name={`${pct}% recovery`} value={input.recovery[i]} onChange={(n) => setCount("recovery", i, n)} />
              ))}
            </div>
          </Section>

          <Section title="HP-loss skills" caption="Debuffs aimed at you, as % of max HP. They always land.">
            <div className="grid grid-cols-1 gap-x-6 min-[420px]:grid-cols-2 md:grid-cols-4">
              {HP_LOSS_BUCKETS.map((pct, i) => (
                <BucketCounter key={pct} label={`${pct}%`} name={`${pct}% HP loss`} value={input.hpLoss[i]} onChange={(n) => setCount("hpLoss", i, n)} />
              ))}
            </div>
          </Section>

          <Section title="Race options">
            <MechanicToggles value={input.toggles} onChange={(toggles) => update({ toggles })} />
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
              <Field label="Ground">
                <AppSelect label="Ground" value={String(input.groundCondition)} onValueChange={(v) => { const g = Number(v); if (isGround(g)) update({ groundCondition: g }); }} options={GROUNDS.map((g) => ({ value: String(g), label: groundLabel(g) }))} className="w-full" />
              </Field>
            </div>
          </Section>

          <div className="flex flex-col gap-2 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:px-5">
            <AppButton type="submit" variant="primary" size="md" isDisabled={status === "running"} className="w-full sm:w-auto">Calculate</AppButton>
            <AppButton variant="quiet" onPress={resetInputs}>Reset inputs</AppButton>
          </div>
        </form>

        <div className="flex flex-col gap-3 lg:sticky lg:top-20">
          <div className="rounded-xl border border-zinc-200 bg-white px-4 py-3.5 dark:border-zinc-800 dark:bg-zinc-900">
            <ResultCircles status={status} result={result} error={error} stale={stale} />
          </div>
          <p role="note" className="text-[11px] leading-relaxed text-zinc-500 dark:text-zinc-400">{PROVISIONAL_NOTE}</p>
        </div>
      </div>
    </section>
  );
}

/** Props-driven entry (race context passed in); the page uses `StaminaFeature`. */
export function StaminaView({ runner, ...track }: StaminaViewProps) {
  return <StaminaScreen vm={useStaminaCalculator(track, runner)} />;
}

/** Stamina page: course and ground come from the global race bar. */
export function StaminaFeature({ runner }: { runner?: StaminaRunner } = {}) {
  return <StaminaScreen vm={useStaminaViewModel(runner)} />;
}
