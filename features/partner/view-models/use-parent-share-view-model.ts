"use client";

import { useMemo, useState } from "react";
import type { KyumaruVeteranItem } from "@/lib/veterans/types";
import { listShareableParents, type ShareableParent } from "../model/shareable-parents";
import { usePartnerShareViewModel, type PartnerShareViewModel } from "./use-partner-share-view-model";

export interface ParentShareViewModel {
  readonly state: {
    readonly choices: ShareableParent[];
    readonly selected: ShareableParent | null;
    readonly share: PartnerShareViewModel;
  };
  readonly commands: {
    readonly open: () => void;
    readonly selectSlot: (slot: ShareableParent["slot"]) => void;
  };
}

/** Share one of the Parenting Hub's own trained parents (P1/P2) as a Partner Card. */
export function useParentShareViewModel(
  parent1: KyumaruVeteranItem | null,
  p1IsBorrow: boolean,
  parent2: KyumaruVeteranItem | null,
  p2IsBorrow: boolean,
): ParentShareViewModel {
  const choices = useMemo(() => listShareableParents(parent1, p1IsBorrow, parent2, p2IsBorrow), [parent1, p1IsBorrow, parent2, p2IsBorrow]);
  const [slot, setSlot] = useState<ShareableParent["slot"]>("p1");
  const selected = choices.find((c) => c.slot === slot) ?? choices[0] ?? null;
  const share = usePartnerShareViewModel(selected?.veteran ?? null);

  return {
    state: { choices, selected, share },
    commands: {
      open: () => {
        if (choices[0] && !choices.some((c) => c.slot === slot)) setSlot(choices[0].slot);
        share.commands.open();
      },
      selectSlot: setSlot,
    },
  };
}
