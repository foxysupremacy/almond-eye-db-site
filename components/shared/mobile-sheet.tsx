"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useBodyScrollLock } from "../../lib/use-body-scroll-lock";
import { XIcon } from "../icons";

/** A scroll-contained sheet with keyboard focus restoration and no input autofocus. */
export function MobileSheet({ open, onClose, title, description, children, footer }: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  const id = useId();
  const panel = useRef<HTMLDivElement>(null);
  const close = useRef<HTMLButtonElement>(null);
  useBodyScrollLock(open);

  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    close.current?.focus({ preventScroll: true });
    return () => { if (previous?.isConnected) previous.focus({ preventScroll: true }); };
  }, [open]);

  if (!open || typeof document === "undefined") return null;
  return createPortal(
    <div className="mobile-sheet-backdrop fixed inset-0 z-[90] flex items-end justify-center bg-black/45 backdrop-blur-xs md:items-center md:p-6 animate-in fade-in duration-200 ease-out-quart"
      onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <div ref={panel} role="dialog" aria-modal="true" aria-labelledby={`${id}-title`}
        aria-describedby={description ? `${id}-description` : undefined}
        className="mobile-sheet flex max-h-[90dvh] w-full min-w-0 flex-col overflow-hidden rounded-t-3xl border border-zinc-200 bg-white text-zinc-900 shadow-xl dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100 md:max-w-xl md:rounded-2xl animate-in slide-in-from-bottom-4 duration-200 ease-out-expo"
        onKeyDown={(event) => {
          // Portal children (such as the preset manager) own their own keyboard handling.
          if (!panel.current?.contains(event.target as Node) || event.defaultPrevented) return;
          if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); onClose(); }
          if (event.key !== "Tab") return;
          const focusable = Array.from(panel.current.querySelectorAll<HTMLElement>(
            'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex="0"]',
          )).filter((element) => element.getClientRects().length > 0);
          const first = focusable[0], last = focusable[focusable.length - 1];
          if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
          else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
        }}>
        <div aria-hidden="true" className="mx-auto mt-2 h-1 w-9 rounded-full bg-zinc-300 dark:bg-zinc-700 md:hidden" />
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-zinc-100 px-5 py-3 dark:border-zinc-800">
          <div className="min-w-0">
            <h2 id={`${id}-title`} className="text-base font-semibold">{title}</h2>
            {description && <p id={`${id}-description`} className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">{description}</p>}
          </div>
          <button ref={close} type="button" onClick={onClose} aria-label={`Close ${title}`} className="grid h-11 w-11 shrink-0 place-items-center rounded-xl text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"><XIcon className="h-5 w-5" /></button>
        </div>
        <div className="mobile-sheet-content min-h-0 overflow-y-auto overscroll-contain px-5 py-4">{children}</div>
        <div className="mobile-sheet-footer shrink-0 border-t border-zinc-100 px-5 pt-3 dark:border-zinc-800">
          {footer ?? <button type="button" onClick={onClose} className="min-h-11 w-full rounded-xl bg-emerald-700 px-4 text-sm font-semibold text-white hover:bg-emerald-600">Done</button>}
        </div>
      </div>
    </div>, document.body,
  );
}
