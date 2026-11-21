// Spark names: the factor list comes from GameTora and carries the Global
// client's official English names, while the rest of the site shows the
// JP-server translations from skills.json. Align skill sparks with the site.

import { skillsById } from "../data/registry";
import type { DecodedFactor } from "./factor-decoder";
import { getCanonicalFactorName } from "./affinity-engine";

let skillByJpName: Map<string, string> | null = null;
function englishSkillNameForJp(nameJp: string): string | null {
  if (!skillByJpName) {
    skillByJpName = new Map();
    for (const skill of skillsById.values()) {
      if (skill.nameJp && skill.nameEn && !skillByJpName.has(skill.nameJp)) skillByJpName.set(skill.nameJp, skill.nameEn);
    }
  }
  return skillByJpName.get(nameJp) ?? null;
}

const withName = (factor: DecodedFactor, name: string): DecodedFactor => ({ ...factor, name, nameEn: name });

/** Display copy of a spark using the site's skill names. Race and scenario sparks keep their own names. */
export function localizeSpark(factor: DecodedFactor): DecodedFactor {
  const isSkillSpark = factor.category === "skill" || factor.type === "green";
  if (isSkillSpark && factor.skillIds?.length) {
    const skillName = skillsById.get(factor.skillIds[0])?.nameEn;
    if (skillName) return withName(factor, skillName);
  }
  if (factor.name === "Factor") {
    const nameJp = getCanonicalFactorName(factor.factorId);
    if (nameJp) return withName(factor, englishSkillNameForJp(nameJp) ?? nameJp);
  }
  return factor;
}
