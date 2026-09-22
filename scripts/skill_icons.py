"""Shared skill icon resolution for data pipeline scripts.

Maps Uma Musume ability_type and rarity to standard icon_id (TTSSV format)
when master.mdb has icon_id = 0 or missing.
"""
from typing import Any, Mapping, Optional


def map_ability_type_to_icon_id(
    ability_type: Optional[int],
    rarity: int = 1,
    float_ability_value: float = 0.0,
    target_type: int = 1,
) -> int:
    """Map an ability_type_1_1 and rarity to the standard 5-digit icon_id.

    Icon ID Structure: [category_prefix][rarity_suffix]
    Rarity suffix:
      1: White / inherit (rarity 1)
      2: Gold (rarity 2)
      3: Unique (rarity 3, 4, 5)
      6: Evolved (rarity 6)

    Category prefixes:
      2001: Speed buff (types 21, 22, 27)
      2002: Acceleration buff (type 9)
      2004: Stamina recovery / Heal (type 31)
      2005: Positioning / Lane movement (type 28)
      1001: Passive Speed (type 1)
      1002: Passive Stamina (type 2)
      1003: Passive Power (type 3)
      1004: Passive Guts (type 4)
      1005: Passive Wisdom (type 5)
      3001: Speed debuff (negative 21/22/27)
      3005: Accel debuff (negative 9)
      3004: Stamina debuff (negative 31)
    """
    if rarity == 1:
        suffix = 1
    elif rarity == 2:
        suffix = 2
    elif rarity in (3, 4, 5):
        suffix = 3
    elif rarity == 6:
        suffix = 6
    else:
        suffix = 1

    # Check for debuffs: negative ability value or debuff target type
    is_debuff = float_ability_value < 0 or target_type in (2, 3, 4, 5, 6, 7, 8, 9, 10)

    if is_debuff:
        if ability_type in (21, 22, 27):
            return 30010 + suffix
        elif ability_type == 9:
            return 30050 + suffix
        elif ability_type == 31:
            return 30040 + suffix
        else:
            return 30010 + suffix

    # Positive / Buff skills
    if ability_type in (21, 22, 27):
        return 20010 + suffix
    elif ability_type == 9:
        return 20020 + suffix
    elif ability_type == 31:
        return 20040 + suffix
    elif ability_type == 28:
        return 20050 + suffix
    elif ability_type == 1:
        return 10010 + (4 if suffix == 1 else suffix)
    elif ability_type == 2:
        return 10020 + suffix
    elif ability_type == 3:
        return 10030 + suffix
    elif ability_type == 4:
        return 10040 + suffix
    elif ability_type == 5:
        return 10050 + suffix
    else:
        # Default fallback is speed buff
        return 20010 + suffix


def resolve_skill_icon_id(
    row_or_dict: Mapping[str, Any],
    parent_icon_id: Optional[int] = None,
) -> int:
    """Resolve a skill's icon_id.

    Priority:
    1. Existing non-zero icon_id in data
    2. Derived from parent_icon_id prefix (for inherit/evolved skills)
    3. Derived from ability_type_1_1, rarity, ability_value, target_type
    """
    if not isinstance(row_or_dict, dict):
        try:
            row_or_dict = dict(row_or_dict)
        except Exception:
            pass

    existing_icon = row_or_dict.get("icon_id") or row_or_dict.get("iconId")
    if existing_icon and int(existing_icon) != 0:
        return int(existing_icon)

    rarity = int(row_or_dict.get("rarity") or 1)
    suffix = 1 if rarity == 1 else (2 if rarity == 2 else (6 if rarity == 6 else 3))

    # If parent has a known icon, preserve the category prefix
    if parent_icon_id and int(parent_icon_id) != 0:
        prefix = int(parent_icon_id) // 10
        return prefix * 10 + suffix

    # Extract ability details from row or conditionGroups
    ability_type = row_or_dict.get("ability_type_1_1")
    ability_val = row_or_dict.get("float_ability_value_1_1", 0.0)
    target_type = row_or_dict.get("target_type_1_1", 1)

    if ability_type is None and "conditionGroups" in row_or_dict:
        cgroups = row_or_dict.get("conditionGroups") or []
        for cg in cgroups:
            for eff in cg.get("effects", []):
                if eff.get("type"):
                    ability_type = eff["type"]
                    ability_val = eff.get("value", 0.0)
                    target_type = eff.get("target", 1)
                    break
            if ability_type is not None:
                break

    return map_ability_type_to_icon_id(
        ability_type=ability_type,
        rarity=rarity,
        float_ability_value=float(ability_val or 0.0),
        target_type=int(target_type or 1),
    )
