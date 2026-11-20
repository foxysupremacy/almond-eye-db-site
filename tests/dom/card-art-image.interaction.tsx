import { afterEach, describe, expect, test } from "bun:test";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { CardArtImage } from "@/app/common/ui/cards/card-art-image";

afterEach(() => cleanup());

const ART = "https://cdn.example/support/30324/30324/01.png";
const PORTRAIT = "https://cdn.example/support/30324/30324/02.png";

describe("CardArtImage", () => {
  test("shows the full art first", () => {
    render(<CardArtImage src={ART} fallbackSrc={PORTRAIT} alt="No Reason" />);
    expect(screen.getByRole("img", { name: "No Reason" }).getAttribute("src")).toBe(ART);
  });

  test("swaps to the portrait when the full art fails to load", () => {
    render(<CardArtImage src={ART} fallbackSrc={PORTRAIT} alt="No Reason" />);
    const img = screen.getByRole("img", { name: "No Reason" });
    fireEvent.error(img);
    expect(img.getAttribute("src")).toBe(PORTRAIT);
    expect(img.getAttribute("data-art-fallback")).toBe("portrait");
  });

  test("hides the image instead of showing a broken icon when both fail", () => {
    render(<CardArtImage src={ART} fallbackSrc={PORTRAIT} alt="No Reason" />);
    const img = screen.getByRole("img", { name: "No Reason" });
    fireEvent.error(img);
    fireEvent.error(img);
    expect(img.style.visibility).toBe("hidden");
    expect(img.getAttribute("data-art-fallback")).toBe("none");
  });

  test("starts over when the card changes", () => {
    const { rerender } = render(<CardArtImage src={ART} fallbackSrc={PORTRAIT} alt="Card" />);
    fireEvent.error(screen.getByRole("img", { name: "Card" }));
    const nextArt = "https://cdn.example/support/30323/30323/01.png";
    rerender(<CardArtImage src={nextArt} fallbackSrc={PORTRAIT} alt="Card" />);
    expect(screen.getByRole("img", { name: "Card" }).getAttribute("src")).toBe(nextArt);
  });

  test("without a fallback, a failed image is hidden", () => {
    render(<CardArtImage src={ART} alt="Solo" />);
    const img = screen.getByRole("img", { name: "Solo" });
    fireEvent.error(img);
    expect(img.style.visibility).toBe("hidden");
  });
});
