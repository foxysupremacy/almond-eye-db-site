"use client";

// Share Modal: Displays ultra-compact share URL, build overview, and 1-click clipboard copy.

import { useState, useMemo, useEffect } from "react";
import { createPortal } from "react-dom";
import { useDeck } from "./store";
import type { DeckPreset } from "../lib/deck/types";
import { RUNNING_STYLE_LABELS } from "../lib/deck/constants";
import { buildShareUrl } from "../lib/share-codec";
import CardTypeIcon, { formatCardType } from "./card-type-icon";
import { XIcon, CheckIcon, ClipboardIcon } from "./icons";
import { useBodyScrollLock } from "../lib/use-body-scroll-lock";

export default function ShareModal({
  preset,
  isOpen,
  onClose,
}: {
  preset?: DeckPreset;
  isOpen: boolean;
  onClose: () => void;
}) {
  useBodyScrollLock(isOpen);
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);
  const { activePreset, allCards, tracks, trackDetail, course } = useDeck();
  const targetPreset = preset || activePreset;

  const [copied, setCopied] = useState(false);
  const [copiedSummary, setCopiedSummary] = useState(false);

  const cardsById = useMemo(() => {
    const map = new Map<number, NonNullable<(typeof allCards)>[0]>();
    if (allCards) {
      for (const c of allCards) map.set(c.id, c);
    }
    return map;
  }, [allCards]);

  const shareUrl = useMemo(() => {
    return buildShareUrl(targetPreset);
  }, [targetPreset]);

  if (!isOpen || !mounted) return null;

  const mainCards = targetPreset.mainDeckIds.map((id) => (id ? cardsById.get(id) : null));
  const parentCards = targetPreset.parentDeckIds.map((id) => (id ? cardsById.get(id) : null));

  const trackName = tracks?.find((t) => t.id === targetPreset.trackInfo.trackId)?.nameJa || "Track";
  const courseLength = course?.distance || 2400;
  const styleLabel = targetPreset.trackInfo.runningStyle
    ? RUNNING_STYLE_LABELS[targetPreset.trackInfo.runningStyle]
    : "Any Style";

  const mainCount = targetPreset.mainDeckIds.filter(Boolean).length;
  const parentCount = targetPreset.parentDeckIds.filter(Boolean).length;

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
      const input = document.getElementById("share-url-input") as HTMLInputElement;
      if (input) {
        input.select();
        document.execCommand("copy");
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
    }
  }

  async function handleCopySummary() {
    const text = `${targetPreset.name} | ${trackName} ${courseLength}m (${styleLabel})\nMain Deck: ${mainCount}/6 | Parent Deck: ${parentCount}/6\n${shareUrl}`;
    try {
      await navigator.clipboard.writeText(text);
      setCopiedSummary(true);
      setTimeout(() => setCopiedSummary(false), 2000);
    } catch {}
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[250] flex items-center justify-center bg-black/60 p-3 sm:p-4 backdrop-blur-xs animate-in fade-in duration-200 ease-out-quart touch-none overscroll-none"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 shadow-2xl animate-in zoom-in-95 duration-200 ease-out-expo text-left touch-auto overscroll-contain"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800/80 px-5 py-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-base font-bold text-zinc-900 dark:text-zinc-100">
                Share Build
              </span>
              <span className="rounded bg-emerald-100 dark:bg-emerald-950/80 px-2 py-0.5 text-[10px] font-bold text-emerald-800 dark:text-emerald-300 uppercase">
                Compact URL
              </span>
            </div>
            <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400 truncate max-w-[340px]">
              {targetPreset.name}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-700 dark:hover:text-zinc-200 cursor-pointer"
          >
            <XIcon className="h-4 w-4" />
          </button>
        </div>

        {/* Build Preview Cards */}
        <div className="p-5 space-y-4 overflow-y-auto overscroll-contain max-h-[70vh] touch-auto">
          {/* Track and Style Pill */}
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-zinc-200/80 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-900/60 p-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">
                {trackName} {courseLength}m
              </span>
              <span className="rounded bg-zinc-200/80 dark:bg-zinc-800 px-1.5 py-0.5 text-[10px] font-medium text-zinc-600 dark:text-zinc-300">
                {styleLabel}
              </span>
            </div>
            <span className="text-[11px] text-zinc-400 dark:text-zinc-500">
              {targetPreset.trackInfo.racerCount} racers
            </span>
          </div>

          {/* Main Deck Preview */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                Main Deck ({mainCount}/6)
              </span>
            </div>
            <div className="grid grid-cols-6 gap-1.5 bg-zinc-100/60 dark:bg-zinc-900/40 p-2 rounded-xl border border-zinc-200/60 dark:border-zinc-800/60">
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

          {/* Parent Deck Preview */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400">
                Parent Deck ({parentCount}/6)
              </span>
            </div>
            <div className="grid grid-cols-6 gap-1.5 bg-zinc-100/60 dark:bg-zinc-900/40 p-2 rounded-xl border border-zinc-200/60 dark:border-zinc-800/60">
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

          {/* Link Box */}
          <div className="space-y-2 pt-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                Shareable Link:
              </label>
              <span className="text-[10px] font-mono text-zinc-400 dark:text-zinc-500">
                Length: {shareUrl.length} chars
              </span>
            </div>

            <div className="flex items-center gap-2">
              <input
                id="share-url-input"
                type="text"
                readOnly
                value={shareUrl}
                onClick={(e) => (e.target as HTMLInputElement).select()}
                className="flex-1 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 px-3 py-2 text-xs font-mono text-zinc-800 dark:text-zinc-200 outline-none select-all"
              />
              <button
                type="button"
                onClick={handleCopy}
                className={`rounded-xl px-4 py-2 text-xs font-semibold transition-all shadow-xs cursor-pointer shrink-0 ${
                  copied
                    ? "bg-emerald-600 text-white"
                    : "bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-200 active:scale-[0.98]"
                }`}
              >
                {copied ? (
                  <span className="inline-flex items-center gap-1.5">
                    <CheckIcon className="h-3.5 w-3.5" />
                    Copied!
                  </span>
                ) : (
                  "Copy Link"
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between border-t border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50 px-5 py-3">
          <button
            type="button"
            onClick={handleCopySummary}
            className="text-xs font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 cursor-pointer"
            title="Copy build title, cards count, track info and link"
          >
            {copiedSummary ? (
              <span className="inline-flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
                <CheckIcon className="h-3.5 w-3.5" />
                Summary Copied!
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5">
                <ClipboardIcon className="h-3.5 w-3.5" />
                Copy Build Summary
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3.5 py-1.5 text-xs font-semibold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-700 cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
