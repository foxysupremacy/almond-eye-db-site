"use client";

import { AppDialog } from "@/app/common/ui/controls/app-dialog";
import { AppButton } from "@/app/common/ui/controls/app-button";

// Shared Import Dialog: Triggered when a user opens a link containing #share=... or ?share=...
// Displays the build contents and asks:
// 1. Save as a new preset
// 2. Load into the current active preset
// 3. Cancel

import { useEffect, useState, useMemo } from "react";
import { useDeck } from "@/features/deck/state";
import type { DeckPreset } from "@/lib/deck/types";
import { RUNNING_STYLE_LABELS } from "@/lib/deck/constants";
import {
  decodePresetFromShareCode,
  extractShareCodeFromUrl,
  type SharedBuildData,
} from "@/lib/share-link";
import { XIcon } from "@/app/common/ui/primitives/icons";

export default function SharedImportDialog() {
  const { importPreset, allCards, tracks, activePreset } = useDeck();
  const [sharedData, setSharedData] = useState<SharedBuildData | null>(null);
  const [presetName, setPresetName] = useState("");
  const [isOpen, setIsOpen] = useState(false);


  // Check URL on mount & when hash/search changes
  useEffect(() => {
    function checkUrl() {
      if (typeof window === "undefined") return;
      const code = extractShareCodeFromUrl(window.location.href);
      if (code) {
        const decoded = decodePresetFromShareCode(code);
        if (decoded) {
          setSharedData(decoded);
          setPresetName(decoded.name || "Shared Build");
          setIsOpen(true);
        }
      }
    }

    checkUrl();
    window.addEventListener("hashchange", checkUrl);
    window.addEventListener("popstate", checkUrl);
    return () => {
      window.removeEventListener("hashchange", checkUrl);
      window.removeEventListener("popstate", checkUrl);
    };
  }, []);

  function cleanUrl() {
    if (typeof window === "undefined") return;
    try {
      // Remove #share= or ?share= cleanly without full reload
      const cleanHref = window.location.pathname;
      window.history.replaceState(null, "", cleanHref);
    } catch {}
  }

  function handleSaveAsNew() {
    if (!sharedData) return;
    importPreset(sharedData, true, presetName);
    setIsOpen(false);
    cleanUrl();
  }

  function handleLoadIntoCurrent() {
    if (!sharedData) return;
    importPreset(sharedData, false, presetName);
    setIsOpen(false);
    cleanUrl();
  }

  function handleDismiss() {
    setIsOpen(false);
    cleanUrl();
  }

  const cardsById = useMemo(() => {
    const map = new Map<number, NonNullable<(typeof allCards)>[0]>();
    if (allCards) {
      for (const c of allCards) map.set(c.id, c);
    }
    return map;
  }, [allCards]);

  if (!isOpen || !sharedData) return null;

  const mainCards = sharedData.mainDeckIds.map((id) => (id ? cardsById.get(id) : null));
  const parentCards = sharedData.parentDeckIds.map((id) => (id ? cardsById.get(id) : null));

  const trackName = tracks?.find((t) => t.id === sharedData.trackInfo.trackId)?.nameJa || "Track";
  const styleLabel = sharedData.trackInfo.runningStyle
    ? RUNNING_STYLE_LABELS[sharedData.trackInfo.runningStyle]
    : "Any Style";

  const mainCount = sharedData.mainDeckIds.filter(Boolean).length;
  const parentCount = sharedData.parentDeckIds.filter(Boolean).length;

  return (
    <AppDialog isOpen={isOpen} onOpenChange={(open) => { if (!open) handleDismiss(); }}
      title={"Shared Build Received"} ariaLabel={"Shared Build Received"} size="md" overlayLayer="inspection"
      header={<></>} bodyClassName="contents" className="max-w-lg text-left">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 px-5 py-4 bg-emerald-50/50 dark:bg-emerald-950/20">
          <div>
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
                Shared Build Received
              </h3>
            </div>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
              Someone shared a deck build with you! How would you like to load it?
            </p>
          </div>
          <AppButton variant="quiet"
            type="button"
            onPress={handleDismiss}
            aria-label="Close shared build dialog"
            iconOnly

          >
            <XIcon className="h-4 w-4" />
          </AppButton>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4 overflow-y-auto overscroll-contain max-h-[70vh]">
          {/* Preset Name Input */}
          <div>
            <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
              Preset Name:
            </label>
            <input
              type="text"
              aria-label="Preset name"
              value={presetName}
              onChange={(e) => setPresetName(e.target.value)}
              className="w-full rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 px-3 py-2 text-xs font-semibold text-zinc-900 dark:text-zinc-100 outline-none focus:border-emerald-500"
            />
          </div>

          {/* Track and Style Info */}
          <div className="flex items-center justify-between rounded-xl border border-zinc-200/80 dark:border-zinc-800 bg-zinc-50/60 dark:bg-zinc-900/60 p-2.5 text-xs">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-zinc-800 dark:text-zinc-200">{trackName}</span>
              <span className="rounded bg-zinc-200/70 dark:bg-zinc-800 px-1.5 py-0.5 text-[10px] text-zinc-600 dark:text-zinc-300">
                {styleLabel}
              </span>
            </div>
            <span className="text-[11px] text-zinc-400">
              {sharedData.trackInfo.racerCount} racers
            </span>
          </div>

          {/* Main Deck Cards */}
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
              Main Deck ({mainCount}/6)
            </span>
            <div className="mt-1.5 grid grid-cols-6 gap-1.5 bg-zinc-100/60 dark:bg-zinc-900/40 p-2 rounded-xl border border-zinc-200/60 dark:border-zinc-800/60">
              {mainCards.map((card, idx) => (
                <div
                  key={idx}
                  className="aspect-square border border-zinc-200/80 dark:border-zinc-700 overflow-hidden bg-white dark:bg-zinc-800 flex items-center justify-center shadow-2xs"
                  title={card ? (card.nameEn || card.nameJp) : `Slot ${idx + 1}: Empty`}
                >
                  {card ? (
                    <img
                      src={card.portraitUrl || card.imgUrl}
                      alt=""
                      className="w-full h-full object-contain"
                    />
                  ) : (
                    <span className="text-[10px] text-zinc-300 dark:text-zinc-600 font-bold">
                      {idx + 1}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Parent Deck Cards */}
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400">
              Parent Deck ({parentCount}/6)
            </span>
            <div className="mt-1.5 grid grid-cols-6 gap-1.5 bg-zinc-100/60 dark:bg-zinc-900/40 p-2 rounded-xl border border-zinc-200/60 dark:border-zinc-800/60">
              {parentCards.map((card, idx) => (
                <div
                  key={idx}
                  className="aspect-square border border-zinc-200/80 dark:border-zinc-700 overflow-hidden bg-white dark:bg-zinc-800 flex items-center justify-center shadow-2xs"
                  title={card ? (card.nameEn || card.nameJp) : `Slot ${idx + 1}: Empty`}
                >
                  {card ? (
                    <img
                      src={card.portraitUrl || card.imgUrl}
                      alt=""
                      className="w-full h-full object-contain"
                    />
                  ) : (
                    <span className="text-[10px] text-zinc-300 dark:text-zinc-600 font-bold">
                      {idx + 1}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-2 border-t border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50 px-5 py-3.5">
          <AppButton variant="secondary"
            type="button"
            onPress={handleDismiss}

          >
            Cancel
          </AppButton>

          <AppButton variant="secondary"
            type="button"
            onPress={handleLoadIntoCurrent}

            title={`Replace active preset "${activePreset.name}" with this build`}
          >
            Load into Current ({activePreset.name})
          </AppButton>

          <AppButton variant="primary"
            type="button"
            onPress={handleSaveAsNew}

          >
            + Save as New Preset
          </AppButton>
        </div>
    </AppDialog>
  );
}
