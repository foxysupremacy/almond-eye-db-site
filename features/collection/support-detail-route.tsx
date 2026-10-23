"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Link as AriaLink } from "react-aria-components/Link";
import { api, type CardIndexEntry } from "@/lib/api";
import { useOwnedCards } from "@/app/common/hooks/use-owned-cards";
import { ChevronLeftIcon } from "@/app/common/ui/primitives/icons";
import { SupportCardDetailSheet } from "./components/support-card-detail-sheet";
import { parseCollectionRouteId } from "./model/routes";

export function SupportDetailRoute() {
  const params = useParams<{ cardId?: string }>();
  const router = useRouter();
  const cardId = parseCollectionRouteId(params.cardId);
  const [cards, setCards] = useState<CardIndexEntry[] | null>(null);
  const { getLimitBreak, setLimitBreak, removeCard } = useOwnedCards();

  useEffect(() => { api.listCardIndex().then(setCards).catch(() => setCards([])); }, []);
  const card = useMemo(() => cardId === null ? null : cards?.find((entry) => entry.id === cardId) ?? null, [cardId, cards]);

  if (cards === null) return <LoadingDetail label="Loading support card..." />;
  if (!card) return <NotFoundDetail backHref="/supports" backLabel="Back to Supports" label="support card" />;

  return (
    <div className="flex flex-col gap-4">
      <div>
        <AriaLink
          href="/supports"
          className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors w-fit"
        >
          <ChevronLeftIcon className="h-4 w-4" /> Back to Supports
        </AriaLink>
      </div>

      <SupportCardDetailSheet
        page
        card={card}
        isOpen
        onClose={() => router.push("/supports")}
        limitBreak={getLimitBreak(card.id)}
        onSetLimitBreak={setLimitBreak}
        onRemoveCard={removeCard}
      />
    </div>
  );
}

function LoadingDetail({ label }: { label: string }) {
  return <div className="flex min-h-64 flex-col items-center justify-center gap-3"><div className="h-8 w-8 animate-spin rounded-full border-4 border-emerald-500 border-t-transparent" /><p className="text-xs text-zinc-400">{label}</p></div>;
}

export function NotFoundDetail({ backHref, backLabel, label }: { backHref: string; backLabel: string; label: string }) {
  return <section className="rounded-2xl border border-zinc-200 bg-white p-10 text-center shadow-2xs dark:border-zinc-800 dark:bg-zinc-900"><h1 className="text-lg font-bold">Unknown {label}</h1><p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">This link does not match an entry in the bundled database.</p><AriaLink href={backHref} className="mt-5 inline-flex rounded-lg bg-emerald-700 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-800">{backLabel}</AriaLink></section>;
}
