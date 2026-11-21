"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { charactersById, type CharacterIndexEntry } from "@/lib/api";
import type { AffinityCalculationResult } from "@/lib/lineage/affinity-engine";
import { applyBorrowedParent } from "@/lib/parenting/borrow";
import { decodePartner, type PartnerSection, type SharedPartner } from "@/lib/veterans/share/partner-codec";
import { useParentingSetup } from "@/features/parenting/hooks";
import {
  buildPartnerCardModel,
  computePartnerAffinity,
  visiblePartnerSections,
  type PartnerCardModel,
} from "../model/partner-card-model";

export type PartnerCardStatus = "loading" | "ready" | "invalid";

export interface PartnerCardViewModel {
  readonly state: {
    readonly status: PartnerCardStatus;
    readonly model: PartnerCardModel | null;
    readonly sharedSections: readonly PartnerSection[];
    readonly visibleSections: readonly PartnerSection[];
    readonly trainee: CharacterIndexEntry | null;
    readonly affinity: AffinityCalculationResult | null;
    readonly characters: CharacterIndexEntry[];
    readonly isTraineePickerOpen: boolean;
    readonly isExporting: boolean;
    readonly canBorrow: boolean;
    readonly notice: string | null;
  };
  readonly commands: {
    readonly toggleSection: (section: PartnerSection) => void;
    readonly openTraineePicker: () => void;
    readonly closeTraineePicker: () => void;
    readonly selectTrainee: (chara: CharacterIndexEntry) => void;
    readonly downloadPng: () => void;
    readonly copyLink: () => void;
    readonly useAsBorrowedParent: () => void;
  };
}

/** Reads the `v=` value from a `/partner#v=…` hash. */
export function partnerCodeFromHash(hash: string): string | null {
  const match = /^#?v=([A-Za-z0-9_-]+)$/.exec(hash.trim());
  return match ? match[1] : null;
}

export function usePartnerCardViewModel(code: string | null): PartnerCardViewModel {
  const { setup, loaded: setupLoaded, updateSetup } = useParentingSetup();
  const [partner, setPartner] = useState<SharedPartner | null>(null);
  const [status, setStatus] = useState<PartnerCardStatus>("loading");
  const [hidden, setHidden] = useState<ReadonlySet<PartnerSection>>(new Set());
  const [traineeOverride, setTraineeOverride] = useState<CharacterIndexEntry | null>(null);
  const [isTraineePickerOpen, setTraineePickerOpen] = useState(false);
  const [isExporting, setExporting] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [pendingBorrow, setPendingBorrow] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!code) {
      setStatus("invalid");
      return;
    }
    setStatus("loading");
    decodePartner(code).then((decoded) => {
      if (cancelled) return;
      setPartner(decoded);
      setStatus(decoded ? "ready" : "invalid");
    });
    return () => {
      cancelled = true;
    };
  }, [code]);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(null), 2500);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const model = useMemo(() => (partner ? buildPartnerCardModel(partner.veteran) : null), [partner]);
  const sharedSections = useMemo<readonly PartnerSection[]>(() => partner?.sections ?? [], [partner]);
  const visibleSections = useMemo(() => visiblePartnerSections(sharedSections, hidden), [sharedSections, hidden]);
  const characters = useMemo(() => [...charactersById.values()], []);

  const trainee = useMemo(() => {
    if (traineeOverride) return traineeOverride;
    if (setup.targetCharaCardId) return charactersById.get(setup.targetCharaCardId) ?? null;
    if (setup.targetCharaId) return characters.find((c) => c.charId === setup.targetCharaId) ?? null;
    return null;
  }, [traineeOverride, setup.targetCharaCardId, setup.targetCharaId, characters]);

  const affinity = useMemo(
    () => (partner && sharedSections.includes("affinity") ? computePartnerAffinity(partner.veteran, trainee?.charId ?? null) : null),
    [partner, sharedSections, trainee],
  );

  const toggleSection = useCallback((section: PartnerSection) => {
    setHidden((prev) => {
      const next = new Set(prev);
      if (next.has(section)) next.delete(section);
      else next.add(section);
      return next;
    });
  }, []);

  const selectTrainee = useCallback((chara: CharacterIndexEntry) => {
    setTraineeOverride(chara);
    setTraineePickerOpen(false);
  }, []);

  const downloadPng = useCallback(() => {
    if (!model || isExporting) return;
    setExporting(true);
    import("../rendering/partner-card-canvas")
      .then(({ downloadPartnerCardPng }) => downloadPartnerCardPng(model, visibleSections, affinity, trainee?.nameEn ?? null))
      .then((result) => setNotice(result.missingImages > 0 ? "Image saved. Some artwork couldn't be embedded." : "Image saved."))
      .catch(() => setNotice("Couldn't create the image."))
      .finally(() => setExporting(false));
  }, [model, isExporting, visibleSections, affinity, trainee]);

  const copyLink = useCallback(() => {
    navigator.clipboard
      ?.writeText(window.location.href)
      .then(() => setNotice("Link copied."))
      .catch(() => setNotice("Couldn't copy the link."));
  }, []);

  const useAsBorrowedParent = useCallback(() => {
    if (!partner || !setupLoaded) return;
    updateSetup((prev) => applyBorrowedParent(prev, partner.veteran));
    setPendingBorrow(true);
  }, [partner, setupLoaded, updateSetup]);

  // Navigate only once the borrowed parent is committed. The provider persists
  // presets in its own (parent) effect, which runs after this one, so defer.
  useEffect(() => {
    if (!pendingBorrow || !partner || !setup.p2IsBorrow || setup.parent2?.card_id !== partner.veteran.card_id) return;
    const timer = window.setTimeout(() => window.location.assign("/#parenting"), 0);
    return () => window.clearTimeout(timer);
  }, [pendingBorrow, partner, setup.parent2, setup.p2IsBorrow]);

  return {
    state: {
      status,
      model,
      sharedSections,
      visibleSections,
      trainee,
      affinity,
      characters,
      isTraineePickerOpen,
      isExporting,
      canBorrow: status === "ready" && setupLoaded && !pendingBorrow,
      notice,
    },
    commands: {
      toggleSection,
      openTraineePicker: () => setTraineePickerOpen(true),
      closeTraineePicker: () => setTraineePickerOpen(false),
      selectTrainee,
      downloadPng,
      copyLink,
      useAsBorrowedParent,
    },
  };
}
