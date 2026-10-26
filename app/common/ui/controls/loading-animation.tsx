"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

/**
 * Three-phase video loading indicator (enter → loop → exit) composited over any
 * background. Clips live at /assets/video/loading/ and are VP9-with-alpha WebM
 * (480×200, mark centered). Support tiers:
 * - Chromium/Firefox: the video clips.
 * - Safari (no WebM alpha) and prefers-reduced-motion: a static transparent PNG
 *   of the mark (`loading_mark.png`) — branded, no motion.
 * - No WebM at all (jsdom/happy-dom tests, ancient browsers): plain spinner.
 *
 * The mode is "unknown" until the mount effect runs; unknown paints the same
 * static mark (the server cannot know the browser tier), so the first paint is
 * branded rather than blank or — worse — an SSR spinner that outlives fast
 * loads until hydration (the exact bug that made the video look like it never
 * shipped).
 *
 * Mount it as an always-mounted sibling of the content it covers:
 * `active` true → enter clip once then loops; `active` false → content is
 * expected to render immediately underneath while the exit clip plays once as
 * an overlay, then the component hides itself (`display:none`, no layout gap).
 * Suspense fallbacks unmount on resolve, so they only ever see enter + loop.
 */
export interface LoadingAnimationProps {
  /** Drives the phase machine: true = enter then loop, false = exit once. */
  active: boolean;
  /** Reuses the exact loading strings the previous spinners/skeletons had. */
  label: string;
  /** block = standalone loading area, inline = inside a row/sheet, overlay = absolute inset-0. */
  variant?: "block" | "inline" | "overlay";
  /** Clip height: sm = h-7, md = h-14, lg = h-28. Defaults to sm for inline, lg otherwise. */
  size?: "sm" | "md" | "lg";
  /** Rendered instead of the clip when video playback is unavailable. */
  fallback?: ReactNode;
  /** Extra wrapper classes; applied only while loading (dropped for the exit overlay). */
  className?: string;
  /** Block variant only: keep the default min-h-64 loading area. Set false inside padded cards. */
  fill?: boolean;
}

type LoadingPhase = "idle" | "enter" | "loop" | "exit" | "done";

const SOURCES = {
  enter: "/assets/video/loading/loading_1_enter.webm",
  loop: "/assets/video/loading/loading_2_loop.webm",
  exit: "/assets/video/loading/loading_3_exit.webm",
  staticMark: "/assets/video/loading/loading_mark.png",
} as const;

type ClipMode = "unknown" | "video" | "static" | "spinner";

function useClipMode(): ClipMode {
  const [mode, setMode] = useState<ClipMode>("unknown");
  useEffect(() => {
    try {
      if (typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        setMode("static");
        return;
      }
      const ua = navigator.userAgent;
      const looksLikeSafari = /Safari/i.test(ua) && !/Chrom(e|ium)|Edg|OPR|Firefox/i.test(ua);
      const probe = document.createElement("video");
      const canVp9 = probe.canPlayType('video/webm; codecs="vp9"') !== "";
      if (!canVp9) {
        setMode("spinner");
      } else if (looksLikeSafari) {
        // Safari plays VP9 WebM but ignores the alpha channel (black box) — still WebM works though.
        setMode("static");
      } else {
        setMode("video");
      }
    } catch {
      setMode("spinner");
    }
  }, []);
  return mode;
}

const CLIP_HEIGHT = { sm: "h-7", md: "h-14", lg: "h-28" } as const;
const SPINNER_SIZE = {
  sm: "h-4 w-4 border-2",
  md: "h-6 w-6 border-2",
  lg: "h-8 w-8 border-4",
} as const;

export function LoadingAnimation({
  active,
  label,
  variant = "block",
  size,
  fallback,
  className = "",
  fill = true,
}: LoadingAnimationProps) {
  const mode = useClipMode();
  const resolvedSize = size ?? (variant === "inline" ? "sm" : "lg");
  const [phase, setPhase] = useState<LoadingPhase>(() => (active ? "enter" : "idle"));
  const enterRef = useRef<HTMLVideoElement>(null);
  const loopRef = useRef<HTMLVideoElement>(null);
  const exitRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    setPhase((prev) => {
      if (active) return prev === "enter" || prev === "loop" ? prev : "enter";
      return prev === "enter" || prev === "loop" ? "exit" : "done";
    });
  }, [active]);

  useEffect(() => {
    if (mode !== "video") return;
    const phaseVideo =
      phase === "enter" ? enterRef.current : phase === "loop" ? loopRef.current : phase === "exit" ? exitRef.current : null;
    for (const video of [enterRef.current, loopRef.current, exitRef.current]) {
      if (!video) continue;
      if (video === phaseVideo) {
        video.currentTime = 0;
        void video.play().catch(() => {});
      } else {
        video.pause();
      }
    }
  }, [phase, mode]);

  if (mode === "unknown") {
    // Pre-hydration / pre-effect: paint the branded static mark right away so the
    // loading area is never blank (server cannot know the video tier). Matches the
    // client's first render, so hydration sees identical markup.
    if (!active) return null;
    return <StaticMark variant={variant} size={resolvedSize} label={label} fill={fill} className={className} />;
  }

  if (mode !== "video") {
    if (!active) return null;
    if (mode === "static") {
      return <StaticMark variant={variant} size={resolvedSize} label={label} fill={fill} className={className} />;
    }
    return <>{fallback ?? <DefaultSpinner variant={variant} size={resolvedSize} label={label} fill={fill} />}</>;
  }

  const resting = phase === "enter" || phase === "loop";
  const visible = resting || phase === "exit";

  return (
    <div
      role={visible ? "status" : undefined}
      aria-hidden={!visible}
      className={[
        wrapperClass(variant, resting, fill),
        visible ? "" : "hidden",
        resting ? className : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <span className="sr-only">{label}</span>
      <div className={variant === "inline" ? "inline-flex items-center gap-2" : "flex flex-col items-center gap-3"}>
        <div className="grid place-items-center">
          <video
            ref={enterRef}
            src={SOURCES.enter}
            muted
            playsInline
            preload="auto"
            disablePictureInPicture
            aria-hidden="true"
            tabIndex={-1}
            onEnded={() => setPhase((prev) => (prev === "enter" ? "loop" : prev))}
            className={`col-start-1 row-start-1 w-auto max-w-full ${CLIP_HEIGHT[resolvedSize]} ${phase === "enter" ? "" : "hidden"}`}
          />
          <video
            ref={loopRef}
            src={SOURCES.loop}
            muted
            playsInline
            loop
            preload="auto"
            disablePictureInPicture
            aria-hidden="true"
            tabIndex={-1}
            className={`col-start-1 row-start-1 w-auto max-w-full ${CLIP_HEIGHT[resolvedSize]} ${phase === "loop" ? "" : "hidden"}`}
          />
          <video
            ref={exitRef}
            src={SOURCES.exit}
            muted
            playsInline
            preload="auto"
            disablePictureInPicture
            aria-hidden="true"
            tabIndex={-1}
            onEnded={() => setPhase((prev) => (prev === "exit" ? "done" : prev))}
            className={`col-start-1 row-start-1 w-auto max-w-full ${CLIP_HEIGHT[resolvedSize]} ${phase === "exit" ? "" : "hidden"}`}
          />
        </div>
        {resting ? <p className="text-xs text-zinc-400">{label}</p> : null}
      </div>
    </div>
  );
}

function wrapperClass(
  variant: LoadingAnimationProps["variant"],
  resting: boolean,
  fill: boolean,
): string {
  if (variant === "inline") {
    return resting
      ? "inline-flex items-center gap-2"
      : "pointer-events-none absolute inset-0 z-20 flex items-center justify-center";
  }
  if (variant === "overlay") {
    return "pointer-events-none absolute inset-0 z-20 flex flex-col items-center justify-center gap-3";
  }
  return resting
    ? `flex ${fill ? "min-h-64 " : ""}flex-col items-center justify-center gap-3`
    : "pointer-events-none absolute inset-0 z-20 flex flex-col items-center justify-center";
}

function StaticMark({
  variant,
  size,
  label,
  fill,
  className = "",
}: {
  variant: NonNullable<LoadingAnimationProps["variant"]>;
  size: NonNullable<LoadingAnimationProps["size"]>;
  label: string;
  fill: boolean;
  className?: string;
}) {
  return (
    <div role="status" className={`${wrapperClass(variant, true, fill)} ${className}`.trim()}>
      <span className="sr-only">{label}</span>
      <div className={variant === "inline" ? "inline-flex items-center gap-2" : "flex flex-col items-center gap-3"}>
        <img
          src={SOURCES.staticMark}
          alt=""
          aria-hidden="true"
          className={`w-auto max-w-full ${CLIP_HEIGHT[size]}`}
        />
        <p className="text-xs text-zinc-400">{label}</p>
      </div>
    </div>
  );
}

function DefaultSpinner({
  variant,
  size,
  label,
  fill,
}: {
  variant: NonNullable<LoadingAnimationProps["variant"]>;
  size: NonNullable<LoadingAnimationProps["size"]>;
  label: string;
  fill: boolean;
}) {
  const spinner = (
    <span className={`animate-spin rounded-full border-emerald-500 border-t-transparent ${SPINNER_SIZE[size]}`} />
  );
  const text = <span className="text-xs text-zinc-400">{label}</span>;
  if (variant === "inline") {
    return (
      <span role="status" className="inline-flex items-center gap-2">
        {spinner}
        {text}
      </span>
    );
  }
  if (variant === "overlay") {
    return (
      <div role="status" className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3">
        {spinner}
        {text}
      </div>
    );
  }
  return (
    <div
      role="status"
      className={`flex ${fill ? "min-h-64 " : ""}flex-col items-center justify-center gap-3`}
    >
      {spinner}
      {text}
    </div>
  );
}
