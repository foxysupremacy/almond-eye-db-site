import { afterEach, expect, test } from "bun:test";
import { act, cleanup, render, screen } from "@testing-library/react";
import { useRaceImpactProfile } from "@/app/common/hooks/use-race-impact-profile";
import { defaultRaceImpactProfile, RACE_IMPACT_PROFILE_KEY, saveRaceImpactProfile } from "@/lib/race-impact";

afterEach(() => { cleanup(); localStorage.removeItem(RACE_IMPACT_PROFILE_KEY); });

function ProfileProbe({ label }: { label: string }) {
  const [raceImpactProfile, updateRaceImpactProfile] = useRaceImpactProfile();
  return <button onClick={() => updateRaceImpactProfile({ ...raceImpactProfile, stats: { ...raceImpactProfile.stats, power: 1234 } })}>{label}: {raceImpactProfile.stats.power}</button>;
}

test("inspectors and feature consumers share saved profile hydration and same-tab updates", () => {
  saveRaceImpactProfile({ ...defaultRaceImpactProfile(), stats: { ...defaultRaceImpactProfile().stats, power: 1100 } });
  render(<><ProfileProbe label="Inspector" /><ProfileProbe label="Visualizer" /></>);
  expect(screen.getByRole("button", { name: "Inspector: 1100" })).toBeTruthy();
  expect(screen.getByRole("button", { name: "Visualizer: 1100" })).toBeTruthy();
  act(() => screen.getByRole("button", { name: "Visualizer: 1100" }).click());
  expect(screen.getByRole("button", { name: "Inspector: 1234" })).toBeTruthy();
  expect(JSON.parse(localStorage.getItem(RACE_IMPACT_PROFILE_KEY)!).stats.power).toBe(1234);
});

test("cross-tab profile changes rehydrate every active consumer", () => {
  render(<><ProfileProbe label="Inspector" /><ProfileProbe label="Parenting" /></>);
  const next = { ...defaultRaceImpactProfile(), stats: { ...defaultRaceImpactProfile().stats, power: 1500 } };
  act(() => {
    localStorage.setItem(RACE_IMPACT_PROFILE_KEY, JSON.stringify(next));
    window.dispatchEvent(new StorageEvent("storage", { key: RACE_IMPACT_PROFILE_KEY }));
  });
  expect(screen.getByRole("button", { name: "Inspector: 1500" })).toBeTruthy();
  expect(screen.getByRole("button", { name: "Parenting: 1500" })).toBeTruthy();
});
