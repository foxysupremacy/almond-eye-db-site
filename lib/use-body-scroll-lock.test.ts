import { describe, it, expect, beforeEach, afterAll } from "bun:test";
import { lockBodyScroll, unlockBodyScroll } from "./use-body-scroll-lock";

describe("use-body-scroll-lock", () => {
  const originalDocument = (globalThis as any).document;
  const originalWindow = (globalThis as any).window;

  let mockBody: any;
  let mockHtml: any;

  beforeEach(() => {
    mockBody = {
      style: {
        overflow: "",
        paddingRight: "",
        overscrollBehavior: "",
      },
    };
    mockHtml = {
      clientWidth: 1000,
      style: {
        overflow: "",
      },
    };

    (globalThis as any).document = {
      body: mockBody,
      documentElement: mockHtml,
    };
    (globalThis as any).window = {
      innerWidth: 1016, // 16px scrollbar
    };

    // Unwind any lingering locks
    unlockBodyScroll();
    unlockBodyScroll();
    unlockBodyScroll();
  });

  afterAll(() => {
    (globalThis as any).document = originalDocument;
    (globalThis as any).window = originalWindow;
  });

  it("locks body, html, scrollbar padding, and overscrollBehavior on initial lock", () => {
    lockBodyScroll();
    expect(mockBody.style.overflow).toBe("hidden");
    expect(mockBody.style.overscrollBehavior).toBe("none");
    expect(mockBody.style.paddingRight).toBe("16px");
    expect(mockHtml.style.overflow).toBe("hidden");

    unlockBodyScroll();
    expect(mockBody.style.overflow).toBe("");
    expect(mockBody.style.overscrollBehavior).toBe("");
    expect(mockBody.style.paddingRight).toBe("");
    expect(mockHtml.style.overflow).toBe("");
  });

  it("supports reference-counted nested locks without premature unlock", () => {
    // Open modal 1
    lockBodyScroll();
    expect(mockBody.style.overflow).toBe("hidden");

    // Open modal 2
    lockBodyScroll();
    expect(mockBody.style.overflow).toBe("hidden");

    // Close modal 2
    unlockBodyScroll();
    // Modal 1 still open -> remains locked
    expect(mockBody.style.overflow).toBe("hidden");

    // Close modal 1
    unlockBodyScroll();
    // All modals closed -> unlocked
    expect(mockBody.style.overflow).toBe("");
    expect(mockBody.style.paddingRight).toBe("");
  });

  it("guards against capturing 'hidden' as original overflow state", () => {
    mockBody.style.overflow = "hidden";
    mockHtml.style.overflow = "hidden";
    mockBody.style.overscrollBehavior = "none";

    lockBodyScroll();
    expect(mockBody.style.overflow).toBe("hidden");

    unlockBodyScroll();
    // Must reset to "" rather than staying stuck on "hidden"
    expect(mockBody.style.overflow).toBe("");
    expect(mockHtml.style.overflow).toBe("");
    expect(mockBody.style.overscrollBehavior).toBe("");
  });
});
