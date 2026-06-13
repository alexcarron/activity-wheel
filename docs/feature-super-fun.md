# Feature Spec: "Super Fun!" Feedback Button

> **Also serves as the template for writing new feature specs.**
> Duplicate this file, replace the content, and follow the same section structure.

---

## Overview

Users previously had three post-spin feedback options — Accept, Skip, Reject — which covered
the neutral-to-negative range but had no way to express genuine enthusiasm: "I didn't just
do this, I *loved* it and want to see it way more often."

The **Super Fun!** button fills this gap with a large weight boost, positioned as the strongest
positive signal a user can send.

---

## User Story

> As a user who has just done an activity and found it genuinely exciting and fun, I want
> to press a single button that tells the wheel "I *loved* that — show it to me a lot more
> often," so that the wheel naturally surfaces my favourite activities more frequently over
> time without me having to tweak any numbers manually.

---

## Signal Table

| Signal | Button | Meaning | Weight effect |
|--------|--------|---------|---------------|
| "That was fine / I did it" | Accept | Mild positive | +~7 pts |
| "Meh, not today" | Skip | Neutral | No change |
| "I don't want this right now" | Reject | Negative | −~5 pts |
| **"That was AMAZING, more please!"** | **★ Super Fun!** | **Strong positive** | **+~25 pts** |

The gap between Accept and Super Fun is intentional and significant — roughly **3.5×** the
Accept step. Accept says "thumbs up"; Super Fun says "this is one of my favourites, prioritise it."

---

## Where It Appears

1. **Post-spin feedback panel** — the first (leftmost, most prominent) button in the feedback
   row immediately after the wheel lands. Position signals: "this is the strongest positive
   signal you can send."

2. **Activity list rows** — a ★ (star) icon button alongside the existing `+` (accept) and
   `−` (reject) buttons. Lets users retroactively mark any activity as a favourite without
   needing to spin it first.

---

## Keyboard Shortcut

| Key | Action |
|-----|--------|
| `F` | ★ Super Fun! (post-spin, while in the landed phase) |

`F` was chosen because it is mnemonic ("Fun"), is on the same hand as Y/N/S, and was not
already in use.

---

## Visual Design

- **Color:** Warm amber `#f59e0b` — distinct from Accept (teal) and Reject (orange-red).
  Evokes joy and excitement without being alarming.
- **Label:** "★ Super Fun!" — short, expressive, unambiguous.
- **KbdHint badge:** Shown inline with the button label (same as all other hotkey buttons).
- **Icon button (list view):** `★` character in the standard 30×30 icon-button style.
- **Hover state:** Slightly darker amber `#d97706`; same 120ms transition as other buttons.

---

## Weight-System Behaviour

Super Fun maps to the internal `boost` feedback action:

| Property | Value / Behaviour |
|----------|------------------|
| Step size | `BOOST_STEP = 25` (vs `ACCEPT_STEP = 7`) |
| Momentum | Consecutive Super Fun / Accept presses multiply the step (up to 2×) |
| Diminishing returns | Growth slows near maximum weight |
| Dominance guard | **Bypassed** — unlike Accept, Super Fun always honours the full boost |
| Undo | Delta stored in `lastAcceptDelta`; reversible via undo logic |
| acceptCount | Incremented (same counter as Accept; no separate `superFunCount` yet) |

The dominance guard bypass is intentional: when a user explicitly presses Super Fun, the
system should always honour it, even if that activity already holds a large share of the pool.

---

## Out of Scope

- Separate analytics tracking for Super Fun vs Accept clicks (both increment `acceptCount`;
  a dedicated `superFunCount` field is not required yet).
- Visual distinction on the wheel slice itself (e.g. a star for high-weight activities) —
  future enhancement.
- Undo button in the UI — undo logic exists internally but is not exposed as a button.
