"use client";

import { DeckProvider } from "@/features/deck";
import { PartnerView } from "@/features/partner";

// DeckProvider gives "Use as borrowed parent" the active preset's Parenting setup.
export default function PartnerPage() {
  return (
    <DeckProvider>
      <PartnerView />
    </DeckProvider>
  );
}
