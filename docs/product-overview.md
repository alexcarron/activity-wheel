# Activity Wheel: Product Overview

This is the deeper companion to the [README](../README.md). The README tells you how to run the app and gives the short version of how it behaves. This doc walks through every feature in more detail, for anyone who wants to understand exactly what the app does before touching the code.

## What it's for

You've got a list of things you could do and no idea which one you're in the mood for. You spin the wheel, it picks something, and you say whether that was a good idea or not. Over time the wheel gets better at guessing, without you ever typing in a number.

## Spinning and selection

Pressing **Spin the wheel** (or `Space`) picks the activity immediately using a cumulative weighted random selection over this session's remaining activities, then plays a deceleration animation that lands the canvas on that precomputed slice. The animation is purely visual: nothing about the outcome depends on how the wheel looks while it spins.

Slices are rendered with the highest probability first starting at the top, sized by the estimated weight each activity has.

Once it lands, you get four feedback buttons and two navigation buttons:

- **★ Love It!** (`L`): awards +2 preference points.
- **Accept** (`Y`): awards +1 preference point.
- **Skip** (`S`): awards no points at all, but the activity is still removed from this session since you've seen it.
- **✕ Hate It!** (`H`): takes 2 preference points away, mirroring Love It in the other direction.
- **Reject** (`N`): takes 1 preference point away.
- **Spin again** (`Space`): spins from whatever activities are left this session.
- **Reset session**: makes every excluded activity available again.

Whatever you spin is excluded from the rest of the session no matter which button you press, including Skip, so the next spin always shows you something new. Accepting doesn't auto-reset the session, so you're free to keep spinning or stop whenever you want.

If the activity you land on has no tags yet, a small "No tags yet. Add a tag?" prompt appears so you can tag it on the spot instead of hunting for it in the list later. You can also rename the winning activity directly from this panel by clicking its name.

## The preference system

Every activity has a **preference score**, the app's guess at how much you like it, and a **confidence in preference score**, how sure it is about that guess. A new activity starts at a neutral preference score that the app is barely confident in.

Your feedback awards **preference points**. Every reaction moves the preference score toward your feedback response and increases the confidence.

How much a single reaction changes the preference score depends on how confident the app is in it. While it it is very unconfident, your first few reactions change the preference score a lot. Once you have given feedback on the same activity again and again, more feedback in the same direction barely changes it.

Picking an activity is not based on just the preference score. For each spin, every activity comes up with a **possible preference score**, its preference score plus an uncertainty of its score. An activity with high preference score confidence comes up with a possible score close to its real preference score. An activity with low preference score confidence comes up with possible scores all over the place, so ocassionally it's score is high giving it a higher opportunity to be picked. Those possible preference scores are what determine the real activity weights/probabilities. How much a higher preference score leads to a higher weight on the actual wheel is the **preference weight strength**.

If you had activities from before this system existed, their old accept/reject history was replayed into a starting preference score and confidence, weighted less. This automatically ran once the first time you opened the app after the update.

## Wheels

You're not limited to one list of activities. The tab bar above the wheel lets you keep separate wheels for separate contexts, like a "Games" wheel and a "Weekend" wheel, each with its own activities, tags, and weights.

- Click `+` to create a new wheel, either blank or copied from an existing one. Copying gives you the option to carry over the source wheel's preferences or reset everything back to neutral.
- Double-click a tab to rename it.
- Hover a tab to reveal its `×` delete button. You can't delete your last wheel: there always has to be at least one.
- `[` and `]` cycle between wheels without touching the mouse.
- Click the 📌 button above the wheel to pin the wheel header in place while you scroll through a long activity list.

## Tag filtering

The pill bar between the wheel and the activity list lets you narrow the spinnable activities down to a filtered set of activities.

- Click a tag pill to filter to it. Click a second tag and, by default, activities matching *either* tag qualify (OR). An AND/OR toggle appears once you've got two or more tags active, letting you require all of them instead.
- Click **Untagged** to see only activities with no tags at all, useful for finding things you haven't gotten around to organizing.
- Click **All** to clear the filter.
- Typing in the search box narrows the pill list itself, it doesn't touch the wheel directly.
- Digit keys `1`-`9` are bound to the nine most-used tags, sorted by how many activities carry them.

The filter is intentionally session-only. It resets on page load and whenever you switch wheels, so you never get stuck wondering why the wheel seems to be ignoring half your activities.

## Managing activities

The activity list below the wheel shows every activity (or the tag-filtered subset, if a filter's active), with search and three sort options: date added, name, and most enjoyed (by preference score).

Each row supports:

- Click the name to rename it inline.
- The same four feedback buttons as the post-spin panel (★ / + / − / ✕), so you can nudge a preference without spinning for it.
- Tags: add via the `+` combobox (autocompletes from every tag you've ever used, or lets you create a new one), remove with the `×` on hover, right-click a tag to open a small popover where you can rename it (rejecting a name that collides with another tag), change its color from a preset palette or a custom picker, or delete it entirely (with a confirmation prompt, since it strips the tag from every activity that has it).
- Delete, with a confirmation prompt.

Click-and-drag across the circular selector on the left of multiple rows to multi-select them, which opens a batch action bar for adding a tag to everything selected at once.

The compact-view toggle (the dense-lines icon next to sort) collapses each row to a single line and removes the list's height cap, so it can fill the whole viewport. It's meant for scanning and acting on a large activity list quickly rather than admiring one row at a time.

## Signing in (optional, cloud sync)

By default your data lives entirely in this browser's IndexedDB and the app never makes a network call. Signing in with Google switches you over to a private Supabase-backed account instead, so your wheels follow you across browsers and devices. Every table is scoped to your account via Postgres row-level security, not by anything the frontend enforces.

The first time you sign in, an **Import local wheels** button appears that copies whatever's currently in this browser's IndexedDB into your new account, one time only, and never touches the local copy. It refuses to run again once your account already has a wheel with activities in it, so you can't accidentally double-import.

You can ignore all of this and just use the app signed out forever. Nothing about local-only behavior changes based on whether cloud sync is configured.

For the full design (schema, RLS policies, the deploy story), see [`user-authentication-plan.md`](./user-authentication-plan.md).

## Shared wheels

A shared wheel is a password-protected wheel that multiple people can view and edit at once, updating live for everyone looking at it. Right now there's exactly one for testing.

Visiting the app with `?sharedWheelId=[ID-HERE]` (with the id of test wheel) in the URL shows a password screen instead of the normal wheel UI. Enter the password once and you get permanent access from then on, on that same browser (or that same signed-in account, if you're signed in with Google) without needing the password again, even without the link. Behind the scenes, unlocking it registers you as a member of that wheel in the backend, so access is enforced by the database, not by anything the frontend remembers.

If `?sharedWheelId=` names a wheel that doesn't exist, you're never shown the password screen. Instead the app loads normally, the bad link is cleaned out of the address bar, and a brief message lets you know no shared wheel exists with that link.

Once unlocked, the shared wheel shows up as an extra tab next to your own wheels, marked with a small multi-user icon. It can't be renamed or deleted from that tab, since it isn't yours to rename or delete.

Because other people can be spinning, adding, or editing activities on the same shared wheel at the same time, changes show up live without needing to refresh. If someone else's change lands on the exact activity you're mid-edit-name on, or the activity you just spun and are looking at the result for, you'll see a brief "Wheel updated by another user" notice so the sudden change doesn't look like a bug. Any other change to the wheel just updates quietly. If two people change the same thing at the same time, whichever write reaches the database last wins.

While a shared wheel is the active tab, Backup & restore only offers Export JSON. Import, Clear wheel, and Clear all wheels are hidden, since it isn't just your data to overwrite or wipe.

## Backup and restore

Open the **Backup & restore** panel at the bottom of the page for:

- **Export JSON**: downloads every wheel, activity, and tag as a single JSON file.
- **Import JSON**: replaces *all* wheels with the contents of a file you pick, after a confirmation, since this is destructive.
- **Clear wheel**: wipes activities and tags from the wheel you currently have open.
- **Clear all wheels**: wipes everything and leaves you with one blank wheel.

This is the same escape hatch whether you're signed in or not: it always operates on whichever backend (local or cloud) you're currently using.

## Debug mode

Open the **Debug** disclosure to control what is shown and how spins run.

There is a separate show/hide checkbox for each internal value, and ticking one adds that value as a pill on every activity row. The available value pills are actual current weight, estimated stable weight, actual current probability, estimated stable probability, preference score, preference score confidence, decayed preference score confidence, and preference score standard deviation. The actual current values are the random ones an activity gets for one exact spin, so their pills change every spin, while the estimated stable values are steady averages across many spins. Everything the user normally sees, including the wheel slice sizes, uses the stable values so nothing shifts under them from spin to spin.

The rest of the panel:

- **RNG seed**: when set, every spin is driven by a Mulberry32 generator seeded from your string plus the current number of activities and a tick counter, so the same starting state and seed reproduces the same sequence of spins.
- **Weight spread**: a slider that exaggerates or compresses the *displayed* differences between activities' weights, for previewing how a lopsided set of activities would feel, without touching anything actually stored.
- **Allow extreme weight spread**: unlocks a much wider range on that slider for stress-testing very unbalanced sets of activities.

All of these persist to `localStorage`, so they survive a page reload.

## Edge cases worth knowing about

- **No activities at all** shows a prompt to add your first one instead of an empty wheel.
- **One activity** is always picked, deterministically.
- **No activities left this session** (everything's been spun) offers a Reset session button instead of a spin button.
- **Tag filter matches nothing** offers a Clear filter button.
- **Tag filter matches something, but you've spun through all of it this session** offers both Reset session and Clear filter.
- **Deleting an activity mid-animation** is handled gracefully: the wheel resets rather than trying to land on something that no longer exists.

## Responsive layout

The app is designed to work well on anything from a small phone to an ultrawide monitor, in portrait or landscape.

- The wheel itself scales fluidly with the viewport rather than staying a fixed size, so it never overflows a narrow phone screen and gets a little more room to breathe on large desktop monitors.
- On touch devices, small icon buttons get an invisibly-extended tap area (the visible button stays the same size, but there's more room around it to tap), and affordances that would otherwise only appear on mouse hover (like the tag remove `×` or the wheel-tab delete `×`) are shown all the time instead, since there's no hover state on touch.
- Popovers like the tag color picker and the add-tag dropdown reposition themselves to stay fully on screen even if they'd otherwise open near the edge of a small viewport.
- On very short viewports (a phone in landscape, for example), padding and spacing shrink so the wheel and its controls still fit without needing to scroll.
- On narrow phone widths, an activity row's name/date, debug pills, tags, and feedback/delete buttons each drop onto their own line instead of competing for space on one row, and keyboard-shortcut hints are hidden entirely since there's no keyboard to reference.

## Layout, top to bottom

1. Auth control (sign in / account name), top-right of the wheel header.
2. Wheel tabs, for switching between wheels.
3. The wheel canvas itself, with the pin button.
4. Post-spin panel, once you've landed on something.
5. Tag filter bar.
6. Activities panel: add-activity field, search/sort/compact controls, the list itself.
7. Debug panel (collapsed by default).
8. Backup & restore (collapsed by default).

Styling is plain CSS, no framework, with theme variables in `src/index.css`, full dark-mode support via `prefers-color-scheme`, and each component's styling co-located in its own `.css` file next to it in `src/components/`.
