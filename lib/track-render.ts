// SVG race-track renderer. Faithful port of track_visualizer.html's rendering
// layer (itself a port of uma-tools' RaceTrack.tsx), refactored so the course is
// the flat engine shape (`lib/skill-engine/types.ts`) and the activation-zone
// overlay is fed by computed SkillZoneResults instead of an embedded skill blob.
//
// This module is browser-only (builds SVG DOM via createElementNS) - use it from
// a `"use client"` component.

import type { Course } from "./skill-engine/types";
import type { SkillZoneResult } from "./skill-engine/zones";

// ---------- constants ----------
const SURF: Record<number, string> = { 1: "Turf", 2: "Dirt" };
const TURN: Record<number, string> = {
  1: " (right-handed)",
  2: " (left-handed)",
  4: " (straight)",
};
const INOUT: Record<number, string> = {
  0: "",
  1: "",
  2: " (inner)",
  3: " (outer)",
  4: " (outer→inner)",
};

// One tint per condition-group/trigger, in the ink/paper editorial palette.
export const ZONE_COLORS = ["#e03131", "#2f6fd0", "#0a8a5f", "#b367c9", "#e08900", "#0f766e"];

// ---------- svg helpers ----------
function el(
  tag: string,
  attrs: Record<string, string> = {},
  children?: Node[],
): SVGElement {
  const n = document.createElementNS("http://www.w3.org/2000/svg", tag);
  for (const k in attrs) {
    if (k === "class") n.setAttribute("class", attrs[k]);
    else if (k === "text") n.textContent = attrs[k];
    else n.setAttribute(k, attrs[k]);
  }
  (children || []).forEach((c) => n.appendChild(c));
  return n;
}

function svgText(
  txt: string,
  x: string,
  y: string,
  opts: { anchor?: string; size?: string; fill?: string; className?: string; dominantBaseline?: string; dy?: string } = {},
): SVGElement {
  const a: Record<string, string> = {
    x,
    y,
    "text-anchor": opts.anchor || "middle",
    "font-size": opts.size || "10px",
    text: txt,
  };
  if (opts.fill) a.fill = opts.fill;
  if (opts.dominantBaseline) a["dominant-baseline"] = opts.dominantBaseline;
  if (opts.className) a["class"] = opts.className;
  if (opts.dy != null) a.dy = opts.dy;
  return el("text", a);
}

// ---------- elevation helpers ----------
function flattenSlopes(course: Course) {
  const full: { start: number; length: number; slope: number }[] = [];
  let lastEnd = 0;
  course.slopes
    .slice()
    .sort((a, b) => a.start - b.start)
    .forEach((s) => {
      if (s.start !== lastEnd) full.push({ start: lastEnd, length: s.start - lastEnd, slope: 0 });
      full.push({ start: s.start, length: s.end - s.start, slope: s.slope });
      lastEnd = s.end;
    });
  if (lastEnd < course.length) full.push({ start: lastEnd, length: course.length - lastEnd, slope: 0 });
  return full;
}

function elevationBand(course: Course): SVGElement[] {
  const full = flattenSlopes(course);
  let hi = 0;
  let lo = 0;
  let us = 0;
  full.forEach((s) => {
    us += (s.slope / 10000) * s.length;
    if (us > hi) hi = us;
    if (us < lo) lo = us;
  });
  let range = hi - (lo + hi > -30 ? 0 : lo);
  range = range || 1;
  const endHeights: number[] = [50];
  full.forEach((s) => {
    const last = endHeights[endHeights.length - 1];
    endHeights.push(last - ((s.slope / 10000) * s.length) / range * 40);
  });

  const elems: SVGElement[] = [];
  full.forEach((s, i) => {
    const x = `${(s.start / course.length) * 100}%`;
    const w = `${(s.length / course.length) * 100}%`;
    const midX = `${((s.start + s.length / 2) / course.length) * 100}%`;
    const yTop = endHeights[i];
    const yBot = endHeights[i + 1];
    if (s.slope === 0) {
      elems.push(el("rect", { x, y: `${yTop * 0.262}%`, width: w, height: "26.2%", fill: "rgb(211,243,68)" }));
    } else {
      const up = s.slope > 0;
      const peak = Math.min(yTop, yBot);
      elems.push(
        el("svg", { x, y: "0", width: w, height: "26.2%", viewBox: "0 0 100 100", preserveAspectRatio: "none", class: `hillArea ${up ? "uphill" : "downhill"}` }, [
          el("polygon", { points: `0,${yTop} 0,100 100,100 100,${yBot}`, fill: "rgb(211,243,68)" }),
        ]),
      );
      elems.push(el("rect", { x, y: "0", width: w, height: "26.2%", fill: up ? "rgba(255,170,50,0.25)" : "rgba(40,200,190,0.25)" }));
      elems.push(
        svgText(`${up ? "↗" : "↘"}${Math.abs(s.slope / 10000)}%`, midX, `${peak * 0.262}%`, {
          size: "10px",
          fill: "rgb(121,64,22)",
          className: "distanceMarker",
          dominantBaseline: "hanging",
          dy: "-1px",
        }),
      );
    }
  });
  elems.push(el("rect", { x: "0", y: "26.2%", width: "100%", height: "1.8%", fill: "rgb(140,170,10)" }));
  return elems;
}

// ---------- straight / corner band ----------
function sectionsBand(course: Course): SVGElement[] {
  const elems: SVGElement[] = [];
  elems.push(
    el("svg", { x: "0", y: "46%", width: "100%", height: "18%", class: "sectionsBg" }, [
      el("rect", { x: "0", y: "0", height: "90%", width: "100%", fill: "rgb(232,232,232)" }),
      el("rect", { x: "0", y: "90%", height: "10%", width: "100%", fill: "rgb(139,139,139)" }),
    ]),
  );
  let si = 0;
  course.straights.forEach((s) => {
    const x = `${(s.start / course.length) * 100}%`;
    const w = `${((s.end - s.start) / course.length) * 100}%`;
    const alt = si++ % 2 === 0;
    elems.push(
      el("svg", { x, y: "46%", width: w, height: "18%", class: "straight" }, [
        el("rect", { x: "0", y: "0", height: "90%", width: "100%", fill: alt ? "rgb(209,235,255)" : "rgb(185,224,255)" }),
        el("rect", { x: "0", y: "90%", height: "10%", width: "100%", fill: alt ? "rgb(23,154,255)" : "rgb(9,146,254)" }),
        el("text", { x: "50%", y: "50%", class: "sectionText", text: "Straight →" }),
      ]),
    );
  });
  course.corners.forEach((c, i) => {
    const x = `${(c.start / course.length) * 100}%`;
    const w = `${((c.end - c.start) / course.length) * 100}%`;
    const alt = i % 2 === 0;
    elems.push(
      el("svg", { x, y: "46%", width: w, height: "18%", class: "corner" }, [
        el("rect", { x: "0", y: "0", height: "90%", width: "100%", fill: alt ? "rgb(255,216,185)" : "rgb(254,228,209)" }),
        el("rect", { x: "0", y: "90%", height: "10%", width: "100%", fill: alt ? "rgb(254,117,9)" : "rgb(250,121,27)" }),
        el("text", { x: "50%", y: "50%", class: "sectionText", text: `C${c.number ?? "x"}` }),
      ]),
    );
  });
  return elems;
}

// ---------- distance markers ----------
function distanceMarkers(course: Course, yBase: number, boundaries: number[]): SVGElement[] {
  const elems: SVGElement[] = [];
  boundaries.forEach((d, i) => {
    if (d <= 0 || d >= course.length) return;
    const prev = i > 0 ? boundaries[i - 1] : 0;
    const x = (d / course.length) * 100;
    const flip = i > 0 && d - prev < course.length * 0.05;
    const up = flip;
    elems.push(
      svgText(`${d}m`, `${x}%`, up ? `${yBase - 11.5}%` : `${yBase}%`, {
        anchor: "middle",
        size: "10px",
        fill: "rgb(121,64,22)",
        className: "distanceMarker",
        dominantBaseline: up ? "hanging" : "auto",
      }),
    );
    elems.push(
      el("line", {
        x1: `${x}%`,
        y1: `${yBase}%`,
        x2: `${x}%`,
        y2: `${yBase + (up ? -2.5 : 2.5)}%`,
        stroke: "rgb(121,64,22)",
      }),
    );
  });
  return elems;
}

// ---------- phases band ----------
function phasesBand(course: Course): SVGElement[] {
  const elems: SVGElement[] = [];
  const colors: [string, string, string][] = [
    ["rgb(0,154,111)", "rgb(0,92,66)", "Opening leg"],
    ["rgb(242,233,103)", "rgb(190,179,16)", "Middle leg"],
    ["rgb(209,134,175)", "rgb(149,56,107)", "Final leg"],
    ["rgb(199,109,159)", "rgb(133,51,96)", "Last spurt"],
  ];
  const phases =
    course.phases && course.phases.length
      ? course.phases
      : [
          { start: 0, end: course.length / 6, id: 0 },
          { start: course.length / 6, end: (course.length * 2) / 3, id: 1 },
          { start: (course.length * 2) / 3, end: (course.length * 5) / 6, id: 2 },
          { start: (course.length * 5) / 6, end: course.length, id: 3 },
        ];
  phases.forEach((p) => {
    const c = colors[p.id] || colors[0];
    const x = `${(p.start / course.length) * 100}%`;
    const w = `${((p.end - p.start) / course.length) * 100}%`;
    elems.push(
      el("svg", { x, y: "64%", width: w, height: "18%", class: `phase phase${p.id}` }, [
        el("rect", { x: "0", y: "0", height: "90%", width: "100%", fill: c[0] }),
        el("rect", { x: "0", y: "90%", height: "10%", width: "100%", fill: c[1] }),
        el("text", { x: "50%", y: "50%", class: "sectionText", text: c[2] }),
      ]),
    );
  });
  return elems;
}

// ---------- ruler (1-24 sections) ----------
function ruler(course: Course): SVGElement[] {
  const elems: SVGElement[] = [];
  elems.push(el("rect", { x: "0", y: "82%", height: "18%", width: "100%", fill: "rgb(228,235,240)" }));
  for (let i = 0; i <= 24; i++) {
    elems.push(
      el("line", {
        x1: `${(i / 24) * 100}%`,
        y1: "96%",
        x2: `${(i / 24) * 100}%`,
        y2: "100%",
        stroke: "rgb(107,145,173)",
        "stroke-width": i === 0 || i === 24 ? "4" : "2",
      }),
    );
  }
  for (let j = 1; j <= 24; j++) {
    elems.push(
      svgText(String(j), `${((1 / 48 + (j - 1) / 24) * 100)}%`, "91%", {
        anchor: "middle",
        size: "10px",
        fill: "rgb(107,145,173)",
        className: "rulerText",
        dominantBaseline: "central",
      }),
    );
  }
  elems.push(el("rect", { x: "0", y: "98.2%", height: "1.8%", width: "100%", fill: "rgb(107,145,173)" }));
  return elems;
}

// ---------- mouse & touch hover ----------
function attachHover(svg: SVGSVGElement, course: Course): void {
  const line = svg.querySelector(".mouseoverLine");
  const txt = svg.querySelector(".mouseoverText");
  if (!line || !txt) return;
  const ln = line as SVGElement;
  const tx = txt as SVGElement;
  // The hover line/text live inside the nested "inner" <svg>, whose user units
  // are the track's nominal size (960×240). The outer svg can be scaled down by
  // CSS (.racetrackView max-width:100%), so convert mouse pixels to inner user
  // units via the inner rect instead of the outer one to avoid drift.
  const inner = ln.parentElement as SVGSVGElement | null;
  const W = inner ? Number(inner.getAttribute("width")) || 960 : 960;
  const H = inner ? Number(inner.getAttribute("height")) || 240 : 240;

  function updateHover(clientX: number, clientY: number) {
    if (!inner) return;
    const r = inner.getBoundingClientRect();
    const u = (clientX - r.left) / r.width; // 0..1 across the track
    if (u < 0 || u > 1) return;
    const x = u * W;
    const m = Math.round(u * course.length);
    ln.setAttribute("x1", String(x));
    ln.setAttribute("x2", String(x));
    tx.setAttribute("x", String(x > W - 45 ? x - 45 : x + 5));
    tx.setAttribute("y", String(((clientY - r.top) / r.height) * H));
    tx.textContent = `${m}m`;
  }

  function move(ev: MouseEvent) {
    updateHover(ev.clientX, ev.clientY);
  }

  function touchMove(ev: TouchEvent) {
    if (!ev.touches[0]) return;
    updateHover(ev.touches[0].clientX, ev.touches[0].clientY);
  }

  function leave() {
    ln.setAttribute("x1", "-5");
    ln.setAttribute("x2", "-5");
    tx.setAttribute("x", "-5");
    tx.setAttribute("y", "-5");
  }

  svg.addEventListener("mousemove", move);
  svg.addEventListener("mouseleave", leave);
  svg.addEventListener("touchstart", touchMove, { passive: true });
  svg.addEventListener("touchmove", touchMove, { passive: true });
  svg.addEventListener("touchend", leave);
}

// ---------- skill activation overlay ----------
// Paints one tinted band per condition-group (T1, T2, …) onto the ruler (82%-100%).
// Random triggers render as a dashed outline; deterministic ones are solid fills.
export function renderSkillOverlay(
  inner: SVGSVGElement,
  course: Course,
  zones: SkillZoneResult[],
): void {
  const overlay = el("g", { id: "skillZones", class: "skillZones" });
  zones.forEach((z, gi) => {
    if (!z.regions.length) return; // never fires on this course
    const color = ZONE_COLORS[gi % ZONE_COLORS.length];
    z.regions.forEach((reg) => {
      const x1 = (reg.start / course.length) * 100;
      const w = ((reg.end - reg.start) / course.length) * 100;
      overlay.appendChild(
        el("rect", {
          x: `${x1}%`,
          y: "82%",
          width: `${w}%`,
          height: "18%",
          fill: color,
          "fill-opacity": z.isRandom ? "0.14" : "0.22",
          stroke: color,
          "stroke-width": "1",
          "stroke-dasharray": z.isRandom ? "3 3" : "",
          "pointer-events": "none",
        }),
      );
      const mid = reg.start + (reg.end - reg.start) / 2;
      overlay.appendChild(
        svgText(`T${gi + 1}`, `${(mid / course.length) * 100}%`, "83%", {
          size: "10px",
          fill: color,
          className: "distanceMarker",
        }),
      );
    });
  });
  inner.appendChild(overlay);
}

// ---------- top-level render ----------
// Builds the full SVG (bands + ruler + hover + optional zone overlay) and appends
// it to `host`, replacing any prior render. Title/header/chips are the caller's job.
export function renderCourse(
  host: HTMLElement,
  course: Course,
  opts: { zones?: SkillZoneResult[] } = {},
): SVGSVGElement {
  host.innerHTML = "";
  const W = 960;
  const H = 240;
  const xOff = 12;
  const yOff = 6;
  const yExtra = 10;

  const svg = el("svg", {
    version: "1.1",
    width: String(W + xOff),
    height: String(H + yOff + yExtra),
    viewBox: `0 0 ${W + xOff} ${H + yOff + yExtra}`,
    xmlns: "http://www.w3.org/2000/svg",
    class: "racetrackView",
    "data-courseid": String(course.id),
  }) as SVGSVGElement;

  const inner = el("svg", { x: String(xOff), y: String(yOff), width: String(W), height: String(H) }) as SVGSVGElement;

  // band 1: elevation
  elevationBand(course).forEach((e) => inner.appendChild(e));
  // band 2: slope tints
  inner.appendChild(
    el("svg", { x: "0", y: "28%", width: "100%", height: "18%", class: "sectionsBg" }, [
      el("rect", { x: "0", y: "0", height: "90%", width: "100%", fill: "rgb(239,229,241)" }),
      el("rect", { x: "0", y: "90%", height: "10%", width: "100%", fill: "rgb(163,106,175)" }),
    ]),
  );
  let upi = 0;
  let downi = 0;
  course.slopes.forEach((s) => {
    const x = `${(s.start / course.length) * 100}%`;
    const w = `${((s.end - s.start) / course.length) * 100}%`;
    const up = s.slope > 0;
    if (up) upi++;
    else downi++;
    const altUp = (upi - 1) % 2 === 0;
    const altDown = (downi - 1) % 2 === 0;
    const body = up ? (altUp ? "rgb(234,207,147)" : "rgb(229,196,120)") : altDown ? "rgb(82,195,184)" : "rgb(116,206,198)";
    const edge = up ? (altUp ? "rgb(191,143,37)" : "rgb(175,132,33)") : altDown ? "rgb(42,123,115)" : "rgb(50,142,134)";
    inner.appendChild(
      el("svg", { x, y: "28%", width: w, height: "18%", class: "slope" }, [
        el("rect", { x: "0", y: "0", height: "90%", width: "100%", fill: body }),
        el("rect", { x: "0", y: "90%", height: "10%", width: "100%", fill: edge }),
        el("text", { x: "50%", y: "50%", class: "sectionText", text: up ? "↗ Uphill" : "↘ Downhill" }),
      ]),
    );
  });
  const slopeBounds: number[] = [];
  course.slopes.forEach((s) => {
    slopeBounds.push(s.start);
    slopeBounds.push(s.end);
  });
  const slopeUniq = [...new Set(slopeBounds)].sort((a, b) => a - b);
  distanceMarkers(course, 42, slopeUniq).forEach((e) => inner.appendChild(e));

  // band 3: straight/corner
  sectionsBand(course).forEach((e) => inner.appendChild(e));
  const secBounds: number[] = [];
  course.straights.forEach((s) => {
    secBounds.push(s.start);
    secBounds.push(s.end);
  });
  course.corners.forEach((c) => {
    secBounds.push(c.start);
    secBounds.push(c.end);
  });
  const secUniq = [...new Set(secBounds)].sort((a, b) => a - b);
  distanceMarkers(course, 60, secUniq).forEach((e) => inner.appendChild(e));

  // band 4: phases
  phasesBand(course).forEach((e) => inner.appendChild(e));
  const phBounds: number[] = [];
  (course.phases || []).forEach((p) => {
    phBounds.push(p.start);
    phBounds.push(p.end);
  });
  // Phase boundaries are shared between adjacent legs; dedupe so each meter
  // label shows once (not twice at the same boundary).
  const phUniq = [...new Set(phBounds)].sort((a, b) => a - b);
  distanceMarkers(course, 78, phUniq).forEach((e) => inner.appendChild(e));

  // band 5: ruler
  ruler(course).forEach((e) => inner.appendChild(e));

  // mouseover elements
  inner.appendChild(el("line", { class: "mouseoverLine", x1: "-5", y1: "0", x2: "-5", y2: "100%", stroke: "var(--track-hover-line, #0284c7)", "stroke-width": "2" }));
  inner.appendChild(el("text", { class: "mouseoverText", x: "-5", y: "-5", fill: "var(--track-hover-line, #0284c7)" }));

  // skill zone overlay
  if (opts.zones) renderSkillOverlay(inner, course, opts.zones);

  svg.appendChild(inner);
  host.appendChild(svg);
  attachHover(svg, course);
  return svg;
}

export { SURF, TURN, INOUT };