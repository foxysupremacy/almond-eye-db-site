import { describe, expect, it } from "bun:test";
import { createSingleSkillPopoverController, createSkillPopoverInteraction, type SkillPopoverMode } from "./skill-popover-interaction";

const waitForPreview = () => new Promise((resolve) => setTimeout(resolve, 390));
const waitForLeaveGrace = () => new Promise((resolve) => setTimeout(resolve, 150));

function setup() {
  const changes: SkillPopoverMode[] = [];
  const interaction = createSkillPopoverInteraction((mode) => changes.push(mode));
  return { changes, interaction };
}

describe("skill popover interaction", () => {
  it("replaces the previous detail when another skill becomes active", () => {
    const changes: Array<[string | null, SkillPopoverMode]> = [];
    const controller = createSingleSkillPopoverController((key, mode) => changes.push([key, mode]));
    controller.pin("skill-a");
    controller.preview("skill-b");
    controller.closePreview("skill-a");
    controller.pin("skill-b");
    expect(changes).toEqual([
      ["skill-a", "pinned"],
      ["skill-b", "preview"],
      ["skill-b", "pinned"],
    ]);
  });

  it("waits for a deliberate mouse hover before showing a passive preview", async () => {
    const { changes, interaction } = setup();
    interaction.pointerEnter("mouse", true);
    expect(changes).toEqual([]);
    await waitForPreview();
    expect(changes).toEqual(["preview"]);
    interaction.dispose();
  });

  it("never opens from touch, pen, or a device without fine hover", async () => {
    const { changes, interaction } = setup();
    interaction.pointerEnter("touch", true);
    interaction.pointerEnter("pen", true);
    interaction.pointerEnter("mouse", false);
    await waitForPreview();
    expect(changes).toEqual([]);
    interaction.dispose();
  });

  it("cancels a pending preview when the pointer moves to another section", async () => {
    const { changes, interaction } = setup();
    interaction.pointerEnter("mouse", true);
    interaction.pointerLeave();
    await waitForPreview();
    expect(changes).toEqual([]);
    interaction.dispose();
  });

  it("dismisses a passive preview after the leave grace period", async () => {
    const { changes, interaction } = setup();
    interaction.pointerEnter("mouse", true);
    await waitForPreview();
    interaction.pointerLeave();
    // Should NOT close synchronously — grace period is active
    expect(changes).toEqual(["preview"]);
    await waitForLeaveGrace();
    expect(changes).toEqual(["preview", "closed"]);
    interaction.dispose();
  });

  it("cancels dismissal when the pointer re-enters during the leave grace period", async () => {
    const { changes, interaction } = setup();
    interaction.pointerEnter("mouse", true);
    await waitForPreview();
    interaction.pointerLeave();
    // Re-enter before grace expires — should cancel the pending close
    interaction.pointerEnter("mouse", true);
    await waitForLeaveGrace();
    // Still in preview, no extra closed→preview bounce
    expect(changes).toEqual(["preview"]);
    interaction.dispose();
  });

  it("pins a hovered preview on click and keeps it open when the pointer leaves", async () => {
    const { changes, interaction } = setup();
    interaction.pointerEnter("mouse", true);
    await waitForPreview();
    interaction.toggle();
    interaction.pointerLeave();
    // Pinned mode ignores leave — no grace timer started
    await waitForLeaveGrace();
    expect(changes).toEqual(["preview", "pinned"]);
    interaction.toggle();
    expect(changes).toEqual(["preview", "pinned", "closed"]);
    interaction.dispose();
  });

  it("opens deliberately on touch and does not let a pending hover replace a pinned panel", async () => {
    const { changes, interaction } = setup();
    interaction.pointerEnter("mouse", true);
    interaction.toggle();
    await waitForPreview();
    expect(changes).toEqual(["pinned"]);
    interaction.close();
    interaction.toggle();
    expect(changes).toEqual(["pinned", "closed", "pinned"]);
    interaction.dispose();
  });

  it("does not reopen after dismissal or unmount while a hover timer is pending", async () => {
    const first = setup();
    first.interaction.pointerEnter("mouse", true);
    first.interaction.close();
    const second = setup();
    second.interaction.pointerEnter("mouse", true);
    second.interaction.dispose();
    await waitForPreview();
    expect(first.changes).toEqual([]);
    expect(second.changes).toEqual([]);
  });
});
