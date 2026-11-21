"use client";

import { useCallback, useEffect, useState } from "react";
import { ALL_PARTNER_SECTIONS, encodePartner, type PartnerSection } from "@/lib/veterans/share/partner-codec";
import type { KyumaruVeteranItem } from "@/lib/veterans/types";

export function buildPartnerShareUrl(origin: string, code: string): string {
  return `${origin.replace(/\/+$/, "")}/partner#v=${code}`;
}

/** The sharer has no trainee to compare against, so their PNG omits Affinity. */
export function sharePngSections(sections: readonly PartnerSection[]): PartnerSection[] {
  return sections.filter((s) => s !== "affinity");
}

export interface PartnerShareViewModel {
  readonly state: {
    readonly isOpen: boolean;
    readonly sections: readonly PartnerSection[];
    readonly link: string | null;
    readonly isEncoding: boolean;
    readonly copied: boolean;
    readonly isExporting: boolean;
    readonly exportNotice: string | null;
  };
  readonly commands: {
    readonly open: () => void;
    readonly close: () => void;
    readonly toggleSection: (section: PartnerSection) => void;
    readonly copyLink: () => void;
    readonly openPreview: () => void;
    readonly downloadPng: () => void;
  };
}

export function usePartnerShareViewModel(veteran: KyumaruVeteranItem | null): PartnerShareViewModel {
  const [isOpen, setOpen] = useState(false);
  const [sections, setSections] = useState<readonly PartnerSection[]>(ALL_PARTNER_SECTIONS);
  const [link, setLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [isExporting, setExporting] = useState(false);
  const [exportNotice, setExportNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || !veteran) return;
    let cancelled = false;
    setLink(null);
    setCopied(false);
    encodePartner(veteran, sections)
      .then((code) => {
        if (!cancelled) setLink(buildPartnerShareUrl(window.location.origin, code));
      })
      .catch(() => {
        if (!cancelled) setLink(null);
      });
    return () => {
      cancelled = true;
    };
  }, [isOpen, veteran, sections]);

  const toggleSection = useCallback((section: PartnerSection) => {
    setSections((prev) =>
      prev.includes(section) ? prev.filter((s) => s !== section) : ALL_PARTNER_SECTIONS.filter((s) => s === section || prev.includes(s)),
    );
  }, []);

  const copyLink = useCallback(() => {
    if (!link) return;
    navigator.clipboard?.writeText(link).then(() => setCopied(true), () => setCopied(false));
  }, [link]);

  const downloadPng = useCallback(() => {
    if (!veteran || isExporting) return;
    setExporting(true);
    setExportNotice(null);
    Promise.all([import("../model/partner-card-model"), import("../rendering/partner-card-canvas")])
      .then(([{ buildPartnerCardModel }, { downloadPartnerCardPng }]) =>
        downloadPartnerCardPng(buildPartnerCardModel(veteran), sharePngSections(sections), null, null),
      )
      .then((result) => setExportNotice(result.missingImages > 0 ? "Saved. Some artwork couldn't be embedded." : "Saved."))
      .catch(() => setExportNotice("Couldn't create the image."))
      .finally(() => setExporting(false));
  }, [veteran, sections, isExporting]);

  const openPreview = useCallback(() => {
    if (link) window.open(link, "_blank", "noopener");
  }, [link]);

  return {
    state: { isOpen, sections, link, isEncoding: isOpen && !!veteran && !link, copied, isExporting, exportNotice },
    commands: {
      open: () => setOpen(true),
      close: () => setOpen(false),
      toggleSection,
      copyLink,
      openPreview,
      downloadPng,
    },
  };
}
