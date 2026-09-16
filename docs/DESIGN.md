# AlmondEye DB — UI Design System & Component Guidelines (`DESIGN.md`)

This document defines the core UI/UX patterns and design system specifications for **AlmondEye DB**, with particular focus on skill presentation, bilingual hierarchy, icon geometry, deck picker layout, mobile ergonomics, and duplicate skill indicators. All current and future components must strictly adhere to these standards.

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

## 3. Surface Flatness & Prohibited Nested Boxes (Anti-Slop Architecture)

Per frontend design craftsmanship guidelines (`design-taste-frontend`), **nested boxes (boxes inside boxes inside boxes) are strictly prohibited**.

### Core Anti-Patterns & Mandates
1. ❌ **No Nested "Russian Doll" Cards**: Never place a bordered, rounded card inside a container that is itself a bordered, rounded card of the same visual weight.
2. ❌ **No Nested Boxes for Filter Toolbars & Sub-Panels**: Never wrap secondary search or filter controls (e.g. the Multi-Skill Filter in `CardPickerPopover`) in a heavy colored, bordered box (`rounded-xl border border-*-500/30 bg-*-50/40 p-*`).
3. ✅ **Single Surface with Divider Lines**:
   - Containers (such as card groups in `skill-list.tsx` and `parent-skill-list.tsx`) must be a single surface (`rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900`).
   - Child items within the container must use separator lines (`divide-y divide-zinc-100 dark:divide-zinc-800/80`) or clean table/list rows, NOT individual inner bordered boxes.
   - Secondary filter sections within a popover/modal header must integrate seamlessly, demarcated only by a subtle top divider line (`pt-2.5 mt-2 border-t border-zinc-200/70 dark:border-zinc-800`) rather than an enclosed container box.
4. ✅ **Unified 6-Slot Grid Across All Deck Pickers**:
   - Both **Main Deck** and **Parent Deck** must render the identical clean 6-slot grid (`components/deck-picker.tsx`).
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
| **Visualizer Inspector** | `components/track/skill-detail-inspector.tsx` | `h-10 w-10 sm:h-11 sm:w-11` | `flex items-center gap-3` | `text-base font-semibold` | `text-xs text-zinc-400` | Hero inspector header, enlarged drop-shadowed icon. |
| **Track Visualizer Sidebar** | `components/track/track-skill-sidebar.tsx` | `h-4 w-4` / `h-5 w-5` | `flex items-center gap-1.5` | `text-xs font-semibold truncate` | `text-[10px] text-zinc-400 truncate` | Trigger status dot, icon, and text stack all vertically centered. |
| **Main Deck Skill List** | `components/skill-list.tsx` | `h-7 w-7` (unified) / `h-6 w-6` (grouped) | `inline-flex items-center gap-2.5` | `text-sm font-semibold` | `text-xs text-zinc-400` | Full title block & icon wrapped inside `SkillHoverCard`. |
| **Parent Deck Skill List** | `components/parent-skill-list.tsx` | `h-7 w-7` (unified) / `h-6 w-6` (grouped) | `inline-flex items-center gap-2.5` | `text-sm font-semibold` | `text-xs text-zinc-400` | Identical styling to Main Deck for visual consistency. |
| **Card Skills Sheet** | `components/card-skills-sheet.tsx` | `h-5 w-5 sm:h-6 sm:w-6` | `flex items-center gap-2` | `text-xs font-semibold` | `text-[10px] sm:text-[11px] text-zinc-400` | Modal/bottom-sheet card detail viewer. |
| **Multi-Skill Filter (Card Picker)** | `components/card-picker-popover.tsx` | `h-3.5 w-3.5` / `h-4 w-4` | `flex items-center gap-1.5` | `text-xs font-bold` | `text-[10px] text-zinc-400` | Flat, non-nested multi-skill filter with tag chips & SVG icons. |
| **Skill Picker Modal (List)** | `components/skill-picker-modal.tsx` | `h-7 w-7` | `flex items-center gap-2.5` | `text-xs font-bold truncate` | `text-[10px] text-zinc-400 truncate` | Search list items with category pills. |
| **Skill Picker Modal (Preview)** | `components/skill-picker-modal.tsx` | `h-8 w-8` | `flex items-center gap-2.5` | `text-xs sm:text-sm font-bold` | `text-[11px] text-zinc-400` | Right-side detail preview header. |

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
- [ ] **No Nested Boxes**: Are lists rendered on flat surfaces with dividers instead of boxes inside boxes? Are filter toolbars flat and divider-based rather than nested cards?
- [ ] **No Emojis in Functional UI**: Are all interface icons crisp SVG components from `components/icons.tsx`? Are HTML `<option>` labels plain text without emojis?
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

The desktop skill popover must be positioned relative to its trigger, never covering it:

1. **Horizontal**: beside the trigger — right side preferred (`rect.right + 8`); flip to the left (`rect.left - width - 8`) when it would overflow the viewport's right edge; clamp to 16px from the edge as a last resort.
2. **Vertical**: centered on the trigger (`rect.top + rect.height / 2 - cardHeight / 2`), clamped to `[16, innerHeight - cardHeight - 16]` so it never gets cut by the top or bottom of the screen.
3. **Measured height**: use the real rendered height from `popoverRef` (fallback estimate only on first paint); the card is fixed `w-[340px]` but its height varies.
4. **Re-measure** via `useLayoutEffect` after mount and after async content loads (height changes).
5. **Origin-aware scale**: `transform-origin` must track the placement side (`${originX} center` — the edge nearest the trigger), so the enter animation scales *from the trigger*, not from the popover's center.

---

## 14. SVG Icons Over Emojis Standard (Clean UI Typography)

All interface icons, badges, indicators, and buttons MUST use standardized SVG vector icons from `components/icons.tsx`. The use of Unicode emojis in functional UI is **strictly prohibited**.

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
   - All standard icons must be imported from `components/icons.tsx`: `TargetIcon`, `CheckIcon`, `XIcon`, `ChevronDownIcon`, `ChevronUpIcon`, `SearchIcon`, `StarIcon`, `TrophyIcon`, `TimerIcon`, `FlagIcon`, etc.
   - When a new icon is needed, implement it in `components/icons.tsx` as a standard `IconProps` component before using it in views.

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

