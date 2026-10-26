"use client";

// Skill Scanner: OCR a screenshot/photo of a Japanese skill name, fuzzy-match
// it against the skill registry, and list every known source of the skill
// (support hints, support/chain events, trainee events, potential, uniques).

import { useCallback, useDeferredValue, useEffect, useMemo, useState } from "react";
import { FileTrigger } from "react-aria-components/FileTrigger";
import { ProgressBar } from "react-aria-components/ProgressBar";
import { Radio, RadioGroup } from "react-aria-components/RadioGroup";
import { api, type CardIndexEntry, type CharacterIndexEntry, type SkillDetail } from "@/lib/api";
import { matchSkillsFromOcrText } from "@/lib/skills/ocr-match";
import {
  collectSkillSources,
  groupSkillSources,
  SKILL_SOURCE_LABELS,
  type SkillSource,
} from "@/lib/skills/skill-sources";
import { AppButton } from "@/app/common/ui/controls/app-button";
import { LoadingAnimation } from "@/app/common/ui/controls/loading-animation";
import { AppDialog } from "@/app/common/ui/controls/app-dialog";
import { CardSourceIcon } from "@/app/common/ui/skills/skill-badges";
import CardTypeIcon from "@/app/common/ui/cards/card-type-icon";
import { CharacterPortrait } from "@/app/common/ui/primitives/character-portrait";
import { ChainArrowIcon } from "@/app/common/ui/skills/provenance/chain-arrow-icon";
import { RARITY_META } from "@/app/common/ui/skills/skill-rarity";
import SkillIcon from "@/app/common/ui/skills/skill-icon";
import SkillHoverCard from "@/app/common/ui/skills/details/skill-hover-card";
import { recognizeJapaneseText, type OcrProgress } from "../ocr/recognize-japanese";

export interface SkillScannerDialogProps {
  isOpen: boolean;
  onClose: () => void;
  /** Optional hand-off back to the opening screen (e.g. filter its own list by the skill). */
  onUseSkill?: (skill: SkillDetail) => void;
  useSkillLabel?: string;
}

interface ScanData {
  skills: SkillDetail[];
  cards: CardIndexEntry[];
  characters: CharacterIndexEntry[];
}

const OCR_STATUS_LABELS: Record<string, string> = {
  "loading tesseract core": "Loading OCR engine…",
  "initializing tesseract": "Starting OCR engine…",
  "loading language traineddata": "Downloading Japanese model…",
  "initializing api": "Starting OCR engine…",
  "recognizing text": "Reading text…",
};

function firstImage(files: FileList | File[] | null | undefined): File | null {
  return Array.from(files ?? []).find((file) => file.type.startsWith("image/")) ?? null;
}

export default function SkillScannerDialog({ isOpen, onClose, onUseSkill, useSkillLabel = "Use skill" }: SkillScannerDialogProps) {
  const [data, setData] = useState<ScanData | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [progress, setProgress] = useState<OcrProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [selectedSkillId, setSelectedSkillId] = useState<number | null>(null);
  const deferredText = useDeferredValue(text);
  const isScanning = progress !== null;

  useEffect(() => {
    if (!isOpen || data) return;
    Promise.all([api.listSkills(), api.listCardIndex(), api.listCharacters()])
      .then(([skills, cards, characters]) => setData({ skills, cards, characters }))
      .catch(() => setError("Could not load the skill database."));
  }, [isOpen, data]);

  useEffect(() => () => {
    if (imageUrl) URL.revokeObjectURL(imageUrl);
  }, [imageUrl]);

  const scanImage = useCallback(async (file: File) => {
    setError(null);
    setImageUrl(URL.createObjectURL(file));
    setProgress({ status: "loading tesseract core", progress: 0 });
    try {
      setText((await recognizeJapaneseText(file, setProgress)).trim());
    } catch {
      setError("Text recognition failed. Check your connection — the OCR model downloads on first use — or type the name below.");
    } finally {
      setProgress(null);
    }
  }, []);

  // Paste a screenshot straight from the clipboard while the scanner is open.
  useEffect(() => {
    if (!isOpen) return;
    const onPaste = (event: ClipboardEvent) => {
      const file = firstImage(Array.from(event.clipboardData?.items ?? []).flatMap((item) => {
        const pasted = item.kind === "file" ? item.getAsFile() : null;
        return pasted ? [pasted] : [];
      }));
      if (!file) return;
      event.preventDefault();
      void scanImage(file);
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [isOpen, scanImage]);

  const matches = useMemo(
    () => (data ? matchSkillsFromOcrText(deferredText, data.skills) : []),
    [data, deferredText],
  );

  useEffect(() => {
    setSelectedSkillId(matches[0]?.skill.id ?? null);
  }, [matches]);

  const selected = matches.find((match) => match.skill.id === selectedSkillId)?.skill ?? null;
  const sourceGroups = useMemo(() => {
    if (!selected || !data) return [];
    const skillsById = new Map(data.skills.map((skill) => [skill.id, skill]));
    return groupSkillSources(collectSkillSources(selected.id, data.cards, data.characters, skillsById));
  }, [selected, data]);

  return (
    <AppDialog
      isOpen={isOpen}
      onOpenChange={(open) => { if (!open) onClose(); }}
      title="Scan a skill"
      description="Screenshot or photograph a Japanese skill name to find where the skill comes from."
      size="lg"
      headerAction={<AppButton variant="quiet" onPress={onClose}>Close</AppButton>}
    >
      <div className="space-y-4 px-5 py-4">
        <div
          onDragOver={(event) => { event.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={(event) => {
            event.preventDefault();
            setIsDragging(false);
            const file = firstImage(event.dataTransfer.files);
            if (file) void scanImage(file);
          }}
          className={`flex flex-col gap-3 rounded-xl border-2 border-dashed p-4 transition-colors sm:flex-row sm:items-center ${
            isDragging
              ? "border-emerald-500 bg-emerald-500/10"
              : "border-zinc-300 bg-zinc-50/50 dark:border-zinc-700 dark:bg-zinc-950/40"
          }`}
        >
          {imageUrl ? (
            <img src={imageUrl} alt="Scanned image" className="max-h-28 w-full flex-none rounded-lg object-contain sm:w-48" />
          ) : null}
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">
              {imageUrl ? "Scan another image" : "Drop, paste or pick a screenshot"}
            </p>
            <p className="mt-0.5 text-[11px] text-zinc-500 dark:text-zinc-400">
              Crop close to the skill name for the best result. Text is read on your device.
            </p>
            <div className="mt-2.5 flex flex-wrap gap-2">
              <FileTrigger acceptedFileTypes={["image/*"]} onSelect={(files) => { const file = firstImage(files ? Array.from(files) : null); if (file) void scanImage(file); }}>
                <AppButton variant="primary" isDisabled={isScanning}>Choose image</AppButton>
              </FileTrigger>
              <FileTrigger acceptedFileTypes={["image/*"]} defaultCamera="environment" onSelect={(files) => { const file = firstImage(files ? Array.from(files) : null); if (file) void scanImage(file); }}>
                <AppButton variant="secondary" isDisabled={isScanning} className="md:hidden">Take photo</AppButton>
              </FileTrigger>
            </div>
          </div>
        </div>

        {progress && (
          <ProgressBar
            aria-label="Text recognition progress"
            value={Math.round(progress.progress * 100)}
            className="flex flex-col gap-1"
          >
            <span className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400">
              {OCR_STATUS_LABELS[progress.status] ?? "Working…"}
            </span>
            <div className="h-1.5 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
              <div className="h-full bg-emerald-600 transition-[width] duration-200 motion-reduce:transition-none" style={{ width: `${Math.round(progress.progress * 100)}%` }} />
            </div>
          </ProgressBar>
        )}

        {error && <p role="alert" className="text-xs text-rose-700 dark:text-rose-300">{error}</p>}

        <label className="block">
          <span className="text-[11px] font-semibold text-zinc-600 dark:text-zinc-400">Recognized text</span>
          <textarea
            value={text}
            onChange={(event) => setText(event.target.value)}
            rows={3}
            placeholder="OCR output appears here — you can also correct it or type a name (Japanese or English)."
            className="mt-1 block w-full resize-y rounded-lg border border-zinc-200 bg-zinc-50 px-2.5 py-2 text-xs text-zinc-800 outline-none placeholder:text-zinc-400 focus:border-emerald-500 dark:border-zinc-700 dark:bg-zinc-800/70 dark:text-zinc-100 dark:placeholder:text-zinc-500"
          />
        </label>

        {deferredText.trim() && !isScanning && (
          matches.length === 0 ? (
            data ? (
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                No skill name recognized. Try a tighter crop or fix the text above.
              </p>
            ) : (
              <LoadingAnimation active={!data} variant="inline" label="Loading skills…" />
            )
          ) : (
            <section aria-label="Matched skills">
              <h3 className="text-[11px] font-semibold text-zinc-600 dark:text-zinc-400">
                {matches.length === 1 ? "Matched skill" : `Possible matches (${matches.length})`}
              </h3>
              <RadioGroup
                aria-label="Matched skills"
                value={selectedSkillId === null ? null : String(selectedSkillId)}
                onChange={(value) => setSelectedSkillId(Number(value))}
                className="mt-1 divide-y divide-zinc-100 rounded-xl border border-zinc-200 dark:divide-zinc-800/80 dark:border-zinc-800"
              >
                {matches.map(({ skill, score }) => (
                  <Radio
                    key={skill.id}
                    value={String(skill.id)}
                    className="flex min-h-11 cursor-pointer items-center justify-between gap-3 px-3 py-2 outline-none first:rounded-t-xl last:rounded-b-xl data-[focus-visible]:ring-2 data-[focus-visible]:ring-inset data-[focus-visible]:ring-emerald-500 data-[selected]:bg-emerald-500/10"
                  >
                    <span className="flex min-w-0 items-center gap-2.5">
                      <SkillIcon iconId={skill.iconId} name={skill.nameEn} className="h-7 w-7 flex-none shrink-0 object-contain" />
                      <span className="min-w-0">
                        <span className="block truncate text-xs font-semibold leading-snug text-zinc-900 dark:text-zinc-100">{skill.nameEn}</span>
                        <span className="mt-0.5 block truncate text-[10px] leading-tight text-zinc-400 dark:text-zinc-500">{skill.nameJp}</span>
                      </span>
                    </span>
                    <span className="flex-none text-[10px] font-medium tabular-nums text-zinc-500 dark:text-zinc-400">
                      {score >= 0.999 ? "Exact" : `${Math.round(score * 100)}%`}
                    </span>
                  </Radio>
                ))}
              </RadioGroup>
            </section>
          )
        )}

        {selected && !isScanning && (
          <section aria-label={`Sources of ${selected.nameEn}`} className="border-t border-zinc-100 pt-3 dark:border-zinc-800">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <SkillHoverCard
                skillId={selected.id}
                fallbackSkill={{ nameEn: selected.nameEn, nameJp: selected.nameJp, rarity: selected.rarity, iconId: selected.iconId }}
                className="group inline-flex min-w-0 items-center gap-2.5 cursor-pointer"
              >
                <SkillIcon iconId={selected.iconId} name={selected.nameEn} className="h-8 w-8 flex-none shrink-0 object-contain" />
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold leading-snug text-zinc-900 group-hover:text-emerald-700 dark:text-zinc-100 dark:group-hover:text-emerald-400">{selected.nameEn}</span>
                  <span className="mt-0.5 block truncate text-[11px] leading-tight text-zinc-400 dark:text-zinc-500">{selected.nameJp}</span>
                </span>
              </SkillHoverCard>
              {onUseSkill && (
                <AppButton variant="secondary" onPress={() => { onUseSkill(selected); onClose(); }}>{useSkillLabel}</AppButton>
              )}
            </div>

            {sourceGroups.length === 0 ? (
              <p className="mt-3 text-xs text-zinc-500 dark:text-zinc-400">
                No support card or trainee in the local data grants this skill. It may come from a scenario or another source not tracked here.
              </p>
            ) : (
              <div className="mt-3 space-y-3">
                {sourceGroups.map((group) => (
                  <div key={group.kind}>
                    <h4 className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                      {SKILL_SOURCE_LABELS[group.kind]} <span className="font-medium tabular-nums">({group.sources.length})</span>
                    </h4>
                    <ul className="mt-1 divide-y divide-zinc-100 dark:divide-zinc-800/80">
                      {group.sources.map((source, index) => <SourceRow key={sourceKey(source, index)} source={source} />)}
                    </ul>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}
      </div>
    </AppDialog>
  );
}

function sourceKey(source: SkillSource, index: number): string {
  return "card" in source ? `${source.kind}-${source.card.id}-${index}` : `${source.kind}-${source.character.id}-${index}`;
}

function SourceRow({ source }: { source: SkillSource }) {
  if ("card" in source) {
    const { card } = source;
    const rarity = RARITY_META[card.rarity];
    return (
      <li className="flex min-h-11 items-center gap-2.5 py-1.5">
        <CardSourceIcon cardId={card.id} cardName={card.nameEn} className="h-9 w-9" />
        <span className="min-w-0 flex-1">
          <span className="flex min-w-0 items-center gap-1.5">
            {rarity && <span className={`inline-flex h-4 flex-none items-center rounded px-1 text-[9px] ${rarity.chip}`}>{rarity.label}</span>}
            <span className="truncate text-xs font-semibold text-zinc-900 dark:text-zinc-100">{card.nameEn}</span>
            <CardTypeIcon type={card.type} />
          </span>
          {source.kind === "card-hint" ? (
            <span className="mt-0.5 block truncate text-[10px] leading-tight text-zinc-400 dark:text-zinc-500">{card.titleJa || card.nameJp}</span>
          ) : (
            <span className="mt-0.5 flex min-w-0 items-center gap-1 text-[10px] leading-tight text-violet-700 dark:text-violet-300">
              {source.kind === "card-chain" && <ChainArrowIcon step={source.chainStep ?? 1} size="sm" className="flex-none" />}
              <span className="truncate">
                {source.eventName ?? "Event"}
                {source.choiceIndex !== undefined && ` · Choice ${source.choiceIndex}`}
                {source.choiceText && ` (${source.choiceText})`}
              </span>
            </span>
          )}
        </span>
      </li>
    );
  }

  const { character } = source;
  return (
    <li className="flex min-h-11 items-center gap-2.5 py-1.5">
      <CharacterPortrait src={character.imgUrl} className="h-9 w-9" />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-xs font-semibold text-zinc-900 dark:text-zinc-100">{character.nameEn}</span>
        <span className="mt-0.5 block truncate text-[10px] leading-tight text-zinc-400 dark:text-zinc-500">
          {character.titleEn || character.titleJp}
          {source.kind === "character-awakening" && source.awakeningLevel ? ` · Potential Lv ${source.awakeningLevel}` : ""}
        </span>
      </span>
    </li>
  );
}

