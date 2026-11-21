// Pure helpers for scripts/fetch-skill-icons.ts (kept separate so they are unit-testable).

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

/** Unique, positive icon ids referenced by skills, ascending. */
export function collectIconIds(skills: ReadonlyArray<{ iconId?: number | string | null }>): number[] {
  const ids = new Set<number>();
  for (const skill of skills) {
    const id = Number(skill.iconId);
    if (Number.isInteger(id) && id > 0) ids.add(id);
  }
  return [...ids].sort((a, b) => a - b);
}

/** Icons with no file under either name the site's SkillIcon tries. */
export function missingIconIds(iconIds: readonly number[], existingFiles: ReadonlySet<string>): number[] {
  return iconIds.filter((id) => !existingFiles.has(`${id}.png`) && !existingFiles.has(`utx_ico_skill_${id}.png`));
}

export function gametoraIconUrl(iconId: number): string {
  return `https://gametora.com/images/umamusume/skill_icons/utx_ico_skill_${iconId}.png`;
}

export function localIconFileName(iconId: number): string {
  return `utx_ico_skill_${iconId}.png`;
}

export function isPng(bytes: Uint8Array): boolean {
  return bytes.length >= PNG_SIGNATURE.length && PNG_SIGNATURE.every((b, i) => bytes[i] === b);
}
