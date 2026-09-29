"use client";

// Re-uses DeckPicker with mode="parent" for the Parent Deck.
// Uses the identical 6-slot card picker and display from Main Deck.
import { DeckPicker } from "@/features/deck/screens";

export default function ParentDeckPicker() {
  return <DeckPicker mode="parent" />;
}
