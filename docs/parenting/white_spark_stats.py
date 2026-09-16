#!/usr/bin/env python3
"""White-spark statistics over a kyumaru veterans.json export.

Usage: python3 white_spark_stats.py [path/to/veterans.json]

Tests the generation rule (each learned skill rolls independently:
20% base / 25% ◎ / 40% gold, +2.5% per pedigree ancestor holding the same
factor — see factor_guide.md lines 60-63):
  1. skill sparks vs skills learned, bucketed — a hard cap would clamp
     both the ratio and the bucket max; independent rolls won't.
  2. race sparks vs unique G1 wins (per-win roll, duplicate wins don't count).
  3. duplicate identical factors in factor_info_array.
Requires the site's affinity.json for the G1 saddle set.
"""

import collections
import json
import statistics
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
DEFAULT = ROOT / "kyumaru" / "responses" / "veterans.json"
G1_SADDLES = set(json.loads((ROOT / "almond-eye-db-site/lib/data/affinity.json").read_text())["g1Saddles"])


def factor_type(fid: int) -> str:
    s = str(fid)
    if len(s) == 7:
        return {"1": "race", "2": "skill", "3": "scenario"}.get(s[0], "gene")
    return {"3": "blue", "4": "pink", "8": "unique"}.get(str(len(s)), "other")


def main() -> None:
    path = Path(sys.argv[1]) if len(sys.argv) > 1 else DEFAULT
    data = json.loads(path.read_text())
    vets = data if isinstance(data, list) else next(v for v in data.values() if isinstance(v, list))
    print(f"veterans: {len(vets)}  ({path})\n")

    rows = []
    for v in vets:
        fa = v.get("factor_info_array") or []
        counts = collections.Counter(factor_type(f["factor_id"]) for f in fa)
        n_sk = len(v.get("skill_array") or [])
        g1_wins = len({s for s in (v.get("win_saddle_id_array") or []) if s in G1_SADDLES})
        rows.append({"sk": counts.get("skill", 0), "race": counts.get("race", 0),
                     "white": sum(counts[k] for k in ("skill", "race", "scenario", "gene")),
                     "n_sk": n_sk, "g1": g1_wins, "rank": v.get("rank_score", 0),
                     "dupes": len(fa) != len({f["factor_id"] for f in fa})})

    print("=== skill sparks vs skills learned (cap test: max must rise with n, ratio must not collapse) ===")
    print(f"{'skills':>10} {'n':>4} {'avg_sk':>7} {'ratio':>7} {'max_sk':>7} {'E@20%':>6} {'E@25%':>6}")
    buckets = collections.defaultdict(list)
    for r in rows:
        if r["n_sk"] >= 20:
            buckets[r["n_sk"] // 10 * 10].append(r)
    for b in sorted(buckets):
        rs = buckets[b]
        print(f"{b:>4}-{b+9:<4} {len(rs):>4} {statistics.mean(x['sk'] for x in rs):>7.1f} "
              f"{statistics.mean(x['sk']/x['n_sk'] for x in rs):>7.3f} {max(x['sk'] for x in rs):>7} "
              f"{b*0.2:>6.1f} {b*0.25:>6.1f}")

    print("\n=== race sparks vs unique G1 wins ===")
    pairs = [(r["g1"], r["race"]) for r in rows if r["g1"] >= 3]
    for g in sorted({p[0] for p in pairs}):
        ys = [y for x, y in pairs if x == g]
        print(f"  {g:>2} G1 wins -> avg race sparks {statistics.mean(ys):.2f} (n={len(ys)})")
    if pairs:
        ratio = statistics.mean(y / x for x, y in pairs)
        print(f"  overall ratio: {ratio:.3f}")

    dupes = sum(r["dupes"] for r in rows)
    print(f"\nveterans with duplicate identical factors: {dupes}/{len(rows)}")
    print(f"max: skill sparks {max(r['sk'] for r in rows)}, white total {max(r['white'] for r in rows)}")


if __name__ == "__main__":
    main()
