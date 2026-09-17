export type SkillPopoverMode = "closed" | "preview" | "pinned";

/** Keeps incidental pointer movement separate from deliberate inspection. */
export function createSkillPopoverInteraction(onChange: (mode: SkillPopoverMode) => void) {
  let mode: SkillPopoverMode = "closed";
  let hoverTimer: ReturnType<typeof setTimeout> | undefined;
  let leaveTimer: ReturnType<typeof setTimeout> | undefined;

  function cancelHover() {
    clearTimeout(hoverTimer);
    hoverTimer = undefined;
  }

  function cancelLeave() {
    clearTimeout(leaveTimer);
    leaveTimer = undefined;
  }

  function cancelAll() {
    cancelHover();
    cancelLeave();
  }

  function change(next: SkillPopoverMode) {
    if (next === mode) return;
    mode = next;
    onChange(next);
  }

  return {
    pointerEnter(pointerType: string, canHover: boolean) {
      cancelAll();
      if (pointerType !== "mouse" || !canHover || mode !== "closed") return;
      hoverTimer = setTimeout(() => {
        hoverTimer = undefined;
        change("preview");
      }, 350);
    },
    pointerLeave() {
      cancelHover();
      if (mode !== "preview") return;
      // Grace period: let the pointer briefly cross a gap without snapping
      // the preview shut (100–150 ms per spec; 120 ms is the sweet spot).
      leaveTimer = setTimeout(() => {
        leaveTimer = undefined;
        if (mode === "preview") change("closed");
      }, 120);
    },
    toggle() {
      cancelAll();
      change(mode === "pinned" ? "closed" : "pinned");
    },
    close() {
      cancelAll();
      change("closed");
    },
    dispose: cancelAll,
  };
}

