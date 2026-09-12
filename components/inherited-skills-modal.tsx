"use client";

import { useState, useMemo } from "react";
import type { KyumaruVeteranItem } from "../lib/kyumaru-types";
import type { GrandparentSlot } from "../lib/parenting-state";
import { type CharacterIndexEntry, getCharacterImageUrl } from "../lib/api";
import { getCharaIdFromCardId, getCanonicalFactorName } from "../lib/affinity-engine";
import { decodeFactor } from "../lib/factor-decoder";

export interface ParticipantSlot {
  slotLabel: string;
  subLabel: string;
  vet: KyumaruVeteranItem | GrandparentSlot | null;
  chara: CharacterIndexEntry | null;
}

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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-in fade-in duration-200 ease-out-quart">
      <div
        className="relative w-full max-w-2xl max-h-[85vh] flex flex-col rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-2xl animate-in zoom-in-95 duration-200 ease-out-expo overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/60">
          <div className="flex items-center gap-2.5">
            <span className="w-3 h-3 rounded-full bg-emerald-500" />
            <div>
              <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                Inherited Skills & Factors
              </h3>
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                Unique skills and inheritable white factors present across your 6-uma lineage tree.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-7 h-7 rounded-full flex items-center justify-center text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer text-sm font-bold"
          >
            ✕
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="flex border-b border-zinc-200 dark:border-zinc-800 bg-zinc-100/50 dark:bg-zinc-900 px-5 pt-2 gap-4">
          <button
            type="button"
            onClick={() => setActiveTab("unique")}
            className={`pb-2 text-xs font-bold transition-colors cursor-pointer border-b-2 ${
              activeTab === "unique"
                ? "border-emerald-500 text-emerald-600 dark:text-emerald-400"
                : "border-transparent text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300"
            }`}
          >
            🌟 Unique Skills
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("factors")}
            className={`pb-2 text-xs font-bold transition-colors cursor-pointer border-b-2 flex items-center gap-1.5 ${
              activeTab === "factors"
                ? "border-emerald-500 text-emerald-600 dark:text-emerald-400"
                : "border-transparent text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300"
            }`}
          >
            <span>📜 White Factors</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-zinc-200 dark:bg-zinc-800">
              {aggregatedFactors.length}
            </span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {activeTab === "unique" ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {participants.map((p, idx) => {
                const chara = p.chara;
                const charaId = p.vet ? getCharaIdFromCardId(p.vet.card_id) : null;
                const cardId = p.vet?.card_id;

                return (
                  <div
                    key={idx}
                    className="flex items-center gap-3 p-3 rounded-xl border border-zinc-200/80 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950/30"
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
          ) : (
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
                      className="flex items-center justify-between p-2.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-950/40 text-xs"
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

                      <div className="shrink-0 flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 font-black text-[11px]">
                        <span>{"★".repeat(f.maxStars)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-5 py-3 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/60 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-xs font-semibold text-zinc-800 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-700 cursor-pointer active:scale-[0.98] transition-all"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
