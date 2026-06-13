# Activity Wheel

A local-first weighted activity wheel. Spin it to decide what to do next; the
wheel learns what you actually enjoy from your accept / skip / reject feedback,
and forgets old preferences slowly so things you stopped liking can resurface.

Everything lives in your browser via IndexedDB. There is no backend, no
account, and no telemetry.

## Quick start

Requires Node 20+.

```bash
npm install
npm run dev      # http://localhost:5173
```

Other scripts:

```bash
npm run build       # type-check, then bundle into ./dist
npm run preview     # serve the production build locally
npm run typecheck   # strict TS, no emit
npm run lint        # eslint
```

## How it works

### Data persistence

The app stores a single object store, `activities`, in an IndexedDB database
named `activity-wheel`. The database lives entirely in the browser profile
that opens the app — clearing site data wipes it; switching browsers or
devices means a fresh slate (use **Backup & restore** to migrate).

The shape of a stored activity is intentionally small:

```ts
interface Activity {
  id: string;
  name: string;
  weight: number;       // baseline at the moment of `lastDecayAt`
  createdAt: number;    // unix ms
  lastDecayAt: number;  // unix ms — used for lazy time-decay
  acceptCount: number;
  rejectCount: number;
  streak: number;       // signed: + for accepts, − for rejects
}
```

Two derived numbers are computed at runtime, never stored:

- **Decayed weight** — the stored weight pulled toward DEFAULT (100) at 2% per
  day since `lastDecayAt`. This is reconciled on every read or write.
- **Recency boost** — a flat +30 added on top, fading linearly to zero over
  the activity's first 7 days, so newly-added items get sampled.

The number actually used for spinning is `effective = decayed + recency`,
clamped to `≥ 20`.

### Weight system

The values were chosen so the system **stabilises but never locks in**:

| Constant            | Value | Why                                                                |
| ------------------- | ----- | ------------------------------------------------------------------ |
| `WEIGHT_DEFAULT`    | 100   | Gravity well; decay pulls everything here, new items start here.    |
| `WEIGHT_MIN`        | 20    | Never zero — disliked items still have a redemption shot.           |
| `WEIGHT_WARNING`    | 30    | Below this, the row shows a ⚠ nudge ("delete me?").                 |
| `ACCEPT_STEP`       | 7     | Base bump on accept.                                                |
| `REJECT_STEP`       | 5     | Base drop on reject (a touch smaller — positive feedback wins ties).|
| `MOMENTUM_PER_STREAK` | +0.25× | Each consecutive same-direction click multiplies harder…           |
| `MOMENTUM_MAX`      | 2.0×  | …up to a 2× cap, so streaks matter but don't explode.               |
| `DIMINISHING`       | x^0.7 (floor 0.1) | Steps shrink near the bounds so the wheel never plateaus hard. |
| `DAILY_DECAY`       | 2 % / day toward DEFAULT | Half-life ~34 days; old preferences fade.            |
| `RECENCY_BOOST`     | +30 over 7 days | Slight bump for new activities so they get tried.            |
| `DOMINANCE_GUARD`   | > 60 % share | Further accept-driven growth is muted to 1/10 strength.          |

In practice this means:

- Accept once: weight +~7.
- Accept three in a row at default weight: ~+7 then +7×1.25 then +7×1.5 ≈ +24
  total — meaningful but not runaway.
- Reject something already near the floor: only ~+0.5 step, so deleting is the
  real "remove this" gesture.
- Don't open the app for a month: every weight has crept ~half-way back to 100,
  giving rejected activities a chance again.

### Selection

Standard cumulative-weight random pick:

1. For each activity in the current session pool, compute its effective weight.
2. Build the cumulative array in **integer-scaled** space (× 10000) to avoid
   floating-point drift on large pools.
3. Binary-search the cumulative array for `r = floor(rng() × total)`.

The RNG is `Math.random` by default. For reproducible spins, paste a string
seed into the Debug panel — it hashes (FNV-1a) into Mulberry32.

The winning activity is computed **before** the wheel animates. The animation
just rotates the canvas to a precomputed final angle (six full revolutions +
the offset that puts the winning slice center under the pointer), with an
ease-out cubic curve over 4.2 seconds.

### Sessions

A *session* is a single round of "spin until I find something". When you spin,
the chosen activity is excluded from the rest of the session — regardless of
whether you accept, skip, or reject — so consecutive spins always show
different options. **Reset session** puts everything back; reloading the page
resets too. Accepting does **not** auto-reset, so you can change your mind.

### Backup & restore

`Backup & restore` exports the full database to a JSON file you can keep on
disk, email to yourself, or import into a different browser. Imports are
explicit (warns first), and the library refuses to import a file that mentions
stores it doesn't know about, so a stale backup can't silently destroy data.

## Project layout

```
src/
├── App.tsx                    # composition only
├── main.tsx
├── index.css
├── App.css
├── domain-logic/
│   ├── constants.ts           # weight tunables — change them here, nowhere else
│   ├── types.ts               # Activity, FeedbackAction, SortKey
│   ├── weights.ts             # decay, momentum, dim. returns, applyFeedback
│   ├── selection.ts           # cumulative weighted pick
│   └── rng.ts                 # mulberry32 seeded RNG
├── lib/
│   └── indexeddb/             # 👇 reusable; copy this folder into other apps
│       ├── index.ts
│       ├── types.ts
│       ├── database.ts        # open(), exportAll(), importAll()
│       └── store.ts           # TypedStore<T> with get/getAll/put/putMany/...
├── services/
│   ├── schema.ts              # the app's DB config + migrations
│   └── activityService.ts     # thin wrapper that uses lib/indexeddb
├── hooks/
│   ├── useActivities.ts       # CRUD + state, talks to activityService
│   ├── useSession.ts          # in-memory exclusion set
│   ├── useWheel.ts            # spin orchestration (pick → animate)
│   └── useDebug.ts            # localStorage-backed UI toggles
├── components/
│   ├── Wheel.tsx              # canvas wheel; rotates via rAF + transform
│   ├── WheelView.tsx          # wheel + spin button + post-spin actions
│   ├── PostSpinActions.tsx
│   ├── AddActivity.tsx
│   ├── ActivityList.tsx
│   ├── ActivityRow.tsx        # inline edit, manual ±, delete
│   ├── DebugPanel.tsx
│   └── BackupControls.tsx
├── utils/
│   ├── id.ts
│   └── format.ts
└── dev/
    └── weightSim.ts           # `import('./dev/weightSim.ts').runSim()` in console
```

## Reusing the IndexedDB module

`src/lib/indexeddb/` knows nothing about activities. Drop the folder into any
TypeScript app:

```ts
import { Database } from './lib/indexeddb';
import type { DBConfig, Migration } from './lib/indexeddb';

const v1: Migration = {
  toVersion: 1,
  apply: ({ db }) => {
    db.createObjectStore('notes', { keyPath: 'id' });
  },
};

const config: DBConfig = {
  name: 'my-app',
  version: 1,
  migrations: [v1],
  expectedStores: [{ name: 'notes', keyPath: 'id' }],
};

const db = new Database(config);
const notes = db.store<{ id: string; body: string }>('notes');

await notes.put({ id: 'n1', body: 'hello' });
const all = await notes.getAll();
```

Migrations are **ordered, additive, and explicit**. The library will not
silently drop or recreate stores: if a migration declares a `toVersion` higher
than the on-disk version, it runs; otherwise it doesn't. Opening fails fast if
the resulting schema doesn't include every store listed in `expectedStores`.

For backups: `db.exportAll()` returns a `DBBackup` object, and
`db.importAll(backup)` validates that every store named in the backup exists
in the current schema before clearing-and-rewriting them.

## Debug mode

Open the **Debug** disclosure to toggle:

- Show weights — adds an effective-weight pill to each activity row.
- Show probabilities — adds a current-spin probability pill.
- RNG seed — when set, every spin uses Mulberry32 seeded by your string + the
  current pool size and a tick counter, so identical state + identical seed =
  identical sequence.

You can also poke at the weight model from the dev console:

```js
const sim = await import('/src/dev/weightSim.ts');
sim.runSim();              // 8 activities, 30 days, 4 spins/day, default profile
sim.runSim({ days: 90 });  // overrides
```

## Decisions worth flagging

A few choices the spec left to me, recorded here for posterity:

- **Stored vs effective weight.** The stored value is the baseline; decay and
  recency are added at runtime. This means importing a backup from yesterday
  yields the same effective behavior as if no time had passed in the DB.
- **Decay is lazy, not scheduled.** No background timers; the math is applied
  whenever a value is read or written. This keeps the data model simple and
  works correctly even if you don't open the app for months.
- **Skip excludes from the session.** The user said "no weight change but still
  not letting the option be spun again". Implemented exactly that.
- **Refresh = session reset, by design.** Session state is only ever in
  memory.
- **Streaks track the *signed* direction.** A reject right after an accept
  resets streak to −1 (not 0); this matched intent of "constantly accepted
  vs constantly rejected".
- **No manual numeric weight editing.** The list shows a +, −, and × per row.
  ⚠ appears for any activity whose effective weight is ≤ 30.
- **Anti-dominance is a soft brake.** The structural cap (MAX = 300, MIN = 20)
  already prevents *runaway* selection share with reasonable pool sizes; the
  60% guard is belt-and-braces for tiny pools.
- **Wheel size is fixed at 420 px.** Canvas + rAF + a single CSS transform
  means rendering ~200 slices stays cheap. The label is truncated and font is
  scaled down as the slice count grows.
- **Selection is computed first, animation second.** Required to avoid
  visible-vs-actual mismatches and to land precisely on the chosen slice.

## Tested manually with

- Adding/removing/renaming activities (incl. inline edit / Esc cancel).
- Accept / Reject / Skip from the wheel.
- Manual + / − / × from the list.
- Spin sessions that exhaust the pool, then Reset.
- 200-activity pool: still 60 fps, still visually identifiable.
- Backup → "Clear all" → Restore: identical state.
- Hard reload mid-spin: graceful fresh session.
