import { describe, it, expect } from "bun:test";
import { decodeFactor, calculateLineageBlueStars, extractSlotPrimaryFactors } from "./factor-decoder";

describe("factor-decoder", () => {
  it("decodes blue stat factors properly", () => {
    const spd3 = decodeFactor(103);
    expect(spd3.type).toBe("blue");
    expect(spd3.name).toBe("Speed");
    expect(spd3.stars).toBe(3);

    const sta2 = decodeFactor(202);
    expect(sta2.type).toBe("blue");
    expect(sta2.name).toBe("Stamina");
    expect(sta2.stars).toBe(2);

    const pwr1 = decodeFactor(301);
    expect(pwr1.type).toBe("blue");
    expect(pwr1.name).toBe("Power");
    expect(pwr1.stars).toBe(1);

    const wit2 = decodeFactor(502);
    expect(wit2.type).toBe("blue");
    expect(wit2.name).toBe("Wit");
    expect(wit2.stars).toBe(2);
  });

  it("decodes pink aptitude factors properly", () => {
    const turf2 = decodeFactor(1102);
    expect(turf2.type).toBe("pink");
    expect(turf2.name).toBe("Turf");
    expect(turf2.stars).toBe(2);

    const mile3 = decodeFactor(2203);
    expect(mile3.type).toBe("pink");
    expect(mile3.name).toBe("Mile");
    expect(mile3.stars).toBe(3);
  });

  it("calculates lineage blue stars accurately across self and parents", () => {
    const sampleVeteran = {
      factor_info_array: [{ factor_id: 103 }, { factor_id: 1102 }], // 3★ Speed self
      succession_chara_array: [
        {
          position_id: 10, // Parent 1
          factor_info_array: [{ factor_id: 203 }], // 3★ Stamina
        },
        {
          position_id: 20, // Parent 2
          factor_info_array: [{ factor_id: 302 }], // 2★ Power
        },
        {
          position_id: 11, // Grandparent (not direct parent)
          factor_info_array: [{ factor_id: 103 }],
        },
      ],
    };

    const stars = calculateLineageBlueStars(sampleVeteran);
    expect(stars.self).toBe(3);
    expect(stars.parents).toBe(5);
    expect(stars.total).toBe(8);
  });

  it("extracts primary blue, pink, and green factors for card pill display", () => {
    const factors = [
      { factor_id: 103 }, // Speed 3★
      { factor_id: 1102 }, // Turf 2★
      { factor_id: 10010103 }, // Unique skill factor 3★ (Special Week Shooting Star)
      { factor_id: 20011 }, // White skill factor
    ];

    const { blue, pink, green } = extractSlotPrimaryFactors(factors);
    expect(blue).toBeDefined();
    expect(blue?.nameEn).toBe("Speed");
    expect(blue?.stars).toBe(3);

    expect(pink).toBeDefined();
    expect(pink?.nameEn).toBe("Turf");
    expect(pink?.stars).toBe(2);

    expect(green).toBeDefined();
    expect(green?.stars).toBe(3);
    expect(green?.type).toBe("green");
  });
});
