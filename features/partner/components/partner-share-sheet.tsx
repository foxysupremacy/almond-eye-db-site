"use client";

import { ToggleButton, ToggleButtonGroup } from "react-aria-components/ToggleButtonGroup";
import { AppDialog } from "@/app/common/ui/controls/app-dialog";
import { AppButton } from "@/app/common/ui/controls/app-button";
import { CheckIcon, CopyIcon, DownloadIcon, LinkIcon } from "@/app/common/ui/primitives/icons";
import { ALL_PARTNER_SECTIONS } from "@/lib/veterans/share/partner-codec";
import type { PartnerShareViewModel } from "../view-models/use-partner-share-view-model";
import { PartnerSectionToggles, SEGMENT_CLASS, SEGMENT_GROUP_CLASS } from "./partner-card";

export interface PartnerShareChoice {
  readonly id: string;
  readonly label: string;
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <p className="mb-2 text-xs font-semibold text-zinc-700 dark:text-zinc-300">{children}</p>;
}

/** Share sheet for one trained uma: choose sections, copy the /partner link or save a PNG. */
export function PartnerShareSheet({
  vm,
  umaName,
  choices,
  selectedChoice,
  onSelectChoice,
}: {
  vm: PartnerShareViewModel;
  umaName: string;
  /** Optional uma switcher, e.g. Parent 1 / Parent 2 from the Parenting Hub. */
  choices?: readonly PartnerShareChoice[];
  selectedChoice?: string;
  onSelectChoice?: (id: string) => void;
}) {
  const { state, commands } = vm;
  return (
    <AppDialog
      isOpen={state.isOpen}
      onOpenChange={(open) => { if (!open) commands.close(); }}
      title="Share partner card"
      ariaLabel="Share partner card"
      size="sm"
      overlayLayer="inspection"
      bodyClassName="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-4"
      footer={
        <div className="flex flex-wrap items-center justify-between gap-2">
          <AppButton variant="quiet" onPress={commands.openPreview} isDisabled={!state.link}>
            <LinkIcon className="h-3.5 w-3.5" /> Open preview
          </AppButton>
          <div className="flex items-center gap-2">
            {state.exportNotice && <span role="status" className="text-[11px] text-zinc-500 dark:text-zinc-400">{state.exportNotice}</span>}
            <AppButton variant="secondary" onPress={commands.downloadPng} isDisabled={state.isExporting}>
              <DownloadIcon className="h-3.5 w-3.5" /> {state.isExporting ? "Saving..." : "Download PNG"}
            </AppButton>
          </div>
        </div>
      }
    >
      <div className="space-y-5">
        <p className="text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
          Anyone with the link can view <span className="font-semibold text-zinc-900 dark:text-zinc-100">{umaName}</span> and use it as a borrowed parent. Your trainer name and ID are never included.
        </p>

        {choices && choices.length > 1 && (
          <div>
            <FieldLabel>Uma</FieldLabel>
            <ToggleButtonGroup
              aria-label="Uma to share"
              selectionMode="single"
              disallowEmptySelection
              selectedKeys={selectedChoice ? new Set([selectedChoice]) : new Set()}
              onSelectionChange={(keys) => {
                const [id] = [...keys];
                if (id != null) onSelectChoice?.(String(id));
              }}
              className={SEGMENT_GROUP_CLASS}
            >
              {choices.map((choice) => (
                <ToggleButton key={choice.id} id={choice.id} className={`${SEGMENT_CLASS} max-w-[14rem] truncate`}>
                  {choice.label}
                </ToggleButton>
              ))}
            </ToggleButtonGroup>
          </div>
        )}

        <div>
          <FieldLabel>Include</FieldLabel>
          <PartnerSectionToggles shared={ALL_PARTNER_SECTIONS} visible={state.sections} onToggle={commands.toggleSection} />
          <p className="mt-2 text-[11px] leading-snug text-zinc-400 dark:text-zinc-500">
            Stats and aptitudes are always shown. Turned-off sections are left out of the link and the image.
          </p>
        </div>

        <div>
          <FieldLabel>Link</FieldLabel>
          <div className="flex min-w-0 items-center gap-2">
            <input
              readOnly
              aria-label="Partner card link"
              value={state.link ?? "Creating link..."}
              onFocus={(e) => e.currentTarget.select()}
              className="min-h-11 min-w-0 flex-1 truncate rounded-lg border border-zinc-200 bg-zinc-50 px-3 text-xs text-zinc-600 outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/70 md:min-h-9 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300"
            />
            <AppButton variant="primary" size="md" onPress={commands.copyLink} isDisabled={!state.link}>
              {state.copied ? <CheckIcon className="h-3.5 w-3.5" /> : <CopyIcon className="h-3.5 w-3.5" />}
              {state.copied ? "Copied" : "Copy"}
            </AppButton>
          </div>
        </div>
      </div>
    </AppDialog>
  );
}
