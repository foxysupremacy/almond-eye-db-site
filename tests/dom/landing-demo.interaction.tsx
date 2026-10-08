import { afterEach, describe, expect, test } from "bun:test";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SkillZoneDemo } from "@/features/landing/components/skill-zone-demo";
import { loadLandingData } from "@/features/landing/load-landing-data";
import { renderCourse } from "@/features/visualizer/rendering";

afterEach(() => cleanup());

describe("landing skill-zone demo", () => {
  test("switches the real SVG zones and live summary without changing saved data", async () => {
    const data = await loadLandingData();
    const user = userEvent.setup();
    const keys = ["presets.v2", "visualizer.v1", "almondeye_parenting_setup", "almondeye_owned_cards"];
    const previous = keys.map((key) => window.localStorage.getItem(key));
    const saved = keys.map((key) => JSON.stringify({ untouched: key }));
    keys.forEach((key, index) => window.localStorage.setItem(key, saved[index]));
    try {
      render(<SkillZoneDemo data={data.demo} />);
      const initial = screen.getByRole("img", { name: "Corner Adept ○ activation zones on Tokyo Turf 2000m" });
      expect(initial.querySelectorAll(".skillZones rect")).toHaveLength(3);
      expect(initial.querySelector(".skillZones rect")?.getAttribute("stroke-dasharray")).toBe("3 3");
      expect(screen.getByText("Possible activation zones: 200-400m, 950-1225m, 1225-1475m")).toBeTruthy();

      await user.click(screen.getByRole("radio", { name: "Show Straight Adept activation zones" }));
      const straight = screen.getByRole("img", { name: "Straight Adept activation zones on Tokyo Turf 2000m" });
      const bands = [...straight.querySelectorAll(".skillZones rect")];
      expect(bands).toHaveLength(2);
      expect(parseFloat(bands[0].getAttribute("x")!)).toBeCloseTo(20);
      expect(parseFloat(bands[0].getAttribute("width")!)).toBeCloseTo(27.5);
      expect(parseFloat(bands[1].getAttribute("x")!)).toBeCloseTo(73.75);
      expect(screen.getByText("Possible activation zones: 400-950m, 1475-2000m")).toBeTruthy();

      await user.click(screen.getByRole("radio", { name: "Show Carrying dreams activation zones" }));
      const finish = screen.getByRole("img", { name: "Carrying dreams activation zones on Tokyo Turf 2000m" });
      expect(finish.querySelectorAll(".skillZones rect")).toHaveLength(1);
      expect(finish.querySelector(".skillZones rect")?.getAttribute("stroke-dasharray")).toBe("");
      expect(screen.getByText("Deterministic trigger location")).toBeTruthy();
      expect(screen.getByText("Possible activation zones: 1475-2000m")).toBeTruthy();
      expect(screen.getByRole("radio", { name: "Show Carrying dreams activation zones" }).getAttribute("aria-checked")).toBe("true");
      expect(keys.map((key) => window.localStorage.getItem(key))).toEqual(saved);
      expect(finish.querySelector(".speedLane")).toBeNull();
    } finally {
      keys.forEach((key, index) => previous[index] === null ? window.localStorage.removeItem(key) : window.localStorage.setItem(key, previous[index]!));
    }
  });

  test("supports keyboard navigation and activation in the skill group", async () => {
    const data = await loadLandingData();
    const user = userEvent.setup();
    render(<SkillZoneDemo data={data.demo} />);
    act(() => screen.getByRole("radio", { name: "Show Corner Adept ○ activation zones" }).focus());
    await user.keyboard("{ArrowRight} ");
    await waitFor(() => expect(screen.getByRole("radio", { name: "Show Straight Adept activation zones" }).getAttribute("aria-checked")).toBe("true"));
    expect(screen.getByText("Possible activation zones: 400-950m, 1475-2000m")).toBeTruthy();
  });

  test("missing demo data presents an accessible fallback and a working tool link", () => {
    render(<SkillZoneDemo data={null} />);
    expect(screen.getByRole("status").textContent).toContain("The sample course is unavailable");
    expect(screen.getByRole("link", { name: "Open the full visualizer" }).getAttribute("href")).toBe("/#visualizer");
    expect(screen.queryByRole("button")).toBeNull();
  });

  test("the stacked mobile skill choices support vertical keyboard navigation", async () => {
    const data = await loadLandingData();
    const user = userEvent.setup();
    const originalMatchMedia = window.matchMedia;
    window.matchMedia = ((query: string) => query === "(max-width: 767px)" ? {
      matches: true, media: query, onchange: null,
      addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {}, dispatchEvent() { return false; },
    } : originalMatchMedia.call(window, query)) as typeof window.matchMedia;
    try {
      render(<SkillZoneDemo data={data.demo} />);
      expect(screen.getByRole("radiogroup").getAttribute("aria-orientation")).toBe("vertical");
      act(() => screen.getByRole("radio", { name: "Show Corner Adept ○ activation zones" }).focus());
      await user.keyboard("{ArrowDown} ");
      await waitFor(() => expect(screen.getByRole("radio", { name: "Show Straight Adept activation zones" }).getAttribute("aria-checked")).toBe("true"));
    } finally {
      cleanup();
      window.matchMedia = originalMatchMedia;
    }
  });

  test("an invalid sample condition can recover by selecting another skill", async () => {
    const data = await loadLandingData();
    const demo = data.demo!;
    const invalid = { ...demo, skills: demo.skills.map((skill, index) => index === 0 ? { ...skill, conditionGroups: [{ condition: "", precondition: "invalid condition!" }] } : skill) };
    const user = userEvent.setup();
    render(<SkillZoneDemo data={invalid} />);
    expect(screen.getByText("This skill's timeline is unavailable. Try another skill or open the full visualizer.")).toBeTruthy();
    await user.click(screen.getByRole("radio", { name: "Show Straight Adept activation zones" }));
    expect(screen.getByRole("img", { name: "Straight Adept activation zones on Tokyo Turf 2000m" })).toBeTruthy();
    expect(screen.queryByText("This skill's timeline is unavailable. Try another skill or open the full visualizer.")).toBeNull();
  });

  test("the existing renderer still includes its speed lane by default", async () => {
    const data = await loadLandingData();
    const host = document.createElement("div");
    const svg = renderCourse(host, data.demo!.course);
    expect(svg.querySelector(".speedLane")).not.toBeNull();
    expect(svg.getAttribute("data-courseid")).toBe("10604");
  });
});
