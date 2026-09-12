import { describe, expect, test } from "bun:test";
import { extractCharacterPaths, parseCharacterPage } from "./fetch-gametora";

const SITEMAP_SNIPPET = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
<url><loc>https://gametora.com/umamusume/characters/100101-special-week</loc></url>
<url><loc>https://gametora.com/umamusume/characters/113301-chrono-genesis</loc></url>
<url><loc>https://gametora.com/umamusume/supports/30001-nice-nature</loc></url>
</urlset>`;

// Minimal replica of a GameTora character page: objectiveData sits on pageProps,
// talent_group lives inside charData.
const CHARACTER_PAGE_HTML = `<!DOCTYPE html>
<html><body>
<script id="__NEXT_DATA__" type="application/json">{"props":{"pageProps":{
"isCharCard":true,
"charData":{"talent_group":113301,"base_stats":[95,89,87,82,97]},
"objectiveData":[
{"order":1,"turn":12,"cond_type":1,"cond_value":0,"races":[{"id":9410,"name_en":"Junior Make Debut","name_jp":"ジュニア級メイクデビュー","grade":900,"track":10010,"distance":1800,"terrain":1}]},
{"order":4,"turn":34,"cond_type":1,"cond_value":5,"races":[{"id":1009,"name_en":"Japanese Oaks","name_jp":"オークス","grade":100,"track":10006,"distance":2400,"terrain":1}]}
]}}}</script>
</body></html>`;

describe("fetch-gametora scrapers", () => {
  test("extractCharacterPaths collects unique character page refs from the sitemap", () => {
    const refs = extractCharacterPaths(SITEMAP_SNIPPET);
    expect(refs).toHaveLength(2);
    expect(refs[0]).toEqual({ cardId: 100101, path: "/umamusume/characters/100101-special-week" });
    expect(refs[1].cardId).toBe(113301);
  });

  test("parseCharacterPage extracts trimmed objectives and the talent group", () => {
    const parsed = parseCharacterPage(CHARACTER_PAGE_HTML);
    expect(parsed).not.toBeNull();
    expect(parsed!.talentGroup).toBe(113301);
    expect(parsed!.objectives).toHaveLength(2);

    const [debut, oaks] = parsed!.objectives;
    expect(debut.condValue).toBe(0);
    expect(debut.races[0]).toEqual({
      id: 9410,
      nameEn: "Junior Make Debut",
      nameJp: "ジュニア級メイクデビュー",
      grade: 900,
      track: 10010,
      distance: 1800,
      terrain: 1,
    });
    expect(oaks.condValue).toBe(5); // 5th or better — not a must-win
    expect(oaks.races[0].id).toBe(1009);
  });

  test("parseCharacterPage returns null for pages without objectiveData", () => {
    expect(parseCharacterPage("<html><script id=\"__NEXT_DATA__\" type=\"application/json\">{\"props\":{\"pageProps\":{}}}</script></html>")).toBeNull();
    expect(parseCharacterPage("<html>no data blob</html>")).toBeNull();
  });
});
