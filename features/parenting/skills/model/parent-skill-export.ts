export interface ExportableSkill {
  id: number;
  nameEn?: string | null;
  nameJp?: string | null;
  sourceLabel?: string | null;
}

export function formatSkillExport(title: string, skills: readonly ExportableSkill[]): string {
  const label = (skill: ExportableSkill) =>
    skill.nameEn?.trim() || skill.nameJp?.trim() || `Skill #${skill.id}`;
  const sorted = [...skills].sort((a, b) =>
    label(a).localeCompare(label(b), "en", { sensitivity: "base", numeric: true }),
  );
  const lines = sorted.map((skill, index) => {
    const en = skill.nameEn?.trim();
    const jp = skill.nameJp?.trim();
    const name = en && jp && en !== jp ? `${en} (${jp})` : en || jp || `Skill #${skill.id}`;
    const source = skill.sourceLabel?.trim();
    return `${index + 1}. ${name}${source ? ` — ${source}` : ""}`;
  });
  return [`${title} (${skills.length})`, ...lines].join("\n");
}

export function exportFileName(title: string): string {
  const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return `parent-skills-${slug || "list"}.txt`;
}
