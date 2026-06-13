# Feature Spec: Activity Tagging & Tag Filter

---

## Overview

Tags let users label activities with freeform text (e.g. "Gaming", "PC", "TV Show") and then
filter the wheel and activity list to only spin within a chosen group. Tags are the primary
curation tool for power users who maintain many activities across different moods or contexts.

---

## User Story

> As a user with 50+ activities spanning different categories, I want to label them with
> tags and then quickly restrict the wheel to a single tag (e.g. "Gaming") so I'm only
> choosing from the activities that make sense for my current mood — without permanently
> removing the others.

---

## Core Concepts

| Concept | Description |
|---------|-------------|
| Tag | A freeform string label applied to one or more activities |
| Tag color | Optional CSS color assigned globally per tag name — "Gaming" is always the same color everywhere |
| Tag filter | A session-only, in-memory filter restricting the wheel pool and activity list |
| Tag registry | Every tag name ever typed is remembered globally for autocomplete |

---

## Tag Filter Bar

Positioned between the wheel and the activity list.

### Layout

1. **Search input** — filters the visible pill list (doesn't change the wheel directly)
2. **"All" pill** — always first; selected by default; clears all active filters
3. **"Untagged" pseudo-pill** — shows only activities with no tags (useful for cleanup)
4. **Tag pills** — one per known tag, with a count badge ("Gaming (8)")
5. **AND/OR toggle** — only visible when 2+ tags are selected (defaults to OR)

### Pill interaction model

- **All** → deselects everything, returns to unfiltered state
- **One tap** on a tag pill → activates it
- **Second tap** → deactivates it
- **Multi-tag:** tapping a second tag while one is active adds to the filter (OR by default)
- **Active pills** are visually filled/colored; inactive are outlined
- **AND/OR toggle:** subtle button, click to flip. "AND" means all active tags must be present.

### Count badges

Each pill shows the number of activities that have that tag: "Gaming (8)". This lets you
immediately see how many activities are in a bucket without spinning.

### Keyboard shortcuts

The 9 most-popular tags (by activity count) are assigned digit keys 1–9. Press `1` to toggle
the most popular tag, `2` for second, etc. Hotkey badges appear on the pills.

---

## Empty State

When the active filter produces zero activities:

> "No activities match this filter — add some or clear the filter."
> [Clear filter] button

When the filter has activities but they've all been spun this session:

> "All filtered activities have been spun this session."
> [Reset session] [Clear filter] buttons

---

## Tag Pills on Activity Rows

Every activity row shows its current tags as colored pills, plus a **＋** button at the end.

### Adding a tag (＋ button → combobox)

1. Click ＋ → floating combobox opens anchored to the button
2. Shows all previously-used tags not already on this activity (for autocomplete)
3. Type to filter suggestions live
4. Click a suggestion to add immediately
5. If typed text doesn't match any existing tag exactly, a **"Create 'xyz'"** option appears
6. **Enter** confirms (adds top suggestion, or creates if nothing matches)
7. Click outside closes without adding

### Removing a tag

Hover over any tag pill on an activity row → **✕** appears → click to remove.

### Tag color picker

Right-click (or long-press) any tag pill → small popup with:
- 9 preset colors (red, orange, amber, green, cyan, blue, purple, pink, gray)
- "Custom…" option via `<input type="color">`
- "Remove color" option to clear back to default

Color is stored globally (in `tag-metadata`), so changing "Gaming" to blue updates it
everywhere — all activities, all rows, filter bar pills, everywhere.

---

## Post-Spin Tag Nudge

If the landed activity has **no tags**, a subtle prompt appears beneath the activity name:

> "No tags yet.  [Add a tag? ＋]"

Clicking it opens an inline input with autocomplete. This nudges users to tag organically
during normal use rather than requiring a dedicated tagging session upfront.

---

## Session Interaction

With a tag filter active, the session pool is:

```
session pool = (activities that pass the filter) ∩ (not yet spun this session)
```

Exclusions from spinning carry over even if the filter changes mid-session. The active filter
itself **never persists across page loads** — it is always reset to "All" on reload.

The debug panel's probability percentages are recalculated for the filtered pool only when a
filter is active, not the global pool.

---

## Behavior Details

| Behaviour | Detail |
|-----------|--------|
| Tags field on Activity | `tags: string[]` — array of tag name strings |
| Tag colors | Stored in `tag-metadata` IDB store, keyed by name. Not per-activity. |
| Tag registry | Every tag name ever created is in `tag-metadata` (for autocomplete) |
| Old activities | Records without a `tags` field are normalized to `[]` on load |
| Filter persistence | Active filter is session-only (in-memory; not saved to IDB or localStorage) |
| AND/OR default | Defaults to OR; resets to OR when filter is cleared |
| "Untagged" pill | Mutually exclusive with regular tag pills; clicking a tag clears untagged mode |
