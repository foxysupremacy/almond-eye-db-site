import { afterEach, describe, expect, test } from "bun:test";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { hydrateRoot } from "react-dom/client";
import { CharacterPortrait } from "@/app/common/ui/primitives/character-portrait";
import { LandingFeature } from "@/features/landing/landing-view";
import { loadLandingData } from "@/features/landing/load-landing-data";

afterEach(() => cleanup());

// Happy DOM skips image loading and reports complete=true with no pixels.
// Model a pending browser request; failure tests explicitly dispatch an error
// or override the individual image's completion state before hydration.
async function withPendingImages(run: () => void | Promise<void>) {
  const prototype = window.HTMLImageElement.prototype;
  const descriptor = Object.getOwnPropertyDescriptor(prototype, "complete")!;
  Object.defineProperty(prototype, "complete", { configurable: true, get: () => false });
  try {
    await run();
  } finally {
    cleanup();
    Object.defineProperty(prototype, "complete", descriptor);
  }
}

describe("landing pedigree portraits", () => {
  test("all seven characters use canonical stand art and the shared sector-clipped layers", async () => withPendingImages(async () => {
    const data = await loadLandingData();
    render(<LandingFeature data={data} />);
    const pedigree = screen.getByRole("figure", { name: /Example pedigree: Almond Eye/ });
    const backs = [...pedigree.querySelectorAll('[data-portrait-layer="back"]')];
    expect(backs).toHaveLength(7);
    for (const back of backs) {
      const portrait = back.parentElement!;
      expect([...portrait.children].map((layer) => layer.getAttribute("data-portrait-layer"))).toEqual(["back", "frame", "front"]);
      const front = portrait.querySelector('[data-portrait-layer="front"]') as HTMLDivElement;
      const backImage = back.querySelector("img")!;
      const frontImage = front.querySelector("img")!;
      expect(backImage.getAttribute("src")).toBe(frontImage.getAttribute("src"));
      expect(data.characters.some((character) => character.portraitUrl === backImage.getAttribute("src"))).toBe(true);
      expect(backImage.getAttribute("src")!.endsWith("/01.png")).toBe(true);
      expect(front.style.clipPath).toBe("polygon(0 -100%, 100% -100%, 100% 0, 50% 50%, 0 0)");
      expect(frontImage.getAttribute("class")).toBe(backImage.getAttribute("class"));
      expect(frontImage.style.clipPath).toBe("");
      expect(front.getAttribute("aria-hidden")).toBe("true");
      expect(backImage.getAttribute("alt")).toBe("");
    }
  }));

  test("either image failing replaces both copies while retaining the circle frame", async () => withPendingImages(() => {
    const view = render(<CharacterPortrait src="/stand.png" className="h-16 w-16" />);
    const front = view.container.querySelector('[data-portrait-layer="front"] img')!;
    fireEvent.error(front);
    expect(view.container.querySelectorAll("img")).toHaveLength(0);
    expect(view.container.querySelector('[data-portrait-fallback="true"]')).not.toBeNull();
    expect(view.container.querySelector('[data-portrait-layer="frame"]')).not.toBeNull();

    view.rerender(<CharacterPortrait src="/another-stand.png" className="h-16 w-16" />);
    expect(view.container.querySelectorAll("img")).toHaveLength(2);
    expect(view.container.querySelector('[data-portrait-fallback="true"]')).toBeNull();
  }));

  test("a broken image loaded before hydration also gets the shared fallback", async () => {
    const host = document.createElement("div");
    document.body.appendChild(host);
    host.innerHTML = renderToStaticMarkup(<CharacterPortrait src="/missing-before-hydration.png" className="h-16 w-16" />);
    const image = host.querySelector('[data-portrait-layer="back"] img')!;
    Object.defineProperty(image, "complete", { value: true });
    Object.defineProperty(image, "naturalWidth", { value: 0 });
    let root: ReturnType<typeof hydrateRoot> | undefined;
    try {
      await act(async () => { root = hydrateRoot(host, <CharacterPortrait src="/missing-before-hydration.png" className="h-16 w-16" />); });
      expect(host.querySelectorAll("img")).toHaveLength(0);
      expect(host.querySelector('[data-portrait-fallback="true"]')).not.toBeNull();
    } finally {
      act(() => root?.unmount());
      host.remove();
    }
  });
});
