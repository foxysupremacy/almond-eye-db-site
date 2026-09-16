# master.mdb Structure Reference

> Auto-generated from SQLite conversion of master.mdb (Uma Musume Pretty Derby game master data).
> Generated 2026-06-17.

---

## Overview

`master.mdb` is the master-data database for **Uma Musume Pretty Derby**. It contains all game configuration: characters, cards, skills, support cards, races, scenarios, items, missions, events, gacha, team stadium, and localized text.

The database has **~430 tables** organized into the following functional areas:

| Area | Tables | Description |
|------|--------|-------------|
| Text / Localization | `text_data` | All localized text keyed by (category, id, index) |
| Characters | `chara_data`, `chara_type`, `love_rank`, `dress_data`, etc. | Character definitions, stats, models |
| Cards | `card_data`, `card_rarity_data`, `card_talent_*` | Card (gacha/unit) definitions |
| Skills | `skill_data`, `skill_set`, `skill_exp`, `skill_level_value`, `skill_upgrade_*` | Skill definitions and upgrade trees |
| Support Cards | `support_card_data`, `support_card_effect_table`, `support_card_unique_effect`, `support_card_*` | Support card definitions and effects |
| Races | `race`, `race_instance`, `race_condition`, `race_course_set`, `race_bgm`, etc. | Race definitions and conditions |
| Race Commentary | `race_jikkyo_*` | Live race commentary / jikkyo system |
| Single Mode (Training) | `single_mode_*` | Training scenario data (大量) |
| Succession | `succession_*` | Inheritance/factor system |
| Champions Meeting | `champions_*` | Champions Meeting (PvP event) |
| Team Stadium | `team_stadium_*` | Team Stadium mode |
| Heroes | `heroes_*` | Heroes mode |
| Gacha | `gacha_*`, `select_pickup` | Gacha banners and rates |
| Items | `item_data`, `piece_data`, `item_exchange`, `item_pack` | Items and shop |
| Missions | `mission_data`, `mission_race_*` | Mission/objective system |
| Login Bonus | `login_bonus_*` | Login bonus campaigns |
| Stories / Events | `main_story_*`, `chara_story_data`, `story_event_*`, `short_episode` | Story and event data |
| Live | `live_data`, `live_*` | Live concert mode |
| Home Screen | `home_*` | Home screen customization |
| Jukebox | `jukebox_*` | Music player data |
| Campaign | `campaign_*` | Limited-time campaigns |
| Profile / Notes | `note_profile`, `note_profile_text_type` | Character profile notebook |
| Audio | `audio_cuesheet`, `audio_*` | Audio/cue sheet definitions |
| Training Challenge | `training_challenge_*` | Training challenge event |
| Rating Race | `rating_race_*` | Rating race system |
| Team Building | `team_building_*` | Team building event |
| Map Event | `map_event_*` | Map exploration event |
| Factor Research | `factor_research_*` | Factor research gacha |
| Ultimate Race | `ultimate_race_*` | Ultimate race content |
| Jobs | `jobs_*` | Jobs/part-time work system |
| Crane Game | `crane_game_*` | Crane game mini-game |
| Daily Race / Legend Race | `daily_race_*`, `legend_race_*` | Daily and legend races |
| Collect Raid | `collect_raid_*` | Collection raid events |
| Circle | `circle_*` | Circle/guild system |
| Omakase | `omakase_*` | Auto-training (omakase) system |
| Various | `banner_data`, `announce_*`, `transfer_*`, etc. | Banners, announcements, data transfer |

---

## The `text_data` Table — Central Localization Store

The `text_data` table is the primary localization storage. All user-facing Japanese text is stored here.

### Schema

```sql
CREATE TABLE text_data (
    id       INTEGER NOT NULL,   -- parent entity ID (character_id, card_id, skill_id, etc.)
    category INTEGER NOT NULL,   -- text category (which kind of text this is)
    index    INTEGER NOT NULL,   -- sub-index within the category/entity
    text     TEXT    NOT NULL,   -- the actual localized text
    PRIMARY KEY (category, index)
);
```

**Note:** The primary key is `(category, index)`, NOT `(id, category, index)`. Multiple rows can share the same `id`+`category` with different `index` values. `index` encodes the entity the text belongs to (e.g., chara_id, card_id, skill_id).

### Text Categories

| Category | Count | Entity Referenced | Description |
|----------|-------|-------------------|-------------|
| 1 | 230 | `id` → story still/event? | (needs verification) |
| 2 | 230 | `id` → story still/event? | (needs verification) |
| 3 | 41 | | Campaign/pack names |
| 4 | 259 | `id` → `card_data.id` | **Card full names** with rarity tag, e.g. `[スペシャルドリーマー]スペシャルウィーク` |
| 5 | 259 | `id` → `card_data.id` | **Card rarity tag only**, e.g. `[スペシャルドリーマー]` |
| 6 | 169 | `id` → `chara_data.id` | **Character given name** (plain, no rarity), e.g. `スペシャルウィーク` |
| 7 | 169 | `id` → `chara_data.id` | (paired with 6; variant) |
| 8 | 136 | `id` → `chara_data.id` | **Dormitory / residence**, e.g. `栗東寮`, `美浦寮`, `一人暮らし` |
| 9 | 131 | `id` → `chara_data.id` | **School year/grade**, e.g. `中等部`, `高等部` (mirrors 162) |
| 10 | 777 | | Item/piece names? (needs verification) |
| 13 | 663 | | (needs verification) |
| 14 | 497 | | (needs verification) |
| 15 | 497 | | (paired with 14) |
| 16 | 191 | | (needs verification) |
| 17 | 191 | | (paired with 16) |
| 23 | 783 | `id` → `item_data.id`? | **Item names** (needs verification) |
| 24 | 777 | `id` → `item_data.id`? | **Item descriptions** (paired with 23) |
| 25 | 27 | | (needs verification) |
| 26 | 663 | | (paired with 13) |
| 27 | 58 | | (needs verification) |
| 28 | 3378 | `id` → `race_instance.id` | **Race full names**, e.g. `フェブラリーステークス`, `高松宮記念` |
| 29 | 3356 | `id` → `race_instance.id` | **Race short names / abbreviations**, e.g. `フェブラリーS`, `高松宮記念` |
| 31 | 17 | | (needs verification) |
| 32 | 2781 | `id` → `race_instance.id` | **Race names** (another variant/length) |
| 33 | 879 | `id` → `race_instance.id` | **Race names** (another variant) |
| 34 | 17 | | (needs verification) |
| 35 | 17 | | (needs verification) |
| 36 | 325 | | (needs verification) |
| 38 | 325 | | (paired with 36) |
| 39 | 93 | | (needs verification) |
| 40 | 93 | | (paired with 39) |
| 41 | 20 | | (needs verification) |
| 42 | 227 | | **Character family name?** (needs verification) |
| 47 | 2082 | `id` → `skill_data.id` | **Skill names**, e.g. `波乱注意砲！`, `アクセルX`, `レッドエース` |
| 48 | 2082 | `id` → `skill_data.id` | **Skill descriptions**, full effect text |
| 49 | 227 | | (paired with 42) |
| 55 | 53 | | (needs verification) |
| 59 | 1109 | `id` → accessory item | **Accessory / jewel item names**, e.g. `ジュエルネフライト`, `ブリッジコンプ` |
| 63 | 355 | | (needs verification) |
| 64 | 174 | | (needs verification) |
| 65 | 1360 | `id` → title | **Trainer title names**, e.g. `新人トレーナー`, `頼れるトレーナー` |
| 66 | 1360 | `id` → title | **Trainer title descriptions** (paired with 65) |
| 67 | 8438 | `id` → `mission_data.id` | **Mission objective text**, e.g. `育成でレースに勝利しよう` |
| 68 | 596 | | (needs verification) |
| 69 | 596 | | (paired with 68) |
| 70 | 243 | `id` → `login_bonus_data.id` | **Login bonus names**, e.g. `ログインボーナス`, `スタートダッシュログインキャンペーン` |
| 75 | 539 | `id` → story/event | Story event card name with rarity tag, e.g. `[トレセン学園]スペシャルウィーク` |
| 76 | 539 | `id` → story/event | Story event rarity tag only, e.g. `[トレセン学園]` |
| 77 | 539 | `id` → story/event | Story event character given name |
| 78 | 539 | `id` → story/event | Story event character name variant |
| 88 | 539 | `id` → story/event | **Event card introduction / description text** |
| 91 | 2 | | (needs verification) |
| 92 | 917 | `id` → story | **Story event / chapter titles**, e.g. `夢は日本一のウマ娘！`, `『友だちだもんね？』` |
| 93 | 10 | | (needs verification) |
| 94 | 169 | `id` → `chara_data.id` | Character related text (needs verification) |
| 95 | 28 | | (needs verification) |
| 96 | 175 | | (needs verification) |
| 97 | 34 | | (needs verification) |
| 111 | 214 | `id` → honor/title | **Honor/title names**, e.g. `クラシック三冠`, `秋シニア三冠`, `トリプルティアラ` |
| 112 | 10 | | (needs verification) |
| 113 | 258 | | (paired with 114) |
| 114 | 258 | | (paired with 113) |
| 119 | 13 | | (needs verification) |
| 120 | 13 | | (paired with 119) |
| 121 | 10 | | (needs verification) |
| 128 | 191 | `id` → promotion/movie? | (needs verification) |
| 130 | 384 | `id` → nickname | **Nickname mission names (nicknames/titles)**, e.g. `レイニーウマ娘`, `ミス・クラウディ`, `雪の女王` |
| 131 | 384 | `id` → nickname | **Nickname unlock conditions**, e.g. `天気[雨]で4回以上出走し、3勝する` |
| 133 | 3 | | (needs verification) |
| 136 | 4 | | **Audience/spectator labels**, e.g. `観客A`, `観客B` |
| 138 | 166 | | **Training facility / ground names**, e.g. `芝`, `ランニングマシン`, `フィットネスバイク` |
| 139 | 36 | | (needs verification) |
| 140 | 96 | | **Race win margin names**, e.g. `大差`, `10バ身差`, `9バ身差` |
| 141 | 96 | | **Race win margin descriptions**, e.g. `大差で勝利した場合に獲得できるスコア` |
| 142 | 43 | | (needs verification) |
| 143 | 43 | | (paired with 142) |
| 144 | 154 | `id` → `chara_data.id` | **Character catchphrase / tagline**, e.g. `けっぱるべー！夢一直線の純心どさん娘` |
| 147 | 2502 | `id` → `succession_factor.factor_id` | **Factor names**, e.g. `スピード`, `スタミナ`, `パワー` |
| 148 | 7 | | (needs verification) |
| 150 | 397 | `id` → `support_card_effect_table.id` | **Support card effect names**, e.g. `やれやれ、お帰り`, `努力は裏切らない！` |
| 151 | 32 | | **Support card effect type names**, e.g. `友情ボーナス`, `やる気効果アップ`, `スピードボーナス` |
| 152 | 204 | | **NPC names**, e.g. `アキト(NPC)`, `カズキ(NPC)` |
| 154 | 32 | | **Support card effect type descriptions**, e.g. `友情トレーニング発生による効果アップ` |
| 155 | 397 | `id` → `support_card_effect_table.id` | **Support card effect descriptions**, e.g. `スキルPtボーナスと初期賢さアップ` |
| 157 | 153 | `id` → `chara_data.id` | **Birthday** (月日), e.g. `5月2日`, `4月20日` |
| 158 | 131 | `id` → `chara_data.id` | **Height**, e.g. `158㎝`, `161㎝` |
| 159 | 30 | | (needs verification) |
| 160 | 30 | | (paired with 159) |
| 161 | 30 | | (needs verification) |
| 162 | 136 | `id` → `chara_data.id` | **School year/grade**, e.g. `中等部`, `高等部` |
| 163 | 153 | `id` → `chara_data.id` | **Self-introduction text** (profile), e.g. `私、スペシャルウィークって言います！...` |
| 164 | 131 | `id` → `chara_data.id` | **Strengths / specialty** (特技), e.g. `臨場感のある食レポ`, `走り続けること` |
| 165 | 131 | `id` → `chara_data.id` | **Weaknesses** (苦手), e.g. `改札のタッチ＆ゴー`, `人の多い場所` |
| 166 | 131 | `id` → `chara_data.id` | **Ears** (耳) characteristics, e.g. `料理の音に敏感で、ついそばだててしまう` |
| 167 | 131 | `id` → `chara_data.id` | **Tail** (尻尾) characteristics, e.g. `感情のまま動いてしまうのでポーカーは苦手` |
| 168 | 131 | `id` → `chara_data.id` | **Shoe size** (靴サイズ), e.g. `左：23.5cm 右：23.0cm` |
| 169 | 131 | `id` → `chara_data.id` | **Family** (家族) info, e.g. `瞳の色は、産んでくれた母親譲り` |
| 170 | 169 | `id` → `chara_data.id` | **Character name** (profile display), plain name |
| 171 | 139 | | (needs verification) |
| 172 | 2502 | `id` → `succession_factor.factor_id` | **Factor descriptions**, e.g. `スピードとスピード上限がアップする因子です` |
| 173 | 17 | `id` → `chara_data.id` | Profile additional text (used in note_profile) |
| 174 | 2 | | Profile additional text (needs verification) |
| 175 | 20 | | (needs verification) |
| 176 | 1 | | (needs verification) |
| 177 | 5 | | (needs verification) |
| 178 | 2 | | (needs verification) |
| 179 | 1 | | (needs verification) |
| 180 | 21 | | (needs verification) |
| 181 | 19220 | `id` → story/scenario | **Story/scenario chapter titles and event names**, e.g. `デビュー戦の後に`, `プロローグ`, `『はじめまして！』` |
| 182 | 169 | `id` → `chara_data.id` | **Character full name** (plain), e.g. `スペシャルウィーク`, `サイレンススズカ` |
| 184 | 131 | `id` → `chara_data.id` | (character profile variant) |
| 185 | 131 | `id` → `chara_data.id` | **RP recovery messages** (character), e.g. `RPがいっぱいになったみたいです…！` |
| 187 | 645 | | **Campaign/pass/event names**, e.g. `報酬獲得量UP`, `TVアニメ第2期最終回応援ミッション` |
| 188 | 438 | | **Subscription / campaign effect descriptions**, e.g. `育成中に獲得できる対象アイテムの量が2倍になります` |
| 189 | 54 | | (needs verification) |
| 190 | 2338 | `id` → `mission_data.id` | **Limited mission names/titles**, e.g. `育成でウマ娘を1人育成完了しよう` |
| 191 | 436 | `id` → mission | **Mission group titles**, e.g. `『はじめまして！』`, `『いってきます』はここから` |
| 192 | 29 | | (needs verification) |
| 193 | 6 | | (needs verification) |
| 194 | 68 | | (needs verification) |
| 195 | 6 | | (needs verification) |
| 196 | 103 | | (needs verification) |
| 197 | 1 | | (needs verification) |
| 198 | 60 | | (needs verification) |
| 199 | 52 | | (needs verification) |
| 200 | 64 | | (needs verification) |
| 201 | 211 | | (needs verification) |
| 202 | 126 | | (needs verification) |
| 203 | 465 | | **Champions Meeting news commentary** (pre-race) |
| 204 | 1703 | | **Interview questions** (post-race news), e.g. `応援しているファンに一言お願いします。` |
| 205 | 1703 | | **Interview answers** (post-race news), paired with 204 |
| 206 | 46 | | (needs verification) |
| 207 | 135 | | (needs verification) |
| 208 | 24 | | (needs verification) |
| 209 | 135 | | (paired with 207) |
| 210 | 24 | | (paired with 208) |
| 211 | 50 | | (needs verification) |
| 212 | 1 | | (needs verification) |
| 214 | 54 | | (needs verification) |
| 215 | 186 | | (needs verification) |
| 216 | 186 | | (paired with 215) |
| 217 | 186 | | (needs verification) |
| 218 | 5 | | (needs verification) |
| 220 | 31 | | (needs verification) |
| 221 | 13 | | (needs verification) |
| 222 | 45 | | (needs verification) |
| 223 | 9 | | (needs verification) |
| 225 | 53 | | (needs verification) |
| 226 | 53 | | (paired with 225) |
| 227 | 5 | | (needs verification) |
| 228 | 486 | | **Jukebox music comments**, character reactions to songs |
| 229 | 580 | | **News headline templates**, e.g. `<character_name> <bashin>で制す` |
| 230 | 265 | | **Champions Meeting result commentary** |
| 231 | 1572 | | **Post-race interview questions** (variant) |
| 232 | 1572 | | **Post-race interview answers** (variant), paired with 231 |
| 233 | 7 | | (needs verification) |
| 234 | 5 | | (needs verification) |
| 235 | 2 | | (needs verification) |
| 236 | 2 | | (needs verification) |
| 237 | 13 | | (needs verification) |
| 238 | 53 | | (needs verification) |
| 239 | 4 | | (needs verification) |
| 240 | 27 | | (needs verification) |
| 241 | 7 | | (needs verification) |
| 242 | 7 | | (paired with 241) |
| 243 | 93 | | (needs verification) |
| 244 | 93 | | (paired with 243) |
| 245 | 7 | | (needs verification) |
| 246 | 5 | | (needs verification) |
| 247 | 36 | | (needs verification) |
| 248 | 1 | | (needs verification) |
| 249 | 36 | | (paired with 247) |
| 250 | 5 | | (needs verification) |
| 251 | 1 | | (needs verification) |
| 252 | 16 | | (needs verification) |
| 253 | 1 | | (needs verification) |
| 254 | 1 | | (needs verification) |
| 255 | 2 | | (needs verification) |
| 256 | 1 | | (needs verification) |
| 257 | 38 | | (needs verification) |
| 258 | 99 | `id` → `chara_data.id` | **Profile secrets / trivia** (秘密①), e.g. `トウモロコシを食べる時は無言で集中！` |
| 259 | 99 | `id` → `chara_data.id` | **Profile secrets** (秘密②), e.g. wallpaper/hobby trivia |
| 260 | 99 | `id` → `chara_data.id` | **Profile secrets** (秘密③) |
| 261 | 27 | `id` → `chara_data.id` | **Favorite subjects** (得意科目/好きなこと), e.g. `体育なら…！` |
| 262 | 27 | `id` → `chara_data.id` | **Personal achievements/records**, e.g. `日替わりメニューの予想的中率が7割以上` |
| 263 | 27 | `id` → `chara_data.id` | **Weak subjects** (不得意科目/苦手なこと) |
| 264 | 86 | | (needs verification) |
| 265–289 | varies | | Various (mostly single-digit counts; TODO verify) |
| 290 | 1775 | | **Scenario objective / condition text**, e.g. `基礎能力[スタミナ]が600以上になる` |
| 293–318 | varies | | Various (TODO verify) |
| 319 | 120 | | **Scout character description**, e.g. `中距離で活躍したウマ娘` |
| 320 | 120 | | **Scout character request text**, e.g. `求めるのは、ガッツのあるウマ娘だ。` |
| 321 | 120 | | **Scout character condition text**, e.g. `・距離適性：中距離「B」以上...` |
| 322–359 | varies | | Various (TODO verify) |
| 360 | 131 | `id` → `chara_data.id` | **Job return messages** (character), e.g. `<jobs_placename>から戻りましたっ！` |
| 361–371 | varies | | Various (TODO verify) |
| 372 | 147 | `id` → `chara_data.id` | **Character names (English/romanized)**, e.g. `Special Week`, `Silence Suzuka` |
| 373 | 723 | | **Item names (English/romanized)**, e.g. `Jewel Nephrite`, `Bridge Comp` |
| 374 | 6 | | (needs verification) |
| 375 | 233 | | **Single mode scenario effect descriptions**, e.g. `島トレと島合宿期間のトレーニングにスピードボーナス +1` |
| 376 | 141 | | **Character short nicknames**, e.g. `スペ`, `スズカ`, `テイオー` |
| 377–382 | varies | | Various (TODO verify) |
| 383 | 30 | | **Training names** (simple), e.g. `ランニング`, `自然派スプリント` |
| 385–428 | varies | | Various (TODO verify) |
| 429 | 437 | | **Character name with line break** (display variant), e.g. `オグリ\nキャップ` |
| 430–433 | varies | | (TODO verify) |
| 434 | 437 | | **Character name reading/furigana**, e.g. `おぐりきゃっぷ`, `たまもくろす` |
| 444–457 | varies | | Latest additions (TODO verify) |

### Key Text Category Patterns

**Name / Description pairs** — Many categories come in pairs where the odd/even or sequential categories hold names vs descriptions:

| Names | Descriptions | Subject |
|-------|-------------|--------|
| 47 | 48 | Skills |
| 150 | 155 | Support card effects |
| 151 | 154 | Support card effect types |
| 130 | 131 | Nickname missions |
| 65 | 66 | Trainer titles |
| 4 | 5 | Card names (full/rarity tag) |
| 75 | 76,77,78,88 | Event card names |
| 204 | 205 | Post-race interview Q&A |
| 231 | 232 | Post-race interview Q&A (alt) |
| 28 | 29 | Race names (full/abbreviated) |
| 147 | 172 | Factor names/descriptions |
| 319 | 320,321 | Scout descriptions/conditions |

### Character Profile Text Categories

The profile notebook (`note_profile`) references these `text_data` categories:

| Profile Field | `text_type` | Categories | Description |
|--------------|-------------|-----------|-------------|
| Self-intro | 1 | 163, 162, 8, 157 | Introduction, grade, dorm, birthday |
| Stats | 2 | 158, 9 | Height, (grade variant) |
| Strengths | 3 | 164, 165 | 特技 (specialty) |
| Weaknesses | 4 | 166, 167 | Ears, tail traits |
| Personal | 5 | 168 | Shoe size |
| Family | 6 | 169 | Family info |
| Secrets 1 | 10 | 258, 259, 260 | Secret facts ①~③ |
| Secrets 2 | 11 | 261, 262, 263 | Favorite/weak subjects, achievements |

**Correspondence to user-known field names:**

| User Name | Category | Sample Content |
|-----------|----------|---------------|
| `char-name` | 182, 170, 6, 372 | `スペシャルウィーク`, `Special Week` |
| `skill-name` | 47 | `波乱注意砲！`, `アクセルX` |
| `skill-desc` | 48 | `レース中間付近で後方にいるとロングスパートをかけて...` |
| `support-effect-name` | 150 | `やれやれ、お帰り`, `努力は裏切らない！` |
| `support-effect-desc` | 155 | `スキルPtボーナスと初期賢さアップ` |
| `support-effect-unique-desc` | 150/155 (via `support_card_unique_effect.id`) | Unique effect instance descriptions |
| `uma-profile-weight` | (not in text_data; likely in `chara_data` column or calculated) | |
| `uma-profile-shoesize` | 168 | `左：23.5cm 右：23.0cm` |
| `uma-profile-strengths` | 164 | `臨場感のある食レポ` |
| `uma-profile-weaknesses` | 165 | `改札のタッチ＆ゴー` |
| `uma-profile-ears` | 166 | `料理の音に敏感で、ついそばだててしまう` |
| `uma-profile-tail` | 167 | `感情のまま動いてしまうのでポーカーは苦手` |
| `uma-profile-family` | 169 | `瞳の色は、産んでくれた母親譲り` |
| `lesson-talent-bonus` | (likely in `single_mode_*` tables or category 375) | |
| `lesson-live-bonus` | (likely in `single_mode_live_master_bonus` or related) | |
| `factor-desc` | 172 | `スピードとスピード上限がアップする因子です` |
| `scenario-item-desc-*` | 375 (and others) | `島トレと島合宿期間のトレーニングにスピードボーナス +1` |
| `training-names` | 383 | `ランニング`, `自然派スプリント` |
| `training-comments` | 360, 185, 163 | Character training/story comments |
| Card names | 4, 5 | `[スペシャルドリーマー]スペシャルウィーク` |
| Character catchphrase | 144 | `けっぱるべー！夢一直線の純心どさん娘` |
| Race names | 28, 29, 32, 33 | `フェブラリーステークス` / `フェブラリーS` |
| Mission text | 67, 190 | `育成でレースに勝利しよう` |
| Title/honor names | 111 | `クラシック三冠` |
| Nickname/title missions | 130, 131 | `レイニーウマ娘` + condition |
| Story titles | 92, 181 | `夢は日本一のウマ娘！` |

---

## Major Table Groups

### Characters (`chara_data`)

Core character definition table.

```sql
CREATE TABLE chara_data (
    id                          INTEGER PRIMARY KEY,
    birth_year                  INTEGER,  -- birth year
    birth_month                 INTEGER,  -- birth month
    birth_day                   INTEGER,  -- birth day
    last_year                   INTEGER,  -- "last year" (class year?)
    sex                         INTEGER,  -- gender
    image_color_main            TEXT,     -- UI color (main)
    image_color_sub             TEXT,     -- UI color (sub)
    ui_color_main               TEXT,
    ui_color_sub                TEXT,
    ui_training_color_1         TEXT,
    ui_training_color_2         TEXT,
    ui_border_color             TEXT,
    ui_num_color_1              TEXT,
    ui_num_color_2              TEXT,
    ui_turn_color               TEXT,
    ui_wipe_color_1             TEXT,
    ui_wipe_color_2             TEXT,
    ui_wipe_color_3             TEXT,
    ui_speech_color_1           TEXT,
    ui_speech_color_2           TEXT,
    ui_nameplate_color_1        TEXT,
    ui_nameplate_color_2        TEXT,
    height                      INTEGER,  -- height (cm?)
    bust                        INTEGER,  -- bust measurement
    scale                       INTEGER,  -- model scale
    skin                        INTEGER,  -- skin type id
    shape                       INTEGER,  -- body shape
    socks                       INTEGER,  -- socks type
    personal_dress              INTEGER,  -- personal dress id
    tail_model_id               INTEGER,  -- tail model
    race_running_type           INTEGER,  -- running style (逃げ/先行/差し/追込)
    ear_random_time_min         INTEGER,  -- ear animation timing
    ear_random_time_max         INTEGER,
    tail_random_time_min        INTEGER,  -- tail animation timing
    tail_random_time_max        INTEGER,
    story_ear_random_time_min   INTEGER,
    story_ear_random_time_max   INTEGER,
    story_tail_random_time_min  INTEGER,
    story_tail_random_time_max  INTEGER,
    attachment_model_id         INTEGER,
    mini_mayu_shader_type       INTEGER,
    start_date                  INTEGER,  -- release date (unix time)
    chara_category              INTEGER,  -- character category
    love_rank_limit             INTEGER   -- max love/affection rank
);
```

Related tables:
- `chara_type` — Character type definitions
- `chara_data_group` — Character groupings
- `chara_category_motion` — Motion sets by character category
- `chara_motion_set`, `chara_motion_act` — Character motion/animation definitions
- `character_prop_animation` — Prop animation
- `face_type_data`, `facial_mouth_change` — Facial animation
- `random_ear_tail_motion` — Random ear/tail movement
- `dress_data` — Dress/costume definitions
- `chara_dress_color_set`, `chara_dress_color_set_default` — Dress color variants
- `love_rank` — Love/affection rank thresholds
- `need_piece_num_data` — Pieces needed per rarity level

### Cards (`card_data`)

Card (uma unit) definitions for gacha and gameplay.

```sql
-- card_data: main card table (structure TBD from describe_table)
-- Related tables:
--   card_rarity_data: per-rarity card stats
--   card_talent_level_upgrade_item: items needed to upgrade card talent levels
--   card_talent_hint_upgrade: talent hint upgrade data
--   card_talent_upgrade_money_num: money cost for talent upgrades
--   card_talent_level_upgrade_money: money costs per level
```

Card names: `text_data` categories 4 (full with rarity), 5 (rarity tag only).

### Skills (`skill_data`)

Skill definitions (both regular skills and unique skills).

```sql
CREATE TABLE skill_data (
    id                          INTEGER PRIMARY KEY,
    rarity                      INTEGER,   -- skill rarity
    group_id                    INTEGER,   -- skill group
    group_rate                  INTEGER,
    filter_switch               INTEGER,
    grade_value                 INTEGER,   -- skill grade/rank
    skill_category              INTEGER,   -- skill category type
    tag_id                      TEXT,      -- skill tag
    unique_skill_id_1           INTEGER,   -- evolves from / to unique skill
    unique_skill_id_2           INTEGER,
    exp_type                    INTEGER,   -- experience/growth type
    potential_per_default       INTEGER,
    activate_lot                INTEGER,
    priority                    INTEGER,
    precondition_1              TEXT,      -- first trigger condition
    condition_1                 TEXT,      -- first effect condition
    float_ability_time_1        INTEGER,   -- duration
    ability_time_usage_1        INTEGER,
    float_cooldown_time_1       INTEGER,   -- cooldown
    ability_type_1_1            INTEGER,   -- effect type 1-1
    ability_value_usage_1_1     INTEGER,
    additional_activate_type_1_1 INTEGER,
    ability_value_level_usage_1_1 INTEGER,
    float_ability_value_1_1     INTEGER,   -- effect value
    target_type_1_1             INTEGER,   -- target type
    target_value_1_1            INTEGER,
    -- (ability_type_1_2 through target_value_1_3: effect slots 2-3 for condition 1)
    -- (precondition_2 through target_value_2_3: condition 2 with 3 effect slots)
    -- (precondition_3... etc.)
    popularity_add_param_1      INTEGER,
    popularity_add_value_1      INTEGER,
    popularity_add_param_2      INTEGER,
    popularity_add_value_2      INTEGER,
    disp_order                  INTEGER,   -- display sort order
    icon_id                     INTEGER,
    plate_type                  INTEGER,
    disable_singlemode          INTEGER,   -- disabled in single mode?
    disable_count_condition     INTEGER,
    is_general_skill            INTEGER,   -- is general (non-unique) skill
    greater_value_skill_detail  INTEGER,
    start_date                  INTEGER,
    end_date                    INTEGER
);
```

- **Skill names:** `text_data` category 47 (`index` = skill_id * 100 + variant)
- **Skill descriptions:** `text_data` category 48

Related tables:
- `skill_set` — Sets of skills (e.g., for cards)
- `available_skill_set` — Available skill set definitions
- `skill_exp` — Skill experience/leveling table
- `skill_level_value` — Per-level skill effect values
- `skill_upgrade_description` — Skill upgrade descriptions
- `skill_upgrade_speciality` — Skill upgrade specialties
- `skill_upgrade_condition` — Conditions for skill upgrades
- `skill_up_scenario_condition` — Scenario-specific upgrade conditions
- `skill_upgrade_succession_skill` — Succession skill upgrades

### Support Cards (`support_card_data`)

Support/assist card definitions.

```sql
CREATE TABLE support_card_data (
    id                  INTEGER PRIMARY KEY,
    chara_id            INTEGER,  -- character on the card
    rarity              INTEGER,  -- card rarity (R/SR/SSR)
    exchange_item_id    INTEGER,  -- item needed to exchange
    exchange_item_num   INTEGER,  -- number of exchange items
    effect_table_id     INTEGER,  -- FK → support_card_effect_table.id
    unique_effect_id    INTEGER,  -- FK → support_card_unique_effect.id
    command_type        INTEGER,  -- training command type
    command_id          INTEGER,  -- training command id
    support_card_type   INTEGER,  -- support card category
    skill_set_id        INTEGER,  -- FK → skill_set.id
    detail_pos_x        INTEGER,  -- card detail display position
    detail_pos_y        INTEGER,
    detail_scale        INTEGER,
    detail_rot_z        INTEGER,
    start_date          INTEGER,
    disp_order          INTEGER,
    outing_max          INTEGER,  -- max outings
    effect_id           INTEGER
);
```

**Support card effect tables:**

```sql
-- support_card_effect_table: Defines effect values at each limit break level
CREATE TABLE support_card_effect_table (
    id          INTEGER,
    type        INTEGER,  -- effect slot (0 or 1)
    init        INTEGER,  -- initial value
    limit_lv5   INTEGER,  -- value at limit break lv5
    limit_lv10  INTEGER,
    limit_lv15  INTEGER,
    limit_lv20  INTEGER,
    limit_lv25  INTEGER,
    limit_lv30  INTEGER,
    limit_lv35  INTEGER,
    limit_lv40  INTEGER,
    limit_lv45  INTEGER,
    limit_lv50  INTEGER,  -- value at max limit break
    PRIMARY KEY (id, type)
);

-- support_card_unique_effect: Unique support card effects
CREATE TABLE support_card_unique_effect (
    id              INTEGER PRIMARY KEY,
    lv              INTEGER,
    type_0          INTEGER,   -- effect type (slot 0)
    value_0         INTEGER,   -- main value
    value_0_1       INTEGER,   -- sub-values 1-4
    value_0_2       INTEGER,
    value_0_3       INTEGER,
    value_0_4       INTEGER,
    type_1          INTEGER,   -- effect type (slot 1)
    value_1         INTEGER,
    value_1_1       INTEGER,
    value_1_2       INTEGER,
    value_1_3       INTEGER,
    value_1_4       INTEGER,
    idle_mode_sub_rate INTEGER
);
```

- **Support effect names:** `text_data` category 150
- **Support effect descriptions:** `text_data` category 155
- **Support effect type names:** `text_data` category 151
- **Support effect type descriptions:** `text_data` category 154

Other support card tables:
- `support_card_limit` — Effect values at each limit break level
- `support_card_level` — Level-based stats
- `support_card_effect_filter` — Effect filter tags
- `support_card_effect_filter_group` — Filter groups
- `support_card_team_score_bonus` — Team stadium score bonus
- `support_card_limit_break` — Limit break costs
- `support_card_group` — Support card groups

### Races

```sql
CREATE TABLE race (
    -- (primary race definition table)
);

CREATE TABLE race_instance (
    id                  INTEGER PRIMARY KEY,
    race_id             INTEGER,  -- FK → race.id
    -- course, distance, conditions, etc.
);

CREATE TABLE race_condition (
    -- race conditions (ground, weather, etc.)
);

CREATE TABLE race_course_set (
    -- course layout / settings
);

CREATE TABLE race_course_set_status (
    -- course status / condition modifiers
);

CREATE TABLE race_env_define (
    -- environmental definitions
);

CREATE TABLE race_bgm (
    -- race background music
);

CREATE TABLE race_bgm_pattern (
    -- BGM play patterns
);

CREATE TABLE race_bgm_cutin (
    -- BGM cut-in timing
);

CREATE TABLE race_bib_color (
    -- race bib/number colors
);

CREATE TABLE race_motivation_rate (
    -- motivation effect multipliers
);

CREATE TABLE race_proper_distance_rate (
    -- distance suitability modifiers
);

CREATE TABLE race_proper_runningstyle_rate (
    -- running style suitability modifiers
);

CREATE TABLE race_proper_ground_rate (
    -- ground suitability modifiers
);

CREATE TABLE race_track (
    -- track definitions
);

CREATE TABLE race_trophy (
    -- race trophy/reward definitions
);

CREATE TABLE race_overrun_pattern (
    -- overrun behavior patterns
);

CREATE TABLE race_player_camera (
    -- player camera settings for races
);

CREATE TABLE race_fence_set (
    -- fence/jump definitions (for steeplechase)
);
```

**Race names** are in `text_data` categories 28, 29, 32, 33.

### Single Mode (Training Scenarios)

The single-player training mode has the largest number of tables. Key ones:

| Table | Purpose |
|-------|---------|
| `single_mode_scenario` | Scenario definitions (id, turn count, stat caps, etc.) |
| `single_mode_program` | Training program/schedule definitions |
| `single_mode_route` | Route definitions |
| `single_mode_route_race` | Race entries within a route |
| `single_mode_route_announce` | Route announcements |
| `single_mode_route_condition` | Route unlock conditions |
| `single_mode_training` | Training command definitions |
| `single_mode_training_effect` | Training effect values |
| `single_mode_training_se` | Training sound effects |
| `single_mode_training_bg_chara` | Training background characters |
| `single_mode_training_plate` | Training plate/UI |
| `single_mode_turn` | Turn definitions |
| `single_mode_message` | In-training messages |
| `single_mode_outing` | Outing event definitions |
| `single_mode_outing_set` | Outing event sets |
| `single_mode_npc` | NPC characters in training |
| `single_mode_rival` | Rival characters |
| `single_mode_race_live` | Race live integration |
| `single_mode_live_live_data` | Live concert in training |
| `single_mode_live_master_bonus` | **Lesson live bonus** |
| `single_mode_live_song_list` | Live song list |
| `single_mode_live_square` | Live square |
| `single_mode_story_data` | Story events in training |
| `single_mode_event_production` | Event production data |
| `single_mode_event_item_detail` | Event item details |
| `single_mode_event_conclusion` | Event conclusion data |
| `single_mode_event_choice_reward` | Event choice rewards |
| `single_mode_event_cr_priority` | Event CR priority |
| `single_mode_chara_program` | Character-specific program |
| `single_mode_unique_chara` | Unique character effects |
| `single_mode_chara_effect` | Character effects in scenario |
| `single_mode_chara_effect_buff` | Character effect buffs |
| `single_mode_chara_grade` | Character grade/rating |
| `single_mode_rank` | Training rank thresholds |
| `single_mode_evaluation` | Evaluation criteria |
| `single_mode_recommend` | Auto-recommend settings |
| `single_mode_recommend_setting` | Recommend setting details |
| `single_mode_fan_count` | Fan count thresholds |
| `single_mode_reward_set` | Reward set definitions |
| `single_mode_wins_saddle` | Win/saddle rewards |
| `single_mode_free_*` | Free training mode sub-system |
| `single_mode_cook_*` | **Cooking scenario** (scenario 8?) |
| `single_mode_sport_*` | **Sports competition** sub-system |
| `single_mode_venus_*` | **Venus** sub-system |
| `single_mode_arc_*` | **ARC scenario** sub-system |
| `single_mode_aoharu_*` | **Aoharu scenario** sub-system |
| `single_mode_09_*` | Scenario 9 (chip/piece system) |
| `single_mode_10_*` | Scenario 10 (buff/masterly system) |
| `single_mode_11_*` | Scenario 11 (island/facility system) |
| `single_mode_12_*` | Scenario 12 (onsen/hot spring system) |
| `single_mode_13_*` | Scenario 13 (team system) |
| `single_mode_14_*` | Scenario 14 (region system) |
| `single_mode_team_race_set` | Team race configuration |
| `single_mode_team_name` | Team name generation |
| `single_mode_scenario_group` | Scenario grouping |
| `single_mode_scenario_record` | Scenario record/history |
| `single_mode_scenario_update` | Scenario update data |
| `single_mode_tag_card_pos` | Tag card positioning |
| `single_mode_race_group` | Race grouping |
| `single_mode_race_restrict_turn` | Race turn restrictions |
| `single_mode_race_unique_condition` | Unique race conditions |
| `single_mode_race_limit_reward` | Race limit rewards |
| `single_mode_difficulty_*` | Difficulty settings and rewards |
| `single_mode_member_rank` | Member rank system |
| `single_mode_member_rank_points` | Member rank point thresholds |
| `single_mode_scout_chara` | Scout character system |
| `single_mode_special_chara` | Special character appearances |
| `single_mode_restrict_support` | Support card restrictions |
| `single_mode_change_chara_route` | Character route changes |
| `single_mode_select_skip` | Skip selection data |
| `single_mode_hint_gain` | Hint gain system |
| `single_mode_skill_need_point` | Skill point costs in training |
| `single_mode_analyze_ticket` | Analysis ticket data |
| `single_mode_analyze_message` | Analysis messages |
| `single_mode_analyze_condition` | Analysis conditions |
| `single_mode_top_bg` | Top screen background |
| `single_mode_top_bg_chara` | Top screen character |
| `single_mode_preview_bgm` | Preview BGM |
| `single_mode_story_guide` | Story guide |
| `single_mode_story_condition_set` | Story condition sets |
| `single_mode_story_root` | Story root/entry points |
| `single_mode_audience_overwrite` | Audience overwrite |
| `single_mode_hide_story_control` | Hide story control |
| `single_mode_conclusion_set` | Conclusion set data |
| `single_mode_idle_single_mode_training_cut` | Idle training cut-ins |
| `hide_chara_text_scenario` | Hidden character text (scenario) |
| `hide_chara_text_special` | Hidden character text (special) |

### Succession (Factor System)

```sql
CREATE TABLE succession_factor (
    factor_id                   INTEGER PRIMARY KEY,
    factor_group_id             INTEGER,
    rarity                      INTEGER,
    grade                       INTEGER,
    factor_type                 INTEGER,    -- blue/red/green/white factor type
    effect_group_id             INTEGER,
    succession_search_hidden    INTEGER,
    start_date                  INTEGER,
    end_date                    INTEGER
);

CREATE TABLE succession_initial_factor (
    -- starting factors
);

CREATE TABLE succession_factor_effect (
    -- factor effect definitions
);

CREATE TABLE succession_factor_addon_effect (
    -- additional factor effects
);

CREATE TABLE succession_relation (
    -- character compatibility/relations
);

CREATE TABLE succession_relation_member (
    -- members within a relation group
);

CREATE TABLE succession_relation_rank (
    -- relation rank thresholds
);

CREATE TABLE succession_rental (
    -- rental character settings
);
```

- **Factor names:** `text_data` category 147
- **Factor descriptions:** `text_data` category 172

### Champions Meeting

```sql
CREATE TABLE champions_schedule (
    -- event schedule
);

CREATE TABLE champions_round_schedule (
    -- round schedule within an event
);

CREATE TABLE champions_round_detail (
    -- round details (race configs)
);

CREATE TABLE champions_evaluation_rate (
    -- evaluation/scoring rates
);

CREATE TABLE champions_race_condition (
    -- race conditions per round
);

CREATE TABLE champions_stand_motion (
    -- podium/stand motions
);

CREATE TABLE champions_reward_rate (
    -- reward rate definitions
);

CREATE TABLE champions_news_title (
    -- news title templates
);

CREATE TABLE champions_news_race (
    -- race news templates
);

CREATE TABLE champions_news_chara_comment (
    -- character commentary for news
);

CREATE TABLE champions_news_win_comment (
    -- win comment templates
);

CREATE TABLE champions_news_win_title (
    -- win title templates
);

CREATE TABLE champions_bgm (
    -- event BGM
);

CREATE TABLE champions_entry_reward (
    -- entry/participation rewards
);
```

### Team Stadium

```sql
CREATE TABLE team_stadium (
    -- team stadium definitions
);

CREATE TABLE team_stadium_class (
    -- class/grade definitions
);

CREATE TABLE team_stadium_class_reward (
    -- class rewards
);

CREATE TABLE team_stadium_rank (
    -- rank thresholds
);

CREATE TABLE team_stadium_raw_score (
    -- raw score calculation
);

CREATE TABLE team_stadium_score_bonus (
    -- score bonus definitions
);

CREATE TABLE team_stadium_evaluation_rate (
    -- evaluation rates
);

CREATE TABLE team_stadium_stand_motion (
    -- stand motions
);

CREATE TABLE team_stadium_race_result_motion (
    -- race result motions
);

CREATE TABLE team_stadium_bgm (
    -- BGM
);
```

### Items & Shop

```sql
CREATE TABLE item_data (
    -- item definitions
);

CREATE TABLE piece_data (
    -- piece (character shard) definitions
);

CREATE TABLE item_exchange (
    -- item exchange shop
);

CREATE TABLE item_exchange_top (
    -- exchange shop banners
);

CREATE TABLE item_group (
    -- item category groups
);

CREATE TABLE item_pack (
    -- purchasable item packs
);

CREATE TABLE daily_pack (
    -- daily pack definitions
);

CREATE TABLE shop_banner (
    -- shop banner images
);

CREATE TABLE price_change (
    -- price change rules
);

CREATE TABLE exchange_ticket_detail (
    -- exchange ticket details
);

CREATE TABLE subscription_effect (
    -- subscription service effects
);
```

### Gacha

```sql
CREATE TABLE gacha_data (
    -- gacha banner definitions
);

CREATE TABLE gacha_free_campaign (
    -- free gacha campaigns
);

CREATE TABLE gacha_available (
    -- available cards in gacha
);

CREATE TABLE gacha_exchange (
    -- spark/pity exchange
);

CREATE TABLE gacha_top_bg (
    -- gacha screen backgrounds
);

CREATE TABLE gacha_prize_odds (
    -- prize/rate definitions
);

CREATE TABLE gacha_piece (
    -- piece drop rates
);

CREATE TABLE gacha_group (
    -- gacha groups
);

CREATE TABLE gacha_stepup (
    -- step-up gacha definitions
);

CREATE TABLE gacha_stampsheet (
    -- stamp sheet (loyalty card)
);

CREATE TABLE gacha_stampsheet_reward (
    -- stamp sheet rewards
);

CREATE TABLE gacha_item_exchange (
    -- item exchange in gacha
);

CREATE TABLE gacha_card_addition_num (
    -- additional card count
);

CREATE TABLE paid_gacha_button_type (
    -- paid gacha UI
);

CREATE TABLE select_pickup (
    -- selectable pickup (choose-your-rate-up)
);
```

### Stories & Events

```sql
CREATE TABLE main_story_part (
    -- main story parts/chapters
);

CREATE TABLE main_story_data (
    -- main story content
);

CREATE TABLE main_story_custom_load (
    -- custom load settings
);

CREATE TABLE main_story_race_data (
    -- race data within stories
);

CREATE TABLE main_story_race_bonus (
    -- race bonuses in stories
);

CREATE TABLE main_story_race_bonus_condition (
    -- bonus conditions
);

CREATE TABLE main_story_race_chara_data (
    -- character data for story races
);

CREATE TABLE chara_story_data (
    -- character-specific stories
);

CREATE TABLE short_episode (
    -- short episode content
);

CREATE TABLE story_event_data (
    -- story event definitions (limited events)
);

CREATE TABLE story_event_point_reward (
    -- point ladder rewards
);

CREATE TABLE story_event_bonus_card (
    -- bonus card multiplier
);

CREATE TABLE story_event_bonus_support_card (
    -- bonus support card multiplier
);

CREATE TABLE story_event_bonus_group_support_card (
    -- group bonus support cards
);

CREATE TABLE story_event_mission (
    -- event missions
);

CREATE TABLE story_event_story_data (
    -- event story content
);

CREATE TABLE story_event_top_chara (
    -- event top screen characters
);

CREATE TABLE story_event_mission_top_chara (
    -- mission top characters
);

CREATE TABLE story_event_nickname_bonus (
    -- nickname bonuses for events
);

CREATE TABLE story_event_roulette_bingo (
    -- bingo/roulette event
);

CREATE TABLE story_event_bingo_reward (
    -- bingo rewards
);

CREATE TABLE story_still (
    -- story still images
);

CREATE TABLE story_hip_offset (
    -- hip position offset for story
);

CREATE TABLE homestory_hip_offset (
    -- hip offset for home story
);

CREATE TABLE story_live_position (
    -- live position in story
);

CREATE TABLE story_race_track_bg_replace (
    -- track background replacement
);

CREATE TABLE story_extra_data (
    -- extra story content
);

CREATE TABLE story_extra_story_data (
    -- extra story data
);

CREATE TABLE story_extra_movie_data (
    -- movie data in extra stories
);

CREATE TABLE story_extra_event_movie (
    -- event movie data
);

CREATE TABLE story_wipe_dictionary (
    -- screen wipe dictionary
);

CREATE TABLE audio_story_effect (
    -- story audio effects
);
```

### Home Screen

```sql
CREATE TABLE home_env_setting (
    -- home environment settings
);

CREATE TABLE home_walk_group (
    -- walking character groups
);

CREATE TABLE home_walk_path_restriction (
    -- path restrictions for walking
);

CREATE TABLE home_story_trigger (
    -- story trigger on home
);

CREATE TABLE home_character_type (
    -- character type for home
);

CREATE TABLE home_prop_setting (
    -- prop settings
);

CREATE TABLE home_poster_data (
    -- poster display data
);

CREATE TABLE home_event_schedule (
    -- home event schedules
);

CREATE TABLE home_eat (
    -- eating scene data
);
```

### Note Profile

The character profile notebook system:

```sql
CREATE TABLE note_profile (
    id              INTEGER PRIMARY KEY,
    chara_id        INTEGER,  -- FK → chara_data.id
    text_type       INTEGER,  -- which profile section (1-11)
    lock_type       INTEGER,  -- unlock condition type
    lock_value      INTEGER,  -- unlock condition value
    secret_flg      INTEGER,  -- is secret/hidden
    sort            INTEGER
);

CREATE TABLE note_profile_text_type (
    id              INTEGER PRIMARY KEY,
    text_type       INTEGER,  -- matches note_profile.text_type
    text_category_id INTEGER, -- FK → text_data.category
    sort            INTEGER   -- display order within the profile section
);
```

### Other Notable Tables

| Table | Purpose |
|-------|---------|
| `character_system_text` | Character voice lines with text, cues, motions, and scene info |
| `character_prop_system_text` | Prop-related voice lines (lip sync data) |
| `character_system_lottery` | Random voice line selection |
| `audio_cuesheet` | Audio cue sheet definitions |
| `audio_ignored_cue_on_highspeed` | Cues to skip on high-speed mode |
| `banner_data` | Banner image definitions |
| `announce_data`, `announce_character`, `announce_support_card` | Announcement/gacha banner data |
| `announce_event` | Event announcements |
| `campaign_data` | Campaign definitions |
| `campaign_*` (27 tables) | Various campaign sub-systems |
| `daily_race`, `daily_race_npc`, `daily_race_billing` | Daily race system |
| `daily_legend_race` | Daily legend race |
| `legend_race`, `legend_race_boss_npc`, `legend_race_npc` | Legend race system |
| `rating_race_*` | Rating race system |
| `collect_event_map_master`, `collect_event_map_bg_data` | Collection event map |
| `collect_raid_*` (10+ tables) | Collection raid events |
| `circle_rank_data`, `circle_stamp_data` | Circle/guild system |
| `crane_game_*` (7 tables) | Crane game mini-game |
| `deck_recommend_*` | Deck recommendation system |
| `directory` | Directory/path references |
| `factor_research_*` | Factor research gacha system |
| `gift_message` | Gift messages |
| `heroes_*` (14 tables) | Heroes mode |
| `honor_data` | Honor/achievement definitions |
| `jobs_*` | Jobs/part-time work system |
| `jukebox_*` (7 tables) | Jukebox/music player |
| `live_*` (6 tables) | Live concert mode |
| `login_bonus_*` | Login bonus system |
| `map_event_*` | Map exploration events |
| `memory_data` | Memory/recollection data |
| `mini_bg`, `mini_bg_chara_motion`, `mini_motion_set`, `mini_face_type_data`, `mini_mouth_type`, `mini_mob` | Mini character system |
| `mission_data`, `mission_race_equate`, `mission_race_scenario_group` | Mission system |
| `mob_data`, `mob_dress_color_set`, `mob_hair_color_set` | Mob/NPC character definitions |
| `audience_data`, `audience_*` | Audience/spectator definitions |
| `name_card_bg` | Name card backgrounds |
| `nickname`, `nickname_hide` | Nickname system |
| `omakase_*` (13+ tables) | Auto-training (omakase) system |
| `race_jikkyo_*` (7 tables) | Race live commentary |
| `race_sp_rule_*` | Special race rules |
| `rental_deck`, `rental_deck_card`, `rental_deck_alt` | Rental deck system |
| `room_match_training_rank` | Room match training rank |
| `season_data` | Season definitions |
| `system_voice_standby_motion` | System voice standby motions |
| `team_building_*` (12 tables) | Team building event |
| `topics` | Topics/news feed |
| `trained_chara_trade_item` | Trained character trade items |
| `training_cutt_*` (4 tables) | Training cutscene data |
| `training_challenge_*` | Training challenge event |
| `training_report_*` | Training report system |
| `transfer_event_*`, `transfer_rotation_*` | Data transfer events |
| `tutorial_guide_data` | Tutorial guides |
| `ultimate_race_*` | Ultimate race content |
| `generate_succession_trained_chara_trade_item` | Succession trade items |

---

## Skill-to-Card Linkage Model

Skills are linked to cards/characters through FOUR distinct paths:

### Path 1: Regular Card Skills
```
card_data.chara_id → card_data.available_skill_set_id → available_skill_set.skill_id → skill_data
```
These are non-unique skills learned as the card ranks up. `available_skill_set.need_rank` specifies the awakening rank required.

### Path 2: Evolved Unique Skills
```
card_data.chara_id → card_data.id → skill_upgrade_description.card_id → skill_id → skill_data
```
These replace the base unique skill at higher ranks. `skill_upgrade_description.rank` specifies when.

### Path 3: Base Unique Skills (skill_id encoding convention)
```
skill_data.id pattern: 1 0 (chara_id % 1000) ...  where rarity >= 5
```
The base unique skill is NOT in any join table. It's linked by ID convention:
- `101341` → chara `1134` (134 = 1134 % 1000), prefix `10134`
- `103802111` → chara `1038` (038 = 1038 % 1000), prefix `10038`

Inherited version follows: `base_id + 800000` (e.g., `101341 → 901341`).
The inherited skill's `unique_skill_id_1` points back to the original.

### Path 4: Support Card Skills
```
support_card_data.chara_id → support_card_data.skill_set_id → skill_set (unpivot 20 slots) → skill_data
```
Support cards grant skills via the `skill_set` table's 20 fixed columns.

### Skill ID Encoding for Unique Skills

| Type | Pattern | Example | For chara |
|------|---------|---------|-----------|
| Base unique | `1` + `0` + zero-padded `chara_id%1000` + seq | `101341` | 1134 → 134 |
| Inherited | `90` + zero-padded `chara_id%1000` + seq | `901341` | 1134 → 134 |
| Evolved (new) | `chara_id` + `card_seq` + `category` + `seq` | `113401111` | 1134, card 01 |
| Evolved (old) | `10` + zero-padded `chara_id%1000` + `category` + `seq` | `103802111` | 1038 → 038 |

### Conversion Factors

| Raw field | Display | Divisor |
|-----------|---------|---------|
| `float_ability_time_*` | Duration (seconds) | ÷ 10000 |
| `float_ability_value_*` | Effect magnitude | ÷ 10000 |
| `float_cooldown_time_*` | Cooldown (seconds) | ÷ 10000 |
| `ability_type_*` | Effect type enum | (lookup table) |
| `target_type_*` | Target type enum | 1=self, 10=all enemies, etc. |

### Condition String Syntax

```
@ = OR    & = AND    == = equals
>= / <= / > / <  = comparisons
```

| Token | Meaning |
|-------|---------|
| `distance_type==3` | 中距離 (middle distance) |
| `distance_type==4` | 長距離 (long distance) |
| `phase==1` | レース中盤 (mid-race) |
| `phase>=2` | レース終盤 (late-race / final phase) |
| `phase_random==1` | Random point in mid-race |
| `phase_firsthalf==1` | First half of current phase |
| `phase_laterhalf_random==1` | Random point in later half of current phase |
| `is_finalcorner==1` | Final corner |
| `near_count>=2` | 2+ horse girls nearby |
| `order_rate<=50` | Position percentile (front 50%) |
| `running_style==2` | 先行 (front-runner) |
| `running_style==4` | 追込 (closer) |
| `accumulatetime>=5` | 5+ seconds in state |
| `remain_distance>=999` | ~1000m remaining |
| `base_speed>=1000` | Speed stat ≥ 1000 |
| `base_stamina>=1200` | Stamina stat ≥ 1200 |
| `always==1` | Always active (passive) |

### Effect Type Enums (partial)

| Type | Effect |
|------|--------|
| 1 | Increase Speed |
| 5 | Increase Stamina |
| 21 | Decrease Speed (debuff) |
| 22 | Increase Acceleration |
| 27 | Increase Target Speed |
| 30 | Increase Power |
| 13 | Increase Guts |
| 14 | Increase Wisdom |

---

## Data Access Patterns

### Getting Character Names

```sql
-- Plain character name (Japanese)
SELECT text FROM text_data WHERE category = 182 AND "index" = <chara_id>;

-- Romanized character name
SELECT text FROM text_data WHERE category = 372 AND "index" = <chara_id>;

-- Character catchphrase
SELECT text FROM text_data WHERE category = 144 AND "index" = <chara_id>;
```

### Getting Card Names

```sql
-- Full card name with rarity tag
SELECT text FROM text_data WHERE category = 4 AND "index" = <card_id>;

-- Rarity tag only
SELECT text FROM text_data WHERE category = 5 AND "index" = <card_id>;
```

### Getting Skill Names & Descriptions

```sql
-- Skill name
SELECT text FROM text_data WHERE category = 47 AND "index" = <skill_id>;

-- Skill description
SELECT text FROM text_data WHERE category = 48 AND "index" = <skill_id>;
```

### Getting Support Card Effect Text

```sql
-- Support card effect name (referenced via support_card_data.effect_table_id)
SELECT text FROM text_data WHERE category = 150 AND id = <effect_table_id>;

-- Support card effect description
SELECT text FROM text_data WHERE category = 155 AND id = <effect_table_id>;
```

### Getting Character Profile Info

```sql
-- Get all profile text types for a character
SELECT nptt.text_type, nptt.text_category_id, nptt.sort, td.text
FROM note_profile np
JOIN note_profile_text_type nptt ON np.text_type = nptt.text_type
JOIN text_data td ON td.category = nptt.text_category_id AND td."index" = np.chara_id
WHERE np.chara_id = <chara_id>
ORDER BY np.text_type, nptt.sort;
```

### Getting Factor Names & Descriptions

```sql
-- Factor name
SELECT text FROM text_data WHERE category = 147 AND id = <factor_id>;

-- Factor description
SELECT text FROM text_data WHERE category = 172 AND id = <factor_id>;
```

### Getting Race Names

```sql
-- Full race name
SELECT text FROM text_data WHERE category = 28 AND "index" = <race_instance_id>;

-- Short race name
SELECT text FROM text_data WHERE category = 29 AND "index" = <race_instance_id>;
```

---

## Notes

1. **Category gaps**: Not all category numbers are used. Gaps exist where categories were deprecated or never assigned.
2. **`id` vs `index`**: In `text_data`, `id` typically refers to the parent entity (chara_id, card_id, skill_id) while `index` contains the entity reference encoded into the key. The encoding varies by category — e.g., category 4 uses `card_id * 100 + variant`, category 47 uses skill IDs directly.
3. **Date fields**: `start_date` and `end_date` throughout the database use Unix timestamps (seconds since epoch).
4. **Color fields**: Stored as hex strings (e.g., `#FF911C`).
5. **Voice/Cue integration**: The `character_system_text` table links character voices to audio cues (`cue_sheet`, `cue_id`) and animations (`motion_set`, `lip_sync_data`).
6. **Scenario index**: Single mode scenarios are indexed numerically (09 through 14+), each with their own table groups.
