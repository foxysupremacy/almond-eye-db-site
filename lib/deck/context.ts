import { createContext, useContext } from "react";
import type { DeckContextValue } from "./types";

export const DeckContext = createContext<DeckContextValue | null>(null);

export function useDeck(): DeckContextValue {
  const ctx = useContext(DeckContext);
  if (!ctx) throw new Error("useDeck must be used within a DeckProvider");
  return ctx;
}
