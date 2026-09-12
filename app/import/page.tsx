"use client";

import { useEffect, useState, useCallback, useTransition } from "react";
import Link from "next/link";
import { type KyumaruSyncPayload, type KyumaruInventoryDump, type KyumaruVeteranItem } from "@/lib/kyumaru-types";
import { saveVeterans, getVeteransCount } from "@/lib/db/veterans-db";

export default function ImportPage() {
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [stats, setStats] = useState<{
    cards: number;
    mlb: number;
    umas: number;
    veterans?: number;
    source?: string;
  } | null>(null);
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [isDragging, setIsDragging] = useState(false);
  const [, startTransition] = useTransition();

  // 1. Process incoming URL hash payload (#data=...)
  useEffect(() => {
    async function processHash() {
      const hash = window.location.hash;
      if (!hash.startsWith("#data=")) {
        setStatus("idle");
        return;
      }

      setStatus("loading");
      const b64 = hash.slice(6);

      try {
        // Base64 URL decode (handles URL-safe characters & padding)
        const unescaped = b64.replace(/-/g, "+").replace(/_/g, "/");
        const padded = unescaped.padEnd(unescaped.length + ((4 - (unescaped.length % 4)) % 4), "=");
        const binaryStr = atob(padded);
        const bytes = Uint8Array.from(binaryStr, (c) => c.charCodeAt(0));

        // Native browser Deflate decompression
        const stream = new Response(
          new Blob([bytes]).stream().pipeThrough(new DecompressionStream("deflate"))
        );
        const payload: KyumaruSyncPayload = await stream.json();

        if (!payload.cards && !payload.umas) {
          throw new Error("Invalid payload: missing cards or umas");
        }

        // Save to localStorage
        if (payload.cards) {
          window.localStorage.setItem("almondeye_owned_cards", JSON.stringify(payload.cards));
        }
        if (payload.umas) {
          window.localStorage.setItem("almondeye_owned_umas", JSON.stringify(payload.umas));
        }
        window.localStorage.setItem("almondeye_last_sync", new Date().toISOString());

        // Dispatch storage event for active tabs/windows
        window.dispatchEvent(new Event("almondeye_inventory_updated"));

        // Clean up address bar (strip hash fragment)
        window.history.replaceState(null, "", window.location.pathname);

        const cardEntries = Object.entries(payload.cards || {});
        const mlbCount = cardEntries.filter(([_, lb]) => lb === 4).length;
        const umaCount = Object.keys(payload.umas || {}).length;
        const veteranCount = await getVeteransCount();

        setStats({
          cards: cardEntries.length,
          mlb: mlbCount,
          umas: umaCount,
          veterans: veteranCount,
          source: "In-Game One-Click Sync",
        });
        setStatus("success");
      } catch (err: any) {
        console.error("Failed to unpack Kyumaru sync data:", err);
        setErrorMessage(err.message || "Failed to decompress inventory payload.");
        setStatus("error");
      }
    }

    processHash();
  }, []);

  // 2. Handle JSON file parsing (inventory.json or veterans.json)
  const processJsonFile = useCallback(async (file: File) => {
    setStatus("loading");
    setErrorMessage("");

    try {
      const text = await file.text();
      const parsed = JSON.parse(text);

      // Check if this is a veterans dump (array of trained umas)
      if (Array.isArray(parsed) && parsed.length > 0 && "proper_ground_turf" in parsed[0]) {
        const veterans = parsed as KyumaruVeteranItem[];
        await saveVeterans(veterans);

        // Read current cards and umas
        const existingCards = JSON.parse(window.localStorage.getItem("almondeye_owned_cards") || "{}");
        const existingUmas = JSON.parse(window.localStorage.getItem("almondeye_owned_umas") || "{}");
        const mlb = Object.values(existingCards).filter((v) => v === 4).length;

        setStats({
          cards: Object.keys(existingCards).length,
          mlb,
          umas: Object.keys(existingUmas).length,
          veterans: veterans.length,
          source: `${file.name} (${veterans.length} Hall of Fame Veterans)`,
        });
        setStatus("success");
        return;
      }

      // Check if this is an inventory dump
      if (parsed.support_card_list || parsed.card_list) {
        const dump = parsed as KyumaruInventoryDump;
        const cardsMap: Record<string, number> = {};
        const umasMap: Record<string, [number, number]> = {};

        if (Array.isArray(dump.support_card_list)) {
          for (const c of dump.support_card_list) {
            cardsMap[String(c.support_card_id)] = c.limit_break_count;
          }
          window.localStorage.setItem("almondeye_owned_cards", JSON.stringify(cardsMap));
        }

        if (Array.isArray(dump.card_list)) {
          for (const u of dump.card_list) {
            umasMap[String(u.card_id)] = [u.rarity, u.talent_level];
          }
          window.localStorage.setItem("almondeye_owned_umas", JSON.stringify(umasMap));
        }

        window.localStorage.setItem("almondeye_last_sync", new Date().toISOString());
        window.dispatchEvent(new Event("almondeye_inventory_updated"));

        const cardEntries = Object.entries(cardsMap);
        const mlbCount = cardEntries.filter(([_, lb]) => lb === 4).length;
        const veteranCount = await getVeteransCount();

        setStats({
          cards: cardEntries.length,
          mlb: mlbCount,
          umas: Object.keys(umasMap).length,
          veterans: veteranCount,
          source: `${file.name} (${cardEntries.length} Cards, ${Object.keys(umasMap).length} Characters)`,
        });
        setStatus("success");
        return;
      }

      // Check if this is a direct compact sync payload { cards: {}, umas: {} }
      if (parsed.cards || parsed.umas) {
        if (parsed.cards) {
          window.localStorage.setItem("almondeye_owned_cards", JSON.stringify(parsed.cards));
        }
        if (parsed.umas) {
          window.localStorage.setItem("almondeye_owned_umas", JSON.stringify(parsed.umas));
        }
        window.localStorage.setItem("almondeye_last_sync", new Date().toISOString());
        window.dispatchEvent(new Event("almondeye_inventory_updated"));

        const cardEntries = Object.entries(parsed.cards || {});
        const mlbCount = cardEntries.filter(([_, lb]: [string, any]) => lb === 4).length;
        const veteranCount = await getVeteransCount();

        setStats({
          cards: cardEntries.length,
          mlb: mlbCount,
          umas: Object.keys(parsed.umas || {}).length,
          veterans: veteranCount,
          source: file.name,
        });
        setStatus("success");
        return;
      }

      throw new Error(
        "Unrecognized file structure. Expected inventory.json, veterans.json, or Kyumaru export."
      );
    } catch (err: any) {
      console.error("Failed to parse dropped JSON file:", err);
      setErrorMessage(err.message || "Invalid or corrupt JSON file.");
      setStatus("error");
    }
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);

      const files = e.dataTransfer.files;
      if (files.length > 0) {
        startTransition(() => {
          processJsonFile(files[0]);
        });
      }
    },
    [processJsonFile]
  );

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (files && files.length > 0) {
        startTransition(() => {
          processJsonFile(files[0]);
        });
      }
    },
    [processJsonFile]
  );

  return (
    <div className="max-w-2xl mx-auto py-12 px-4">
      <div className="text-center mb-8">
        <p className="text-xs font-bold uppercase tracking-widest text-emerald-600 dark:text-emerald-400 mb-1">
          Kyumaru Sync
        </p>
        <h1 className="text-3xl font-black tracking-tight text-zinc-900 dark:text-zinc-100">
          Game Data Import & Ingest
        </h1>
        <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400 max-w-md mx-auto">
          Synchronize your owned support cards, playable characters, and Hall of Fame veterans with zero server uploads.
        </p>
      </div>

      {status === "loading" && (
        <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/60 p-12 text-center shadow-xs">
          <div className="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100 mb-1">
            Processing Game Data...
          </h2>
          <p className="text-xs text-zinc-500">Decompressing and storing locally into your browser sandbox.</p>
        </div>
      )}

      {status === "success" && stats && (
        <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-6 sm:p-8 mb-8 text-left shadow-xs">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-full bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center text-xl font-bold">
              ✓
            </div>
            <div>
              <h2 className="text-lg font-bold text-emerald-800 dark:text-emerald-300">
                Synchronization Complete!
              </h2>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                {stats.source ? `Source: ${stats.source}` : "Saved to local browser storage."}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6 text-center">
            <div className="bg-white/80 dark:bg-black/30 rounded-xl p-3 border border-zinc-200/80 dark:border-emerald-500/15 shadow-2xs">
              <div className="text-2xl font-black text-zinc-900 dark:text-white">{stats.cards}</div>
              <div className="text-[11px] text-zinc-500 dark:text-zinc-400 font-medium">Owned Cards</div>
            </div>
            <div className="bg-white/80 dark:bg-black/30 rounded-xl p-3 border border-zinc-200/80 dark:border-emerald-500/15 shadow-2xs">
              <div className="text-2xl font-black text-amber-500 dark:text-amber-400">{stats.mlb}</div>
              <div className="text-[11px] text-zinc-500 dark:text-zinc-400 font-medium">MLB Cards (4★)</div>
            </div>
            <div className="bg-white/80 dark:bg-black/30 rounded-xl p-3 border border-zinc-200/80 dark:border-emerald-500/15 shadow-2xs">
              <div className="text-2xl font-black text-sky-500 dark:text-sky-400">{stats.umas}</div>
              <div className="text-[11px] text-zinc-500 dark:text-zinc-400 font-medium">Owned Umas</div>
            </div>
            <div className="bg-white/80 dark:bg-black/30 rounded-xl p-3 border border-zinc-200/80 dark:border-emerald-500/15 shadow-2xs">
              <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
                {stats.veterans ?? 0}
              </div>
              <div className="text-[11px] text-zinc-500 dark:text-zinc-400 font-medium">Trained Veterans</div>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-emerald-500/20">
            <div className="flex items-center gap-2">
              <Link
                href="/"
                className="inline-flex items-center px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-xl shadow-xs transition-colors"
              >
                Go to Deck Builder →
              </Link>
            </div>
            <span className="text-xs text-zinc-500 flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
              100% Client-Side Privacy Guaranteed
            </span>
          </div>
        </div>
      )}

      {status === "error" && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-6 text-left mb-8 shadow-xs">
          <h2 className="text-base font-bold text-red-500 dark:text-red-400 mb-1">Import Failed</h2>
          <p className="text-xs text-zinc-600 dark:text-zinc-300 mb-3">{errorMessage}</p>
          <p className="text-[11px] text-zinc-500">
            Please ensure you selected a valid <code>inventory.json</code> or <code>veterans.json</code> export from Kyumaru.
          </p>
        </div>
      )}

      {/* Drag & Drop Zone */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        className={`rounded-2xl border-2 border-dashed p-8 text-center transition-all cursor-pointer ${
          isDragging
            ? "border-emerald-500 bg-emerald-500/5 dark:bg-emerald-500/10"
            : "border-zinc-300 dark:border-zinc-800 bg-white/50 dark:bg-zinc-900/40 hover:border-zinc-400 dark:hover:border-zinc-700"
        }`}
      >
        <div className="w-12 h-12 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 flex items-center justify-center mx-auto mb-4 text-xl">
          📁
        </div>
        <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-1">
          Drag & Drop Kyumaru JSON Files
        </h3>
        <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-4 max-w-sm mx-auto">
          Drop <code>inventory.json</code> (cards & characters) or <code>veterans.json</code> (trained horses) directly here.
        </p>

        <label className="inline-flex items-center px-4 py-2 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 text-xs font-semibold rounded-xl shadow-xs hover:bg-zinc-800 dark:hover:bg-white cursor-pointer transition-colors">
          <span>Choose JSON File</span>
          <input
            type="file"
            accept=".json"
            onChange={handleFileInput}
            className="sr-only"
          />
        </label>
      </div>

      {/* Info footer */}
      <div className="mt-8 text-center text-xs text-zinc-400 dark:text-zinc-500">
        <p>
          Need to sync from the game? Open the in-game Hachimi overlay menu in <em>Umamusume</em> and click{" "}
          <strong className="text-zinc-600 dark:text-zinc-300">[ Open in Browser & Sync ]</strong>.
        </p>
      </div>
    </div>
  );
}
