Zenno Rob Roy
Race Tools Character Tools Documents
Master Data
This article is my personal notes on Umamusume's master data, a.k.a. master.mdb or just "the mdb." Most of the notes are oriented toward my work on this website. It is an in-progress translation of my broader but more sparse notes into a more agreeable, navigable, and consistent form.

master.mdb is an SQLite database that the game downloads to your device. On Windows, you can find it at %USERPROFILE%\AppData\LocalLow\Cygames\Umamusume\master\master.mdb. Hakuraku has a master data explorer that you can use on the website.

Generally speaking, I am only documenting what I feel is important, both in terms of tables and columns. That does occasionally include documenting some things as being unimportant.

Roughly speaking, master data contains all the numbers needed to display the game's user interface, including during races. Skill data, support card effects, Grand Concert lesson definitions, and so on are in there. If trying to access some data in-game shows a "Connecting..." indicator while it loads, it probably isn't in the mdb. Notably, this includes everything related to career event outcomes. (Event information on sites like GameTora and GameWith are massive crowd-sourced efforts.)

This document is oriented toward programmers with understanding of SQL databases. Mentions of Gallop:: are references to types visible in decompilations of the game, but no C# knowledge is needed.

§ Table of Contents Top ▲

Master Data
text_data
Skills
Skill Details
Skill Abilities
Skill Level Scaling
Skill Points
Sparks
Spark Data
Spark Effects
Initial Inspiration Effects
Support Cards
Support Card Data
Support Card Effects
Unique Effects
Hints
§ text_data Top ▲

The text_data table contains most non-story strings in the game. Queries look up entries by category and index, i.e. SELECT "text" FROM text_data WHERE category=? AND "index"=?.

Some important categories:

6 is character names, 4 is [variant] character name, 5 is [variant], 14 is clothing names.
47 is skill names, 48 is skill descriptions.
75 is support card names including variant, 76 is support card variant, 77 is support card character.
147 is spark names, 172 is spark descriptions.
33 is race name by race ID, 28 is race name by race instance ID, 31 is race courses, 111 is saddle names.
65 is player titles, 66 is title descriptions.
119 is scenario full titles (e.g. The Beginning: URA Finale), 120 is scenario descriptions, 237 is scenario names (e.g. URA Finale).
130 is epithet names, 131 is epithet descriptions.
Other categories are usually easy enough to figure out by inspection. Text data categories have proper names given in Gallop::MasterString.Category, but a few categories that have useful strings are missing from there.

§ Skills Top ▲

Relevant text_data categories include 47 for skill names and 48 for skill descriptions. Otherwise, info for skills lives in skill_data.

Skill ID is just id.
rarity is 1 for common (white) skills, 2 for rare (gold) skills, 3 for 1☆/2☆ uniques, 4 for 3☆ uniques of horses upgraded from 1☆ or 2☆, and 5 for full 3☆ uniques.
group_id groups skills that replace each other when purchased. E.g., 
 Skill icon ID 10011 Fall Runner ○, 
 Skill icon ID 10011 Fall Runner ◎,
 Skill icon ID 10014 Fall Runner ×, and 
 Skill icon ID 10012 Fall Frenzy all have a group_id of 20019. Unique skills are generally alone in their groups.
group_rate gives the relative strength of a skill within its group. Negative (purple) skills always have a group_rate of -1. For skills that have non-purple versions (i.e. not skills like 
 Skill icon ID 10014 G1 Averseness), the base version has a group_rate of 1 and each successive upgrade is 1 higher. E.g., 
 Skill icon ID 10011 Fall Runner ○ is 1, 
 Skill icon ID 10011 Fall Runner ◎ is 2, 
 Skill icon ID 10012 Fall Frenzy, and
 Skill icon ID 10014 Fall Runner × is -1. Skills that have only common and rare versions instead assign a group_rate of 2 to the rare.
grade_value is the amount the skill adds to a horse's rating when owned. Higher tiers of skills within a group replace the lower ones rather than adding to them, so 
 Skill icon ID 10011 Fall Runner ◎ is worth its listed grade value of 174, not
 Skill icon ID 10011 Fall Runner ○'s 129 plus 174.
skill_category gives the category where the skill is listed in the skills tab at the paddock:
Category ID	Category
5	Unique
0	Passive
1	Early-Race
2	Mid-Race
3	Late-Race
4	Anytime
tag_id gives a slash-separated list of three-digit tag values that various other mechanics can match against. E.g., Copano Rickey's unique skill 
 Skill icon ID 20013 Luck Runs My Way counts the number of skills activated with tag values between 601 and 615 to determine the multiplier on its extra effects; mechanics like GL shop skills and MANT rivals match tags for running style (101 to 104), distance (201 to 204), and/or surface (501 and 502); and I expect that support card unique effects like Mejiro Ramonu will count "speed-increasing skills" by looking for tag 401.
Tag ID	Inferred Meaning
101	Front Runner
102	Pace Chaser
103	Late Surger
104	End Closer
201	Sprint
202	Mile
203	Medium
204	Long
301	Early-Race
302	Mid-Race
303	Late-Race
401	Affects speed stat or velocity
402	Affects stamina stat or HP
403	Affects power stat, acceleration, or lane movement speed
404	Affects guts stat
405	Affects wit stat or vision
406	Debuff of any type, or a main story self-debuff, or Behold Thine Emperor's Divine Might
407	Modifies gate delay
501	Turf
502	Dirt
601	Ground condition passive
602	Weather passive
603	Season passive
604	Race track passive
605	Time of day passive
606	Exchange race passive
607	Distance passive
608	Corner-based passive
609	Gate position passive
610	Ground type passive
611	Popularity passive
612	Running style passive
613	Passive depending on other horses' styles or skills
614	Base stat threshold passive
615	Mood passive
801	URA Finale scenario skill
802	Unity Cup scenario skill
803	Grand Concert scenario skill
804	Trackblazer scenario skill
E.g., 
 Skill icon ID 10012 Fall Frenzy has a tag_id of 401/403/603 (as text, including the slashes). The tagged skills explorer allows you to see skills by their tags.
For inherited unique skills, unique_skill_id_1 holds the ID of the non-inherited version. When it is the inherited unique from an upgraded 1☆/2☆ horse, unique_skill_id_2 holds the ID of the 1☆/2☆ version of the unique.
exp_type appears to be 1 when the skill is able to gain levels, i.e. is a unique skill.
activate_lot is 1 if the skill uses a wit check.
disp_order is the sort order used in the skill purchase menu.
icon_id is the resource ID of the skill's icon.
There are quite a few other columns which may be useful but which I have not bothered to figure out.
skill_data additionally holds skill conditions and effects, described in the next section.

¶ Skill Details Top ▲

Skills have one or two skill details, also called triggers. The first skill detail has column names with _1 appended, and the second has _2. Each skill detail has:

precondition_1 (resp. precondition_2): Precondition text, if the skill has one, otherwise empty.
condition_1: Condition text. (Skills like 
 Skill icon ID 10051 Restraint which always activate have always==1.) If the skill has only one detail, then condition_2 is empty.
float_ability_time_1: Base duration expressed in ten thousandths of a second, or -1 for passives, or 0 for instantaneous skills (recoveries, 
 Skill icon ID 20061 Focus).
ability_time_usage_1: Scaling type for the skill duration.
Type	Duration Scaling
1	direct (no scaling)
2	scaling with distance from the front
3	scaling with remaining HP
4	increasing with each pass while active
5	scaling with mid-race phase blocked side time
7	scaling with remaining HP
GameTora and the race mechanics doc describe duration scaling types in more detail.
float_cooldown_time_1: Base cooldown duration expressed in ten thousandths of a second, or 5000000 (500s) for skills with no cooldown, or 0 for passives.
Columns for three abilities, described in the next section.
This SQL query parses all conditions and preconditions to obtain all distinct combinations of skill condition types, operators, and arguments. This may be useful to tool authors.

¶ Skill Abilities Top ▲

Each skill detail has up to three abilities, all of which apply for as long as the skill detail is active (except for AdditionalActivate abilities). Column names append _1, _2, or _3 after the skill detail's own number.

ability_type_1_1 (resp. ability_type_1_2, ability_type_1_3, ability_type_2_1, ability_type_2_2, ability_type_2_3) define what simulation parameter the ability affects.
Type	Effect	Value Units
1	Speed stat	+n
2	Stamina stat	+n
3	Power stat	+n
4	Guts stat	+n
5	Wit stat	+n
6	Become Runaway	
7	HpDecRate (unused)	
8	Vision range	+m
9	HP	+ proportion of max HP
10	Adjust gate delay	×
11	ForceOvertakeIn (unused)	
12	ForceOvertakeOut (unused)	
13	Set Rushed duration	s
14	Set gate delay	s
21	Current speed (debuffs)	+m/s
22	Current speed (buffs)	+m/s
27	Target speed	+m/s
28	Lane change speed	+CW/s
29	Rushed chance	+ flat%
30	PushPer (unused)	
31	Acceleration	+m/s²
32	All stats	+n
35	Set target lane	CW
36	ActivateRandomNormalAndRareSkill (unused)	
37	Activate rare skills	count
38	Gain immunity to debuffs	
41	Activate Sympathy (?)	
42	Evolved Skill duration (?)	× (?)
48	Zenkai Spurt acceleration (?)	+m/s² (?)
49	Reactivate Unique Skill (?)	
501	Carnival Bonus effect (old)	
502	Carnival Bonus stats up	
503	Carnival Bonus mood up	
Types with (?) don't exist in my decomp but are used on skills in the copy of the JP mdb that I have, which I'm told is "from like 3 weeks ago" at the time of writing. Those marked (unused) do exist in the decomp, but are not used for skills even on JP.
ability_value_usage_1_1 defines special scaling for the ability's value.
Type	Value Scaling
1	direct (no scaling)
2	scaling with the number of skills
3	scaling with team Speed
4	scaling with team Stamina
5	scaling with team Power
6	scaling with team Guts
7	scaling with team Wit
8	with a random 0× to 0.04× multiplier
9	with a random 0× to 0.04× mulitplier
10	scaling with the number of races won in the career
12	scaling with fans earned in the career
13	scaling with the highest raw stat
14	scaling with the number of Passive skills activated
19	plus extra when far from the lead
20	scaling with mid-race phase blocked side time
22	scaling with overall speed
23	scaling with overall speed
24	scaling with L'Arc global potential
25	scaling with the longest lead obtained in the first ⅔
GameTora describes value scaling types in more detail. (The race mechanics doc is missing most of them.)
additional_activate_type_1_1 indicates abilities that only activate on additional events while the skill detail is active.
Type	Meaning
0	none
1	upon pass, up to three times
2	upon activating other skills, up to three times
3	upon activating other skills, up to twice
ability_value_level_usage_1_1 indicates how the ability scales with skill level (i.e. unique level, not double circle vs single circle).
Type	Meaning	Instances
0	none	Hokko Tarumae and Halloween Digitan (on empty abilities)
1	default	almost all abilities
2	ignored	Chrono Genesis (on evo duration scaling)
3	inverse	unused
float_ability_value_1_1 is the base magnitude of the ability's effect, expressed in ten thousandths.
target_type_1_1 describes which umas the skill targets. It takes target_value_1_1 as an argument.
Type	Meaning	Argument
1	self	
2	everyone	
3	AllOtherSelf (unused)	
4	visible	maximum targets
5	RandomOtherSelf (unused)	
6	Order (unused)	
7	frontmost	maximum targets
8	furthest back (unused)	
9	ahead of the user	maximum targets
10	behind the user	maximum targets
11	all teammates	
12	Near (unused)	
13	SelfAndBlockFront (unused)	
14	BlockSide (unused)	
15	NearInfront (unused)	
16	NearBehind (unused)	
17	RunningStyle (unused)	
18	others using the given running style	running style ID
19	those ahead who are Rushed	
20	those behind who are Rushed	
21	those using the given running style who are Rushed	running style ID
22	specific character	character ID
23	whosoever triggered the skill	
Skills that take maximum targets as an argument use a target_value_1_1 of 18 to mean unlimited. Type 23 is internally named ActivateHealSkill, so it may instead mean something like "horses who activated a heal skill this frame." It is only used for 
 Skill icon ID 30011 Oppression and its gold.
¶ Skill Level Scaling Top ▲

The table skill_level_value defines the coefficients by which each ability's value scales with unique level. Curiously, it defines coefficients up to level = 10 for each ability_type, even though the maximum achievable level is 6.

The float_ability_value_coef column is a multiplier on the corresponding skill ability type's float_ability_value_?_?, expressed in ten thousandths.

¶ Skill Points Top ▲

The table single_mode_skill_need_point lists the SP cost of each skill.

id is the skill ID.
need_skill_point is the SP cost.
status_type and status_value are always zero.
solvable_type is nonzero for some negative (purple) skills that are applied and later healed during careers, for Sweep Tosho, Air Shakur, and Daitaku Helios. Some other JP negative skills that GameTora has no source information for also have it.
§ Sparks Top ▲

Internally called succession factors. Relevant text_data categories include 147 for spark names and 172 for spark descriptions, both indexed by factor ID.

¶ Spark Data Top ▲

Queries should join with succession_factor inside.

Spark ID is factor_id. This identifies the combination of spark variety and its star level.
factor_group_id gives the variety. E.g., the star levels of the February S. spark are factor IDs 1000101, 1000102, and 1000103, but all three have group ID 10001.
rarity is the star level, 1-indexed.
grade is 2 for unique (green) sparks and 1 otherwise.
factor_type is roughly the color type of the spark plus extra subdivisions for white sparks:
Type ID	Spark Type	Color
1	Stat	
2	Aptitude	
3	Unique	
4	Skill	
5	Race	
6	Scenario	
7	Carnival Bonus	
8	Distance	
9	Hidden	
10	Surface	
11	Style	
Types 8 and above should release with 4anni.
effect_group_id may give something like the distribution of spark effects. For current Global data, it's in bijection with factor_type × rarity. It doesn't join with anything else in the mdb.
¶ Spark Effects Top ▲

succession_factor_effect defines all possible effects that each spark can yield (but not their distributions). Effects are organized by factor_group_id rather than by factor_id, which implies to some degree that all star levels of a given spark have the same possible results with different distributions, although it is possible that some values have zero probability for some star levels.

The process by which the game determines the effects of a given spark proc during (Classic and Senior) inspiration is as follows, or semantically equivalent.

The server chooses a random effect_id from the hidden distribution for the spark's effect_group_id.
The client (and server) selects all rows matching the spark's factor_group_id and the random rolled effect_id, i.e. SELECT target_type, value_1, value_2 FROM succession_factor_effect WHERE factor_group_id = $current_spark_factor_group_id AND effect_id = $random_choice_effect. There may be several such effects.
For each result row, apply the effect according to the target_type, with value_1 and value_2 as its possible arguments:
target_type	Description	value_1 Usage	value_2 Usage
1	Speed	Amount	
2	Stamina	Amount	
3	Power	Amount	
4	Guts	Amount	
5	Wit	Amount	
6	Skill Points	Amount	
7	Random Stat	Amount	(always 1)
11	Turf Aptitude	Levels	
12	Dirt Aptitude	Levels	
21	Front Runner Aptitude	Levels	
22	Pace Chaser Aptitude	Levels	
23	Late Surger Aptitude	Levels	
24	End Closer Aptitude	Levels	
31	Sprint Aptitude	Levels	
32	Mile Aptitude	Levels	
33	Medium Aptitude	Levels	
34	Long Aptitude	Levels	
41	Skill Hint	Skill ID	Hint Levels
51	Carnival Bonus	Skill ID	(always 1)
61	Max Speed	Amount	
62	Max Stamina	Amount	
63	Max Power	Amount	
64	Max Guts	Amount	
65	Max Wit	Amount	
When effect 41 applies to a skill which is already at its maximum hint value (including from previous spark procs in the same inspiration), a small amount (1-5, perhaps?) of some number (one? two?) of random stats is applied instead, but the details of this are not known.
E.g., all succession_factor_effect data for Lovely Spring Breeze (Mejiro Bright's green spark) is:

succession_factor_effect
id	factor_group_id	effect_id	target_type	value_1	value_2
1469	107401	1	41	900741	1
2521	107401	1	62	1	0
2523	107401	1	64	1	0
2522	107401	1	65	1	0
1470	107401	2	41	900741	2
2524	107401	2	62	2	0
2526	107401	2	64	1	0
2525	107401	2	65	1	0
1471	107401	3	41	900741	2
2528	107401	3	62	2	0
2530	107401	3	64	1	0
2529	107401	3	65	2	0
2527	107401	4	41	900741	3
2532	107401	4	62	2	0
2534	107401	4	64	2	0
2533	107401	4	65	2	0
When the spark procs, the server rolls an effect ID of 1, 2, 3, or 4 according to some hidden distribution, then it applies all four effects with that effect ID.

¶ Initial Inspiration Effects Top ▲

succession_initial_factor defines thresholds for initial inspiration, i.e. the immediate effects of sparks upon starting a run. There is not much consistency to its format, but it has only thirteen rows, reproduced here.

succession_initial_factor
id	factor_type	value_1	value_2	add_point
1	1	1	0	5
2	1	2	0	12
3	1	3	0	21
4	2	1	3	1
5	2	4	6	2
6	2	7	9	3
7	2	10	999	4
8	1	1	1	4
9	1	2	1	9
10	1	3	1	16
11	3	1	1	0
12	3	2	2	0
13	3	3	4	0
There are six rows with factor_type = 1, referring to blue sparks. value_1 refers to the star level of each individual spark. value_2 identifies whether the effect applies to starting stats (0) or raised max stats (1). add_point is the amount to add to the respective field.

Pink sparks, i.e. factor_type = 2, have four rows. value_1 is the lower threshold of total star count, and value_2 is the upper threshold. add_point is the number of levels to raise the corresponding aptitude.

factor_type = 3 for unique sparks has three rows. add_point is always 0. The (value_1, value_2) pairs are (1, 1), (2, 2), and (3, 4), but the meaning is unclear; all rows for this factor type were added in the 1 Jul patch that introduced raised stat caps, so one would expect it to be related to those. (In particular, it does not appear to be related to the starting skill hints.)

In all cases, there is no direct association between the spark and its actual initial effects. They must be derived from the spark's normal effects instead.

§ Support Cards Top ▲

Relevant text_data categories include 75 for name including variant, 76 for variant alone, 77 for character name. Category 151 gives support card effect names, 154 gives effect descriptions, 150 gives unique effect names, and 155 gives unique effect descriptions.

¶ Support Card Data Top ▲

Queries should join with support_card_data inside.

Support card ID is just id.
chara_id links to character. Implements the "no supporting yourself" and "no duplicated characters" rules.
rarity is 1 for R, 2 for SR, 3 for SSR.
exchange_item_id is the type of item you get for exchanging duplicates.
effect_table_id joins support_card_effect_table.
unique_effect_id joins support_card_unique_effect.
command_type is generally 1 for normal support cards and 0 for pals and groups, but Throne is 1 as well. Probably not important.
command_id gives the specialty type: 101 for speed, 102 for power, 103 for guts, 105 for stamina, 106 for wit, 0 for pal and group. There is no 104.
support_card_type is 1 for normal cards, 2 for pal, 3 for group.
skill_set_id gives the hint list via support_card_data sc JOIN single_mode_hint_gain h ON sc.skill_set_id = h.hint_id AND sc.support_card_id = h.support_card_id. Given that you have to use the support card ID anyway, this seems redundant.
outing_max is the number of recreation events with the card, for pals and groups.
effect_id is the specific instance of Pure Passion the card can grant, for groups.
¶ Support Card Effects Top ▲

support_card_effect_table gives progressions of support card stats. There is one row per stat per support card. Unique effects are not included.

id joins with support card ID.
type is the stat type (text_data category 151):
Type ID	Effect
1	Friendship Bonus
2	Mood Effect
3	Speed Bonus
4	Stamina Bonus
5	Power Bonus
6	Guts Bonus
7	Wit Bonus
8	Training Effectiveness
9	Initial Speed
10	Initial Stamina
11	Initial Power
12	Initial Guts
13	Initial Wit
14	Initial Friendship Gauge
15	Race Bonus
16	Fan Bonus
17	Hint Levels
18	Hint Frequency
19	Specialty Priority
20	Max Speed
21	Max Stamina
22	Max Power
23	Max Guts
24	Max Wit
25	Event Recovery
26	Event Effectiveness
27	Failure Protection
28	Energy Cost Reduction
29	Minigame Effectiveness
30	Skill Point Bonus
31	Wit Friendship Recovery
init is the card's value at level 1, then there are subsequent limit_lv5, limit_lv10, &c. up to limit_lv50. Each value is either a threshold value for the corresponding level, or -1 to indicate that the value should interpolate per level between the previous positive value (defaulting to 0) and the next (defaulting to no interpolation).
¶ Unique Effects Top ▲

Unique effect data is in support_card_unique_effect.

id joins with support_card_data.unique_effect_id, but it's also always the same as the support card ID, never deduplicated or anything. (This ID is also used for unique effect name lookup, after all.)
lv gives the level at which the unique effect becomes active, one of 25, 30, 35, or 40.
type_0 and type_1 give the effect type ID with the corresponding magnitude in value_0 or value_1, largely same as for support_card_effect_table.type. However, there are some extra types:
101 is a friendship gauge check. value_0 is the threshold value, and then value_0_1 and value_0_3 give the effects that become active at that threshold with their magnitudes in value_0_2 and value_0_4, respectively.
102 is Guts Bakushin's special effect of Training Effectiveness (magnitude in value_0_1) when both above a friendship threshold (value_0) and not on her own specialty.
103 is Agnes Ditigal's special effect of Training Effectiveness (magnitude in value_0_1) when the deck has at least value_0 different colors.
104 is Narita Top Road's special effect of Training Effectiveness of maximum magnitude value_0_1 divided by each group of value_0 fans.
105 is +value_0 initial stat to the specialty of each card in the deck and +value_0 initial all stats per pal and group card.
106 is stacking effect per rainbow training, where value_0 is the maximum number of stacks, value_0_1 is the effect type granted by the stack, and value_0_2 is the value per stack.
107 is scaling with how low energy is. value_0 is obviously the effect type ID that scales, but the other parameters are unclear. Currently only Bamboo Memory Guts has this, with value_0_1⪙4 being (10, 30, 15, 5).
108 is scaling with maximum energy. Similar to 107, value_0 is the effect type ID that scales, but the rest is unclear, with values of (100, 75, 5, 20) for Pearl.
109 is scaling with total friendship across all cards. value_0 is the effect type ID that scales, value_0_1 is the amount of bond required to increase the effect by 1.
110 is scaling with the number of cards at the training. value_0 is the effect type ID that scales, value_0_1 is the amount per card.
110 is scaling with the number of cards at the training. value_0 is the effect type ID that scales, value_0_1 is the amount per card.
111 is scaling with training facility level. value_0 is the effect type ID that scales, value_0_1 is the amount per level.
112 is Nakayama Festa Wit's value_0% chance to disable failure chance.
113 is an additional effect active for rainbow training. value_0 is the additional effect ID, value_0_1 is its value.
Certainly more types will follow.
idle_mode_sub_rate is uncertain, but it is likely related to Independent Training (called idle single mode internally, where "single mode" is in turn the internal name for career). It takes only a few values:
For unique effects that don't vary, it is always 0.
For those that vary with the deck composition (Agnes Digital, Satono Diamond Wit), it is 10.
For effects that activate with 80+ friendship, it has a value of 20.
For 100+ friendship effects, fan count scaling, rainbow training stacking effects, effects scaling with energy or max energy, scaling with number of cards trained with, scaling with training level, and scaling with total deck friendship, it has a value of 30.
¶ Hints Top ▲

Lastly, the table single_mode_hint_gain lists the effects of hints during career.

hint_id joins with support_card_data.skill_set_id, but it isn't unique; e.g., Seiun Sky SR has the same hint_id as prior Seiun Sky cards, despite having a different hint list. Unclear what it actually does. Doesn't seem useful for my purposes.
support_card_id is effectively the lookup key.
hint_group ties together the results of one hint. Skill hints are generally one each, but stat hints have two or three rows with matching hint groups.
hint_gain_type is 0 for skill hints and 1 for stat hints.
For skill hints, hint_value_1 is the skill ID, and hint_value_2 is always 1; presumably the latter could serve as the base value of hint levels. For stat hints, hint_value_1 is the stat ID – 1 for speed through 5 for wit, or 30 for skill points – and hint_value_2 is the amount to add.
group_id, condition_set_id, and priority are only nonzero for Haru Urara Power, whose unique effect includes "hint event effectiveness" and who has upgraded stat hints. It's unclear exactly how it works or why it takes three columns to implement.
Umamusume: Pretty Derby tools by zephyrtronium.
All game data is auto-generated from the game's local database.
If you find this site helpful, please consider supporting my Ko-fi.
