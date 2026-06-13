# Feature Spec: "Hate It!" Feedback Button

---

## Overview

Users previously had no way to signal strong dislike beyond the mild "Reject" button.
Someone who genuinely **hates** an activity and never wants to see it would need to press
Reject many times to push its weight down — an annoying chore.

The **Hate It!** button fills this gap with a large weight penalty, positioned as the strongest
negative signal a user can send. It is the direct negative mirror of **Super Fun!**.

---

## User Story

> As a user who has just done (or seen in the list) an activity I genuinely despise,
> I want to press a single button that tells the wheel "I *hate* that — show it to me
> far less often," so that activities I really dislike quickly drop off my wheel
> without me having to press Reject over and over.

---

## Signal Table

| Signal | Button | Meaning | Weight effect |
|--------|--------|---------|---------------|
| "That was AMAZING, more please!" | ★ Super Fun! | Strong positive | +~25 pts |
| "That was fine / I did it" | Accept | Mild positive | +~7 pts |
| "Meh, not today" | Skip | Neutral | No change |
| "I don't want this right now" | Reject | Negative | −~5 pts |
| **"I hate this, show it way less"** | **✕ Hate It!** | **Strong negative** | **−~25 pts** |

The gap between Reject and Hate It is intentional and significant — roughly **5× the
Reject step**. Reject says "not now"; Hate It says "I genuinely dislike this, demote it hard."

Hate It is the exact negative mirror of Super Fun: same step size, same momentum scaling,
same diminishing-returns curve — just in the opposite direction.

---

## Where It Appears

1. **Post-spin feedback panel** — the last (rightmost) button in the feedback row after
   the wheel lands. Position signals: "strongest negative signal you can send."

2. **Activity list rows** — a ✕ icon button alongside ★ (boost), + (accept), − (reject).
   Lets users retroactively demote any activity without spinning it first.

---

## Keyboard Shortcut

| Key | Action |
|-----|--------|
| `H` | ✕ Hate It! (post-spin, while in the landed phase) |

`H` was chosen because it is mnemonic ("Hate"), is on the home row, and was not already in use.

---

## Visual Design

- **Color:** Crimson red `#dc2626` — a cooler, deeper red than Reject's orange-red (`--warn`).
  Distinct at a glance. Evokes strong dislike without being as bright/alarming as an error state.
- **Hover:** `#b91c1c` (darker crimson).
- **Label:** "✕ Hate It!" — short, expressive, unambiguous.
- **KbdHint badge:** Shown inline with button label (white-on-translucent, same as other dark-bg buttons).
- **Icon button (list view):** `✕` character in the standard 30×30 icon-button style.
- **Hover state (list icon):** Crimson fill, same 120ms transition as other buttons.

---

## Weight-System Behaviour

Hate It maps to the internal `hate` feedback action:

| Property | Value / Behaviour |
|----------|------------------|
| Step size | `HATE_STEP = 25` (vs `REJECT_STEP = 5`) |
| Momentum | Consecutive Hate It / Reject presses multiply the step (up to 2×) |
| Diminishing returns | Reduction slows near minimum weight |
| Undo | **Not stored** — no `lastRejectDelta` field exists; use Accept/Super Fun to recover |
| rejectCount | Incremented (same counter as Reject; no separate `hateCount` yet) |

Hate It and Reject share the same momentum direction (`'negative'`), so mixing them
builds streak momentum just like mixing Accept and Super Fun builds positive momentum.

---

## Out of Scope

- Separate analytics tracking for Hate It vs Reject (both increment `rejectCount`; a
  dedicated `hateCount` field is not required yet).
- Undo for Hate It — the undo system currently only reverses the last *positive* delta
  (`lastAcceptDelta`). Adding a negative undo would require a new `lastRejectDelta` field
  and changes to the `undo` action handler; deferred to a future feature.
- Visual distinction on the wheel slice itself (e.g. skull for low-weight activities).
