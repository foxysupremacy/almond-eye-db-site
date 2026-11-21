"use client";

import { useEffect, useState } from "react";
import { AppButton } from "@/app/common/ui/controls/app-button";
import { LoadingAnimation } from "@/app/common/ui/controls/loading-animation";
import { DownloadIcon, LineageIcon, LinkIcon } from "@/app/common/ui/primitives/icons";
import { CharacterPickerModal } from "@/features/parenting";
import { PartnerCard, PartnerSectionToggles } from "./components/partner-card";
import { partnerCodeFromHash, usePartnerCardViewModel } from "./view-models";

function useHashCode(): string | null | undefined {
  const [code, setCode] = useState<string | null | undefined>(undefined);
  useEffect(() => {
    const read = () => setCode(partnerCodeFromHash(window.location.hash));
    read();
    window.addEventListener("hashchange", read);
    return () => window.removeEventListener("hashchange", read);
  }, []);
  return code;
}

function PartnerScreen({ code }: { code: string | null }) {
  const { state, commands } = usePartnerCardViewModel(code);

  if (state.status === "loading") {
    return <LoadingAnimation active label="Opening partner card..." size="md" fill={false} className="py-16" />;
  }

  if (state.status === "invalid" || !state.model) {
    return (
      <div className="py-16 text-center">
        <h1 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">This partner link doesn't work</h1>
        <p className="mx-auto mt-2 max-w-sm text-sm text-zinc-500 dark:text-zinc-400">
          The link may be cut off or changed. Ask the sender to copy it again from their Trained Umas tab.
        </p>
        <a href="/" className="mt-5 inline-block text-sm font-semibold text-emerald-700 hover:underline dark:text-emerald-400">
          Go to the deck builder
        </a>
      </div>
    );
  }

  return (
    <>
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <PartnerSectionToggles shared={state.sharedSections} visible={state.visibleSections} onToggle={commands.toggleSection} />
        <div className="flex flex-wrap items-center gap-1.5">
          <AppButton variant="secondary" onPress={commands.copyLink}>
            <LinkIcon className="h-3.5 w-3.5" /> Copy link
          </AppButton>
          <AppButton variant="secondary" onPress={commands.downloadPng} isDisabled={state.isExporting}>
            <DownloadIcon className="h-3.5 w-3.5" /> {state.isExporting ? "Saving..." : "Download PNG"}
          </AppButton>
          <AppButton variant="primary" onPress={commands.useAsBorrowedParent} isDisabled={!state.canBorrow}>
            <LineageIcon className="h-3.5 w-3.5" /> Use as borrowed parent
          </AppButton>
        </div>
      </div>

      <PartnerCard
        model={state.model}
        sections={state.visibleSections}
        affinity={state.affinity}
        trainee={state.trainee}
        onPickTrainee={commands.openTraineePicker}
      />

      <CharacterPickerModal
        isOpen={state.isTraineePickerOpen}
        onClose={commands.closeTraineePicker}
        characters={state.characters}
        onSelect={commands.selectTrainee}
        title="Affinity with which trainee?"
      />

      {state.notice && (
        <div role="status" className="fixed inset-x-0 bottom-6 z-[300] mx-auto w-fit rounded-lg bg-zinc-900 px-3 py-2 text-xs font-semibold text-white shadow-lg animate-in fade-in slide-in-from-bottom-2 duration-200 ease-out-quart dark:bg-zinc-100 dark:text-zinc-900">
          {state.notice}
        </div>
      )}
    </>
  );
}

/** `/partner#v=…` — read-only Partner Card for a shared trained uma. */
export default function PartnerView() {
  const code = useHashCode();
  return (
    <div className="mx-auto w-full min-w-0 max-w-3xl px-4 py-8 sm:px-6">
      <div className="mb-6 flex items-center justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-widest text-emerald-700 dark:text-emerald-400">Partner Card</p>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">A trained uma shared from Almond Eye DB</p>
        </div>
        <a href="/" className="text-xs font-semibold text-zinc-600 hover:underline dark:text-zinc-300">
          Almond Eye DB
        </a>
      </div>
      {code === undefined ? (
        <LoadingAnimation active label="Opening partner card..." size="md" fill={false} className="py-16" />
      ) : (
        <PartnerScreen code={code} />
      )}
    </div>
  );
}
