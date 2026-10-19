"use client";

import { Dialog, Heading, Modal, ModalOverlay } from "react-aria-components/Modal";
import { Text } from "react-aria-components/Text";
import type { ReactNode, Ref } from "react";

export interface AppDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  headerAction?: ReactNode;
  header?: ReactNode;
  className?: string;
  bodyClassName?: string;
  overlayClassName?: string;
  overlayLayer?: "mobile" | "picker" | "share" | "inspection" | "inspector";
  titleClassName?: string;
  isDismissable?: boolean;
  ariaLabel?: string;
  /** `phone-full` covers the whole viewport edge to edge (phone-only surfaces). */
  size?: "sheet" | "side" | "sm" | "md" | "lg" | "full" | "phone-full";
  dialogRef?: Ref<HTMLDivElement>;
}

const sizes = {
  sheet: "max-h-[90dvh] w-full rounded-t-3xl md:max-w-xl md:rounded-2xl",
  side: "max-h-[90dvh] w-full rounded-t-3xl md:h-dvh md:max-h-dvh md:rounded-none md:border-y-0 md:border-r-0",
  sm: "max-h-[90dvh] w-full max-w-md rounded-2xl",
  md: "max-h-[90dvh] w-full max-w-xl rounded-2xl",
  lg: "max-h-[92dvh] w-full max-w-3xl rounded-2xl",
  full: "h-[88dvh] max-h-[92dvh] w-full sm:h-[90vh] sm:max-h-[860px] sm:max-w-2xl rounded-t-2xl sm:rounded-2xl",
  "phone-full": "h-dvh max-h-dvh w-full rounded-none",
} as const;
const modalWidths = {
  sheet: "max-w-full md:max-w-xl",
  side: "max-w-full md:ml-auto md:mr-0 md:h-dvh md:max-w-md",
  sm: "max-w-md",
  md: "max-w-xl",
  lg: "max-w-3xl",
  full: "max-w-full sm:max-w-2xl",
  "phone-full": "h-dvh max-w-full",
} as const;

/** Controlled modal shell with focus containment, dismissal and restoration. */
const overlayLayers = { mobile: "z-[90]", picker: "z-[300]", share: "z-[250]", inspection: "z-[350]", inspector: "z-[400]" } as const;

export function AppDialog({ isOpen, onOpenChange, title, description, children, footer, headerAction, header, className = "", bodyClassName = "", overlayClassName = "", overlayLayer = "picker", titleClassName = "", isDismissable = true, ariaLabel, size = "md", dialogRef }: AppDialogProps) {
  return (
    <ModalOverlay
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      isDismissable={isDismissable}
      className={`fixed inset-0 ${overlayLayers[overlayLayer]} flex items-end justify-center bg-black/50 p-0 backdrop-blur-xs outline-none data-[entering]:animate-in data-[entering]:fade-in data-[entering]:duration-200 data-[exiting]:animate-out data-[exiting]:fade-out ${size === "phone-full" ? "" : "sm:items-center sm:p-4"} ${overlayClassName}`}
    >
      <Modal className={`mx-auto w-full ${modalWidths[size]} outline-none`}>
        <Dialog
          ref={dialogRef}
          aria-label={ariaLabel}
          className={`flex min-w-0 flex-col overflow-hidden ${size === "phone-full" ? "" : "border border-zinc-200 dark:border-zinc-800"} bg-white text-zinc-900 shadow-2xl outline-none dark:bg-zinc-950 dark:text-zinc-100 ${sizes[size]} ${className}`}
        >
          {header ?? <header className="flex shrink-0 items-center justify-between gap-3 border-b border-zinc-100 px-5 py-3 dark:border-zinc-800">
              <div className="min-w-0 flex-1">
                <Heading slot="title" className={`text-base font-semibold ${titleClassName}`}>{title}</Heading>
                {description && <Text slot="description" className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">{description}</Text>}
              </div>
              {headerAction}
            </header>}
          <div className={bodyClassName || "min-h-0 flex-1 overflow-y-auto overscroll-contain"}>{children}</div>
          {footer && <footer className="shrink-0 border-t border-zinc-100 px-5 py-3 dark:border-zinc-800">{footer}</footer>}
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
}
