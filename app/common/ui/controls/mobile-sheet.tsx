"use client";

import type { ReactNode } from "react";
import { AppDialog } from "./app-dialog";
import { AppButton } from "./app-button";
import { XIcon } from "../primitives/icons";

/** Responsive modal sheet with focus containment and focus restoration. */
export function MobileSheet({ open, onClose, title, description, children, footer }: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <AppDialog
      isOpen={open}
      onOpenChange={(next) => { if (!next) onClose(); }}
      title={title}
      description={description}
      size="sheet"
      overlayLayer="mobile"
      overlayClassName="md:p-6"
      className="mobile-sheet"
      headerAction={
        <AppButton variant="quiet" iconOnly aria-label={`Close ${title}`} onPress={onClose}>
          <XIcon className="h-5 w-5" />
        </AppButton>
      }
      footer={footer ?? <AppButton variant="primary" size="md" onPress={onClose} className="w-full">Done</AppButton>}
    >
      <div className="mobile-sheet-content px-5 py-4">{children}</div>
    </AppDialog>
  );
}
