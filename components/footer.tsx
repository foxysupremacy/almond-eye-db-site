"use client";

// AlmondEye DB - Application Footer
// Displays project branding, unofficial fan disclaimer, community & resource links, and data sync metadata.

import { useEffect, useState } from "react";

import { APP_VERSION, DEPLOYED_AT } from "@/lib/version";

function formatDeployedAgo(iso: string): string {
  const minutes = Math.floor((Date.now() - new Date(iso).getTime()) / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

export default function Footer() {
  const [deployedDate, setDeployedDate] = useState(DEPLOYED_AT.slice(0, 10));
  const [deployedAgo, setDeployedAgo] = useState<string | null>(null);

  useEffect(() => {
    const update = () => {
      const d = new Date(DEPLOYED_AT);
      const pad = (n: number) => String(n).padStart(2, "0");
      setDeployedDate(
        `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
      );
      setDeployedAgo(formatDeployedAgo(DEPLOYED_AT));
    };
    update();
    const timer = setInterval(update, 60_000);
    return () => clearInterval(timer);
  }, []);
  return (
    <footer className="mt-auto border-t border-zinc-200/80 dark:border-zinc-800/80 bg-white/60 dark:bg-zinc-900/60 backdrop-blur-xs transition-colors">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 py-8 sm:py-10">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
          {/* Brand and Description */}
          <div className="sm:col-span-2 space-y-2.5">
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 ring-4 ring-emerald-500/20" />
              <span className="text-sm font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
                AlmondEye DB
              </span>
              <span className="rounded bg-emerald-100 dark:bg-emerald-950/80 px-1.5 py-0.5 text-[10px] font-bold text-emerald-800 dark:text-emerald-300">
                v{APP_VERSION}
              </span>
              <span className="text-[10px] font-mono text-zinc-400 dark:text-zinc-500">
                deployed {deployedDate}
                {deployedAgo ? ` · ${deployedAgo}` : ""}
              </span>
            </div>
            <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed max-w-md">
              High-performance Deck Builder, Parent Deck inheritance optimizer, and Skill Activation Visualizer for{" "}
              <span className="font-medium text-zinc-800 dark:text-zinc-200">Uma Musume: Pretty Derby</span>.
            </p>
            <p className="text-[11px] text-zinc-400 dark:text-zinc-500 leading-normal">
              Data synchronized with in-memory database and geometry engine.
            </p>
          </div>

          {/* Quick Tools & Resources */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300">
              Tools & Navigation
            </h4>
            <ul className="mt-3 space-y-2 text-xs text-zinc-500 dark:text-zinc-400">
              <li>
                <a
                  href="#main"
                  className="hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors"
                >
                  Main Deck Builder
                </a>
              </li>
              <li>
                <a
                  href="#parent"
                  className="hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors"
                >
                  Parent Deck Farm
                </a>
              </li>
              <li>
                <a
                  href="#visualizer"
                  className="hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors"
                >
                  Race Track Visualizer
                </a>
              </li>
              <li>
                <a
                  href="/tournament_swiss_schedule.html"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors inline-flex items-center gap-1"
                >
                  <span>PvP Schedule</span>
                  <span className="text-[10px] text-zinc-400">↗</span>
                </a>
              </li>
            </ul>
          </div>

          {/* Community & Feedback */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300">
              Community & Links
            </h4>
            <ul className="mt-3 space-y-2 text-xs text-zinc-500 dark:text-zinc-400">
              <li>
                <a
                  href="https://github.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors inline-flex items-center gap-1"
                >
                  <span>GitHub Repository</span>
                  <span className="text-[10px] text-zinc-400">↗</span>
                </a>
              </li>
              <li>
                <a
                  href="https://discord.gg/EFK7zFt4wy"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors inline-flex items-center gap-1"
                >
                  <span>Discord Community</span>
                  <span className="text-[10px] text-zinc-400">↗</span>
                </a>
              </li>
              <li>
                <a
                  href="https://github.com/issues"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors inline-flex items-center gap-1"
                >
                  <span>Report Bug / Issue</span>
                  <span className="text-[10px] text-zinc-400">↗</span>
                </a>
              </li>
            </ul>
          </div>
        </div>

        {/* Disclaimer & Copyright Border */}
        <div className="mt-8 pt-6 border-t border-zinc-200/60 dark:border-zinc-800/60 flex flex-col sm:flex-row items-center justify-between gap-4 text-[11px] text-zinc-400 dark:text-zinc-500 text-center sm:text-left">
          <p>
            AlmondEye DB is an unofficial, non-commercial fan-made tool. Uma Musume: Pretty Derby and all related media are trademarks and copyright of Cygames, Inc.
          </p>
          <p className="shrink-0 font-mono text-[10px]">
            © {new Date().getFullYear()} AlmondEye DB
          </p>
        </div>
      </div>
    </footer>
  );
}
