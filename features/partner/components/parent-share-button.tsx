"use client";

import { AppButton } from "@/app/common/ui/controls/app-button";
import { LinkIcon } from "@/app/common/ui/primitives/icons";
import { charactersById } from "@/lib/api";
import type { KyumaruVeteranItem } from "@/lib/veterans/types";
import { useParentShareViewModel } from "../view-models/use-parent-share-view-model";
import { PartnerShareSheet } from "./partner-share-sheet";

/** Parenting toolbar entry point: share your own P1/P2 as a Partner Card. Hidden when neither qualifies. */
export function ParentShareButton({
  parent1,
  p1IsBorrow,
  parent2,
  p2IsBorrow,
  className = "",
}: {
  parent1: KyumaruVeteranItem | null;
  p1IsBorrow: boolean;
  parent2: KyumaruVeteranItem | null;
  p2IsBorrow: boolean;
  className?: string;
}) {
  const { state, commands } = useParentShareViewModel(parent1, p1IsBorrow, parent2, p2IsBorrow);
  if (state.choices.length === 0) return null;

  const nameOf = (vet: KyumaruVeteranItem) => charactersById.get(vet.card_id)?.nameEn ?? `Chara ${vet.card_id}`;

  return (
    <>
      <AppButton variant="quiet" onPress={commands.open} className={className} title="Share one of your parents as a partner card friends can borrow">
        <LinkIcon className="h-4 w-4" />
        <span>Share Parent</span>
      </AppButton>
      <PartnerShareSheet
        vm={state.share}
        umaName={state.selected ? nameOf(state.selected.veteran) : "this uma"}
        choices={state.choices.map((c) => ({ id: c.slot, label: `${c.label} · ${nameOf(c.veteran)}` }))}
        selectedChoice={state.selected?.slot}
        onSelectChoice={(id) => commands.selectSlot(id as "p1" | "p2")}
      />
    </>
  );
}
