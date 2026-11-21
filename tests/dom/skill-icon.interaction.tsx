import { afterEach, describe, expect, test } from "bun:test";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import SkillIcon from "@/app/common/ui/skills/skill-icon";

afterEach(() => cleanup());

describe("SkillIcon", () => {
  test("tries the plain icon path first, then the utx_ico_skill_ path", () => {
    render(<SkillIcon iconId={20386} name="Swift Dance" />);
    const img = screen.getByRole("img", { name: "Swift Dance icon" });
    expect(img.getAttribute("src")).toBe("/assets/skills/20386.png");
    fireEvent.error(img);
    expect(screen.getByRole("img", { name: "Swift Dance icon" }).getAttribute("src")).toBe("/assets/skills/utx_ico_skill_20386.png");
  });

  test("shows a same-size placeholder tile instead of a broken image when both paths fail", () => {
    const { container } = render(<SkillIcon iconId={20386} name="Swift Dance" className="h-7 w-7 flex-none" />);
    fireEvent.error(screen.getByRole("img", { name: "Swift Dance icon" }));
    fireEvent.error(screen.getByRole("img", { name: "Swift Dance icon" }));
    expect(container.querySelector("img")).toBeNull();
    const tile = container.querySelector("[data-skill-icon-missing]");
    expect(tile).not.toBeNull();
    expect(tile!.className).toContain("h-7 w-7");
    expect(tile!.getAttribute("aria-hidden")).toBe("true");
  });

  test("renders nothing when there is no icon id", () => {
    const { container } = render(<SkillIcon iconId={null} name="None" />);
    expect(container.innerHTML).toBe("");
  });

  test("starts over when the icon id changes", () => {
    const { rerender, container } = render(<SkillIcon iconId={20386} name="A" />);
    fireEvent.error(screen.getByRole("img", { name: "A icon" }));
    fireEvent.error(screen.getByRole("img", { name: "A icon" }));
    expect(container.querySelector("img")).toBeNull();
    rerender(<SkillIcon iconId={20016} name="A" />);
    expect(screen.getByRole("img", { name: "A icon" }).getAttribute("src")).toBe("/assets/skills/20016.png");
  });
});
