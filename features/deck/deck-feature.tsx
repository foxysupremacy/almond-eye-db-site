"use client";

import DeckPicker from "./screens/deck-picker";
import SkillList from "./screens/skill-list";

export function DeckFeature() {
  return (
    <div className="flex flex-col gap-6 sm:gap-8">
      <DeckPicker />
      <SkillList />
    </div>
  );
}
