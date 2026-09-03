# Requirements: Condition Renderer — Multi-line Chips with Color Boxes

## 1. Overview

Replace the current flat-text "When: ..." / "Needs: ..." condition rendering with a multi-line chip display. Each `@` (OR) branch becomes its own line, each line carries a tinted color box, and individual `&` (AND) sub-conditions can be styled as inline chips. The result reads as a bulleted list of alternative condition sets rather than a run-on sentence. Additionally, each condition group now shows its **effect** under the chips — e.g. `+0.45 m/s for 6s` — with the duration and magnitude computed from the API's `effects[]` and `base_time` fields.

## 2. User Stories

- **US-01**: As a user viewing a skill's activation conditions, I want each OR alternative on its own line so I can quickly scan the different ways a skill can trigger.
- **US-02**: As a user, I want each condition line to have a colored box matching the zone tint so I can visually connect the condition text to the track overlay.
- **US-03**: As a user, I want the conditions to remain readable in the sidebar list (compact) and the detail panel (expanded), without breaking layout.
- **US-04**: As a user, I want the existing "Needs:" (precondition) text to also use the chip layout, so it's consistent.
- **US-05**: As a user, I want to see each condition group's **effect** (e.g. `+0.35 m/s for 2.4s`) directly under its chips, computed from the API's `effects[]` and `base_time` fields and the selected course length.

## 3. Acceptance Criteria

- **AC-01**: Given a condition string `"running_style==4&phase==2&change_order_onetime>0&accumulatetime>=5@running_style==4&phase==2&blocked_side_continuetime>=2&accumulatetime>=5"`, the renderer produces two lines: one for each `@` branch. Each branch's `&` sub-conditions render as distinct inline chips (e.g. the first line shows 4 chips: "Running as a pace chaser", "Mid-race", "Just got passed", "After 5s of racing").
- **AC-02**: Each line is prefixed with a colored box (the same zone tint from the track overlay).
- **AC-03**: Long `&` chains wrap to additional rows within a line rather than overflowing or truncating; the sidebar (compact) and detail panel (expanded) both wrap identically.
- **AC-04**: The "Needs:" precondition also uses the chip layout.
- **AC-05**: `describeCondition` keeps its `.when`/`.needs` string return untouched for backward compatibility, and a new pure-TS structured accessor (e.g. `{ whenBranches: string[][] }`) is added for the chip renderer. React never enters `lib/skill-engine/`.
- **AC-06**: No new JS dependencies; pure TS + Tailwind.
- **AC-07**: The existing `describeCondition` flat-string fallback is preserved for any code path that doesn't use the new chip renderer.
- **AC-08**: A condition whose zone never fires on the selected course renders with a muted/gray tint (not its usual zone color).

## 4. Edge Cases

- **EC-01**: Single condition with no `@` (e.g., `"phase==1"`) → one chip line.
- **EC-02**: Empty/null condition string → no chips rendered.
- **EC-03**: Malformed condition text falls back to the raw text in a single chip.
- **EC-04**: Precondition absent → no "Needs:" section shown.
- **EC-05**: Color box for zones that don't fire on this course → muted/gray tint.

## 5. Technical Constraints

- **TC-01**: The parser grammar (`&`=AND, `@`=OR, no parens, `@` binds loosest) must not change.
- **TC-02**: `lib/skill-engine/` must stay pure TS (no React). The chip rendering lives in the component layer.
- **TC-03**: Stick to the warm ink-on-paper palette (`--paper`, `--ink`, `--ink-soft`, `--line`).
- **TC-04**: `racerCount` threading for `order_rate` must continue to work.

## 6. Alignment with Product Vision

Supports the product goal of being a "correct, trustworthy reference" by making condition alternatives visually scannable — users can immediately see the different activation paths instead of parsing a long sentence.