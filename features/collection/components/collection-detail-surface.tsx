import type { ReactNode } from "react";
import { AppDialog } from "@/app/common/ui/controls/app-dialog";

interface CollectionDetailSurfaceProps {
  page?: boolean;
  isOpen: boolean;
  onClose: () => void;
  title: string;
  ariaLabel: string;
  header: ReactNode;
  children: ReactNode;
}

/** Lets the existing detail behavior serve both a modal and a canonical route. */
export function CollectionDetailSurface({ page = false, isOpen, onClose, title, ariaLabel, header, children }: CollectionDetailSurfaceProps) {
  if (page) {
    return (
      <section className="flex flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-2xs dark:border-zinc-800 dark:bg-zinc-900">
        {header}
        {children}
      </section>
    );
  }

  return (
    <AppDialog
      isOpen={isOpen}
      onOpenChange={(open) => { if (!open) onClose(); }}
      title={title}
      ariaLabel={ariaLabel}
      size="full"
      overlayClassName="z-[350]"
      header={<></>}
      bodyClassName="min-h-0 flex-1 overflow-y-auto overscroll-contain flex flex-col"
    >
      {header}
      {children}
    </AppDialog>
  );
}
