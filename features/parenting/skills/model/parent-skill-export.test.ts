import { describe, expect, test } from "bun:test";
import { exportFileName, formatSkillExport } from "./parent-skill-export";

describe("parent skill export", () => {
  test("formats an alphabetically sorted numbered list with count header", () => {
    const text = formatSkillExport("Unique Targets", [
      { id: 1, nameEn: "straightaway Adept", nameJp: "直線巧者", sourceLabel: "Card A" },
      { id: 2, nameEn: "Corner Recovery", nameJp: "コーナー", sourceLabel: null },
      { id: 3, nameEn: "Acceleration" },
    ]);
    expect(text).toBe(
      "Unique Targets (3)\n1. Acceleration\n2. Corner Recovery (コーナー)\n3. straightaway Adept (直線巧者) — Card A",
    );
  });

  test("falls back to the id label when a skill has no name", () => {
    expect(formatSkillExport("X", [{ id: 3 }])).toBe("X (1)\n1. Skill #3");
  });

  test("builds a safe file name", () => {
    expect(exportFileName("Unique Targets")).toBe("parent-skills-unique-targets.txt");
    expect(exportFileName("???")).toBe("parent-skills-list.txt");
  });
});
