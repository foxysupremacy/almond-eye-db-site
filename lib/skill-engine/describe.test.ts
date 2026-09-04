import { describe, expect, test } from "bun:test";
import { describeCondition, conditionBranches, formatEffect } from "./describe";

describe("describeCondition", () => {
  test("known geometry keywords", () => {
    expect(describeCondition("corner!=0").when).toBe("On a corner");
    expect(describeCondition("phase==1").when).toBe("Mid-race");
    expect(describeCondition("phase==3").when).toBe("Last spurt");
    expect(describeCondition("is_last_straight==1").when).toBe("On the final straight");
    expect(describeCondition("distance_type==3").when).toBe("A medium-distance race");
    expect(describeCondition("ground_type==1").when).toBe("Turf");
  });

  test("& joins with 'and', lowercased after first", () => {
    expect(describeCondition("phase==1&is_overtake==1").when).toBe(
      "Mid-race and has an overtake target",
    );
    expect(describeCondition("corner!=0&phase==2").when).toBe(
      "On a corner and late race",
    );
  });

  test("@ joins with 'or'", () => {
    expect(describeCondition("phase==1@phase==2").when).toBe("Mid-race or late race");
  });

  test("timed condition renders seconds", () => {
    expect(describeCondition("accumulatetime>=25").when).toBe("After 25s");
  });

  test("position renders order", () => {
    expect(describeCondition("order<=3").when).toBe("Position 3 or better");
    expect(describeCondition("order_rate<=50").when).toBe("Position 6 or better");
  });

  test("order_rate renders exact positions from racer count", () => {
    expect(describeCondition("order_rate<=33", undefined, 18).when).toBe(
      "Position 6 or better",
    );
    expect(describeCondition("order_rate<50").when).toBe("Position better than 6");
    expect(describeCondition("order_rate>50").when).toBe("Position 7 or worse");
    expect(describeCondition("order_rate>=50").when).toBe("Position 6 or worse");
    expect(describeCondition("order_rate<=50", undefined, 9).when).toBe(
      "Position 5 or better",
    );
    expect(describeCondition("order_rate>50", undefined, 9).when).toBe(
      "Position 6 or worse",
    );
    // No racerCount passed → default 12.
    expect(describeCondition("order_rate<=50").when).toBe("Position 6 or better");
  });

  test("order_rate<=0 falls back to raw text", () => {
    expect(describeCondition("order_rate<=0").when).toBe("Order_rate <= 0");
  });

  test("racerCount is clamped and never throws", () => {
    // rate ≤ 0 leaves a needs string raw too (no throw).
    expect(() => describeCondition("order_rate<=50", null, 0)).not.toThrow();
    expect(() => describeCondition("order_rate<=50", null, 999)).not.toThrow();
    expect(() => describeCondition("order_rate<=50", null, NaN)).not.toThrow();
    // Clamping: 0 → 9 → round(4.5) = 5 → "Position 5 or better".
    expect(describeCondition("order_rate<=50", null, 0)).toEqual({
      when: "Position 5 or better",
    });
    // Clamping: 999 → 18.
    expect(describeCondition("order_rate>50", null, 999)).toEqual({
      when: "Position 10 or worse",
    });
  });

  test("order_rate precondition renders with the same racer count", () => {
    expect(describeCondition("order_rate<=50", "accumulatetime>=25", 9)).toEqual({
      when: "Position 5 or better",
      needs: "After 25s",
    });
  });

  test("unknown keyword falls back to raw text", () => {
    expect(describeCondition("some_unknown_keyword>=5").when).toBe(
      "Some_unknown_keyword >= 5",
    );
  });

  test("precondition renders as needs", () => {
    expect(describeCondition("is_last_straight==1", "accumulatetime>=25")).toEqual({
      when: "On the final straight",
      needs: "After 25s",
    });
  });

  test("malformed input does not throw", () => {
    expect(() => describeCondition("phase==garbage&&&")).not.toThrow();
    expect(() => describeCondition("")).not.toThrow();
    expect(() => describeCondition("!@#$%^&*")).not.toThrow();
  });

  test("bare always", () => {
    expect(describeCondition("always==1").when).toBe("Always");
  });

  test("operator fixes and non-equality comparisons", () => {
    expect(describeCondition("distance_type!=3").when).toBe("Not a medium-distance race");
    expect(describeCondition("phase>=1").when).toBe("Mid-race or later");
    expect(describeCondition("phase>=2").when).toBe("Late race or later");
    expect(describeCondition("phase<=1").when).toBe("Early or mid-race");
    expect(describeCondition("ground_condition!=1").when).toBe("Not good ground");
    expect(describeCondition("ground_condition<=2").when).toBe("Good or slightly heavy ground");
    expect(describeCondition("ground_condition>=3").when).toBe("Heavy or bad ground");
    expect(describeCondition("compete_fight_count>0").when).toBe("In a showdown");
  });

  test("semantic phrasing fixes", () => {
    expect(describeCondition("is_finalcorner==1").when).toBe("At or after the final corner");
    expect(describeCondition("is_finalcorner==0").when).toBe("Before the final corner");
    expect(describeCondition("corner_random==1").when).toBe("A random point on corner 1");
    expect(describeCondition("corner_random==3").when).toBe("A random point on corner 3");
    expect(describeCondition("is_surrounded==1").when).toBe("Boxed in (front, back, and outside)");
    expect(describeCondition("change_order_up_finalcorner_after>=2").when).toBe("Passed 2 girls at or after the final corner");
    expect(describeCondition("running_style==4").when).toBe("Running as a Chaser");
    expect(describeCondition("temptation_count==0").when).toBe("Never rushed");
  });

  test("track name lookup with fallback", () => {
    expect(describeCondition("track_id==10005").when).toBe("Nakayama racecourse");
    expect(describeCondition("track_id!=10005").when).toBe("Not Nakayama racecourse");
    expect(describeCondition("track_id==99999").when).toBe("Track #99999");
  });

  test("pluralization and grammar", () => {
    expect(describeCondition("near_count>=1").when).toBe("1 other girl within ~3m");
    expect(describeCondition("near_count>=2").when).toBe("2 other girls within ~3m");
    expect(describeCondition("near_infront_count>=1").when).toBe("1 girl within ~2.5m ahead");
    expect(describeCondition("near_infront_count>=2").when).toBe("2 girls within ~2.5m ahead");
    expect(describeCondition("bashin_diff_infront<=1").when).toBe("≤ 1 length to the horse ahead");
    expect(describeCondition("bashin_diff_infront<=3").when).toBe("≤ 3 lengths to the horse ahead");
    expect(describeCondition("same_skill_horse_count>=1").when).toBe("1 other girl has this skill");
    expect(describeCondition("same_skill_horse_count>=2").when).toBe("2 other girls have this skill");
    expect(describeCondition("temptation_opponent_count_behind>=1").when).toBe("1 opponent behind rushing");
    expect(describeCondition("temptation_opponent_count_behind>=2").when).toBe("2 opponents behind rushing");
  });
});

describe("conditionBranches", () => {
  test("splits @ into rows, & into chips", () => {
    const { branches } = conditionBranches("phase==1&is_overtake==1@phase==2");
    expect(branches).toHaveLength(2);
    expect(branches[0]).toEqual(["mid-race", "has an overtake target"]);
    expect(branches[1]).toEqual(["late race"]);
  });

  test("preserves backward compat .when", () => {
    const { when } = conditionBranches("phase==1&is_overtake==1");
    expect(when).toBe("Mid-race and has an overtake target");
  });
});

describe("formatEffect", () => {
  test("target speed type 27", () => {
    // 3500 / 10000 = 0.35 m/s, base_time=24000, courseLength=1000 → 2.4 s
    const line = formatEffect([{ type: 27, value: 3500 }], 24000, 1000);
    expect(line).toBe("+0.35 m/s Target Speed for 2.4 s");
  });

  test("recovery type 9", () => {
    const line350 = formatEffect([{ type: 9, value: 350 }], null, 1200);
    expect(line350).toBe("+3.5% HP");

    const line550 = formatEffect([{ type: 9, value: 550 }], null, 1200);
    expect(line550).toBe("+5.5% HP");

    const lineHybrid = formatEffect(
      [{ type: 9, value: 550 }, { type: 22, value: 1500 }],
      20000,
      2400,
    );
    expect(lineHybrid).toBe("+5.5% HP, +0.15 m/s Current Speed for 4.8 s");
  });

  test("passive no duration", () => {
    const line60 = formatEffect([{ type: 1, value: 600000 }], -1, 1200);
    expect(line60).toBe("+60 Speed");

    const line40 = formatEffect([{ type: 1, value: 400000 }], null, 1200);
    expect(line40).toBe("+40 Speed");

    const lineStamina = formatEffect([{ type: 2, value: 400000 }], null, 1200);
    expect(lineStamina).toBe("+40 Stamina");
  });

  test("accel type 31 with duration", () => {
    // 4000 / 10000 = 0.4 m/s², base_time=24000, courseLength=1000 → 2.4 s
    const line = formatEffect([{ type: 31, value: 4000 }], 24000, 1000);
    expect(line).toBe("+0.40 m/s² Acceleration for 2.4 s");
  });

  test("negative value", () => {
    const line = formatEffect([{ type: 21, value: -2000 }], 24000, 1000);
    expect(line).toBe("−0.20 m/s Current Speed for 2.4 s");
  });

  test("multiple effects join with ', '", () => {
    const line = formatEffect(
      [{ type: 27, value: 3500 }, { type: 27, value: 1500 }],
      24000,
      1000,
    );
    expect(line).toBe("+0.35 m/s Target Speed, +0.15 m/s Target Speed for 2.4 s");
  });

  test("target designations for hybrid and debuff skills", () => {
    // Speed Eater (hybrid: debuff behind + self buff)
    const speedEater = formatEffect(
      [
        { target: 10, target_details: 5, type: 21, value: -1500 },
        { type: 27, value: 1500 },
      ],
      30000,
      1800,
    );
    expect(speedEater).toBe("−0.15 m/s Current Speed (opponents behind), +0.15 m/s Target Speed (self) for 5.4 s");

    // Keen Insight (pure debuff)
    const keenInsight = formatEffect(
      [{ target: 9, target_details: 18, type: 21, value: -2000 }],
      25000,
      1200,
    );
    expect(keenInsight).toBe("−0.20 m/s Current Speed (opponents ahead) for 3.0 s");

    // Faltering Runners (running style debuff)
    const faltering = formatEffect(
      [{ target: 18, target_details: 1, type: 21, value: -1500 }],
      30000,
      1000,
    );
    expect(faltering).toBe("−0.15 m/s Current Speed (opponent Runners) for 3.0 s");

    // Teammate buff
    const teamBuff = formatEffect(
      [
        { type: 27, value: 4500 },
        { target: 11, type: 27, value: 1500 },
      ],
      null,
      1600,
    );
    expect(teamBuff).toBe("+0.45 m/s Target Speed (self), +0.15 m/s Target Speed (teammates)");
  });

  test("never throws on garbage", () => {
    expect(() => formatEffect([{ type: 999, value: NaN }], null, 0)).not.toThrow();
    expect(() => formatEffect([], null, 0)).not.toThrow();
  });
});
