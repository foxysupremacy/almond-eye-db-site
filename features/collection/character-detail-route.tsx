"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Link as AriaLink } from "react-aria-components/Link";
import { api, type CharacterIndexEntry } from "@/lib/api";
import { useOwnedUmas } from "@/app/common/hooks/use-owned-umas";
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

  if (characters === null) return <div className="flex min-h-64 flex-col items-center justify-center gap-3"><div className="h-8 w-8 animate-spin rounded-full border-4 border-sky-500 border-t-transparent" /><p className="text-xs text-zinc-400">Loading character...</p></div>;
  if (!character) return <NotFoundDetail backHref="/characters" backLabel="Back to Characters" label="character costume" />;

  return <div className="flex flex-col gap-6">
    <CharacterDetailSheet page character={character} isOpen onClose={() => router.push("/characters")} details={getUmaDetails(character.id)} onSetUmaDetails={setUmaDetails} onRemoveUma={removeUma} />
    {alternatives.length > 0 && <section className="border-t border-zinc-200 pt-5 dark:border-zinc-800"><h2 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">Other costumes</h2><p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">Other playable variants for {character.nameEn}.</p><div className="mt-3 flex flex-wrap gap-2">{alternatives.map((alternative) => <AriaLink key={alternative.id} href={`/characters/${alternative.id}`} className="inline-flex max-w-full items-center gap-2 rounded-lg border border-zinc-200 px-2.5 py-2 text-xs font-semibold text-zinc-700 transition-colors hover:border-emerald-500/50 hover:text-emerald-700 dark:border-zinc-800 dark:text-zinc-300 dark:hover:text-emerald-300"><img src={alternative.imgUrl} alt="" className="h-7 w-7 flex-none object-contain" /><span className="min-w-0 truncate">{alternative.titleEn || alternative.titleJp || alternative.nameEn}</span></AriaLink>)}</div></section>}
  </div>;
}
