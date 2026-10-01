"use client";

import { Button as AriaButton, type ButtonProps as AriaButtonProps } from "react-aria-components/Button";
import type { ReactNode } from "react";

export type AppButtonVariant = "primary" | "secondary" | "quiet" | "destructive";

export interface AppButtonProps extends AriaButtonProps {
  variant?: AppButtonVariant;
  size?: "sm" | "md";
  iconOnly?: boolean;
  title?: string;
}

const variants: Record<AppButtonVariant, string> = {
  primary: "border border-emerald-800 bg-emerald-800 text-white hover:bg-emerald-700 data-[pressed]:bg-emerald-900 dark:border-emerald-600 dark:bg-emerald-700 dark:hover:bg-emerald-600",
  secondary: "border border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50 data-[pressed]:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800",
  quiet: "border border-transparent text-zinc-600 hover:bg-zinc-100 data-[pressed]:bg-zinc-200 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:data-[pressed]:bg-zinc-700",
  destructive: "border border-rose-700 bg-rose-700 text-white hover:bg-rose-600 data-[pressed]:bg-rose-800 dark:border-rose-600 dark:bg-rose-700 dark:hover:bg-rose-600",
};

/** Shared accessible action control. */
export function AppButton({ variant = "secondary", size = "sm", iconOnly = false, className = "", title, children, ...props }: AppButtonProps) {
  const geometry = size === "md" ? "min-h-11 rounded-xl px-3.5 text-sm md:min-h-9" : "min-h-11 rounded-lg px-2.5 text-xs md:min-h-8";
  const iconGeometry = iconOnly ? "w-11 px-0 md:w-8" : "";
  return (
    <AriaButton
      {...props}
      render={title ? (nativeProps, renderProps) => props.render
        ? props.render({ ...nativeProps, title }, renderProps)
        : <button {...nativeProps} title={title} />
        : props.render}
      className={`inline-flex shrink-0 items-center justify-center gap-1.5 font-semibold outline-none transition-colors focus-visible:ring-2 focus-visible:ring-emerald-500/70 focus-visible:ring-offset-2 focus-visible:ring-offset-white disabled:cursor-not-allowed disabled:opacity-40 dark:focus-visible:ring-offset-zinc-950 ${geometry} ${iconGeometry} ${variants[variant]} ${typeof className === "string" ? className : ""}`}
    >
      {children as ReactNode}
    </AriaButton>
  );
}
