import { afterEach, describe, expect, test } from "bun:test";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { ActivationStrip, GainPositionChart, phaseBandsForCourse, SpeedTimeChart } from "@/app/common/ui/skills/effect-details/charts";

afterEach(cleanup);
const trace = {
  version: 1, points: [0, 1, 2].map((i) => ({ timeSeconds: 70 + i, baselineMeter: 1400 + i * 20, baselineSpeed: 20, baselineTargetSpeed: 20, skillMeter: 1400 + i * 21, skillSpeed: 20 + i, skillTargetSpeed: 20, phase: 2 })),
  spatialPoints: [], activationMeter: 1420, effectEndMeter: 1460, activationTimeSeconds: 71, effectEndTimeSeconds: 72, totalTimeSeconds: 140, timeGainSeconds: 0.1, distanceGainMeters: 2, bashinGain: 0.8, physicsStatus: "modeled",
} as const;

describe("effect charts", () => {
  test("speed chart readout updates on keyboard scrub", () => {
    render(<SpeedTimeChart trace={trace as never} />);
    const plot = screen.getByRole("img", { name: /speed versus elapsed time/i });
    plot.focus();
    fireEvent.keyDown(plot, { key: "ArrowRight" });
    expect(screen.getByRole("status").textContent).toMatch(/71\.0 s/);
  });
  test("touch tap scrubs immediately; touch move without press does not", () => {
    const { container } = render(<SpeedTimeChart trace={trace as never} />);
    const overlay = container.querySelector("rect[fill='transparent']") as SVGRectElement;
    overlay.getBoundingClientRect = () => ({ left: 0, top: 0, width: 640, height: 160, right: 640, bottom: 160, x: 0, y: 0, toJSON() {} }) as DOMRect;
    const before = screen.getByRole("status").textContent;
    fireEvent.pointerMove(overlay, { pointerType: "touch", clientX: 640, pointerId: 1 });
    expect(screen.getByRole("status").textContent).toBe(before);
    fireEvent.pointerDown(overlay, { pointerType: "touch", clientX: 320, pointerId: 1 });
    expect(screen.getByRole("status").textContent).toMatch(/71\.0 s/);
    fireEvent.pointerMove(overlay, { pointerType: "touch", clientX: 640, pointerId: 1 });
    expect(screen.getByRole("status").textContent).toMatch(/72\.0 s/);
    fireEvent.pointerUp(overlay, { pointerType: "touch", pointerId: 1 });
    fireEvent.pointerMove(overlay, { pointerType: "touch", clientX: 0, pointerId: 1 });
    expect(screen.getByRole("status").textContent).toMatch(/72\.0 s/);
  });
  test("gain chart marks the best position and handles empty data", () => {
    const bands = phaseBandsForCourse(2200, 1833);
    const { rerender } = render(<GainPositionChart courseLength={2200} samples={[{ meter: 1300, bashin: 2 }, { meter: 1340, bashin: 3.8 }]} bands={bands} bestMeter={1340} />);
    expect(screen.getByText(/best 1,340 m/i)).toBeTruthy();
    rerender(<GainPositionChart courseLength={2200} samples={[]} bands={bands} bestMeter={null} />);
    expect(screen.getByText(/no modeled effect/i)).toBeTruthy();
  });
  test("activation strip is labelled 'Possible activation points' and marks each point at full height (R32: no rate)", () => {
    const { container } = render(<ActivationStrip courseLength={2000} samples={[{ meter: 1000 }, { meter: 1010 }, { meter: 1020 }]} bands={[]} />);
    const strip = screen.getByRole("img", { name: "Possible activation points along the course" });
    expect(strip).toBeTruthy();
    const marks = container.querySelectorAll("rect[data-point]");
    expect(marks.length).toBe(3);
    for (const m of marks) expect(m.getAttribute("height")).toBe("24");
  });
  test("phase bands cover the course in order", () => {
    const b = phaseBandsForCourse(2200, 1833);
    expect(b.map((x) => x.tone)).toEqual(["early", "mid", "late", "spurt"]);
    expect(b[0].start).toBe(0);
    expect(b.at(-1)!.end).toBe(2200);
    expect(phaseBandsForCourse(2400, 1600).map((x) => x.tone)).toEqual(["early", "mid", "spurt"]);
  });
});
