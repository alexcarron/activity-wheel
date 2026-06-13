# Claude Project Context — Activity Wheel

> **AI INSTRUCTION:** Read this file first before beginning any task on this project.
> It tells you what every file does, how the domain works, which files to touch for
> common task types, and the invariants you must not break.
> After completing a task that changes architecture, add/update the relevant section.

---

## Project in One Sentence

A weighted activity-selection wheel (Vite + React + TypeScript + IndexedDB) that learns
user preferences through button feedback — no numbers, no backend, fully client-side.

---

## Tech Stack

| Layer | Choice |
|-------|--------|
| Bundler | Vite |
| UI | React 18 + TypeScript |
| Styling | Plain CSS (App.css + index.css) — no CSS framework |
| Persistence | IndexedDB via a custom generic wrapper (`src/libraries/indexeddb/`) |
| State | React hooks only — no Redux, no Zustand |
| Testing | None yet (dev scripts in `src/dev-scripts/`) |

---

## Repository Layout

```
src/
├── domain-logic/                   ← Pure functions. No React, no IO.
│   ├── types.ts                    ← Activity + TagMetadata interfaces; FeedbackAction union
│   ├── weighted-selection-logic.ts ← Cumulative weighted random pick
│   ├── tag-filter-logic.ts         ← filterActivitiesByTags() + count helpers (NEW)
│   ├── weight-logic/               ← All weight math (see Weight System section)
│   │   ├── weight-constants.ts     ← ALL numeric tuning knobs live here
│   │   ├── weight-feedback-response-logic.ts  ← applyFeedback() — the core function
│   │   ├── weight-momentum-logic.ts
│   │   ├── effective-weight-logic.ts
│   │   ├── weight-diminishing-returns-logic.ts
│   │   ├── weight-minimum-logic.ts
│   │   ├── weight-maximum-logic.ts
│   │   ├── recency-boost-logic.ts
│   │   ├── warning-weight-logic.ts
│   │   └── index.ts                ← Barrel export
│   └── activity-logic/
│       └── activity-factory.ts     ← createActivity() factory
│
├── services/
│   ├── activity-service.ts         ← Persistence layer. Calls applyFeedback + IndexedDB.
│   ├── tag-service.ts              ← Tag metadata CRUD (name registry + colors) (NEW)
│   └── schema.ts                   ← IDB schema v2 (activities + tag-metadata stores)
│
├── hooks/
│   ├── useActivities.ts            ← Primary state hook. Owns the activities array + updateTags().
│   ├── useSession.ts               ← Manages current spin pool (which activities excluded)
│   ├── useTagFilter.ts             ← Tag filter state (session) + tag metadata (persisted) (NEW)
│   ├── useNow.ts                   ← Live timestamp (for recency calculations)
│   ├── useHotkey.ts                ← Global keydown listener with enable/disable flag
│   └── wheel/
│       ├── useWheel.ts             ← Wheel animation state machine (idle→spinning→landed)
│       └── spin-duration-logic.ts
│
├── context/
│   ├── WeightContext.tsx            ← Provides totalEffectiveWeight + numTotalActivities
│   └── SpinCountContext.tsx
│
├── components/
│   ├── WheelView.tsx               ← Orchestrator. Owns spin flow + wires hooks together.
│   ├── Wheel.tsx                   ← Canvas-based wheel render + animation only.
│   ├── PostSpinActions.tsx         ← Feedback buttons shown after wheel lands + tag nudge.
│   ├── TagFilterBar.tsx            ← Tag filter pills + search + AND/OR toggle (NEW)
│   ├── ActivityList.tsx            ← Searchable/sortable list wrapper.
│   ├── ActivityRow.tsx             ← Single activity row with inline edit, feedback, tag pills.
│   ├── AddActivity.tsx             ← Text input + add button.
│   ├── KbdHint.tsx                 ← <kbd> badge component used inside buttons.
│   ├── DebugPanel.tsx              ← Collapsible dev panel (weights + probabilities).
│   └── BackupControls.tsx          ← JSON export/import UI.
│
├── libraries/indexeddb/            ← Generic TypedStore<T> abstraction. Not domain-specific.
│   ├── database.ts
│   ├── store.ts
│   ├── types.ts
│   └── index.ts
│
├── utils/
│   └── format.ts                   ← formatDate, formatWeight, formatPercent helpers
│
├── hotkeys.ts                      ← SINGLE SOURCE OF TRUTH for all keyboard shortcuts
│                                     (HOTKEYS object + TAG_HOTKEYS array for Digit1–Digit9)
├── App.tsx                         ← Root composition. Passes callbacks down.
├── App.css                         ← ALL layout + component styles (one file)
└── index.css                       ← CSS variables (colors, typography, theme tokens)

docs/
├── claude-project-context.md   ← THIS FILE — AI technical reference (read first)
├── product-overview.md         ← Product vision, user flows, all features at product level
├── feature-super-fun.md        ← Deep spec for ★ Super Fun! button (also new-feature template)
└── feature-tagging.md          ← Deep spec for activity tagging & tag filter bar

launchers/
└── README.md                   ← Windows one-click launcher setup (start-activity-wheel.bat, shortcuts, autostart)
```

---

## Core Data Types (`src/domain-logic/types.ts`)

```typescript
interface Activity {
  id: string;           // UUID v4
  name: string;
  weight: number;       // Stored baseline, Use effectiveWeight() for display/selection.
  createdAt: number;    // Unix ms — drives 7-day recency boost
  acceptCount: number;  // Incremented by accept AND boost/super-fun
  rejectCount: number;
  streak: number;       // >0 = consecutive accepts/boosts, <0 = rejects, 0 = neutral
  lastAcceptDelta?: number; // Exact delta from last accept/boost. Enables undo. Cleared after undo.
  tags: string[];       // Freeform tag labels. Default []. Old records normalised on load.
}

interface TagMetadata {
  name: string;   // IDB key. Every tag name ever typed is registered here.
  color?: string; // Optional CSS color string. Global per tag name across all activities.
}

type FeedbackAction = 'accept' | 'reject' | 'skip' | 'boost' | 'undo';
// 'boost' = the "Super Fun!" action (large weight increase, ~3.5× accept)
```

**Key rule:** Never read `activity.weight` directly for UI or selection. Always call
`getEffectiveWeight(activity, now, globalWeightContext)` which adds the time-decaying
recency bonus on top.

---

## Weight System

### Constants (`src/domain-logic/weight-logic/weight-constants.ts`)
**All numeric tuning lives here. Change weights/steps here only.**

| Constant | Value | Meaning |
|----------|-------|---------|
| `WEIGHT_DEFAULT` | 100 | Starting weight for new activities |
| `WEIGHT_MIN` | 20 | Floor — activities are always spinnable |
| `ACCEPT_STEP` | 7 | Moderate boost per accept |
| `REJECT_STEP` | 5 | Decrease per reject |
| `BOOST_STEP` | 25 | Large boost (Super Fun! action) — ~3.5× accept |
| `MOMENTUM_PER_STREAK` | 0.25 | Multiplier added per consecutive same-direction action |
| `MOMENTUM_MAX` | 2.0 | Streak multiplier cap |
| `DIMINISHING_EXPONENT` | 0.7 | Curve exponent near bounds |
| `DIMINISHING_FLOOR` | 0.1 | Minimum factor — even at bound, tiny nudge still registers |
| `DOMINANCE_GUARD` | 0.6 | If activity holds ≥60% of pool weight, suppress accept growth to ×0.1 |
| `RECENCY_BOOST_DURATION_DAYS` | 7 | Days over which new-activity bonus fades |
| `RECENCY_BOOST_MULTIPLIER` | 0.3 | Bonus = 30% of pool average weight |

### Core Function: `applyFeedback()` (`weight-feedback-response-logic.ts`)

Pure function: `(activity, action, now, globalWeightContext?) → Activity`

| Action | Step | Momentum | Diminishing returns | Dominance guard | Stores delta |
|--------|------|----------|--------------------|--------------------|--------------|
| `skip` | 0 | — | — | — | No |
| `accept` | ACCEPT_STEP | ✓ | ✓ | ✓ (fires if share >60%) | Yes |
| `reject` | REJECT_STEP | ✓ | ✓ | Never | No |
| `boost` | BOOST_STEP | ✓ | ✓ | **Never** (always honoured) | Yes |
| `undo` | −lastAcceptDelta | — | — | — | Clears |

**Invariants enforced by applyFeedback:**
- Output weight always clamped to minimum and maximum weight
- All values rounded to 4 decimal places
- Pure function — no side effects, safe for React state updates

### Effective Weight (`effective-weight-logic.ts`)
```
effectiveWeight = storedWeight + recencyBonus
recencyBonus    = RECENCY_BOOST_MULTIPLIER × poolAvgWeight × (1 − daysOld/7)
                  (fades to 0 after 7 days; fallback flat 30 pts if no pool context)
```

### Momentum (`weight-momentum-logic.ts`)
- `accept` and `boost` both count as "positive" direction
- First action in direction: multiplier 1.0×, streak ±1
- Each consecutive same-direction: +0.25× (capped at 2.0×)
- Opposite direction resets streak; skip/undo reset to 0

---

## Keyboard Shortcuts (`src/hotkeys.ts`)

**This is the single source of truth. Always add shortcuts here first.**

### Static hotkeys (`HOTKEYS` object)

| Key | Code | Action |
|-----|------|--------|
| Space | `Space` | Spin (idle) / Spin again (landed) |
| F | `KeyF` | Super Fun! (boost action) |
| Y | `KeyY` | Accept |
| S | `KeyS` | Skip |
| N | `KeyN` | Reject |

### Dynamic tag hotkeys (`TAG_HOTKEYS` array)

| Key | Code | Action |
|-----|------|--------|
| 1 | `Digit1` | Toggle most-popular tag |
| 2–9 | `Digit2`–`Digit9` | Toggle 2nd–9th most-popular tag |

Tag hotkeys are wired up dynamically in `TagFilterBar.tsx` based on runtime tag counts.
`TAG_HOTKEYS[i]` corresponds to the (i+1)th most-popular tag.

Hotkeys are consumed in components via `useHotkey(code, handler, enabled)`.

---

## UI Flow

```
App loads
  └─ useActivities() hydrates activities from IndexedDB
  └─ useTagFilter() hydrates tag metadata from IndexedDB
  └─ filteredActivities = filterActivitiesByTags(activities, activeTags, mode, untaggedOnly)
  └─ useSession(filteredActivities) — pool = filtered ∩ not yet spun
  └─ WeightContext provides totalEffectiveWeight to all components

Idle phase (WheelView)
  └─ TagFilterBar renders above the wheel: "All" | "Untagged" | tag pills w/ counts
  └─ Wheel.tsx renders canvas slices proportional to effectiveWeight (filtered pool only)
  └─ Space / Spin button → useWheel.spin(pool)
       └─ Selection computed deterministically BEFORE animation
       └─ State: idle → spinning
  └─ If filter active + 0 pool items → tag empty-state message + Clear Filter button

Spinning phase
  └─ requestAnimationFrame animation (Wheel.tsx)
  └─ State: spinning → landed (on finish)

Landed phase (PostSpinActions.tsx)
  └─ Buttons: ★ Super Fun! (F) | Accept (Y) | Skip (S) | Reject (N)
  └─ If landed activity has no tags → "Add a tag? ＋" nudge appears
  └─ Any feedback → onChoose(action) → WheelView → useActivities.feedback()
       └─ activity-service.recordFeedback() → applyFeedback() → IndexedDB
  └─ Space = Spin again (remaining filtered pool)

Activity list (always visible below wheel)
  └─ Shows filteredActivities when a filter is active, all activities otherwise
  └─ ActivityRow.tsx: tag pills | ★ (boost) | + (accept) | − (reject) | × (delete)
       └─ Tag pill ＋ → combobox dropdown (portal) with autocomplete
       └─ Tag pill right-click → color picker popup (portal)
  └─ onFeedback() / onUpdateTags() callback chains → persist to IndexedDB
  └─ Probabilities shown in rows computed over the displayed (filtered) set
```

---

## State & Data Flow

```
useActivities (hook)          ← owns activities[], provides add/rename/remove/feedback/updateTags
  └─ activity-service.ts      ← calls applyFeedback() / updateActivityTags() then writes to IndexedDB
       └─ IndexedDB library    ← generic TypedStore<Activity>  (store: "activities")

useTagFilter (hook)           ← owns tag filter state (session) + tag metadata (IDB-persisted)
  │  activeTags, untaggedOnly, filterMode  ← in-memory only, reset on reload
  └─ tag-service.ts           ← CRUD for tag-metadata IDB store
       └─ IndexedDB library    ← TypedStore<TagMetadata>  (store: "tag-metadata")

filteredActivities (App.tsx)  ← useMemo: filterActivitiesByTags(activities, activeTags, ...)
  └─ passed to useSession + ActivityList + WheelView

useSession(filteredActivities) ← pool = filteredActivities filtered by excluded IDs
  └─ exclude(id)              ← called after every spin feedback
  └─ reset()                  ← called by Reset Session button or page refresh

useWheel (hook)               ← animation state machine
  └─ spin(pool, seed?)        ← picks winner + starts animation
  └─ finish()                 ← transitions spinning→landed
  └─ resetWheel()             ← back to idle

WeightContext (context)       ← provides { totalEffectiveWeight, numTotalActivities }
  └─ consumed by applyFeedback (dominance guard) and effectiveWeight (recency scaling)
  └─ NOTE: always based on ALL activities, not just the filtered subset
```

---

## CSS Patterns (`src/App.css` + `src/index.css`)

**index.css** — CSS custom properties only (colors, radius, shadow, font). Touch this to
change the visual theme.

**App.css** — All component styles. Organised by section with comments. Key classes:

| Class | Purpose |
|-------|---------|
| `.btn` | Base button style |
| `.btn-primary` | Blue CTA |
| `.btn-accept` | Teal/green — positive feedback |
| `.btn-super-fun` | Amber `#f59e0b` — enthusiastic positive feedback |
| `.btn-reject` | Orange-red — negative feedback |
| `.btn-skip` | Neutral grey border |
| `.btn-secondary`, `.btn-ghost` | Navigation buttons |
| `.icon-btn` | 30×30 square icon button (activity row) |
| `.icon-btn-danger` | Red hover for delete |
| `.icon-btn-super-fun` | Amber hover for ★ Super Fun in list |
| `.kbd-hint` | `<kbd>` badge inside buttons |
| `.post-spin-feedback` | Flex row of feedback buttons |
| `.activity-row-actions` | Flex row of icon buttons in list |
| `.tag-filter-bar` | The whole filter bar container; `.tag-filter-bar-active` when a filter is on |
| `.tag-pill` | Filter bar pill; `.tag-pill-active` when toggled on |
| `.activity-tag-pill` | Inline tag pill inside an activity row |
| `.activity-tag-add` | The ＋ add-tag button (hidden until row hover) |
| `.tag-combobox-dropdown` | Floating autocomplete dropdown (rendered via portal) |
| `.tag-color-picker` | Floating color picker popup (rendered via portal) |

**KbdHint override rule:** Dark-background buttons (`.btn-accept`, `.btn-reject`,
`.btn-super-fun`, `.btn-primary`) need a white-on-translucent KbdHint variant — add the
class to the selector block near `.btn-primary .kbd-hint`.

**Dark mode:** Handled entirely via `@media (prefers-color-scheme: dark)` in `index.css`.
Use CSS variables everywhere; never hard-code colors in App.css except for action-specific
button colors (accept teal, super-fun amber, reject orange-red).

---

## Adding a New Feedback Action (Step-by-Step Template)

Use this when adding a new user signal that changes activity weight.

1. **`src/domain-logic/types.ts`** — Add new string literal to `FeedbackAction` union.
2. **`src/domain-logic/weight-logic/weight-constants.ts`** — Add `X_STEP` constant.
3. **`src/domain-logic/weight-logic/weight-feedback-response-logic.ts`** — Add branch in
   `applyFeedback()`. Decide: momentum? diminishing returns? dominance guard? stores delta?
4. **`src/domain-logic/weight-logic/weight-momentum-logic.ts`** — Classify the action as
   `'positive'`, `'negative'`, or `'neutral'` in `getMomentumDirectionFromAction()`.
5. **`src/hotkeys.ts`** — Add entry to `HOTKEYS` constant.
6. **`src/App.css`** — Add `.btn-X` and/or `.icon-btn-X` style. Add KbdHint override if
   button has a dark background.
7. **`src/components/PostSpinActions.tsx`** — Add `<button>` + `useHotkey()` call.
8. **`src/components/ActivityRow.tsx`** — Add icon button if it makes sense in the list.
9. **`docs/product-overview.md`** — Update the post-spin options table in §3.1 and
   the activity list controls in §3.3.
10. **`docs/feature-super-fun.md`** — Add a new feature spec file using that file as template.

---

## Common Task Types → Files to Touch

### "Change how much a button boosts/reduces weight"
→ `src/domain-logic/weight-logic/weight-constants.ts` only (change the step constant).

### "Change the dominance guard threshold"
→ `weight-constants.ts` (`DOMINANCE_GUARD`). Logic is in `weight-feedback-response-logic.ts`.

### "Add a new button after the wheel lands"
→ `hotkeys.ts`, `PostSpinActions.tsx`, `App.css`. If it changes weight: also `types.ts`,
`weight-constants.ts`, `weight-feedback-response-logic.ts`.

### "Add a new button to activity rows"
→ `ActivityRow.tsx`, `App.css`. If new action: also `types.ts` + weight files.

### "Change wheel colors / sizing"
→ `Wheel.tsx` (canvas rendering), `index.css` (CSS vars for theme colors).

### "Change how activities are stored / what fields they have"
→ `domain-logic/types.ts` (interface), `activity-logic/activity-factory.ts` (factory),
`services/activity-service.ts` (persistence + normalizeActivity for old records).
If adding a new IDB store: also `services/schema.ts` (new StoreSchema + migration, bump version).

### "Add a new keyboard shortcut"
→ `hotkeys.ts` first. Then `useHotkey()` call in the relevant component.

### "Change the recency boost duration or strength"
→ `weight-constants.ts` (`RECENCY_BOOST_DURATION_DAYS`, `RECENCY_BOOST_MULTIPLIER`).

### "Change how momentum works"
→ `weight-momentum-logic.ts` + `weight-constants.ts` (`MOMENTUM_PER_STREAK`, `MOMENTUM_MAX`).

### "Add a new sort or filter to the activity list"
→ `ActivityList.tsx`. Sort keys typed in `domain-logic/types.ts` (`SortKey`).
For tag-based filtering see `domain-logic/tag-filter-logic.ts` + `hooks/useTagFilter.ts`.

### "Add or change a tag's color"
→ `services/tag-service.ts` (`setTagColor`). Color picker UI is in `ActivityRow.tsx` (TagPill).
Colors are global per tag name (stored in `tag-metadata` IDB store, not on Activity).

### "Change tag filter logic (OR/AND, untagged behaviour)"
→ `domain-logic/tag-filter-logic.ts` (pure functions).
→ `hooks/useTagFilter.ts` (filter state: activeTags, filterMode, untaggedOnly).
→ `components/TagFilterBar.tsx` (UI and hotkeys).

### "Change what the wheel spins when a tag filter is active"
→ `App.tsx`: `filteredActivities` memo + `useSession(filteredActivities)`.
The session pool is always `filteredActivities ∩ not yet excluded`. This is the single
place where the filter is applied — everything downstream receives the already-filtered list.

---

## Invariants — Do Not Break These

- **`applyFeedback` is pure.** No IO, no mutation, no side effects. Keep it that way.
- **Selection happens before animation.** The wheel canvas only animates; the winner is
  already decided when `spin()` is called. Do not move selection into the animation loop.
- **Effective weight, not stored weight, drives everything visible.** All display and
  probability math uses `getEffectiveWeight()`. The stored `weight` field is the durable
  baseline only.
- **All shortcuts are in `hotkeys.ts`.** Never hard-code key names in components.
- **All CSS variables are in `index.css`.** Never add `:root {}` variables to App.css.
- **`WEIGHT_MIN` must be > 0.** Every activity must always have a non-zero selection chance.
- **Undo only reverses `lastAcceptDelta`.** It is a one-shot reverse of the last positive
  action. Do not chain undo. `lastAcceptDelta` is cleared after use.
- **`boost` bypasses dominance guard.** Accept does not. This is intentional — never add
  a dominance guard to boost/super-fun.
- **Tag filter state is session-only.** `activeTags`, `untaggedOnly`, `filterMode` live only
  in `useTagFilter` React state. They are never written to localStorage or IndexedDB. They
  reset to "no filter" on every page load by design.
- **Tag colors are global per tag name.** They are stored in the `tag-metadata` IDB store,
  NOT on the Activity record. Never store a color on an individual Activity.
- **`activity.tags` is always a non-null array.** Old records without `tags` are normalised
  to `[]` by `normalizeActivity()` in `activity-service.ts` on load. Never assume `tags` is
  undefined downstream.
- **`WeightContext` is always based on ALL activities**, not the filtered subset. The
  dominance guard and recency boost use the global pool average — filtering does not change
  those denominators.

---

## Pre-Existing Build Errors (Not Caused by Your Changes)

These two files have TypeScript errors that pre-date this project's current state.
They are not blockers for the app running in dev/prod, but they will fail `tsc -b`:

- `src/dev-scripts/weight-simulator.ts` — calls `applyFeedback` with 2 args (needs 3)
- `src/hooks/useSpinCount.ts` — imports non-exported symbols from `SpinCountContext`

**Do not fix these unless explicitly asked.** They are in non-critical paths.
`npm run dev` works fine; only `npm run build` (which runs `tsc -b`) flags them.

---

## How to Keep This File Current

After any task that changes the architecture, file structure, or domain rules:

1. Update the **Repository Layout** tree if files were added/removed.
2. Update the **Core Data Types** section if `Activity`, `TagMetadata`, or `FeedbackAction` changed.
3. Update the **Weight System** constants table if any constant changed.
4. Update the **Keyboard Shortcuts** table if hotkeys changed.
5. Update the **UI Flow** and **State & Data Flow** diagrams if the data or render path changed.
6. Update the **CSS Patterns** table if new major classes were added.
7. Update the **Common Task Types** map if you discovered a new pattern.
8. Update **Invariants** if a new rule was established or an old one changed.
9. Add any new pre-existing build errors to that section if you found them.

Also update `docs/product-overview.md` if a user-visible feature was added or changed.
Create a new `docs/feature-<name>.md` for any significant new feature (copy `feature-super-fun.md`
as a template).
