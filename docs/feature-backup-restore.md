# Feature: Backup & Restore

**Status:** Shipped (multi-wheel, format `full-backup-v2`)

---

## Overview

The Backup & Restore panel (inside the `<details>` accordion at the bottom of the app) lets users export all their data to a portable JSON file and restore it on any browser. It is the only supported path for migrating data between browsers, profiles, or devices.

---

## User-Visible Behaviour

### Export JSON
Downloads a `.json` file named `activity-wheel-YYYY-MM-DD.json`. The file contains **every wheel** in the database, including:
- Wheel metadata (`id`, `name`, `createdAt`, `lastUsedAt`)
- All activities for each wheel (with all weight/feedback stats)
- All tag metadata for each wheel (including tag colors)

### Import JSON
Opens a file picker. On file selection:
1. Shows a confirmation dialog warning that **all existing wheels will be deleted**.
2. Validates the file format. Unsupported formats show a descriptive error.
3. Deletes all existing wheels, activities, and tags from IndexedDB.
4. Writes the imported wheels, activities, and tags.
5. Switches the active wheel to the first wheel in the backup.

### Clear wheel
Removes all activities and tag metadata from the **currently active wheel** only. The wheel itself is preserved; other wheels are unaffected. Asks for confirmation.

### Clear all wheels
Deletes **all** wheels and all their data, then creates a single blank "My Wheel" and switches to it. Asks for confirmation.

---

## Backup File Format (`full-backup-v2`)

```json
{
  "format": "full-backup-v2",
  "exportedAt": 1717200000000,
  "wheels": [
    {
      "wheel": {
        "id": "abc-123",
        "name": "My Wheel",
        "createdAt": 1710000000000,
        "lastUsedAt": 1717199000000
      },
      "activities": [
        {
          "id": "xyz-456",
          "wheelId": "abc-123",
          "name": "Read a book",
          "weight": 100,
          "createdAt": 1710000000000,
          "acceptCount": 3,
          "rejectCount": 1,
          "streak": 1,
          "tags": ["solo", "calm"]
        }
      ],
      "tags": [
        { "key": "abc-123:solo", "wheelId": "abc-123", "name": "solo", "color": "#7c3aed" }
      ]
    }
  ]
}
```

---

## Format Compatibility

| Format | Produced by | Handled by import |
|--------|-------------|-------------------|
| `full-backup-v2` | Current export | Full multi-wheel restore |
| Raw IDB dump (`{ name, stores }`) | Legacy full-DB export | Restored via `db.importAll` (backwards compat) |
| `wheel-backup-v1` | Old single-wheel export | Rejected with a helpful error message |

---

## Architecture

### Service layer (`src/services/wheel-service.ts`)

| Function | Description |
|----------|-------------|
| `exportFullBackup()` | Queries all wheels + activities + tags; returns JSON string |
| `importFullBackup(json)` | Validates, wipes DB, writes backup; returns first wheel ID |
| `resetToBlankWheel()` | Deletes all wheels, creates a fresh "My Wheel"; returns the new wheel |

Both `importFullBackup` and `resetToBlankWheel` call `deleteWheel()` at the service level, **bypassing** the "cannot delete last wheel" guard that lives in `useWheels`. This is intentional — the guard is a UI invariant, not a data invariant.

### Hook (`src/hooks/useWheels.ts`)

`reloadWheels()` re-fetches the wheel list from IDB and syncs React state. Used after `importFullBackup` and `resetToBlankWheel` to bring the tab bar up to date. Falls back the active wheel ID if the previously-active wheel no longer exists.

### Component (`src/components/BackupControls.tsx`)

Props:
```typescript
interface Props {
  exportJson(): Promise<string>;
  importJson(json: string): Promise<void>;
  clearWheel(): Promise<void>;
  clearAllWheels(): Promise<void>;
}
```

All destructive operations require `window.confirm` before proceeding.

---

## Invariants

- After `importFullBackup`, at least 1 wheel always exists (a blank fallback is created if the backup has 0 wheels).
- Wheel IDs from the backup are preserved exactly — activities and tag keys reference the original wheel IDs.
- `activeWheelId` in localStorage is updated to the first imported wheel's ID.
- Tag metadata `key` field uses the format `"${wheelId}:${tagName}"` and is preserved verbatim from the backup.
