"use client";

import { useState, useEffect, useMemo } from "react";
import { api, type CardIndexEntry, type CharacterIndexEntry } from "../../lib/api";
import { useOwnedCards } from "../../lib/use-owned-cards";
import { useOwnedUmas } from "../../lib/use-owned-umas";
import ImportModal from "../import-modal";
import type { SubTab, CardTypeKey, OwnershipFilter } from "./types";
import { CardsCollectionTab } from "./cards-collection-tab";
import { CharactersCollectionTab } from "./characters-collection-tab";

export default function CollectionView() {
  const [subTab, setSubTab] = useState<SubTab>("cards");
  const [cards, setCards] = useState<CardIndexEntry[]>([]);
  const [characters, setCharacters] = useState<CharacterIndexEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);

  // Filter states
  const [query, setQuery] = useState("");
  const [cardType, setCardType] = useState<CardTypeKey>("all");
  const [cardRarity, setCardRarity] = useState<number | "all">("all");
  const [charaRarity, setCharaRarity] = useState<number | "all">("all");
  const [ownership, setOwnership] = useState<OwnershipFilter>("all");

  const {
    getLimitBreak,
    setLimitBreak,
    removeCard,
    totalOwned: totalOwnedCards,
    mlbCount,
  } = useOwnedCards();

  const {
    getUmaDetails,
    setUmaDetails,
    removeUma,
    totalOwned: totalOwnedUmas,
    fiveStarCount,
  } = useOwnedUmas();

  useEffect(() => {
    Promise.all([api.listCardIndex(), api.listCharacters()])
      .then(([cList, charaList]) => {
        setCards(cList);
        setCharacters(charaList);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Failed to load collection data:", err);
        setLoading(false);
      });
  }, []);

  // Filtered Cards
  const filteredCards = useMemo(() => {
    const q = query.trim().toLowerCase();
    return cards.filter((card) => {
      // Query filter
      if (q) {
        const nameEn = (card.nameEn || "").toLowerCase();
        const nameJp = (card.nameJp || "").toLowerCase();
        const titleEn = (card.titleEn || "").toLowerCase();
        const charName = (card.charName || "").toLowerCase();
        if (
          !nameEn.includes(q) &&
          !nameJp.includes(q) &&
          !titleEn.includes(q) &&
          !charName.includes(q)
        ) {
          return false;
        }
      }

      // Type filter
      if (cardType !== "all" && card.type !== cardType) {
        if (!(cardType === "intelligence" && card.type === "wit")) {
          return false;
        }
      }

      // Rarity filter
      if (cardRarity !== "all" && card.rarity !== cardRarity) {
        return false;
      }

      // Ownership filter
      const lb = getLimitBreak(card.id);
      if (ownership === "owned" && lb === undefined) return false;
      if (ownership === "unowned" && lb !== undefined) return false;
      if (ownership === "maxed" && lb !== 4) return false;

      return true;
    });
  }, [cards, query, cardType, cardRarity, ownership, getLimitBreak]);

  // Filtered Characters
  const filteredCharacters = useMemo(() => {
    const q = query.trim().toLowerCase();
    return characters.filter((chara) => {
      // Query filter
      if (q) {
        const nameEn = (chara.nameEn || "").toLowerCase();
        const nameJp = (chara.nameJp || "").toLowerCase();
        const titleEn = (chara.titleEn || "").toLowerCase();
        const titleJp = (chara.titleJp || "").toLowerCase();
        if (
          !nameEn.includes(q) &&
          !nameJp.includes(q) &&
          !titleEn.includes(q) &&
          !titleJp.includes(q)
        ) {
          return false;
        }
      }

      // Base rarity filter
      if (charaRarity !== "all" && chara.rarity !== charaRarity) {
        return false;
      }

      // Ownership filter
      const details = getUmaDetails(chara.id);
      if (ownership === "owned" && !details) return false;
      if (ownership === "unowned" && details) return false;
      if (ownership === "maxed" && (!details || details[0] !== 5)) return false;

      return true;
    });
  }, [characters, query, charaRarity, ownership, getUmaDetails]);

  if (loading) {
    return (
      <div className="py-20 flex flex-col items-center justify-center gap-3">
        <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-xs text-zinc-400">Loading collection database...</p>
      </div>
    );
  }

  return (
    <section className="flex flex-col gap-6">
      {/* Top Header & Sub-navigation Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-zinc-200 dark:border-zinc-800 pb-4">
        <div>
          <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
            My Inventory & Collection
          </h2>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Track and configure your owned support cards (limit breaks 0–4★) and playable character costumes.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => setIsImportModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-emerald-500/40 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 text-xs font-semibold hover:bg-emerald-100 dark:hover:bg-emerald-950/70 shadow-2xs cursor-pointer transition-colors"
          >
            <span>📥 Sync / Import Data</span>
          </button>
        </div>
      </div>

      {/* Segmented Switcher + Stats Summary */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
        {/* Segmented Controls */}
        <div className="inline-flex rounded-xl bg-zinc-200/60 dark:bg-zinc-800/60 p-1 border border-zinc-200/80 dark:border-zinc-700/50 shrink-0">
          <button
            type="button"
            onClick={() => {
              setSubTab("cards");
              setQuery("");
            }}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              subTab === "cards"
                ? "bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 shadow-xs"
                : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100"
            }`}
          >
            <span>Support Cards</span>
            <span className="rounded-md bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 px-1.5 py-0.5 text-[10px] font-bold">
              {totalOwnedCards} / {cards.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => {
              setSubTab("characters");
              setQuery("");
            }}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              subTab === "characters"
                ? "bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 shadow-xs"
                : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100"
            }`}
          >
            <span>Playable Characters</span>
            <span className="rounded-md bg-sky-500/15 text-sky-700 dark:text-sky-300 px-1.5 py-0.5 text-[10px] font-bold">
              {totalOwnedUmas} / {characters.length}
            </span>
          </button>
        </div>

        {/* Stats Shelf */}
        <div className="flex items-center gap-3 text-xs">
          {subTab === "cards" ? (
            <>
              <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white/60 dark:bg-zinc-900/60 px-3 py-1.5">
                <span className="text-zinc-500">Owned: </span>
                <strong className="text-zinc-900 dark:text-zinc-100 font-bold">
                  {totalOwnedCards}
                </strong>{" "}
                <span className="text-[10px] text-zinc-400">
                  ({Math.round((totalOwnedCards / (cards.length || 1)) * 100)}%)
                </span>
              </div>
              <div className="rounded-xl border border-amber-500/20 bg-amber-50/50 dark:bg-amber-950/20 px-3 py-1.5 text-amber-700 dark:text-amber-300">
                <span>MLB (4★): </span>
                <strong className="font-bold">{mlbCount}</strong>
              </div>
            </>
          ) : (
            <>
              <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white/60 dark:bg-zinc-900/60 px-3 py-1.5">
                <span className="text-zinc-500">Owned Umas: </span>
                <strong className="text-zinc-900 dark:text-zinc-100 font-bold">
                  {totalOwnedUmas}
                </strong>{" "}
                <span className="text-[10px] text-zinc-400">
                  ({Math.round((totalOwnedUmas / (characters.length || 1)) * 100)}%)
                </span>
              </div>
              <div className="rounded-xl border border-sky-500/20 bg-sky-50/50 dark:bg-sky-950/20 px-3 py-1.5 text-sky-700 dark:text-sky-300">
                <span>Max 5★: </span>
                <strong className="font-bold">{fiveStarCount}</strong>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Filter and Search Toolbar */}
      <div className="flex flex-col gap-3 rounded-2xl border border-zinc-200/90 dark:border-zinc-800/80 bg-white/80 dark:bg-zinc-900/70 p-3.5 shadow-2xs backdrop-blur-xs">
        <div className="flex flex-col sm:flex-row items-center gap-3">
          {/* Search Box */}
          <div className="relative w-full sm:flex-1">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={
                subTab === "cards"
                  ? "Search cards by character, title, or Japanese name..."
                  : "Search characters by name or costume title..."
              }
              className="w-full rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50/70 dark:bg-zinc-950 px-3 py-2 text-xs text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 outline-hidden focus:border-emerald-500 transition-colors"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 text-xs"
              >
                ✕
              </button>
            )}
          </div>

          {/* Ownership Filter */}
          <div className="flex items-center gap-1 shrink-0 overflow-x-auto w-full sm:w-auto">
            {(
              [
                { id: "all", label: "All" },
                { id: "owned", label: "Owned" },
                { id: "unowned", label: "Unowned" },
                { id: "maxed", label: subTab === "cards" ? "MLB Only" : "5★ Only" },
              ] as const
            ).map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setOwnership(f.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition-colors ${
                  ownership === f.id
                    ? "bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 shadow-2xs font-semibold"
                    : "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {subTab === "cards" ? (
          <CardsCollectionTab
            filteredCards={filteredCards}
            cardType={cardType}
            onCardTypeChange={setCardType}
            cardRarity={cardRarity}
            onCardRarityChange={setCardRarity}
            getLimitBreak={getLimitBreak}
            onSetLimitBreak={setLimitBreak}
            onRemoveCard={removeCard}
          />
        ) : (
          <CharactersCollectionTab
            filteredCharacters={filteredCharacters}
            totalCharactersCount={characters.length}
            charaRarity={charaRarity}
            onCharaRarityChange={setCharaRarity}
            getUmaDetails={getUmaDetails}
            onSetUmaDetails={setUmaDetails}
            onRemoveUma={removeUma}
          />
        )}
      </div>

      {/* Import Modal */}
      <ImportModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
      />
    </section>
  );
}
