# Bulk pre-add people — Phase 1 (single-page grid) — design

**Date:** 2026-07-18
**Status:** Approved (design), pending build
**File:** `index.html` (Settings → Setup Items)

## Problem / goal

Someone who knows the team should be able to pre-fill everyone's setup preferences up front, so
that when those people show up on a future service their checklist is ready (instead of every
person being asked on their first pull). Phase 1 delivers a **manual bulk-capture grid**; Phase 2
(separate) adds a PCO "last 6 months" button that auto-populates the grid.

Chosen UX (brainstorm): a **single-page grid** — list people (name + instrument/role), expand
each row inline to set their preferences, save all at once.

## Reuse (what already exists)

- **Setup buckets** keyed `stableSetupKey(name, role, typeKey)` — read by the ✓ Items check-off,
  the manager, and the post-pull popup. `renderPersonSetupEditor(container, stableKey, typeKey)`
  renders the grouped selector and **saves selections live** into that bucket.
- **Mic memory:** `state.inventory` is the mic list; `setMicRemembered(name, micName)` stores a
  soft "reuse this mic" preference (the same call the post-pull `pref-vocal` card makes).
- **"Known" markers:** `buildPostPullSteps` skips a person when `state.musicianPreferences[key]`
  exists — vocalist `key = name|vocal`, band `key = name|<roleTagFromInstLabel(label)>`, MD
  `key = name|md`.
- **Catalog keys:** `['drums','bass','ag','eg','keys','md','strings','vocals']` via `setupCatalogFor`.

## Design

### Entry
- Settings → **Setup Items** tab: a **"＋ Bulk pre-add people"** button (below the defaults
  section) opens a full-screen modal `#bulkPreaddModal` (styled like the existing `.sa-modal`
  overlays: header + scrollable body + footer).

### The grid (`renderBulkPreadd`)
- **Rows** in a scroll area. Each row is `{ id, name, role, typeKey, isMD, open }` held in a
  module-local array (`bulkPreaddRows`), not written to `state` until Save.
  - `role` ∈ `'vocalist' | 'band'`. For `band`, `typeKey` is one of the instrument catalog keys
    (drums/bass/ag/eg/keys/strings). `isMD` is a checkbox on any row (adds the MD setup section).
- **Add:** a **"＋ Add person"** button appends a blank row (name input + a role/instrument
  `<select>` whose options are *Vocalist* + the instrument catalog labels, plus an "also MD"
  checkbox).
- **Seed from roster:** an **"Add everyone on the current plan"** button appends rows from the
  live roster — `state.vocalists` (role vocalist) and non-vocalist-linked `state.instruments`
  (role band, `typeKey = detectPresetKey(inst)`, `isMD` when `musicDirectorId === inst.id`),
  skipping names already in the grid.
- **Expand/collapse:** clicking a row toggles `open`. The expanded body renders the person's
  preference editor(s) into a container, keyed by their stable bucket:
  - vocalist → a **mic** `<select>` (options built from `state.inventory`, same encoding as the
    post-pull card: `value="Name|wl|wd"`) + `renderPersonSetupEditor(el, stableSetupKey(name,'vocalist','vocals'), 'vocals')`.
  - band → `renderPersonSetupEditor(el, stableSetupKey(name,'band',typeKey), typeKey)`.
  - `isMD` (either role) → additionally `renderPersonSetupEditor(elMd, stableSetupKey(name,'md','md'), 'md')`.
  - A row with no name yet shows only the name/role inputs (editors mount once a name is typed;
    re-render on name blur so the bucket key is correct).
- **Collapsed summary:** show the person's chosen count (`setupCompletionStats(key).total`) and,
  for vocalists, their mic — e.g. "3 items · Beta 58A".
- **Remove row:** an ✕ on each row (drops it from `bulkPreaddRows`; does not delete any bucket).

### Save all (`commitBulkPreadd`)
For each row with a non-empty (trimmed) name:
- Setup selections are already saved live by the editors into the stable buckets — nothing extra.
- **Mic:** if a vocalist mic was chosen, `setMicRemembered(name, micName)` (micName = value before `|`).
- **"Known" markers** (best-effort re-prompt suppression): set
  `state.musicianPreferences[`${normFullName(name)}|vocal`]` for vocalists,
  `[`${normFullName(name)}|md`]` when isMD, and `[`${normFullName(name)}|${typeKey}`]` for band.
  _Note:_ the band marker keys by `typeKey`, while `buildPostPullSteps` keys by
  `roleTagFromInstLabel(label)`; for standard instruments these match (e.g. "Keys"→"keys"), but a
  differently-labeled future instrument (e.g. "Electric Guitar"→"electric_guitar" vs typeKey "eg")
  may still prompt once. That's acceptable — the **pre-filled setup bucket is the real win** (the
  post-pull card and check-off read it by the stable key regardless), so a re-prompt just shows
  the already-filled selections. `saveState()` then close.

### Non-goals (Phase 1)
- No PCO history ("last 6 months") — that's Phase 2, which will push rows into `bulkPreaddRows`.
- No editing of the church defaults (that's the shipped defaults editor).
- No change to `buildPostPullSteps` / the marker-key scheme.

## Testing (`tests/bulkpreadd.js`, jsdom)

1. Opening the modal + "＋ Add person" adds an empty row; the role select lists Vocalist + the
   instrument catalog.
2. "Add everyone on the current plan" seeds rows from `state.vocalists` + band instruments
   (role/typeKey correct; MD flagged for the `musicDirectorId` instrument), skipping dupes.
3. Expanding a **band** row mounts a setup editor on `stableSetupKey(name,'band',typeKey)`; ticking
   an option writes that bucket.
4. Expanding a **vocalist** row shows a mic select (from `state.inventory`) + the vocals editor;
   choosing a mic + Save calls `setMicRemembered` (mic remembered in `micPrefs`).
5. An **isMD** row also mounts the `name|md|md` editor; its selections land in that bucket.
6. **Save all** marks `musicianPreferences` for each named row (vocalist `|vocal`, MD `|md`, band
   `|typeKey`) and persists; a pre-added vocalist is then treated as **known** by
   `buildPostPullSteps` (no `pref-vocal` step for them).
7. A pre-added person's setup shows on the ✓ Items check-off (bucket populated) — integration.
8. Full `npm test` green (allow `curve.js`); existing setup tests unaffected.

## Notes
- All persistence uses existing stores (`setupItems`, `micPrefs`, `musicianPreferences`) — no new
  keys, so pre-added data flows through the check-off, manager, and post-pull popup unchanged.
- `bulkPreaddRows` is transient (module-local); only Save writes to `state`. Discard/close throws
  the list away but leaves any live-saved buckets (the editors save live) — acceptable, matching
  how the per-person editor already behaves.
