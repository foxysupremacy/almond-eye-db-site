"use client";

import type { ReactNode } from "react";
import { AppDialog } from "./app-dialog";
import { AppButton } from "./app-button";
import { XIcon } from "../primitives/icons";

/** Responsive modal sheet with focus containment and focus restoration. */
export function MobileSheet({ open, onClose, title, description, children, footer, placement = "bottom" }: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  placement?: "bottom" | "side";
}) {
  return (
    <AppDialog
      isOpen={open}
      onOpenChange={(next) => { if (!next) onClose(); }}
      title={title}
      description={description}
      size={placement === "side" ? "side" : "sheet"}
      overlayLayer="mobile"
      overlayClassName={placement === "side" ? "md:items-stretch md:justify-end md:bg-black/20 md:p-0 md:backdrop-blur-none" : "md:p-6"}
      className="mobile-sheet"
      headerAction={
        <AppButton variant="quiet" iconOnly aria-label={`Close ${title}`} onPress={onClose} className={placement === "side" ? "md:w-11 md:min-h-11" : undefined}>
          <XIcon className="h-5 w-5" />
        </AppButton>
      }
      footer={footer ?? <AppButton variant="primary" size="md" onPress={onClose} className="w-full">Done</AppButton>}
    >
      <div className="mobile-sheet-content px-5 py-4">{children}</div>
    </AppDialog>
  );
}
