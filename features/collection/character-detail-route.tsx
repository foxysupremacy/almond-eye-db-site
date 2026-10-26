"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Link as AriaLink } from "react-aria-components/Link";
import { api, type CharacterIndexEntry } from "@/lib/api";
import { useOwnedUmas } from "@/app/common/hooks/use-owned-umas";
import { LoadingAnimation } from "@/app/common/ui/controls/loading-animation";
import { ChevronLeftIcon } from "@/app/common/ui/primitives/icons";
import { CharacterDetailSheet } from "./components/character-detail-sheet";
import { NotFoundDetail } from "./support-detail-route";
import { parseCollectionRouteId, relatedCostumes } from "./model/routes";

export function CharacterDetailRoute() {
  const params = useParams<{ costumeId?: string }>();
  const router = useRouter();
  const costumeId = parseCollectionRouteId(params.costumeId);
  const [characters, setCharacters] = useState<CharacterIndexEntry[] | null>(null);
  const { getUmaDetails, setUmaDetails, removeUma } = useOwnedUmas();

  useEffect(() => { api.listCharacters().then(setCharacters).catch(() => setCharacters([])); }, []);
  const character = useMemo(() => costumeId === null ? null : characters?.find((entry) => entry.id === costumeId) ?? null, [characters, costumeId]);
  const alternatives = useMemo(() => character && characters ? relatedCostumes(characters, character) : [], [character, characters]);

  const loading = characters === null;

  return (
    <div className="relative">
      {!loading && character && (
        <div className="flex flex-col gap-4">
          <div>
            <AriaLink
              href="/characters"
              className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors w-fit"
            >
              <ChevronLeftIcon className="h-4 w-4" /> Back to Characters
            </AriaLink>
          </div>

          {alternatives.length > 0 && (
            <section className="flex flex-col gap-2">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                <h2 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                  Other costumes
                </h2>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  Other playable variants for {character.nameEn}.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {alternatives.map((alternative) => (
                  <AriaLink
                    key={alternative.id}
                    href={`/characters/${alternative.id}`}
                    className="inline-flex max-w-full items-center gap-2 rounded-lg border border-zinc-200/80 bg-zinc-50/60 px-2.5 py-1.5 text-xs font-semibold text-zinc-700 transition-colors hover:border-emerald-500/50 hover:bg-emerald-50/40 hover:text-emerald-700 dark:border-zinc-800 dark:bg-zinc-800/50 dark:text-zinc-300 dark:hover:text-emerald-300"
                  >
                    <img
                      src={alternative.imgUrl}
                      alt=""
                      className="h-6 w-6 flex-none object-contain"
                    />
                    <span className="min-w-0 truncate">
                      {alternative.titleEn || alternative.titleJp || alternative.nameEn}
                    </span>
                  </AriaLink>
                ))}
              </div>
            </section>
          )}

          <CharacterDetailSheet
            page
            character={character}
            isOpen
            onClose={() => router.push("/characters")}
            details={getUmaDetails(character.id)}
            onSetUmaDetails={setUmaDetails}
            onRemoveUma={removeUma}
          />
        </div>
      )}
      {!loading && !character && <NotFoundDetail backHref="/characters" backLabel="Back to Characters" label="character costume" />}
      <LoadingAnimation active={loading} label="Loading character..." />
    </div>
  );
}
