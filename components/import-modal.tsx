"use client";

import { useState, useCallback } from "react";
import { useOwnedCards } from "../lib/use-owned-cards";
import { useOwnedUmas } from "../lib/use-owned-umas";
import { saveVeterans, clearVeterans } from "../lib/db/veterans-db";
import { type KyumaruInventoryDump, type KyumaruVeteranItem } from "../lib/kyumaru-types";
import { decodeKyumaruSyncPayload } from "../lib/kyumaru-decode";

export default function ImportModal({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const { totalOwned: totalCards, mlbCount, clearAll: clearCards } = useOwnedCards();
  const { totalOwned: totalUmas, clearAll: clearUmas } = useOwnedUmas();

  const [isDragging, setIsDragging] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [pastedData, setPastedData] = useState("");

  if (!isOpen) return null;

  const processJson = async (text: string, filename = "Pasted Data") => {
    try {
      let data = text.trim();
      if (data.includes("#data=")) {
        data = data.split("#data=")[1];
      }

      // If Base64 compressed hash
      if (!data.startsWith("{") && !data.startsWith("[")) {
        // Kyumaru emits raw DEFLATE (RFC 1951); see decodeKyumaruSyncPayload
        const payload = await decodeKyumaruSyncPayload(data);

        if (payload.cards) {
          window.localStorage.setItem("almondeye_owned_cards", JSON.stringify(payload.cards));
        }
        if (payload.umas) {
          window.localStorage.setItem("almondeye_owned_umas", JSON.stringify(payload.umas));
        }
        window.localStorage.setItem("almondeye_last_sync", new Date().toISOString());
        window.dispatchEvent(new Event("almondeye_inventory_updated"));

        setStatusMessage({
          type: "success",
          text: `Successfully synced ${Object.keys(payload.cards || {}).length} cards & ${Object.keys(payload.umas || {}).length} characters!`,
        });
        return;
      }

      const parsed = JSON.parse(data);

      // 1. Veterans dump
      if (Array.isArray(parsed) && parsed.length > 0 && "proper_ground_turf" in parsed[0]) {
        await saveVeterans(parsed as KyumaruVeteranItem[]);
        setStatusMessage({
          type: "success",
          text: `Successfully imported ${parsed.length} Hall of Fame veterans into local database!`,
        });
        return;
      }

      // 2. Inventory dump
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

        setStatusMessage({
          type: "success",
          text: `Imported ${Object.keys(cardsMap).length} cards and ${Object.keys(umasMap).length} characters from ${filename}!`,
        });
        return;
      }

      // 3. Direct compact payload
      if (parsed.cards || parsed.umas) {
        if (parsed.cards) {
          window.localStorage.setItem("almondeye_owned_cards", JSON.stringify(parsed.cards));
        }
        if (parsed.umas) {
          window.localStorage.setItem("almondeye_owned_umas", JSON.stringify(parsed.umas));
        }
        window.localStorage.setItem("almondeye_last_sync", new Date().toISOString());
        window.dispatchEvent(new Event("almondeye_inventory_updated"));

        setStatusMessage({
          type: "success",
          text: `Imported ${Object.keys(parsed.cards || {}).length} cards and ${Object.keys(parsed.umas || {}).length} characters!`,
        });
        return;
      }

      throw new Error("Unrecognized JSON format. Expected inventory.json or veterans.json.");
    } catch (err: any) {
      setStatusMessage({
        type: "error",
        text: err.message || "Failed to process data.",
      });
    }
  };

  const handleFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      if (text) processJson(text, file.name);
    };
    reader.readAsText(file);
  };

  const handleClearAll = async () => {
    if (confirm("Are you sure you want to clear your local collection and trained umas?")) {
      clearCards();
      clearUmas();
      await clearVeterans();
      setStatusMessage({
        type: "success",
        text: "Local inventory and veterans data cleared.",
      });
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200 ease-out-quart"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-lg rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-2xl p-6 relative animate-in zoom-in-95 duration-200 ease-out-expo">
        <div className="flex items-center justify-between pb-4 mb-4 border-b border-zinc-100 dark:border-zinc-800">
          <div>
            <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
              Sync / Import Game Data
            </h2>
            <p className="text-xs text-zinc-500">
              Load inventory or trained veterans from Kyumaru.
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Current status summary */}
        <div className="grid grid-cols-3 gap-2 mb-4 text-center">
          <div className="rounded-xl bg-zinc-50 dark:bg-zinc-800/60 p-2 border border-zinc-200/60 dark:border-zinc-700/40">
            <div className="text-lg font-bold text-zinc-900 dark:text-zinc-100">{totalCards}</div>
            <div className="text-[10px] text-zinc-500">Cards ({mlbCount} MLB)</div>
          </div>
          <div className="rounded-xl bg-zinc-50 dark:bg-zinc-800/60 p-2 border border-zinc-200/60 dark:border-zinc-700/40">
            <div className="text-lg font-bold text-sky-600 dark:text-sky-400">{totalUmas}</div>
            <div className="text-[10px] text-zinc-500">Owned Umas</div>
          </div>
          <div className="rounded-xl bg-zinc-50 dark:bg-zinc-800/60 p-2 border border-zinc-200/60 dark:border-zinc-700/40 flex flex-col justify-center">
            <button
              onClick={handleClearAll}
              className="text-[11px] font-medium text-red-600 dark:text-red-400 hover:underline cursor-pointer"
            >
              Reset Data
            </button>
          </div>
        </div>

        {statusMessage && (
          <div
            className={`p-3 rounded-xl text-xs mb-4 ${
              statusMessage.type === "success"
                ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20"
                : "bg-red-500/10 text-red-700 dark:text-red-300 border border-red-500/20"
            }`}
          >
            {statusMessage.text}
          </div>
        )}

        {/* Drag & drop file area */}
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setIsDragging(false);
            if (e.dataTransfer.files?.[0]) {
              handleFile(e.dataTransfer.files[0]);
            }
          }}
          className={`rounded-xl border-2 border-dashed p-6 text-center transition-colors cursor-pointer mb-4 ${
            isDragging
              ? "border-emerald-500 bg-emerald-500/10"
              : "border-zinc-300 dark:border-zinc-700 hover:border-zinc-400 dark:hover:border-zinc-600 bg-zinc-50/50 dark:bg-zinc-950/40"
          }`}
        >
          <div className="text-2xl mb-1.5">📥</div>
          <p className="text-xs font-semibold text-zinc-800 dark:text-zinc-200 mb-0.5">
            Drop inventory.json or veterans.json
          </p>
          <p className="text-[11px] text-zinc-500 mb-3">
            Located in <code>%USERPROFILE%\Documents\Kyumaru\</code>
          </p>
          <label className="inline-flex items-center px-3 py-1.5 rounded-lg bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 text-xs font-medium cursor-pointer hover:bg-zinc-800 dark:hover:bg-white shadow-xs">
            <span>Browse File</span>
            <input
              type="file"
              accept=".json"
              onChange={(e) => {
                if (e.target.files?.[0]) handleFile(e.target.files[0]);
              }}
              className="sr-only"
            />
          </label>
        </div>

        {/* Or Paste Code */}
        <div className="space-y-2">
          <label className="text-xs font-medium text-zinc-600 dark:text-zinc-400 block">
            Or paste sync URL / JSON snippet:
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={pastedData}
              onChange={(e) => setPastedData(e.target.value)}
              placeholder="#data=... or raw JSON"
              className="flex-1 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-3 py-1.5 text-xs text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:border-emerald-500 focus:outline-hidden"
            />
            <button
              type="button"
              onClick={() => {
                if (pastedData.trim()) processJson(pastedData.trim());
              }}
              className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-xl shadow-xs transition-colors cursor-pointer shrink-0"
            >
              Apply
            </button>
          </div>
        </div>

        <div className="mt-4 pt-3 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-between text-[11px] text-zinc-400">
          <span>Zero data sent to any server</span>
          <button
            onClick={onClose}
            className="text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 font-medium"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
