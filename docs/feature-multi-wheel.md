# Feature: Multi-Wheel

**Status:** Shipped (IDB schema v3)

---

## Problem

Users wanted to maintain separate sets of activities for different contexts (solo vs. with friends, work vs. personal, etc.). The only workaround was to Export JSON → Clear All → Import JSON — too many steps and required saving files.

---

## Solution: Named Wheels

A "wheel" is a named namespace for a set of activities + tags. Users can switch between wheels instantly via a tab bar at the top of the app. Every wheel is independent: its own activities, weights, tag metadata, and tag colors.

---

## User-Visible Behaviour

### Tab bar
- Sits at the top of the page, above the app header.
- Each wheel is a tab with its name. The active tab has an accent border.
- Double-click a tab name → inline rename (press Enter or blur to confirm, Escape to cancel).
- Hover a tab → reveals a × delete button (only when 2+ wheels exist).
- Clicking a tab switches the active wheel instantly.
- The + button opens the inline create form.

### Inline create form
Opens below the tab bar when + is clicked:
- **Name** — text input (required)
- **Copy from** — dropdown (Blank wheel / any existing wheel name)
- **Reset activity weights to default** — checkbox, only shown when copying from an existing wheel; resets all copied activities to `WEIGHT_DEFAULT` but preserves tag assignments
- **Create** / **Cancel** buttons; Enter submits, Escape cancels

### Keyboard navigation
- `[` → switch to the previous wheel (wraps)
- `]` → switch to the next wheel (wraps)
- Only active when 2+ wheels exist.

### On wheel switch
Three things reset automatically:
1. **Session pool** — the spin session clears (new `useSession` because `filteredActivities` is a new reference)
2. **Tag filter** — resets to "All" (no active tags, no untagged-only, mode back to OR)
3. **Wheel canvas** — redraws with the new wheel's activities

### Backup & restore (wheel-scoped)
- **Export JSON** downloads the current wheel's activities and tag metadata only (format: `wheel-backup-v1`).
- **Import JSON** replaces all activities in the current wheel with those in the file.
- **Clear all** deletes all activities in the current wheel only (other wheels unaffected).

---

## Data Model

### `Wheel` (new)
```typescript
interface Wheel {
  id: string;        // UUID v4 or 'default'
  name: string;
  createdAt: number;
  lastUsedAt: number;
}
```
Stored in the `wheels` IDB store (`keyPath: 'id'`).

### `Activity.wheelId` (new field)
Every activity now has a `wheelId`. Old records get `wheelId = 'default'` via `normalizeActivity()` on load.

### `TagMetadata` (changed key structure)
The IDB key changed from `name` (tag display name) to `key` (`"${wheelId}:${tagName}"`):
```typescript
interface TagMetadata {
  key: string;     // IDB key: "${wheelId}:${tagName}"
  wheelId: string;
  name: string;    // display name — still used everywhere in the UI
  color?: string;
}
```

### Active wheel
Stored in `localStorage` under key `activeWheelId`. Written by `persistActiveWheelId()` in `wheel-service.ts`. Changing it triggers a re-render in `useWheels`, which propagates to `useActivities` and `useTagFilter` via their `wheelId` prop.

---

## Architecture

### Services
| File | Responsibility |
|------|---------------|
| `wheel-service.ts` | Wheel CRUD: `listWheels`, `createWheel`, `renameWheel`, `deleteWheel`, `copyWheel`, `touchWheel`. Also `getStoredActiveWheelId` / `persistActiveWheelId` for localStorage. |
| `activity-service.ts` | All functions now take/use `wheelId`. `listActivities(wheelId)` uses the `wheelId` IDB index for efficient queries. `addActivity(name, wheelId)` stores the ID. |
| `tag-service.ts` | All functions take `wheelId`. IDB key = `"${wheelId}:${name}"`. Functions: `listTagMetadata(wheelId)`, `setTagColor(wheelId, name, color)`, `ensureTagsExist(wheelId, names)`, `clearWheelTagMetadata(wheelId)`, `copyTagMetadata(fromWheelId, toWheelId)`. |

### Hooks
| File | Change |
|------|--------|
| `useWheels.ts` | New hook. Loads wheels from IDB on mount, manages `activeWheelId`, provides `switchWheel` / `createWheel` / `copyWheel` / `renameWheel` / `deleteWheel`. Also wires `[` and `]` hotkeys via `useHotkey`. |
| `useActivities.ts` | Now accepts `wheelId: string`. Re-loads activities via `useEffect` on `wheelId` change. |
| `useTagFilter.ts` | Now accepts `wheelId: string`. `useEffect` on `wheelId` reloads metadata AND resets all filter state (activeTags, untaggedOnly, filterMode). |

### Schema: v3 migration
Runs once when the user first opens the updated app:
1. Adds `wheelId` index to the `activities` store.
2. Cursor-iterates existing activities and sets `wheelId = 'default'` on any without it.
3. Reads existing `tag-metadata` records (preserving colors), deletes the old store (was `keyPath: 'name'`), recreates with `keyPath: 'key'`, writes migrated records as `"default:${tagName}"`.
4. Creates the `wheels` store and inserts `{ id: 'default', name: 'My Wheel', ... }`.

---

## Edge Cases

| Scenario | Behaviour |
|----------|-----------|
| Stored `activeWheelId` no longer exists (deleted in another tab) | `useWheels` falls back to the first available wheel on load |
| Copying a wheel with activities whose names collide | `copyWheel` uses the activity's `name` to match source stats — duplicate names in the source wheel may get wrong stats; wheel names should be unique within a wheel |
| Deleting the only wheel | `useWheels.deleteWheel()` throws; the × button is hidden when only 1 wheel exists |
| Importing a legacy full-DB backup | `importWheelJson` detects the old format (no `format` field) and falls back to the legacy `importBackup()` path |
| Tag colors after migration | Existing tag colors are preserved. Colors are NOT shared between wheels — each wheel has its own color registry. |

---

## Invariants

- The active wheel ID is the only piece of data that lives in localStorage. Everything else is in IDB.
- `TagMetadata.name` is always the display name. `TagMetadata.key` is the IDB composite key.
- `wheels.length >= 1` always. `deleteWheel` refuses to delete the last wheel.
- `copyWheel` awaits before `switchWheel` — the new wheel's activities are fully written before we navigate to it.
