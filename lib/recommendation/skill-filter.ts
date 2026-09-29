import type { SkillDetail, SkillMeta } from "../data/types";

export interface SkillFilterMatch {
  matches: boolean;
  isSpecialized: boolean;
}

export interface SkillFilterInput {
  meta?: SkillMeta;
  rawSkill?: Pick<SkillDetail, "tags" | "conditionGroups">;
  style: number | null;
  distance: number | null;
  surface: number | null;
}

/**
 * Match a skill against the requested style, distance, and surface.
 * Prefer curated metadata and fall back to tags/condition expressions when
 * metadata has not been generated for a skill yet.
 */
export function matchSkillFilter({
  meta,
  rawSkill,
  style,
  distance,
  surface,
}: SkillFilterInput): SkillFilterMatch {
  if (meta) {
    let isSpecialized = false;

    if (style !== null) {
      const checkStyle = style === 5 ? 1 : style;
      if (meta.styles.length > 0) {
        if (!meta.styles.includes(checkStyle)) return { matches: false, isSpecialized: false };
        isSpecialized = true;
      }
    }

    if (distance !== null && meta.distances.length > 0) {
      if (!meta.distances.includes(distance)) return { matches: false, isSpecialized: false };
      isSpecialized = true;
    }

    if (surface !== null && meta.surfaces.length > 0) {
      if (!meta.surfaces.includes(surface)) return { matches: false, isSpecialized: false };
      isSpecialized = true;
    }

    return { matches: true, isSpecialized };
  }

  if (!rawSkill) return { matches: false, isSpecialized: false };

  let isSpecialized = false;
  const tags = rawSkill.tags || [];
  const allCondStr = (rawSkill.conditionGroups || [])
    .map((group) => `${group.condition || ""} ${group.precondition || ""}`)
    .join(" ");

  if (style !== null) {
    const checkStyle = style === 5 ? 1 : style;
    const styleTags: number[] = [];
    if (tags.includes("run")) styleTags.push(1);
    if (tags.includes("ldr")) styleTags.push(2);
    if (tags.includes("bet")) styleTags.push(3);
    if (tags.includes("cha")) styleTags.push(4);

    const styleCondMatches = [...allCondStr.matchAll(/running_style==(\d+)/g)].map((m) =>
      parseInt(m[1], 10)
    );
    const requiredStyles = Array.from(new Set([...styleTags, ...styleCondMatches]));
    if (requiredStyles.length > 0) {
      if (!requiredStyles.includes(checkStyle)) return { matches: false, isSpecialized: false };
      isSpecialized = true;
    }
  }

  if (distance !== null) {
    const distTags: number[] = [];
    if (tags.includes("sho")) distTags.push(1);
    if (tags.includes("mil")) distTags.push(2);
    if (tags.includes("med")) distTags.push(3);
    if (tags.includes("lon")) distTags.push(4);

    const distCondMatches = [...allCondStr.matchAll(/distance_type==(\d+)/g)].map((m) =>
      parseInt(m[1], 10)
    );
    const requiredDistances = Array.from(new Set([...distTags, ...distCondMatches]));
    if (requiredDistances.length > 0) {
      if (!requiredDistances.includes(distance)) return { matches: false, isSpecialized: false };
      isSpecialized = true;
    }
  }

  if (surface !== null) {
    const surfTags: number[] = [];
    if (tags.includes("tur")) surfTags.push(1);
    if (tags.includes("dir")) surfTags.push(2);

    const surfCondMatches = [...allCondStr.matchAll(/ground_type==(\d+)/g)].map((m) =>
      parseInt(m[1], 10)
    );
    const requiredSurfaces = Array.from(new Set([...surfTags, ...surfCondMatches]));
    if (requiredSurfaces.length > 0) {
      if (!requiredSurfaces.includes(surface)) return { matches: false, isSpecialized: false };
      isSpecialized = true;
    }
  }

  return { matches: true, isSpecialized };
}
