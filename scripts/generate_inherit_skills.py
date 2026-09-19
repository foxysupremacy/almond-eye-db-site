#!/usr/bin/env python3
"""
Generate inherited-unique skill data for AlmondEyeDB from master.mdb.

Source of truth: skill_data rows where unique_skill_id_1 != 0 — per Zeno Rob
Roy's mdb guide, those rows ARE the inherited (white) versions of unique
skills; unique_skill_id_1 points at the full 3-star unique, unique_skill_id_2
at the 1-star/2-star version when the horse upgrades from a lower base star.

Outputs (into almond-eye-db-site/lib/data/):
  skills-inherit.json        inherit skill entries, same schema as skills.json
  unique-inherit-map.json    { originalUniqueSkillId: inheritSkillId }

English names/descriptions come from the GameTora dump (skills.json
gene_version) as a temporary fallback; hachimi cat 48 is skipped because its
inherit-id entries are stale copies of the full unique's description.

Usage:
  python3 scripts/generate_inherit_skills.py [path/to/master.mdb]
"""

import json
import os
import re
import sqlite3
import sys

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if os.path.isdir(os.path.join(REPO_ROOT, "lib", "data")):
    SITE_LIB_DATA = os.path.join(REPO_ROOT, "lib", "data")       # in-repo layout
else:
    SITE_LIB_DATA = os.path.join(REPO_ROOT, "almond-eye-db-site", "lib", "data")  # sibling layout

# Korean text (untranslated GameTora gene rows / KR-client mdb text_data) must
# never win over an available English name.
HANGUL_RE = re.compile(r"[\uac00-\ud7af\u1100-\u11ff]")

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from _env import load_env

load_env()

DETAIL_COLUMNS = ("precondition", "condition", "float_ability_time", "ability_type", "float_ability_value", "target_type")
N_ABILITIES = 3


def load_json(path):
    if not os.path.exists(path):
        return None
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def build_condition_groups(row):
    """Mirror the GameTora condition_groups schema: one group per skill detail."""
    groups = []
    for d in (1, 2):
        cond = row[f"condition_{d}"]
        base_time = row[f"float_ability_time_{d}"]
        if not cond or not base_time:
            continue
        effects = []
        for a in range(1, N_ABILITIES + 1):
            atype = row[f"ability_type_{d}_{a}"]
            if not atype:
                continue
            effect = {"type": atype, "value": row[f"float_ability_value_{d}_{a}"]}
            target = row[f"target_type_{d}_{a}"]
            if target not in (0, 1):
                effect["target"] = target
            effects.append(effect)
        if not effects:
            continue
        groups.append(
            {
                "condition": cond,
                "precondition": row[f"precondition_{d}"] or None,
                "base_time": base_time,
                "effects": effects,
            }
        )
    return groups


def pick_name_en(gene, parent_name_en, mdb_name):
    """EN name for an inherit skill: first candidate free of Hangul wins.

    Priority: GameTora gene EN -> parent unique's EN name (site skills.json) ->
    GameTora KO/TW -> raw mdb text. The parent's EN name outranks gene KO/TW
    because GameTora often lags on gene_version translations for newer uniques
    (e.g. evolved uniques ship KO/TW only); the white inherit keeps the parent's
    name by design. Only when nothing else exists does a Korean name survive.
    """
    candidates = [
        gene.get("name_en"),
        gene.get("enname"),
        parent_name_en,
        gene.get("name_ko"),
        gene.get("name_tw"),
        mdb_name,
    ]
    text = [str(c).strip() for c in candidates if c and str(c).strip()]
    for name in text:
        if not HANGUL_RE.search(name):
            return name
    return text[0] if text else ""


def main():
    mdb_path = sys.argv[1] if len(sys.argv) > 1 else os.environ.get("UMAMUSUME_MDB_PATH", "")
    if not mdb_path:
        print(
            "Error: UMAMUSUME_MDB_PATH is not set.\n"
            "Put it in .env (repo root) or the environment, or pass the path:\n"
            "  python3 scripts/generate_inherit_skills.py <path/to/master.mdb>"
        )
        sys.exit(1)
    if not os.path.exists(mdb_path):
        print(f"Error: master.mdb not found at {mdb_path}")
        sys.exit(1)

    # GameTora raw skill dump (sibling workspace file) — optional; without it
    # EN descriptions degrade to empty and EN names fall back to the parent
    # unique's site name.
    gametora = (
        load_json(os.path.join(REPO_ROOT, "skills.json"))
        or load_json(os.path.join(os.path.dirname(REPO_ROOT), "skills.json"))
        or []
    )
    if not gametora:
        print("Notice: raw skills.json (GameTora dump) not found, EN fallbacks limited to site data.")
    gametora_by_id = {s["id"]: s for s in gametora}
    site_skills = load_json(os.path.join(SITE_LIB_DATA, "skills.json")) or []
    site_name_by_id = {s["id"]: s["nameEn"] for s in site_skills}

    con = sqlite3.connect(f"file:{mdb_path}?mode=ro", uri=True)
    con.row_factory = sqlite3.Row
    rows = con.execute(
        """
        SELECT sd.*, tn.text AS name_text, td.text AS desc_text
        FROM skill_data sd
        LEFT JOIN text_data tn ON tn.category = 47 AND tn."index" = sd.id
        LEFT JOIN text_data td ON td.category = 48 AND td."index" = sd.id
        WHERE sd.unique_skill_id_1 != 0
        ORDER BY sd.id
        """
    ).fetchall()
    con.close()
    print(f"master.mdb: {len(rows)} inherited-unique skill rows")

    entries = []
    inherit_map = {}
    no_en_desc = 0
    for row in rows:
        inherit_id = row["id"]
        orig_id = row["unique_skill_id_1"]
        base_id = row["unique_skill_id_2"]

        gene = gametora_by_id.get(orig_id, {}).get("gene_version") or {}
        parent_name_en = site_name_by_id.get(orig_id)

        name_en = pick_name_en(gene, parent_name_en, row["name_text"])
        # hachimi cat 48 inherit entries are stale copies of the full unique's
        # description, so the GameTora gene dump is the only EN desc fallback.
        desc_en = (gene.get("desc_en") or "").strip()
        if not desc_en:
            no_en_desc += 1
        name_jp = (row["name_text"] or parent_name_en or name_en).strip()
        desc_jp = (row["desc_text"] or "").strip()

        entries.append(
            {
                "id": inherit_id,
                "nameEn": name_en,
                "nameJp": name_jp,
                "descEn": desc_en,
                "descJp": desc_jp,
                "rarity": row["rarity"],
                "iconId": row["icon_id"],
                "conditionGroups": build_condition_groups(row),
            }
        )

        # Prefer the standard white inherit when an evolved (rarity 6) inherit
        # row also points at the same original unique.
        for key in (orig_id, base_id):
            if not key:
                continue
            existing = inherit_map.get(str(key))
            if existing is None or (row["rarity"] == 1 and existing.get("rarity") != 1):
                inherit_map[str(key)] = {"id": inherit_id, "rarity": row["rarity"]}

    # Validate against the site's character index: every uniqueSkillId that a
    # parent can contribute must resolve to an inherit row.
    chars = load_json(os.path.join(SITE_LIB_DATA, "characters.json")) or []
    chara_uniques = sorted({c["uniqueSkillId"] for c in chars if c.get("uniqueSkillId")})
    missing = [u for u in chara_uniques if str(u) not in inherit_map and u not in site_name_by_id]
    unmapped = [u for u in chara_uniques if str(u) not in inherit_map]
    print(f"character uniques: {len(chara_uniques)}, mapped to inherit: {len(chara_uniques) - len(unmapped)}, unmapped: {len(unmapped)}")
    if missing:
        print(f"  WARNING not in mdb or site data: {missing}")

    skills_out = os.path.join(SITE_LIB_DATA, "skills-inherit.json")
    with open(skills_out, "w", encoding="utf-8") as f:
        json.dump(entries, f, ensure_ascii=False, separators=(",", ":"))
    print(f"Wrote {len(entries)} inherit skills to {skills_out}")

    map_out = os.path.join(SITE_LIB_DATA, "unique-inherit-map.json")
    with open(map_out, "w", encoding="utf-8") as f:
        json.dump({k: v["id"] for k, v in sorted(inherit_map.items(), key=lambda kv: int(kv[0]))}, f, indent=0)
    print(f"Wrote {len(inherit_map)} unique->inherit mappings to {map_out}")
    print(f"inherit skills without EN description: {no_en_desc}/{len(entries)}")
    hangul_named = [e for e in entries if HANGUL_RE.search(e["nameEn"])]
    if hangul_named:
        print(
            f"  WARNING {len(hangul_named)} inherit skills still have Korean names "
            f"(no EN source anywhere): {[e['id'] for e in hangul_named]}"
        )

    weave = next((e for e in entries if e["id"] == 901331), None)
    if weave:
        print(f"sanity 901331 (Weaving History): rarity={weave['rarity']} groups={len(weave['conditionGroups'])} effects={weave['conditionGroups'][0]['effects']}")


if __name__ == "__main__":
    main()
