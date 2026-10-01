"use client";

import { useState, useMemo } from "react";
import { Tabs, TabList, Tab, TabPanel } from "react-aria-components/Tabs";
import { AppDialog } from "@/app/common/ui/controls/app-dialog";
import { AppButton } from "@/app/common/ui/controls/app-button";
import { XIcon, SparklesIcon, LibraryIcon } from "@/app/common/ui/primitives/icons";
import { type CharacterIndexEntry, getCharacterImageUrl } from "@/lib/api";
import { getCharaIdFromCardId, getCanonicalFactorName } from "@/lib/lineage/affinity-engine";
import { decodeFactor } from "@/lib/lineage/factor-decoder";
import type { ParticipantSlot } from "@/lib/parenting/types";
import { Badge } from "@/app/common/ui/primitives/badge";

interface InheritedSkillsModalProps {
  isOpen: boolean;
  onClose: () => void;
  participants: ParticipantSlot[];
}

export default function InheritedSkillsModal({
  isOpen,
  onClose,
  participants,
}: InheritedSkillsModalProps) {
  const [activeTab, setActiveTab] = useState<"unique" | "factors">("unique");

  // Aggregate white & race factors across all 6 slots
  const aggregatedFactors = useMemo(() => {
    const factorMap = new Map<
      number,
      {
        factorId: number;
        name: string;
        maxStars: number;
        occurrences: { slotLabel: string; stars: number }[];
      }
    >();

    for (const p of participants) {
      if (!p.vet?.factor_info_array) continue;
      for (const f of p.vet.factor_info_array) {
        const id = f.factor_id;
        // White factors are >= 10000 (Skills, Races, Scenarios)
        if (id >= 10000) {
          const stars = Number(String(id).slice(-1)) || 1;
          const canonical = getCanonicalFactorName(id) || decodeFactor(id).name;
          const entry = factorMap.get(id) || {
            factorId: id,
            name: canonical,
            maxStars: stars,
            occurrences: [],
          };
          entry.occurrences.push({ slotLabel: p.slotLabel, stars });
          if (stars > entry.maxStars) entry.maxStars = stars;
          factorMap.set(id, entry);
        }
      }
    }

    return Array.from(factorMap.values()).sort(
      (a, b) => b.maxStars - a.maxStars || a.name.localeCompare(b.name)
    );
  }, [participants]);

  if (!isOpen) return null;

  return (
    <AppDialog
      isOpen={isOpen}
      onOpenChange={(open) => { if (!open) onClose(); }}
      title="Inherited Skills & Factors"
      description="Unique skills and inheritable white factors present across your 6-uma lineage tree."
      size="lg"
      headerAction={<AppButton variant="quiet" iconOnly aria-label="Close inherited skills" onPress={onClose}><XIcon className="h-4 w-4" /></AppButton>}
      footer={<div className="flex justify-end"><AppButton onPress={onClose}>Close</AppButton></div>}
    >
      <Tabs selectedKey={activeTab} onSelectionChange={(key) => setActiveTab(key as "unique" | "factors")}>
        <TabList aria-label="Inherited skill sources" className="flex gap-4 border-b border-zinc-200 px-5 pt-2 dark:border-zinc-800">
          <Tab id="unique" className="flex min-h-11 items-center gap-1.5 border-b-2 border-transparent pb-2 text-xs font-semibold text-zinc-500 outline-none data-[selected]:border-emerald-500 data-[selected]:text-emerald-700 focus-visible:ring-2 focus-visible:ring-emerald-500/70 dark:data-[selected]:text-emerald-400">
            <SparklesIcon className="h-4 w-4" /> Unique Skills
          </Tab>
          <Tab id="factors" className="flex min-h-11 items-center gap-1.5 border-b-2 border-transparent pb-2 text-xs font-semibold text-zinc-500 outline-none data-[selected]:border-emerald-500 data-[selected]:text-emerald-700 focus-visible:ring-2 focus-visible:ring-emerald-500/70 dark:data-[selected]:text-emerald-400">
            <LibraryIcon className="h-4 w-4" /> White Factors <Badge size="compact" tone="neutral">{aggregatedFactors.length}</Badge>
          </Tab>
        </TabList>
        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          <TabPanel id="unique" className="outline-none">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {participants.map((p, idx) => {
                const chara = p.chara;
                const charaId = p.vet ? getCharaIdFromCardId(p.vet.card_id) : null;
                const cardId = p.vet?.card_id;

                return (
                  <div
                    key={idx}
                    className="flex items-center gap-3 p-3 border-b border-zinc-100 dark:border-zinc-800/80"
                  >
                    <div className="relative w-12 h-12 shrink-0 rounded-full ring-2 ring-amber-400/80 overflow-hidden bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center">
                      {cardId && charaId ? (
                        <img
                          src={getCharacterImageUrl(charaId, cardId, "01")}
                          alt=""
                          className="w-full h-full object-contain object-top"
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.opacity = "0";
                          }}
                        />
                      ) : (
                        <span className="text-sm text-zinc-400">?</span>
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="px-1.5 py-0.2 rounded text-[9px] font-black bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300">
                          {p.slotLabel}
                        </span>
                        <span className="text-[10px] text-zinc-400 truncate">
                          {p.subLabel}
                        </span>
                      </div>
                      <h4 className="text-xs font-bold text-zinc-900 dark:text-zinc-100 truncate mt-0.5">
                        {chara?.nameEn || p.vet?.name || "Not Selected"}
                      </h4>
                      <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold truncate">
                        {chara?.titleEn || chara?.titleJp || "Inherited Gene"}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </TabPanel>
          <TabPanel id="factors" className="outline-none">
            <div>
              {aggregatedFactors.length === 0 ? (
                <div className="py-12 text-center text-zinc-400 text-xs">
                  No white skill or race factors detected in the current veterans.
                  <br />
                  <span className="text-[11px] text-zinc-500">
                    Upload veterans from Kyumaru or select trained parents to inspect inherited factors.
                  </span>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {aggregatedFactors.map((f) => (
                    <div
                      key={f.factorId}
                      className="flex items-center justify-between p-2.5 border-b border-zinc-100 dark:border-zinc-800/80 text-xs"
                    >
                      <div className="min-w-0 flex-1 pr-2">
                        <div className="font-bold text-zinc-900 dark:text-zinc-100 truncate">
                          {f.name}
                        </div>
                        <div className="flex items-center gap-1 text-[10px] text-zinc-400 mt-0.5">
                          <span>Inherited from:</span>
                          <span className="text-zinc-600 dark:text-zinc-300 font-medium">
                            {f.occurrences.map((o) => o.slotLabel).join(", ")}
                          </span>
                        </div>
                      </div>

                      <Badge size="standard" tone="amber" className="font-black">
                        <span>{"★".repeat(f.maxStars)}</span>
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </TabPanel>
        </div>
      </Tabs>
    </AppDialog>
  );
}