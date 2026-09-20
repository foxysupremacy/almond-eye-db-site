import type { RaceParameters } from "./skill-engine/types";

export type PvpEventStage =
  | "upcoming"
  | "round1"
  | "round2"
  | "team_selection"
  | "matchmaking"
  | "finals"
  | "ended";

export interface PvpEvent {
  id: string;
  name: string;
  shortName: string;
  trackId: number;
  courseId: number;
  racerCount: number;
  season: string;
  seasonIcon: string;
  seasonNum: number;
  weather: string | null;
  weatherIcon: string | null;
  weatherNum: number | null;
  ground: string | null;
  groundNum: number | null;
  time: string;
  timeIcon: string;
  timeNum: number;
  gradeNum: number;
  specialRules?: string[];
  noDebuffs?: boolean;
  startDate?: string;
  durationDays?: number;
}

// Banned debuff skills in Champions Meeting Special Rule "No Debuffs" (55 skills)
export const BANNED_DEBUFF_SKILL_IDS: ReadonlySet<number> = new Set<number>([
  200691, // 慧眼 (Keen Insight)
  200692, // 展開窺い (Progress Peek)
  200772, // 見惚れるトリック (Captivating Trick)
  200771, // トリック（前） (Trick (Front))
  200781, // トリック（後） (Trick (Back))
  200791, // 逃げ駆け引き (Frantic Runners)
  200801, // 先行駆け引き (Frantic Leaders)
  200811, // 差し駆け引き (Frantic Betweeners)
  200821, // 追込駆け引き (Frantic Chasers)
  200831, // 逃げけん制 (Restrained Runners)
  200841, // 逃げ焦り (Panicked Runners)
  200851, // 逃げためらい (Faltering Runners)
  200861, // 先行けん制 (Restrained Leaders)
  200871, // 先行焦り (Panicked Leaders)
  200881, // 先行ためらい (Faltering Leaders)
  200891, // 差しけん制 (Restrained Betweeners)
  200901, // 差し焦り (Panicked Betweeners)
  200911, // 差しためらい (Faltering Betweeners)
  200921, // 追込けん制 (Restrained Chasers)
  200931, // 追込焦り (Panicked Chasers)
  200941, // 追込ためらい (Faltering Chasers)
  201011, // 悩殺術 (Bewitching)
  201012, // 後方釘付 (Spellbound Pursuers)
  201022, // 抜け駆け禁止 (No Running Allowed)
  201082, // スピードイーター (Speed Eater)
  201091, // 布陣 (Battle Formation)
  201092, // 布石 (Opening Move)
  201151, // 独占力 (Monopolize)
  201152, // 束縛 (Binding Chains)
  201161, // 魅惑のささやき (Charming Whispers)
  201162, // ささやき (Gentle Whispers)
  201221, // スタミナグリード (Stamina Greed)
  201222, // スタミナイーター (Stamina Eater)
  201231, // 奇術師 (Illusionist)
  201232, // 目くらまし (Deception)
  201302, // リスタート (Restart)
  201371, // 幻惑のかく乱 (Glamorous Perturbation)
  201372, // かく乱 (Perturbation)
  201441, // 八方にらみ (All-direction Glare)
  201442, // 鋭い眼光 (Sharp Gaze)
  201511, // 熱いまなざし (Passionate Gaze)
  201512, // まなざし (Sightlines)
  202131, // 荒ぶる旋風 (Wild Whirlwind)
  202132, // 気迫を込めて (With Verve)
  202352, // 土煙 (Dust Cloud)
  202362, // 圧迫感 (Burdensome Aura)
  202541, // 威風堂々 (Dignity and grandeur)
  202542, // プレッシャー (Pressure)
  202912, // 切り崩し (Break Through)
  202942, // 鬼気迫って (Fearsome Pursuit)
  100251, // アナタヲ・オイカケテ (Chasing You)
  100851, // 至上であれ (Reign Supreme)
  110071, // Adventure of 564
  110301, // Drain for rose
  110581, // Spooky-Scary-Happy
]);

export const PVP_EVENTS: PvpEvent[] = [
  {
    id: "cm-mile-2026-09",
    name: "September Champions Meeting MILE",
    shortName: "Sep CM (Mile)",
    trackId: 10006, // Tokyo
    courseId: 10603, // 1800m Turf, Left-handed
    racerCount: 9,
    season: "Fall",
    seasonIcon: "/assets/track_conditions/utx_txt_season_02.png",
    seasonNum: 3, // 3: Fall/Autumn
    weather: "Sunny",
    weatherIcon: "/assets/track_conditions/utx_ico_weather_00.png",
    weatherNum: 1, // 1: Sunny
    ground: "Good",
    groundNum: 1, // 1: Good/Firm
    time: "Daytime",
    timeIcon: "/assets/track_conditions/utx_ico_timezone_00.png",
    timeNum: 2, // 2: Daytime
    gradeNum: 100, // 100: G1
    startDate: "2026-09-14T12:00:00+09:00",
    durationDays: 6,
  },
  {
    id: "cm-classic-2026-09",
    name: "September Champions Meeting CLASSIC",
    shortName: "Sep CM (Longchamp)",
    trackId: 10201, // Longchamp
    courseId: 11203, // 2400m Turf, Right-handed
    racerCount: 9,
    season: "Fall",
    seasonIcon: "/assets/track_conditions/utx_txt_season_02.png",
    seasonNum: 3, // 3: Fall/Autumn
    weather: "Sunny",
    weatherIcon: "/assets/track_conditions/utx_ico_weather_00.png",
    weatherNum: 1, // 1: Sunny
    ground: "Heavy",
    groundNum: 3, // 3: Heavy turf (重)
    time: "Daytime",
    timeIcon: "/assets/track_conditions/utx_ico_timezone_00.png",
    timeNum: 2, // 2: Daytime
    gradeNum: 100, // 100: G1
    specialRules: ["No Debuffs"],
    noDebuffs: true,
    startDate: "2026-09-21T12:00:00+09:00",
    durationDays: 6,
  },
  {
    id: "cm-classic-2026-10",
    name: "October Champions Meeting CLASSIC",
    shortName: "Oct CM (Classic)",
    trackId: 10008, // Kyoto
    courseId: 10808, // 2200m Turf Outer, Right-handed
    racerCount: 9,
    season: "Fall",
    seasonIcon: "/assets/track_conditions/utx_txt_season_02.png",
    seasonNum: 3, // 3: Fall/Autumn
    weather: "Cloudy",
    weatherIcon: "/assets/track_conditions/utx_ico_weather_01.png",
    weatherNum: 2, // 2: Cloudy
    ground: "Good",
    groundNum: 1, // 1: Good/Firm
    time: "Daytime",
    timeIcon: "/assets/track_conditions/utx_ico_timezone_00.png",
    timeNum: 2, // 2: Daytime
    gradeNum: 100, // 100: G1
    startDate: "2026-10-15T12:00:00+09:00",
    durationDays: 6,
  },
  {
    id: "league-heroes-2026-11",
    name: "November League of Heroes",
    shortName: "Nov LoH",
    trackId: 10008, // Kyoto
    courseId: 10810, // 3000m Turf Outer, Right-handed
    racerCount: 12,
    season: "Fall",
    seasonIcon: "/assets/track_conditions/utx_txt_season_02.png",
    seasonNum: 3, // 3: Fall/Autumn
    weather: null,
    weatherIcon: null,
    weatherNum: null, // Variable / Random
    ground: null,
    groundNum: null, // Variable / Random
    time: "Daytime",
    timeIcon: "/assets/track_conditions/utx_ico_timezone_00.png",
    timeNum: 2, // 2: Daytime
    gradeNum: 100, // 100: G1
    startDate: "2026-11-10T12:00:00+09:00",
    durationDays: 6,
  },
];

export function getPvpEventById(id: string | null | undefined): PvpEvent | null {
  if (!id) return null;
  return PVP_EVENTS.find((e) => e.id === id) ?? null;
}

export function getPvpEventStage(event: PvpEvent, now: Date = new Date()): PvpEventStage {
  if (!event.startDate) return "round1";
  const start = new Date(event.startDate).getTime();
  const diffMs = now.getTime() - start;
  if (diffMs < 0) return "upcoming";

  const hours = diffMs / (1000 * 60 * 60);
  const totalHours = (event.durationDays ?? 6) * 24;

  if (hours >= totalHours) return "ended";

  // CM specific stages (Day 1-2, Day 3-4, Day 5 team selection & matchmaking, Day 6 finals)
  if (hours < 48) return "round1";
  if (hours < 96) return "round2";
  if (hours < 108) return "team_selection";
  if (hours < 120) return "matchmaking";
  return "finals";
}

export function isPvpEventEnded(event: PvpEvent, now: Date = new Date()): boolean {
  return getPvpEventStage(event, now) === "ended";
}

export function getActivePvpEvents(now: Date = new Date()): PvpEvent[] {
  return PVP_EVENTS.filter((e) => !isPvpEventEnded(e, now));
}

export function getPvpRaceParameters(event: PvpEvent | null | undefined): Partial<RaceParameters> {
  if (!event) return {};
  return {
    season: event.seasonNum,
    weather: event.weatherNum,
    groundCondition: event.groundNum,
    time: event.timeNum,
    grade: event.gradeNum,
    noDebuffs: Boolean(event.noDebuffs),
  };
}

export function isSkillBanned(skillId: number, eventOrNoDebuffs?: PvpEvent | boolean | null): boolean {
  if (!eventOrNoDebuffs) return false;
  const noDebuffs = typeof eventOrNoDebuffs === "boolean" ? eventOrNoDebuffs : Boolean(eventOrNoDebuffs.noDebuffs);
  if (!noDebuffs) return false;
  return BANNED_DEBUFF_SKILL_IDS.has(skillId);
}

