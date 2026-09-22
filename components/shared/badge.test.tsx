import { describe, expect, it } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { AlertTriangleIcon } from "../icons";
import { Badge } from "./badge";

describe("shared Badge", () => {
  it("uses the compact geometry contract without pill styling", () => {
    const html = renderToStaticMarkup(
      <Badge size="compact" tone="emerald" uppercase>
        Unique Target
      </Badge>,
    );

    expect(html).toContain("h-5");
    expect(html).toContain("px-1.5");
    expect(html).toContain("text-[9px]");
    expect(html).toContain("rounded-md");
    expect(html).not.toContain("rounded-full");
    expect(html).toContain("uppercase");
  });

  it("supports tones, emphasis, icons, titles, and full-width rails", () => {
    const html = renderToStaticMarkup(
      <Badge
        size="standard"
        tone="amber"
        emphasis="outline"
        fullWidth
        title="In main deck"
        icon={<AlertTriangleIcon className="h-full w-full" />}
      >
        In Main Deck
      </Badge>,
    );

    expect(html).toContain("h-6");
    expect(html).toContain("text-[10px]");
    expect(html).toContain("border-amber-400");
    expect(html).toContain("bg-transparent");
    expect(html).toContain("w-full");
    expect(html).toContain("title=\"In main deck\"");
    expect(html).toContain("h-full w-full");
  });
});
