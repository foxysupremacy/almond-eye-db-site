# AlmondEye DB — UI Design System & Component Guidelines (`DESIGN.md`)

This document defines the core UI/UX patterns and design system specifications for **AlmondEye DB**, including skill presentation, bilingual hierarchy, icon geometry, deck picker layout, mobile ergonomics, duplicate skill indicators, and reusable control behavior. These standards apply across the application and to future components, not only to the screens where a pattern first appeared.

---

## 1. Bilingual Skill Display Hierarchy

Skill names must always be presented with clear visual hierarchy: **English translated text on top, original Japanese text directly below.**

### Core Principles
1. **English First (Primary Line)**:
   - Always rendered as the main title on the top line.
   - High-contrast typography: `text-zinc-900 dark:text-zinc-100` (or `text-zinc-800 dark:text-zinc-200`).
   - Font weight: `font-semibold` or `font-bold`.
   - Line height: `leading-tight` or `leading-snug`.
2. **Japanese Sub-line (Secondary Line)**:
   - Always rendered directly **below** the English name (stacked vertically in a block).
   - **PROHIBITED ANTI-PATTERN**: Never place Japanese side-by-side with English (e.g. `English (日本語)` or `English · 日本語`).
   - Muted, low-contrast typography: `text-zinc-400 dark:text-zinc-500`.
   - Font size: `text-[10px]`, `text-[11px]`, or `text-xs` (consistently 1-2 steps smaller than English).
   - Font weight: `font-normal` or `font-medium`.
   - Spacing: `mt-0.5` with `leading-tight`.
3. **Banned / Inactive States (`No Debuff` Rule)**:
   - When `isBanned` is active (e.g. under Champions Meeting "No Debuff" rules):
     - Both English and Japanese text receive `line-through`.
     - Typography colors dim to `text-zinc-500 dark:text-zinc-400`.
     - Container row receives `opacity-60` and a subtle rose-tinted border/background.

---

## 2. Skill Icon Geometry & Vertical Centering

Whenever a skill icon is displayed alongside the 2-line title block, **the icon MUST be vertically centered (`items-center`) against the entire two-line block**.

### Why Vertical Centering is Mandatory
When a leading icon is paired with a multi-line text container:
- ❌ **Anti-Pattern (`items-start`)**: Aligning to the top causes the icon to align only with the English title, leaving the Japanese subtitle hanging awkwardly below the icon baseline.
- ✅ **Mandatory Pattern (`items-center`)**: Vertically centering balances the icon directly against the geometric midpoint of both the English title and Japanese subtitle, creating a unified, polished silhouette.

---

## 3. Surface Flatness & Minimal-Box Architecture (Rankings Design Standard)

Per frontend craftsmanship guidelines (`design-taste-frontend`), **unnecessary box containers (cards inside cards, heavy card borders around lists, and boxed filter toolbars) are strictly prohibited**. The application adopts the **Rankings Tab** as the design benchmark for minimal-box, high-density interfaces.

### Core Anti-Patterns & Mandates
1. ❌ **No Nested "Russian Doll" Cards**: Never place a bordered, rounded card inside a container that is itself a bordered, rounded card of the same visual weight.
2. ❌ **No Enclosing Box Cards for Linear Lists & Tracks**: Do not wrap full-page lists (such as the Deck Skill List) or track canvases in bulky container cards (`rounded-2xl border border-zinc-200 bg-white shadow-xs`). Follow the **Rankings Tab** standard where the track diagram and list items sit directly on the page layout.
3. ❌ **No Nested Boxes for Filter Toolbars & Sub-Panels**: Never wrap search, filter tabs, or layout switchers in heavy colored, bordered boxes (`rounded-xl border border-*-500/30 bg-*-50/40 p-*`). Use flat segmented pill groups (`inline-flex rounded-lg bg-zinc-100 dark:bg-zinc-800 p-0.5`).
4. ✅ **Divider Lines over Card Enclosures (`divide-y`)**:
   - List items must use hairline dividers (`divide-y divide-zinc-100 dark:divide-zinc-800/80`) or clean table/list rows, NOT individual 4-sided bordered cards stacked with gaps (`space-y-2`).
   - For skill lists: distinguish rarity with a distinctive left accent stripe (`border-l-4`) and subtle background gradient/tint (`skill-surface-gold`, `skill-surface-unique`, `skill-surface-evolved`), never with separate card boxes.
   - Secondary filter sections within a popover/modal header must integrate seamlessly, demarcated only by a subtle top divider line (`pt-2.5 mt-2 border-t border-zinc-200/70 dark:border-zinc-800`) rather than an enclosed container box.
5. ✅ **Unified 6-Slot Grid Across All Deck Pickers**:
   - Both **Main Deck** and **Parent Deck** must render the identical clean 6-slot grid (`features/deck/screens/deck-picker.tsx`).
   - Do NOT embed a secondary "reference strip" box containing 6 mini-boxes inside the Parent Deck surface.

---

## 4. Deck Picker & Candidate Card 2-Row Uniform Specification

In all card pickers (`CardPickerPopover`, modal selectors, candidate sheets), each card row must strictly adhere to this uniform 2-row layout:

```
Row 1: [Portrait]  [Rarity] [Card Name] [In Main] [Equipped]  ------>  [+X target skills]* [Ownership] [Type Icon] [Skills ↗]
Row 2:            [Japanese Subtitle / Card Title]                    ------>  Release: YYYY-MM-DD
```

\* `+X target skills` is rendered in **Parent Deck mode only** (see Ownership & Target-Skills rule below).

### Layout Rules
1. **Top Row (Left-Aligned)**:
   - Card portrait thumbnail (with 4-line boundary/border).
   - Rarity tag (`SSR`, `SR`, `R` with rarity pill styling).
   - English Card Name (e.g., `Gran Alegria`, `Fine Motion`).
   - Contextual status badges (`In Main`, `Equipped`, `Trainee Card (Prohibited)`).
2. **Top Row (Right-Aligned)**:
   - `+X target skills` badge — **Parent Deck mode only** (never in Main Deck mode); right-aligned inside the top-right group, immediately left of the ownership chip.
   - Ownership chip (`Unowned` / `0 LB`–`3 LB` / `MLB`) — see Ownership Chip rule below.
   - Card type icon badge (Speed, Stamina, Power, Guts, Wit, Friend, Group).
   - Dedicated `Skills ↗` inspection button.
3. **Bottom Row (Left-Aligned)**:
   - Original Japanese subtitle / name (e.g., `[NEW TALES AWAIT] グランアレグリア`) in muted `text-zinc-400 dark:text-zinc-500 text-[11px]`.
4. **Bottom Row (Right-Aligned)**:
   - Release date (`Release: YYYY-MM-DD`) positioned **directly beneath** the type icon and `Skills ↗` button.
5. **Ownership Chip (Fixed-Width Alignment Contract)**:
   - Label states: `Unowned` / `0 LB` / `1 LB` / `2 LB` / `3 LB` / `MLB`.
   - ❌ **PROHIBITED**: the `N★` star shorthand (it conflated stars with limit breaks and read ambiguously).
   - Color coding: `Unowned` zinc (`bg-zinc-100 dark:bg-zinc-800 text-zinc-400`); `N LB` sky (`bg-sky-500/20 text-sky-800 dark:text-sky-300 border-sky-500/30`); `MLB` amber (`bg-amber-500/20 text-amber-800 dark:text-amber-300 border-amber-500/40`).
   - **Fixed width `w-11` (44px — fits `Unowned`, the widest state) with `inline-flex items-center justify-center`** so every state occupies identical space. This keeps the ownership column aligned across all rows and, because the `+X target skills` badge sits immediately to its left, pins the badge's right edge consistently. Never use horizontal padding (`px-*`) in place of the fixed width.
6. **Click / Interaction Contract**:
   - Clicking anywhere on the card row equips the card.
   - Clicking `Skills ↗` stops event propagation (`e.stopPropagation()`) and opens the inspection sheet without equipping the card.

---

## 5. Duplicate Skill Indicator Specification (`duplicate with {card}`)

When a skill is granted by multiple cards in the user's active deck:

1. **Replaces Generic Static Badges**:
   - Do NOT use static text like `"Shared across cards"` or `"Shared across Parent Cards"`.
2. **Dynamic Indicator Label (`duplicate with {card}`)**:
   - In **Group by Card** views (both Main Deck and Parent Deck):
     - **Single duplicate**: Must dynamically name the other card: `duplicate with {Card Name}` (e.g., `duplicate with Agnes Tachyon`).
     - **Multiple duplicates**: Must show primary partner plus count: `duplicate with {Card Name} (+N)`.
   - In **Unified List** views: Displays `duplicate ({count})`.
   - Color coding: Amber (`bg-amber-500/15 text-amber-800 dark:text-amber-300`) for Main Deck; Sky (`bg-sky-50 dark:bg-sky-950/50 text-sky-700 dark:text-sky-300`) for Parent Deck.
   - Text truncation: Must include responsive truncation (`max-w-[120px] sm:max-w-[160px] truncate`) so long card names never break list row flex layouts.
3. **Interactive Hover & Touch Popover**:
   - Hovering or tapping the badge triggers a detailed breakdown popover.
   - **Portal Requirement**: Must be rendered via `createPortal(..., document.body)` with `fixed z-[250]`, ensuring it is never clipped by `overflow: hidden` on parent containers.
   - **Contents**:
     - Header displaying the skill name and duplicating count.
     - Full list of all support cards granting the skill.
     - Card portrait thumbnails, English name, Japanese subtitle, and card type.
     - Acquisition source badge (`Hint` in emerald, `Event` in violet with continuous event choice metadata).
     - `[This Card]` tag highlighting the card currently being viewed versus duplicate partners.

---

## 6. Mobile Touch & Keyboard Discipline (No Input Hijacking)

Mobile usability is a primary constraint:

1. ❌ **PROHIBITED: Auto-focusing search inputs on touch devices**:
   - Opening a card picker or skill modal must **never** automatically trigger the mobile virtual keyboard. Forced focus immediately slides up the OS soft keyboard, hiding half the screen and disrupting the browsing flow.
2. ✅ **Pointer-Fine Guard Required**:
   - Always guard `.focus()` calls with pointer capability detection:
     ```ts
     if (typeof window !== "undefined" && window.matchMedia("(pointer: fine)").matches) {
       searchBoxRef.current?.focus();
     }
     ```
   - On touch devices (`pointer: coarse`), render search inputs visible at the top but unfocused until the user explicitly taps the input.
3. ✅ **Touch Target Sizing**:
   - Filter chips, badges, and tab buttons must have minimum touch targets of `min-h-[28px]` or `py-1` on mobile, paired with smooth horizontal scrolling (`overflow-x-auto scrollbar-none`).

---

## 7. Course-Aware Recommendation & Activation Integrity

When a racecourse / track is active in the deck builder:

1. **Strict Activation Filtering (`firesOnCourse`)**:
   - The `+X target skills` badge count on candidate cards must **only** count skills that actually fire on the active course (`s.firesOnCourse === true`).
   - Never display inflated target counts for skills whose track, distance, surface, or slope preconditions cannot activate on the selected course.
2. **Harmonized Recommendation Engine**:
   - Both **Main Deck** and **Parent Deck** candidate pickers must utilize the full recommendation engine (`recommendCardsForParent` with `raceParams` support) and `Sort: ⭐ Recommended`.

---

## 8. Candidate Card Inspection & Dynamic Skill Loading

To ensure zero dead ends when inspecting support cards:

1. **Dynamic Fallback in `CardSkillsSheet`**:
   - When a user clicks `Skills ↗` on an unequipped candidate card, the sheet must NOT fail with "No skills found for this card".
   - If the card is not yet in the active deck store (`skillsByCard[card.id]`), it must dynamically fetch all card skills via `api.cardSkills(card.id)` and render a loading spinner during the fetch.
2. **Stacking & Action Layering**:
   - The inspection sheet must operate at `z-[350]` so it cleanly overlays `CardPickerPopover` (`z-[100]`).
   - Must provide an immediate "Select Card ✓" action bar for one-tap equipping from the inspection view.

---

## 9. Sizing Tokens & Component Matrix

| View / Component | File | Icon Size | Centering Classes | Title Size | Subtitle Size | Notes |
|---|---|---|---|---|---|---|
| **Visualizer Inspector** | `features/visualizer/components/skill-detail-inspector.tsx` | `h-10 w-10 sm:h-11 sm:w-11` | `flex items-center gap-3` | `text-base font-semibold` | `text-xs text-zinc-400` | Hero inspector header, enlarged drop-shadowed icon. |
| **Track Visualizer Sidebar** | `features/visualizer/components/track-skill-sidebar.tsx` | `h-4 w-4` / `h-5 w-5` | `flex items-center gap-1.5` | `text-xs font-semibold truncate` | `text-[10px] text-zinc-400 truncate` | Trigger status dot, icon, and text stack all vertically centered. |
| **Main Deck Skill List** | `features/deck/screens/skill-list.tsx` | `h-7 w-7` (unified) / `h-6 w-6` (grouped) | `inline-flex items-center gap-2.5` | `text-sm font-semibold` | `text-xs text-zinc-400` | Full title block & icon wrapped inside `SkillHoverCard`. |
| **Parent Deck Skill List** | `features/parenting/skills/parent-skill-list.tsx` | `h-7 w-7` (unified) / `h-6 w-6` (grouped) | `inline-flex items-center gap-2.5` | `text-sm font-semibold` | `text-xs text-zinc-400` | Identical styling to Main Deck for visual consistency. |
| **Card Skills Sheet** | `features/deck/components/card-skills-sheet.tsx` | `h-5 w-5 sm:h-6 sm:w-6` | `flex items-center gap-2` | `text-xs font-semibold` | `text-[10px] sm:text-[11px] text-zinc-400` | Modal/bottom-sheet card detail viewer. |
| **Multi-Skill Filter (Card Picker)** | `features/deck/pickers/card-picker-popover.tsx` | `h-3.5 w-3.5` / `h-4 w-4` | `flex items-center gap-1.5` | `text-xs font-bold` | `text-[10px] text-zinc-400` | Flat, non-nested multi-skill filter with tag chips & SVG icons. |
| **Skill Picker Modal (List)** | `features/deck/components/legacy-skill-picker-modal.tsx` | `h-7 w-7` | `flex items-center gap-2.5` | `text-xs font-bold truncate` | `text-[10px] text-zinc-400 truncate` | Search list items with category pills. |
| **Skill Picker Modal (Preview)** | `features/deck/components/legacy-skill-picker-modal.tsx` | `h-8 w-8` | `flex items-center gap-2.5` | `text-xs sm:text-sm font-bold` | `text-[11px] text-zinc-400` | Right-side detail preview header. |

---

## 10. Interactive Wrapping Pattern (`SkillHoverCard`)

In skill lists and decks (`skill-list.tsx`, `parent-skill-list.tsx`, `card-skills-sheet.tsx`):
- `SkillHoverCard` wraps **both the icon and the two-line title block** as a single clickable/hoverable element.
- The trigger must have `group` and `inline-flex items-center gap-2.5 min-w-0 cursor-pointer`.
- Text styles leverage `group-hover:text-emerald-700 dark:group-hover:text-emerald-400` to indicate hover affordance across the whole block.

```tsx
<SkillHoverCard
  skillId={s.id}
  fallbackSkill={s}
  cardName={s.cardName}
  isParentMode={false}
  className="group inline-flex items-center gap-2.5 min-w-0 cursor-pointer"
>
  {/* 1. Vertically centered icon */}
  <SkillIcon
    iconId={s.iconId}
    name={s.nameEn}
    className="h-7 w-7 object-contain flex-none drop-shadow-2xs"
  />

  {/* 2. 2-line title block */}
  <div className="min-w-0">
    <div className="flex items-center gap-1">
      <span className={`text-sm font-semibold text-zinc-900 dark:text-zinc-100 group-hover:text-emerald-700 dark:group-hover:text-emerald-400 transition-colors leading-snug ${isBanned ? "line-through text-zinc-500 dark:text-zinc-400" : ""}`}>
        {s.nameEn}
      </span>
      <span className="text-[10px] text-zinc-400 dark:text-zinc-500 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 opacity-60 group-hover:opacity-100 transition-opacity">
        ↗
      </span>
    </div>
    {s.nameJp && (
      <p className={`text-xs text-zinc-400 dark:text-zinc-500 mt-0.5 font-normal leading-tight ${isBanned ? "line-through" : ""}`}>
        {s.nameJp}
      </p>
    )}
  </div>
</SkillHoverCard>
```

---

## 11. Canonical Standard Implementation Recipe

When creating any new component that displays a skill, use this standard JSX structure:

```tsx
<div className="flex items-center gap-2.5 min-w-0">
  {/* Icon: flex-none to prevent squishing, vertically centered */}
  <SkillIcon
    iconId={skill.iconId}
    name={skill.nameEn}
    className="h-7 w-7 object-contain flex-none drop-shadow-2xs"
  />

  {/* Stacked Bilingual Text Container */}
  <div className="min-w-0 flex-1">
    {/* English Name (Top) */}
    <h4 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 truncate leading-snug">
      {skill.nameEn}
    </h4>

    {/* Original Japanese Name (Below) */}
    {skill.nameJp && (
      <p className="text-xs text-zinc-400 dark:text-zinc-500 truncate font-normal mt-0.5 leading-tight">
        {skill.nameJp}
      </p>
    )}
  </div>
</div>
```

---

## 12. Checklist for Code Reviews & Future Sessions

Before approving any UI change involving cards, skills, or deck pickers:
- [ ] **Bilingual Order**: Is English displayed on top and Japanese displayed directly underneath?
- [ ] **Bilingual Typography**: Is Japanese text muted (`text-zinc-400 dark:text-zinc-500`) and 1-2 font sizes smaller than English?
- [ ] **Icon Centering**: Is the skill icon vertically centered (`items-center`) against the combined 2-line title block?
- [ ] **Aspect Ratio**: Does the icon have `flex-none` / `shrink-0` to avoid aspect ratio distortion on narrow viewports?
- [ ] **Parenting Portrait Layers**: Does the pop-out use a circle-sized wrapper with the top 90° sector and hidden left/right tangent bounds, above the clipped image and circular frame (Section 20)?
- [ ] **Skill Action Geometry**: Do Rankings skill actions and their loading/empty states use `rounded-md` (6px), with no capsule silhouette (Section 21)?
- [ ] **Track Flatness**: Is the track canvas completely unboxed and borderless, matching Rankings with a concise venue caption and segmented pill mode switcher (Section 21)?
- [ ] **Visualizer 2-Column Surface**: Are the Visualizer sidebar and detail panel de-boxed, separated only by a clean vertical hairline (`md:border-r`) and flat list dividers (Section 21)?
- [ ] **Deck Skill List Surfaces**: Are deck skills rendered as a continuous flat list (`divide-y`) with a left rarity accent stripe (`border-l-4`) and surface tint instead of individual bordered card boxes with gaps (Section 22)?
- [ ] **No Nested Boxes**: Are lists rendered on flat surfaces with dividers instead of boxes inside boxes? Are filter toolbars flat segmented pill groups (`bg-zinc-100 dark:bg-zinc-800 p-0.5`) rather than nested cards?
- [ ] **No Emojis in Functional UI**: Are all interface icons crisp SVG components from `app/common/ui/primitives/icons.tsx`? Are HTML `<option>` labels plain text without emojis?
- [ ] **Multi-Skill Matching Integrity**: In Parent Deck mode, does skill filtering support ANY/ALL toggling and bi-directional Gold <-> White mapping?
- [ ] **Uniform Card Layout**: Does candidate card row place target-skills badge (parent mode only), ownership chip, type icon & `Skills ↗` top-right, and release date bottom-right?
- [ ] **Ownership Chip**: Is the ownership chip labeled `Unowned` / `0 LB`–`3 LB` / `MLB` (never `N★`) and rendered fixed-width (`w-11`, `inline-flex items-center justify-center`) so the column aligns across rows?
- [ ] **Duplicate Indicator**: Does duplicate indicator display `duplicate with {Card Name}` and open a portal popover on hover/touch?
- [ ] **Mobile Ergonomics**: Are search input autofocus calls guarded with `window.matchMedia("(pointer: fine)")`?
- [ ] **Recommendation Accuracy**: Does `+X target skills` strictly count skills where `firesOnCourse === true`?
- [ ] **Candidate Inspection**: Does `CardSkillsSheet` dynamically fetch skills for unequipped cards?
- [ ] **Truncation Discipline**: Are `truncate` and `min-w-0` applied to prevent badge or text overflow?
- [ ] **Non-Linear Easing**: Do new animations use the custom easing tokens (`ease-out-expo`, `ease-out-quart`, `ease-in-out-cubic`) instead of `linear` / `ease-in`?
- [ ] **Motion Duration**: Are animation durations within the skill limits (≤300ms; overlays 200ms, sheets 250ms, micro-interactions 150ms)?
- [ ] **Reduced Motion**: Are new animations utility-based (`animate-in`, `transition-*`) so the global `prefers-reduced-motion` guard covers them?

---

## 13. Motion & Animation Design System

Reference workflow: [`almond-eye-db-site/.agents/skills/web-animation-design/SKILL.md`](almond-eye-db-site/.agents/skills/web-animation-design/SKILL.md) — consult it for full easing/duration decision trees. All animation in the site is implemented with **`tw-animate-css`** (imported in `app/globals.css`), which powers the `animate-in` / `fade-in` / `zoom-in-*` / `slide-in-from-*` utilities. **Never remove this import** — without it those classes silently compile to nothing (this exact bug shipped once).

### 13.1 Easing Tokens (defined in `@theme` in `app/globals.css`)

Non-linear curves are mandatory. `linear` is reserved for constant-speed motion only (`animate-spin`, `animate-pulse`). `ease-in` is prohibited in UI (delays feedback, feels sluggish).

| Token | Curve | Use For |
|---|---|---|
| `ease-out-expo` | `cubic-bezier(0.19, 1, 0.22, 1)` | Enter/exit motion: modal panels, bottom sheets, popovers, toasts |
| `ease-out-quart` | `cubic-bezier(0.165, 0.84, 0.44, 1)` | Micro-interactions: overlay fades, press feedback (`active:scale`), hover color/scale transitions |
| `ease-in-out-cubic` | `cubic-bezier(0.645, 0.045, 0.355, 1)` | On-screen movement/morphs: chevron rotates, position shifts of already-visible elements |
| (stock) | `cubic-bezier(0.4, 0, 0.2, 1)` | Bulk `transition-colors` hover fades are acceptable as-is |

### 13.2 Duration Budget

| Element Type | Duration |
|---|---|
| Micro-interactions (press, hover zoom) | `duration-150` / `duration-200` |
| Overlays, modal panels, popovers, toasts | `duration-200` |
| Bottom sheets / drawers | `duration-[250ms]` |
| Hard ceiling | `300ms` — never exceed for product UI |

Paired elements that animate together (overlay + its panel) must share the same duration. Do not animate keyboard-initiated interactions.

### 13.3 Canonical Enter-Animation Recipes (use these exact class strings)

| Surface | Overlay/Backdrop | Panel/Content |
|---|---|---|
| Centered modal | `animate-in fade-in duration-200 ease-out-quart` | `animate-in zoom-in-95 duration-200 ease-out-expo` |
| Bottom sheet (mobile) with desktop modal fallback | `animate-in fade-in duration-200 ease-out-quart` | `animate-in slide-in-from-bottom sm:zoom-in-95 duration-[250ms] ease-out-expo` |
| Floating hover popover | — | `animate-in fade-in zoom-in-95 duration-200 ease-out-expo` |
| Toast / notification bar | — | `animate-in slide-in-from-top-2 duration-200 ease-out-expo` |
| Inline expanding row/section | — | `animate-in fade-in duration-200 ease-out-quart` |

There are currently **no exit animations** (overlays conditionally unmount); adding one requires reworking conditional rendering — don't add `animate-out` classes to the current conditional-mount structure without that rework.

### 13.4 `prefers-reduced-motion`

`app/globals.css` contains a global guard that collapses all animation/transition durations to ~0ms. It applies to every `animate-in` and `transition-*` utility — new animations get reduced-motion support for free as long as they use utility classes. Do NOT remove this block, and do NOT implement animations via inline styles or JS that bypass it without adding their own guard.

### 13.5 Popover Placement & Origin Contract (`SkillHoverCard`)

The desktop skill inspector stays positioned relative to its active skill trigger without coupling content reflow to a `ResizeObserver` callback:

1. **Horizontal**: beside the trigger — right side preferred (`rect.right + 8`); flip to the left (`rect.left - width - 8`) when it would overflow the viewport's right edge; clamp to 16px from the edge as a last resort.
2. **Vertical**: center on the trigger (`rect.top + rect.height / 2 - panelHeight / 2`), clamped to the visible viewport with 16px padding.
3. **Measured size**: use the rendered panel's actual bounds and cap its height to the visible viewport; long content scrolls inside the panel.
4. **Frame-coalesced updates**: observe the trigger and panel, plus scroll and viewport changes, but schedule all reads and writes through one `requestAnimationFrame`. The inspector owns placement, so React Aria `Popover` must use `shouldUpdatePosition={false}` here; do not update layout synchronously from a resize callback.
5. **Composited placement**: apply coordinates with `translate3d` and only when they change. Keep scale animation on an inner content wrapper so it cannot overwrite the positioned outer popover; its origin follows the side nearest the trigger.

---

## 14. SVG Icons Over Emojis Standard (Clean UI Typography)

All interface icons, badges, indicators, and buttons MUST use standardized SVG vector icons from `app/common/ui/primitives/icons.tsx`. The use of Unicode emojis in functional UI is **strictly prohibited**.

### Core Rules
1. ❌ **No Emojis in Functional UI Markup**:
   - Never use emojis as functional UI icons (e.g. 🎯, ⭐, ✓, ✕). Emojis render inconsistently across OS platforms (macOS, iOS, Windows, Android), clash with the dark/light design system palette, and disrupt visual hierarchy.
   - ❌ **Anti-Pattern**: `<span>🎯 Filter by Skills</span>`, `<span>✓ Owned Only</span>`, `<button>✕</button>`
   - ✅ **Standard**: `<TargetIcon className="h-3.5 w-3.5 text-emerald-600" /> Filter by Skills`, `<CheckIcon className="h-3 w-3" /> Owned Only`, `<XIcon className="h-3 w-3" />`
2. ✅ **HTML `<select>` Options Must Be Plain Text**:
   - Native HTML `<option>` elements cannot render SVG children.
   - In `<select>` dropdowns, use clean, polished plain text labels without emojis:
     - ✅ `Sort: Recommended` (never `Sort: ⭐ Recommended`)
     - ✅ `Sort: Target Skills` (never `Sort: 🎯 Target Skills`)
3. ✅ **Component Icon Library**:
   - All standard icons must be imported from `app/common/ui/primitives/icons.tsx`: `TargetIcon`, `CheckIcon`, `XIcon`, `ChevronDownIcon`, `ChevronUpIcon`, `SearchIcon`, `StarIcon`, `TrophyIcon`, `TimerIcon`, `FlagIcon`, etc.
   - When a new icon is needed, implement it in `app/common/ui/primitives/icons.tsx` as a standard `IconProps` component before using it in views.

---

## 15. Multi-Skill Search & Filter Specification (Parent Deck Mode)

When picking support cards for the **Parent Deck** to farm inheritance skills:

1. **Integrated Panel (No Standalone Modal or Header Search Button)**:
   - The skill search capability is integrated directly into the card selection panel (`CardPickerPopover` in `mode="parent"`).
   - Standalone skill modals (like the legacy `SkillPickerModal`) and extra header buttons on the deck are deprecated in favor of opening the card picker directly on slot tap.
2. **Flat & Seamless Filter Architecture**:
   - Filter controls must NOT be wrapped inside nested bordered boxes (`rounded-xl border bg-emerald-50 ... p-*`).
   - The filter toolbar blends seamlessly into the popover header, separated only by a subtle divider line (`pt-2.5 mt-2 border-t border-zinc-200/70 dark:border-zinc-800`).
3. **Multi-Skill Tag Chips**:
   - Users can search and select multiple skills simultaneously.
   - Selected skills are rendered as removable tag chips with skill icon, rarity badge, and bilingual name.
4. **Flexible Matching Logic (ANY vs ALL)**:
   - **ANY (OR) Mode** (Default): Returns cards that grant *at least one* of the selected skills. Cards granting more matched skills are ranked higher at the top of the list.
   - **ALL (AND) Mode**: Returns only cards that simultaneously grant *all* selected skills.
5. **Bi-directional Gold <-> White Equivalence**:
   - In inheritance farming, Gold skills downgrade to White versions upon succession.
   - When filtering by a White skill, cards granting its parent Gold version must match.
   - Conversely, selecting a Gold skill matches cards granting either the Gold or equivalent White version.
6. **Hint & Event Skill Ingestion**:
   - A card is considered to grant a skill if it appears in `c.hintSkills` or `c.eventSkills`.
7. **Visual Match Feedback on Card Rows**:
   - Candidate card rows display a high-contrast match badge: `<CheckIcon className="h-3 w-3" /> {count}/{total} Skills`.
   - Matched skill pills (`<SkillIcon /> {name}`) are rendered beneath the card title for immediate identification of which target skills the card provides.



## 16. Universal Single-Value Dropdowns (`AppSelect`)

All single-value dropdowns in `app/` and `features/` must use
`app/common/ui/controls/app-select.tsx`; do not render native `<select>` menus.
Specialized card/skill search and multiple-choice filters retain their own UI.

- Controlled API: string `value`, `onValueChange`, readonly `options`, `label`,
  optional `placeholder`, `disabled`, `id`, `className`, `triggerLabel`, and `variant` (`field` / `chip`).
  Options provide a string value and text label, optional icon, disabled state,
  and group label. Keep options ordered and group entries contiguous. Empty strings
  are supported; number/null conversion belongs to callers.
- Desktop and mobile use React Aria Components `Select`, `Popover`, and `ListBox` with viewport-aware
  placement, typeahead, keyboard navigation and a scrolling list. Mobile uses
  44px option rows and a selected checkmark; never open a second bottom sheet.
  Focus the current enabled option, never a search input. Selection applies once
  and closes; cancel leaves the value intact. Restore trigger focus on close.
  Crossing the breakpoint closes the dropdown.
- Use shared zinc light/dark surfaces and emerald selected/focus states. `field`
  is the form/filter trigger; `chip` displays condition icons and tone classes.
  Long trigger text truncates; full option text wraps inside the list.
- Portal to `document.body`: popup z410, above existing
  inspection sheets. Parent Escape/outside-click handlers must yield while
  `hasOpenAppSelect()` is true. Portal clicks must not close a parent overlay.
  Parent scroll locks remain active until the parent itself closes.
- Style React Aria state through `data-*` selectors or render props. Utility
  enter animations use existing easing tokens, at most 250ms, with global
  reduced-motion support; keyboard opening has no animation.

---

## 17. Consistent Action Controls Across the Application

Action buttons in toolbars, page headers, dialogs, and feature panels must share a small set of visual variants. Do not create a new one-off button treatment for each screen.

Build interaction behavior with React Aria Components (`react-aria-components`).
Shared wrappers live in `app/common/ui/controls/`: `AppButton`, `AppSelect`,
`AppDialog`, `AppPopover`, `AppDisclosure`, `PickerSearchBar`, and `MobileSheet`.
Keep filter/ranking and persistence logic in its owning feature or `lib/`; these
wrappers own presentation, focus, keyboard behavior and ARIA semantics.

1. **Shared variants**:
   - Use `app/common/ui/controls/app-button.tsx` (`AppButton`) or its shared
     variants for primary, secondary, quiet, destructive, and icon-only actions.
   - Buttons in the same action group use the same height, corner radius, border weight, typography scale, focus ring, and hover/disabled behavior. Semantic emphasis may change the color, but not the control geometry.
   - Match dropdown triggers to adjacent buttons so they read as one control group. Single-value dropdowns use the React Aria based `AppSelect` contract in Section 16.
2. **Icons**:
   - Use SVG icon components from `app/common/ui/primitives/icons.tsx`; never use emoji or text glyphs as functional button icons.
   - Keep icon size and stroke weight consistent within a control group. Icon-only actions require an accessible name (`aria-label` or equivalent title where appropriate) and the same minimum target size as text actions.
3. **Responsive behavior**:
   - Preserve control height and interaction states across screens. Labels may shorten or become visually hidden at narrow widths only when the action remains accessible by name and understandable in context.
   - Keep action groups usable without causing horizontal overflow; wrap or reflow controls instead of shrinking their hit targets.

4. **Overlay behavior**:
   - Use `AppDialog` for modal and sheet shells, with controlled `isOpen` and
     `onOpenChange`; preserve modal focus containment/restoration and use the
     explicit `overlayLayer` token (`mobile`, `picker`, `share`, `inspection`,
     `inspector`) for stacking.
   - Use `AppPopover` for anchored interactive content. `AppSelect` portals above
     application dialogs at z410 and exposes `data-app-select-layer` so any
     remaining legacy parent handlers yield Escape to it.
   - Do not keep manual Escape, focus-trap, and body-scroll-lock handlers beside
     React Aria's modal behavior. Nested overlays close from the top and return
     focus to their owning trigger.

---

## 18. Stable Selectors and Concise Values

Selectors should communicate one decision at a time and keep their geometry stable as the selected value changes.

1. **One property per selector**:
   - Give independent choices independent controls. Do not combine unrelated properties into one option label when they can be selected separately.
   - A selector for a quantity should show the concise quantity (for example, `1400m`). Put category, surface, direction, or other derived metadata in its own control or a clearly associated detail area.
2. **Stable trigger sizing**:
   - Set trigger widths by the control's role and expected content, not by the currently selected option. A long option must not resize the surrounding toolbar as the user makes a selection.
   - Choose widths that fit common values, then truncate long selected labels. Keep full option labels readable in the popup.
3. **Dependent options**:
   - When one choice constrains another, filter the dependent options and keep the selected domain object valid. Selecting a related value should preserve the current compatible choice when possible, then choose a valid available option if necessary.
   - Do not let display-only values silently diverge from the data used for evaluation or calculations.
4. **Derived summaries**:
   - Show parsed or derived details only when they add information that the controls do not already communicate. Keep them adjacent to the relevant controls and remove redundant summaries, duplicate labels, and status badges that do not help the next decision.
   - Avoid wrapping a compact control group in an extra bordered or tinted surface when it can sit directly in the parent layout. Use a containing surface only when it establishes a meaningful section boundary.

---

## 19. Checklist for Shared Controls

Before finalizing a new or updated toolbar, filter row, selector group, or action group:

- [ ] Do controls in the same group share consistent geometry and interaction styling?
- [ ] Are single-value menus implemented with the React Aria `AppSelect` rather than native `<select>`?
- [ ] Are trigger widths fixed by control role rather than changing with the selected option?
- [ ] Does each selector represent one independent decision, with dependent options constrained to valid data?
- [ ] Are option labels concise while any useful derived detail appears only once?
- [ ] Have redundant summary rows, status labels, and outer surfaces been removed?
- [ ] Do functional icons use shared SVG components and accessible names?
- [ ] Do responsive layouts retain readable labels and usable hit targets without overflow?

---

## 20. Parenting Ancestor Portrait Layering

`AncestorIdentityButton` in `features/parenting/loop-optimizer.tsx` uses the same
portrait layering at every selectable ancestor generation. Only the **top 90°
sector**, from 10:30 to 1:30 around the circle's center, may pop out over the
frame. The remaining 270° stays inside the circular crop. This quarter is an
angular sector, not the top 25% of the circle's height.

The shared implementation is `app/common/ui/primitives/character-portrait.tsx`
(`CharacterPortrait`). Both Parenting Hub and the landing pedigree use it.
Pass the canonical character `imgUrl` from the data gateway (the currently
published `01.png` stand), not a guessed `02.png` thumbnail URL. Reserve top
clearance around the portrait so ears and hats can extend above the circle.
Both image layers share one failure state; an unavailable image falls back to
the lineage icon inside the ring, including failures before hydration.

### Layer Order and Geometry

| Layer | Stacking | Contract |
|---|---|---|
| Back image (`data-portrait-layer="back"`) | `z-0` | Circle-sized wrapper with `overflow-hidden rounded-full`. |
| Circular frame (`data-portrait-layer="frame"`) | `z-10` | Full amber ring, `ring-[2.5px] ring-amber-400/95 dark:ring-amber-400/80`. |
| Front image (`data-portrait-layer="front"`) | `z-20` | Circle-sized wrapper with `overflow-visible`; clip the wrapper to the upward sector. |

- The outer portrait container is `relative`, square, and `overflow-visible`.
  Each layer uses `absolute inset-0` so its coordinates match the circle.
- Apply `clip-path` to the **front wrapper**, never directly to the scaled
  image. Use `polygon(0 -100%, 100% -100%, 100% 0, 50% 50%, 0 0)`.
  The diagonal edges extend from the center through the endpoints of the top
  90° arc. Above the circle, the region is bounded by invisible vertical
  tangents at its leftmost and rightmost points (`x = 0%` and `x = 100%`).
- Both image copies use the same source and transform:
  `absolute inset-0 h-full w-full object-contain object-top drop-shadow-xs scale-[1.65] origin-top -translate-y-[17%]`.
  Keeping them aligned prevents a seam between the circular crop and pop-out.
- Do not restore a horizontal upper/lower cutoff or use background-colored
  covers to hide overflow. The clipping geometry must work in both themes.
- Frame and front wrapper use `pointer-events-none`; all portrait layers are
  `aria-hidden="true"` and images have empty `alt`. The owning button provides
  the accessible name and picker action.
- Preserve the existing responsive sizes, name placement, and top clearance.
  Hover scaling belongs on the outer portrait container so all layers move
  together under the motion rules in Section 13.

### Verification

Keep the existing portrait regression test aligned with the layer order and
wrapper clipping. User-owned browser checks should include Satono Crown's wide
hat, portraits with tall ears, all ancestor sizes, both themes, and hover:
only the top sector may cross the frame, no image may cross the side tangents,
and the hat must not acquire a horizontal cutoff through its middle.


---

## 21. Rankings Benchmark & Visualizer Flat Architecture

### 21.1 Rankings Design Benchmark

The **Rankings Tab** serves as the application-wide benchmark for flat, high-density, minimal-box UX:
- **Full-Width Flat Character Rows**: Characters are displayed as flat items divided only by hairline borders (`divide-y divide-zinc-100 dark:divide-zinc-800/80`). Competitor entries are never wrapped in individual card boxes.
- **Skill Actions**: Compact actions containing a skill icon, name and Bashin score use `rounded-md` (6px) corners. Keep the same radius for unavailable-slot placeholders and loading skeletons. Do not use `rounded-full` capsules for these actions.
- **Flat Surfaces**: Neutral zinc borders (`border-zinc-200 dark:border-zinc-700`) and flat backgrounds, centered icons with `shrink-0`, truncated names and readable score metrics. Preserve `min-h-11` on touch layouts and `md:min-h-8` on desktop, along with visible keyboard focus rings.
- Circular character portraits and small status dots remain circular; they are not skill action buttons.

### 21.2 Visualizer Track Canvas Flat Architecture

To match the seamless aesthetic of the Rankings course strip, the Visualizer track canvas is completely de-boxed:
1. **No Outer Card Container**: The track sits directly on the page layout without enclosing card borders, backgrounds, or shadows (`rounded-2xl border bg-white shadow-xs` is prohibited).
2. **Concise Header Toolbar**:
   - The top row pairs the concise venue caption (e.g. `Kyoto 2,200m · Turf · Right · Oct CM (Classic)`) with the layout switcher.
   - Prohibited: bulky technical banner labels such as `"Board 1 · Course Map 2.5D"` or `"Board 2 · 1D Linear Timeline with Speed Estimate"`.
3. **Segmented Pill View Mode Switcher**:
   - Layout modes ("Map + timeline", "1D Only", "Map Only") are switched via an `inline-flex` segmented pill container (`bg-zinc-100 dark:bg-zinc-800 p-0.5 rounded-lg text-xs`).
   - Active pill uses `bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 shadow-2xs font-semibold` with `min-h-8 px-2.5 py-1 rounded-md`.
4. **Unboxed Track Rendering Order**:
   - When "Map + timeline" is active: 2.5D Course Map renders on top (`overflow-hidden`), and the 1D SVG Timeline with speed lane renders directly beneath (`overflow-x-auto`).
   - Slices render with natural transparent backgrounds, allowing dark and light theme page surfaces to show through seamlessly.
   - Synchronized hover telemetry and tooltips (`TrackUnifiedTooltip`) float cleanly over the track elements without container boundaries clipping coordinates.

### 21.3 Visualizer 2-Column Flat Layout (Sidebar & Inspector)

1. **Sidebar (`TrackSkillSidebar`)**:
   - De-boxed: renders flatly on the page, demarcated from the inspector panel on desktop via a subtle vertical hairline (`md:border-r md:border-zinc-200/80 md:pr-4 dark:md:border-zinc-800/80`).
   - Filter switchers (`visualizerDeck` and `rarityFilter`) use flat segmented pills (`bg-zinc-100 dark:bg-zinc-800 p-0.5 rounded-lg`).
   - Skill entries are flat rows separated by `divide-y divide-zinc-100 dark:divide-zinc-800/80`.
   - Selection uses a restrained emerald tint (`bg-emerald-50 dark:bg-emerald-950/40 rounded-md`) and `aria-pressed`.
   - Triggerability status dot: green for triggers on course, muted for no trigger, rose for banned debuff rules.
   - The row selection button and graph action must be sibling buttons. Use the shared `AppButton` quiet/icon-only variant for the graph action; opening the graph must not select the row.
2. **Detail Inspector (`SkillDetailPanel`)**:
   - De-boxed on the Visualizer page: renders with transparent background, no outer card border, and no shadow.
   - Data blocks (Header, Effect badges, Trigger conditions, Calculation breakdown) flow naturally, separated cleanly by `divide-y divide-zinc-200/80 dark:divide-zinc-800`.

---

## 22. Deck Skill List Flat Architecture (Main Deck & Parent Deck)

In `features/deck/screens/skill-list.tsx`, deck skills are displayed in a minimal-box format that maximizes readability and data density while preserving instant visual recognition of skill rarity.

### 22.1 Unified List Specification
1. **Continuous Flat List**:
   - Rendered as a single list with divider lines: `<ul className="mt-4 divide-y divide-zinc-100 dark:divide-zinc-800/80">`.
   - ❌ **PROHIBITED**: Stacking individual 4-sided bordered card boxes with vertical gaps (`space-y-2 rounded-xl border`).
2. **Rarity Left Accent Stripe (`border-l-4`)**:
   - Each skill row features a 4px solid left accent stripe indicating its rarity:
     - **Gold**: `border-l-amber-500`
     - **Unique**: `border-l-pink-500`
     - **Evolved**: `border-l-purple-500`
     - **White**: `border-l-zinc-300 dark:border-l-zinc-700`
3. **Rarity Surface Tint**:
   - Rows preserve their subtle rarity background gradient (`skill-surface-gold`, `skill-surface-unique`, `skill-surface-evolved`) or neutral surface for White skills, paired with a soft hover tint (`hover:bg-zinc-100/60 dark:hover:bg-zinc-800/40`).
   - Banned skills receive `opacity-60 bg-rose-50/20 dark:bg-rose-950/10`.

### 22.2 Group by Card Specification
- When viewing skills grouped by support card slot (`viewMode === "card"`):
  - Card slots are separated into flat sections (`className="pt-2"`) rather than enclosed in heavy card boxes.
  - Card slot header uses a clean bottom divider line (`border-b border-zinc-200/80 dark:border-zinc-800/80 py-2.5`).
  - Child skills within each card slot inherit the identical flat list structure with `border-l-4` rarity stripes and surface tints.

### 22.3 Filter Bars & Toolbars
- **Segmented Pill Controls**:
  - Rarity tabs, Source filters, and View Mode toggles use flat segmented pill containers (`inline-flex rounded-lg bg-zinc-100 dark:bg-zinc-800 p-0.5 text-xs font-medium`).
  - Active pills use `bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 font-semibold shadow-2xs` (with custom accent colors for active Gold/Unique/Evo rarity pills).
  - ❌ **PROHIBITED**: Wrapping filter toolbars in borders or drop shadows (`border border-zinc-200 shadow-2xs`).

### 22.4 Support Card 6-Slot Grid Preservation
- In `DeckPicker` (`features/deck/screens/deck-picker.tsx`), the 6 support card slots preserve their edge-to-edge poster card layout to showcase character artwork, rarity banners, card types, and event chain branch selectors. They are not compressed into a text-only strip.

---

## 23. Parenting Canvas Flat Architecture (Lineage Planner)

In `features/parenting/`, the Parenting Hub and its lineage canvas follow the same minimal-box benchmark as Rankings (§3) and the track canvas (§21.2). The generation-row pedigree reads like a wiring diagram, not a stack of cards.

### 23.1 Canvas De-Boxing
1. **Transparent Canvas**:
   - The lineage canvas section renders directly on the page surface — no `rounded-2xl border bg-white p-4` enclosure, no backdrop-blur stage panel, no decorative blur orbs.
   - The target trainee stage (affinity header + portrait spotlight + stat bar) sits flat at the top of the canvas; its only separators are hairlines and the SVG lineage connectors.
2. **Flat Trainee Stats**:
   - The 5-stat bar is delimited by `border-y border-zinc-200/80 dark:border-zinc-800/80` hairlines only (no rounded box, no shadow, no surface fill).
   - The trainee aptitude rows render as flat rows; individual aptitude cells keep the same bordered cell treatment as ancestor `AptitudeCell`s.
3. **Flat Ancestor Tiles**:
   - Parent/grandparent ancestor tiles have NO card box — no `rounded-2xl border bg-white shadow` — only the top padding that reserves portrait pop-out space (`p-1 pt-2 sm:p-1.5 sm:pt-3`, see §20).
   - All inline controls stay on the tile: aptitude cells, unique-skill row (§10 two-line block, `h-8` slot), pink factor button (`h-8`), white genetics picker (`compact` variant, `h-8`). Details remain in their hover popovers.
   - GGP (great-grandparent) minis are flat pink inputs (portrait + pink factor popover) — no mini card box.

### 23.2 Generation-Row Separators
1. The two lineage halves (P1 / P2) are separated by a full-height vertical hairline (`sm:border-l sm:border-zinc-200/70 dark:sm:border-zinc-800` on the P2 half, with `sm:px-3` on both halves and `sm:gap-0` on the grid) — the §21.3 sidebar pattern.
2. Grandparent columns within each half use the same symmetric hairline (`sm:px-2` on both + `sm:border-l` on the second column), so the hairline descends from the fan connector's split point.
3. SVG fan connectors (`data-pedigree-connector`) remain the only lineage linkage; keep them hairline (`text-emerald-700/50 dark:text-emerald-300/50`, `vectorEffect="non-scaling-stroke"`).
4. Phone/tablet tiles (`AncestorTile`) are flat: transparent background, no border/shadow, hover feedback via `hover:bg-zinc-100/80 dark:hover:bg-zinc-800/60`.

### 23.3 Pedigree Skills Section
1. The unified list is a flat `divide-y` list (§22.1) — no `rounded-2xl border bg-white/70` enclosure.
2. Group-by-parent sections are flat (`pt-2`) with `border-b border-zinc-200/80 dark:border-zinc-800/80 py-2.5` slot headers (§22.2); branch identity (P1 emerald / P2 blue) is carried by the tag chip and badge tones, not by tinted card boxes.
3. Filter/search toggles use flat segmented pills (§22.3); empty states are muted centered rows, never dashed boxes.

### 23.4 Parent Deck CTA Banner
- The "Ready to build your support cards" banner is a flat CTA row separated by `border-b border-zinc-200/70 dark:border-zinc-800 pb-3`, with a `DeckIcon` SVG (never the 🃏 emoji — §14) and a single emerald action button. No gradient enclosure.

### 23.5 Unified P/GP Card & White-Genetic Readouts (u-ma proportions)
1. **One Card Layout, One Size (P and GP)**:
   - P and GP render the SAME card: an identity row (portrait `h-9/sm:h-11` left + truncated name right, opening the picker), then a full-width badge block — Surface `grid-cols-2` (centered, cells capped `max-w-[4rem]`), Distance/Style `grid-cols-2 @min-[152px]:grid-cols-4` via the card-level `@container` so narrow cards (phone GP, 4-up) wrap badges to 2 columns instead of shrinking them unreadable.
   - Control stack, in order: pink factor pill (`h-8`) → unique inherit skill row (`h-8` SkillHoverCard) → `WhiteGeneticPicker compact` (`h-8`, lists selections) → genetic indicator strip LAST (thin `border-t` row). `AptitudeCell compactCell` renders dense (`min-h-8`, body `h-5 sm:h-6`, rank icon `h-3.5/h-4`); card wrapper `@container p-1 pt-2 sm:p-1.5 sm:pt-3`.
   - The GGP mini keeps its vertical identity + pink chip.
2. **Same Card at Every Width**:
   - The unified card is used on EVERY tier — desktop branch halves AND phone/tablet rows (`renderUmaCard`). P/GP editing happens through inline popovers everywhere; the `AncestorSheet` now serves GGP only.
   - GGP/GGGP are unchanged: 8 GGP tiles (no grade strip) each carrying 2 GGGP spark chips at every tier (16 total; phone uses the `compact` stars-only chip). Navigating from a genetic popover focuses the P/GP card or GGGP chip directly; only GGP opens the sheet.
3. **White-Genetic Readouts** (`WhiteGeneticPicker`):
   - The trigger LISTS every selected genetic by short name (`Target: Turf · Ldr · Med`) instead of a count; parent cards show it via the compact trigger.
   - Eligible checkboxes carry their roll odds (`N★ · ≈40%` for 6–11★, `N★ · 100%` at 12★) and the footer states `White genetic roll odds: 6–11★ ≈40% · 12★ = 100%.`

### 23.6 Aptitude Target Editing & Branch Spark Suggester
1. **Per-slot aptitude targets** (`AptitudeCell` popover):
   - Every P/GP aptitude cell (all ten, styles included) opens its existing popover with a target RadioGroup `E · D · C · B · A` plus a `Clear` action; the cell header carries a mini target chip (emerald when met, amber while pending).
   - The ladder locks to the picked parent's own base: aptitudes already at base `A` show "Base A — already at the top rank, no target needed." instead of the RadioGroup, and ranks below the parent's base are disabled (pink only ever raises aptitude, so they are unreachable). `?` bases (no parent picked) leave the whole ladder open.
   - C/D/E targets remain the farm floors that drive the G1 calendar (a raised floor tightens eligibility, a lowered one relaxes it); B/A are ambitions above the floor and never tighten race eligibility. Targets persist in `loopConfig.slotAptitudeGoals` and round-trip through share links.
2. **Branch spark suggester** (`lib/parenting/spark-suggester.ts`):
   - Each branch header carries a `Suggest sparks` chip (SVG spark glyph — never an emoji, §14 — violet tones, `ease-out-quart` hover). It stays dashed/disabled with an explanatory `title` until the branch has all three trainees (1 P + 2 GPs).
   - Opening it computes a pink plan for the branch's 12 deep slots (4 GGP + 8 GGGP) and shows a preview popover: per-trainee genetic outcome chips (`Med 6★ · ≈40%` / `12★ · 100%`), target coverage, junk warnings (amber rows), notes, and the count of manually kept slots; NOTHING is written until `Apply to N slots` is pressed. The headline reports both `N obtainable` pools (≥ 6★) and the ≈ per-run roll expectation.
   - The plan maximises on-target genetics spread-first: a pool at ≥ 6★ already earns full priority weight (the loop can collect it over reruns, up to all three Ace categories) and 12★ only adds a small certainty bonus (+10%), so surplus budget splits into 6/6 (or 6/6/6) across target genetics instead of concentrating 12★ on one — weights Distance > Style > Turf for turf aces and Distance > Dirt > Style for dirt aces — after meeting per-slot targets, under the hard rule that every off-target donor pool stays ≤ 5★ (below the 6★ roll threshold). Deep slots with manual pink picks — or a picked card's own factors — are kept untouched and listed in the preview.
   - No free slot is ever left as "no factor" while the Global Track Bar has a course/style: leftover capacity becomes on-target pink in priority order (preferring the next 6★/12★ threshold it can cross), because every genetic matching the Ace's target is useful.
3. **Farm focus toggles** (`FarmFocusToggles`, header chip beside the "Ace genetics" line):
   - Six toggle chips grouped Surface (Turf/Dirt) and Distance (Spr/Mile/Med/Long); the trigger lists disabled ones (`Farm focus: −Spr`).
   - A toggled-off aptitude drops its default floor target, its G1 races leave the calendar with the muted `excluded` status, and the spark engine spends no budget on it. Explicit per-slot C/D/E targets still win over the toggle. Persisted as `loopConfig.disabledFarmAptitudes` and round-tripped through share links.
