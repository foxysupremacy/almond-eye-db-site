export type SkillPopoverMode = "closed" | "preview" | "pinned";

/**
 * Coordinates a single shared detail surface. Replacing its active key is
 * intentional: a newer hover or click must never leave an older detail open.
 */
export function createSingleSkillPopoverController(onChange: (key: string | null, mode: SkillPopoverMode) => void) {
  let activeKey: string | null = null;
  let mode: SkillPopoverMode = "closed";
  const set = (nextKey: string | null, nextMode: SkillPopoverMode) => {
    if (activeKey === nextKey && mode === nextMode) return;
    activeKey = nextKey;
    mode = nextMode;
    onChange(activeKey, mode);
  };
  return {
    preview(key: string) { set(key, "preview"); },
    pin(key: string) { set(key, "pinned"); },
    closePreview(key: string) { if (activeKey === key && mode === "preview") set(null, "closed"); },
    close(key?: string) { if (!key || activeKey === key) set(null, "closed"); },
  };
}

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
