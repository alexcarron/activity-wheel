# Activity Wheel — Product Overview

**Project:** Weighted Activity Wheel  
**Tech Stack:** Vite + React + TypeScript + IndexedDB (fully client-side, no backend)

> **For implementation details** (file map, type definitions, weight constants, invariants),
> see [`claude-project-context.md`](./claude-project-context.md).  
> **For per-feature deep dives**, see [`feature-super-fun.md`](./feature-super-fun.md)
> and [`feature-tagging.md`](./feature-tagging.md).

---

## 1. Product Vision

The Activity Wheel solves **decision paralysis when choosing what to do for fun.**

Instead of agonizing over options, users spin a wheel to get a suggestion. But this isn't a
random dice roll — the wheel is *intelligent*. It learns which activities the user genuinely
enjoys and increases their likelihood of appearing, while activities the user rejects gradually
fade in priority. The system is conversational (no manual weight numbers), transparent in how
it works, and designed to stabilize over time rather than lock into repetitive picks.

### Core Promise

- **Fast decision-making:** Spin once, get a suggestion.
- **Adaptive:** Learns what you enjoy without requiring explicit numeric input.
- **Fair:** New activities get a fair chance; old favorites don't dominate forever.
- **Recoverable:** Even rejected activities can make a comeback if your mood changes.

---

## 2. User Workflows

### Daily Usage Scenario

```
User opens app → Sees wheel with list of activities

1. "I feel like doing something fun but don't know what"
   → Click SPIN button
   → Wheel lands on: "Play Deadlock"
   → Think: "Nah, not in the mood"
   → Click REJECT
   → Weight decreases; activity removed from current session

2. Click SPIN again (Deadlock no longer available)
   → Wheel lands on: "Play Celeste"
   → Think: "Could work, but let me see if there's something better"
   → Click SKIP
   → Weight unchanged; activity removed from current session

3. Click SPIN again
   → Wheel lands on: "Play Factorio"
   → Think: "Yes! That sounds great"
   → Plays Factorio, comes back
   → Click ACCEPT → moderate weight increase
   OR
   → Click ★ SUPER FUN! → large weight increase (~3.5× Accept)

4. [Later] Wants to add new activity
   → Types "Watch Anime" in add field → clicks ADD
   → Appears immediately with neutral weight + 7-day recency boost

5. [With many activities] Wants only gaming options tonight
   → Clicks "Gaming" tag pill in filter bar
   → Wheel now only spins gaming activities
   → Filter cleared automatically on next page load
```

### Adding & Managing Activities

```
User navigates to "Activities" section
- See list of all activities sorted by name / date added / weight
- Inline-edit any activity name (click name)
- Search activities by name
- Sort by name / date added / most enjoyed
- Delete activity (with confirmation)
- Manually adjust weight (★ / + / −  buttons per row)
- Add tags to activities (pill UI in each row)
- Warning flag shown if weight is dangerously low
```

### Tag Filtering

```
Tag filter bar lives between the wheel and the activity list.

- Click a tag pill → wheel + list restricted to that tag
- Click a second tag → both active (OR by default: either tag matches)
- Toggle AND/OR button → require all active tags
- Click "Untagged" → see only activities with no tags (cleanup tool)
- "All" pill always resets the filter
- Filter does NOT persist across page loads (by design)
- Digit keys 1–9 activate the 9 most-popular tags
```

### Resetting a Session

```
At any time:
- Click RESET SESSION → clears current spin exclusions, full pool restored
- Page refresh → automatic session reset
- After accepting, user can spin again (remaining pool) or reset manually
```

---

## 3. Core Features

### 3.1 Spinning & Selection

**What happens when user spins:**

1. Cumulative weighted random selection picks the winner *before* the animation starts.
2. Wheel animates smoothly with deceleration curve; lands exactly on the selected slice.
3. Selected activity is shown with action buttons.

**Post-spin feedback (determines weight change):**

| Button | Hotkey | Effect |
|--------|--------|--------|
| ★ Super Fun! | `F` | Large weight boost (~3.5× Accept); bypasses dominance guard |
| Accept | `Y` | Moderate weight increase |
| Skip | `S` | No weight change; activity excluded from session |
| Reject | `N` | Weight decrease; activity excluded from session |

**Post-spin navigation:**

| Button | Hotkey | Effect |
|--------|--------|--------|
| Spin again | `Space` | Spin from remaining session pool |
| Reset session | — | Restore full pool, clear exclusions |

**Key behavior:**
- Accepting does NOT auto-reset; user decides when to reset.
- Activities cannot be spun twice in the same session.
- If the landed activity has no tags, a subtle "Add a tag?" prompt appears.

### 3.2 Weight System Philosophy

The weight system is the heart of the app. Design goals:

- **Conversational:** Users never enter numbers — only press feedback buttons.
- **Stable:** Converges over time; doesn't lock into the same pick forever.
- **Fair:** Rejects fade but remain possible (redemption arc).
- **Balanced:** New activities are viable but not dominant.
- **Meaningful at scale:** With 100+ activities, feedback should still noticeably shift probabilities over time.

**Short-term reactivity:**
- Boost/Accept → weight increase; Reject → decrease; Skip → no change.
- Changes get stronger with repetition (momentum multiplier up to 2×).

**Long-term adaptation:**
- Repeated accepts → increasingly stronger gains (diminishing returns prevent monopoly).
- New activities get a temporary recency boost that fades linearly over 7 days.

**Bounds and stability:**
- Minimum floor (~20): if weight hits this, a warning flag appears (candidate for deletion).
- Maximum ceiling (300): diminishing returns prevent any one activity from dominating.
- No activity can ever reach weight = 0 — everything remains spinnable.

For exact constants and math, see [`claude-project-context.md`](./claude-project-context.md#weight-system).

### 3.3 Activity List & Management

- **List view** with all activities (or tag-filtered subset when a filter is active).
- **Inline editing** of activity names (click to edit).
- **Search bar** to filter by name.
- **Sort options:** name, date added, most enjoyed.
- **Delete button** (trash icon) with confirmation per activity.
- **Manual weight controls:** ★ Super Fun! | + Increase | − Decrease.
- **Tag pills** on each row: show tags, ＋ to add (combobox with autocomplete), ✕ to remove, right-click to set color. Tag count badge shown subtly on each pill (fades to ✕ on row hover).
- **Visual indicators:** warning flag for low weight; optional weight/probability debug view.
- **Compact mode:** Toggle button (dense-lines icon) in the list controls. Collapses each row to a single line showing name + weight (if debug) + all four action buttons. Removes the list height cap so the full activity list can fill the entire viewport — designed for scanning and acting on many activities at once without scrolling.

### 3.4 Tagging

Activities can be labelled with any number of freeform text tags (e.g. "Gaming", "PC", "TV Show").
Tags drive the filter bar. For full tagging spec see [`feature-tagging.md`](./feature-tagging.md).

Key facts:
- Tags are stored as `string[]` on the Activity.
- Tag colors are global per tag name (stored in a separate `tag-metadata` IDB store).
- Every tag name ever used is remembered for autocomplete.
- The active tag filter is **session-only** — it never persists across page loads.

### 3.5 Wheel Animation

- Smooth 60fps spinning animation via `requestAnimationFrame`.
- Natural deceleration (ease-out curve).
- Supports ~200 activities without lag.
- Selection is computed before animation starts — animation is purely visual.

### 3.6 Session Management

A "session" is the current spin pool.

- **Start:** All activities (or filtered subset) available.
- **Each spin:** Selected activity is excluded for the rest of the session.
- **Reset session:** Restores full pool.
- **Page refresh:** Automatic session reset.
- **With tag filter active:** Pool = filtered activities ∩ not yet spun this session.

### 3.7 Data Persistence & Backup

**IndexedDB Storage:**
- All activities, weights, and tag metadata persisted locally.
- No backend required; fully client-side.
- Automatic save on every action.

**Backup/Import:**
- Export current data as JSON.
- Import JSON to restore state.
- Useful for switching devices, recovering data, sharing setups.

**Current export format (simplified):**
```json
{
  "name": "activity-wheel",
  "version": 2,
  "exportedAt": 1700000000000,
  "stores": {
    "activities": [
      {
        "id": "uuid-1",
        "name": "Play Factorio",
        "weight": 115,
        "createdAt": 1700000000000,
        "acceptCount": 5,
        "rejectCount": 1,
        "streak": 2,
        "tags": ["Gaming", "PC"]
      }
    ],
    "tag-metadata": [
      { "name": "Gaming", "color": "#3b82f6" },
      { "name": "PC" }
    ]
  }
}
```

---

## 4. UI Structure

### Layout (top to bottom)

1. **Header** — title + subtitle
2. **Wheel Canvas** — visual wheel with slice labels; pointer at top
3. **Post-Spin Panel** — appears after landing; shows activity name + feedback buttons
4. **Tag Filter Bar** — pill strip between wheel and list; "All" | "Untagged" | tag pills
5. **Activities Panel** — heading + AddActivity input + ActivityList (search, sort, rows)
6. **Debug Panel** (collapsed by default) — weights, probabilities, RNG seed
7. **Backup Controls** (collapsed by default) — export/import/clear

### Styling

- Plain CSS (`App.css` + `index.css`); no CSS framework.
- Theme via CSS custom properties in `index.css`; full dark-mode support via `@media (prefers-color-scheme: dark)`.
- Responsive but optimized for desktop (primary use case).

---

## 5. Selection Algorithm

### Cumulative Weighted Random Selection

```
Activities: [A, B, C, D]
Weights:    [50, 100, 75, 150]
Cumulative: [50, 150, 225, 375]

Random value 0–375: say 180
  → Falls in B's range (50–150)
  → Selects B

Probability:
  A: 50/375 = 13%   B: 100/375 = 27%
  C: 75/375 = 20%   D: 150/375 = 40%
```

- O(n) selection time — fast for ~200 items.
- Deterministic when seeded (useful for debugging via the RNG seed input).
- Uses *effective weight* (stored weight + recency boost) for selection, not raw stored weight.

---

## 6. Edge Cases

| Scenario | Behavior |
|----------|----------|
| Zero activities | Empty-state message; invite user to add first activity |
| One activity | Spins deterministically |
| All activities spun in session | Empty-state; offer Reset Session |
| Tag filter active + no matches | "No activities match this filter" + Clear Filter button |
| Tag filter active + all matches spun | Offers both Reset Session and Clear Filter |
| Activity deleted mid-session | Safely removed from pool; no crash |
| Weight at minimum | Warning flag shown on row |
| IndexedDB unavailable | Error state with explanation |

---

## 7. Performance Targets

| Metric | Target |
|--------|--------|
| Wheel animation | 60fps with 200 activities |
| Feedback response | < 50ms perceived |
| Startup with full list | < 1 second |
| Search/sort 200 activities | No noticeable lag |

Primary device: desktop/tablet. Typical usage: 10–50 activities, 5–20 spins per session.

---

## 8. Success Metrics

### User Success

- User opens app unsure what to do → gets suggestion → does the activity.
- Over weeks, the wheel increasingly surfaces genuinely enjoyed activities.
- Disliked activities fade without the user having to manually manage weights.
- New activities are discovered naturally without dominating.

### System Success

- No weight runaway (single activity > 60% probability is guarded against).
- No permanent stale bias (feedback always has a meaningful effect).
- Selection unbiased relative to weights.
- Smooth performance at 200 activities.
- Schema migrations never destroy existing data.
