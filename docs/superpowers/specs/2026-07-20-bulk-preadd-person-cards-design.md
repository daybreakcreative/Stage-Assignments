# Bulk pre-add — person cards (Batch C) — design

**Date:** 2026-07-20
**Status:** Approved (design), pending build
**File:** `index.html` (bulk pre-add modal: model, `renderBulkPreadd`, `bulkRowsFromPcoTeamData`,
`fetchPcoRegulars`, `seedBulkFromRoster`, `commitBulkPreadd`) + `tests/bulkpreadd*.js`

## Problem / goal

The bulk pre-add grid shows a flat list of rows, each with a role **dropdown**. The PCO aggregator
already emits one row per (person, position), so a person who played Keys and Bass becomes two
adjacent rows — each with a dropdown inviting you to "re-pick" a role PCO already knows. Dillon
wants the positions a person has actually filled shown **grouped under that person**, as read-only
positions, not a dropdown to choose from.

**Decisions (locked):** one card per person; MD is its own position chip (not an "also MD" flag).

## What exists today (from exploration)

- `bulkPreaddRows` — flat array; row `{ id, name, role, typeKey, isMD, mic, open, onStage, pcoId }`.
  `role` ∈ `band|vocalist|md`; `typeKey` only for band; `isMD` only on band rows.
- `BULK_ROLE_OPTS` (`~6858`) — the role option list.
- `addBulkRow(partial)` (`~6864`), `bulkRowSetupKey(r)` (`~6882`), `bulkRowSummary(r)` (`~6886`),
  `seedBulkFromRoster()` (`~6869`).
- `bulkRowsFromPcoTeamData(members, existingKeys)` (`~7033`) — pure; dedupe key
  `normFullName|role|typeKey`; flags `isMD` on the first band row of an md_flag person, else emits a
  standalone `{role:'md', onStage:true}` row.
- `fetchPcoRegulars()` (`~7062`) — pages past plans (≤6 mo), collects `{name, position}`, calls the
  aggregator, `addBulkRow`s each result, `renderBulkPreadd()`.
- `renderBulkPreadd()` (`~6935`) — flat row list; each row head has name input, `.bulk-role`
  `<select>`, "also MD" checkbox; expanded body mounts `renderPersonSetupEditor` + mic (vocalist) /
  on-off-stage (md).
- `commitBulkPreadd()` (`~7009`) — per row writes `musicianPreferences[nn|<slot>]`
  (`md`/`vocal`/typeKey), mic via `setMicRemembered`, and an extra `nn|md` when `isMD`.
- `classifyPosition` → `kind` ∈ `unknown|shadow|host|ignore|vocalist|band(+position)|md_flag`.
- `stableSetupKey(name, role, typeKey)` = `` `${normFullName(name)}|${role}|${typeKey||'none'}` ``.
- The modal is transient — `bulkPreaddRows` is reset on `openBulkPreadd()`, not persisted.

## Design

### A. Model — add a person layer, drop `isMD`

- New session array `let bulkPeople = [];` — `[{ pid, name, pcoId }]`. `pid` = `'bp_'+rand`.
- `bulkPreaddRows` row becomes `{ id, pid, name, role, typeKey, mic, open, onStage, pcoId }`.
  **`isMD` is removed.** `name` is denormalized onto the row (kept in sync with its person) so
  commit + `renderPersonSetupEditor` keep using `r.name` unchanged.
- Grouping is by `pid`. A card's rows = `bulkPreaddRows.filter(r => r.pid === person.pid)`.
- Helpers:
  - `addBulkPerson(partial)` → pushes `{ pid, name:'', pcoId:'' }` (merged with `partial`), returns
    the pid.
  - `addBulkRow(partial)` — unchanged shape minus `isMD`; callers pass `pid`.
  - `bulkFindOrCreatePerson(name, pcoId)` → returns the pid of an existing person with the same
    `normFullName`, else creates one. Used by the PCO/roster paths to group.
  - `renameBulkPerson(pid, name)` → sets the person's name and every row's `name` where
    `r.pid === pid`.
  - `removeBulkPerson(pid)` → drops the person and all its rows.
- `openBulkPreadd()` also resets `bulkPeople = []`.

### B. Aggregator — MD as its own row

`bulkRowsFromPcoTeamData(members, existingKeys)` stays pure and returns rows **without `pid`**.
Change only the MD handling:

```js
mdNames.forEach((disp, nn) => {
  // MD is its own position chip. Emit a standalone md row for every md_flag person (whether or not
  // they also play an instrument / sing). A vocalist row is never turned into an MD.
  const k = keyOf(disp, 'md', '');
  if (!rowMap.has(k) && !existing.has(k)) rowMap.set(k, { name: disp, role: 'md', onStage: true });
});
```

- Vocalist rows: unchanged (`{name, role:'vocalist'}`, one per person).
- Band rows: unchanged (`{name, role:'band', typeKey}`, one per instrument). **No `isMD`.**
- Dedupe key format `normFullName|role|typeKey` unchanged (md row key = `nn|md|`).

### C. Grouping in the PCO/roster paths

- `fetchPcoRegulars()`: after `const rows = bulkRowsFromPcoTeamData(members, existingKeys)`, for each
  returned row: `const pid = bulkFindOrCreatePerson(row.name, null); addBulkRow(Object.assign({pid}, row));`
  (existing-key dedupe against current rows is unchanged — build `existingKeys` from
  `bulkPreaddRows` as today.)
- `seedBulkFromRoster()` ("add everyone on the current plan"): rebuild so that, per assigned person,
  it creates/finds the person and adds one row per position they hold on the plan, plus a separate
  `{role:'md', onStage:true}` row for the current `state.musicDirectorId` player (instead of setting
  `isMD`). Group by `pid` the same way.

### D. `renderBulkPreadd()` — person cards

Render one `.bulk-person` card per `bulkPeople` entry:

```
.bulk-person[data-pid]
  .bulk-person-head
    input.bulk-name (PCO people-search when pcoTokens; plain text otherwise) + .bulk-name-results
    button.bulk-person-remove ✕
  .bulk-pos-list
    (for each row of this person) .bulk-pos[data-id]
      button.bulk-pos-expand ▸/▾
      span.bulk-pos-label   ← read-only: "Vocals" | instrument label | "MD"
      (inline on the chip head, per the approved mock: .bulk-mic select on a vocalist chip;
       on/off-stage select on an md chip)
      button.bulk-pos-remove ✕
      (expanded) .bulk-pos-body → renderPersonSetupEditor(...) only
  .bulk-addpos
    select.bulk-addpos-select (BULK_ROLE_OPTS)  +  button.bulk-addpos-btn "+ add position"
```

- **Position label** comes from the row: vocalist → `"Vocals"`; band → its instrument label
  (`BULK_ROLE_OPTS` label for `typeKey`, e.g. "Keys"); md → `"MD"`. It is a static `<span>`, not a
  `<select>`.
- **Add position:** the per-card `select.bulk-addpos-select` lists `BULK_ROLE_OPTS`; the button adds
  a row to this person: `vocalist`→`{role:'vocalist'}`; `md`→`{role:'md', onStage:true}`; else
  `{role:'band', typeKey:v}`. Skip if that (person, role, typeKey) row already exists (no dupes).
  This is the ONLY dropdown left, and it adds rather than re-picks.
- **Inline chip controls** (on the chip head, visible without expanding, per the approved mock): a
  vocalist chip shows the `.bulk-mic` select; an md chip shows the on/off-stage `<select>` bound to
  `r.onStage`.
- **Expanded body** per chip: `renderPersonSetupEditor` at the existing keys
  (`stableSetupKey(name,'band',typeKey)` / `(name,'vocalist','vocals')` / `(name,'md','md')`) — the
  setup checklist only.
- **Name field:** editing it calls `renameBulkPerson(pid, value)`; PCO search selecting a person
  sets the person's `name` + `pcoId` and re-renders (still routes through `renameBulkPerson`).
- **Remove:** `.bulk-person-remove` → `removeBulkPerson(pid)`; `.bulk-pos-remove` → drop that row.
- Header controls unchanged: `#bulkAddRow` (now "Add person" → `addBulkPerson()` + open its card),
  `#bulkSeedRoster`, `#bulkRegulars`, `#bulkSave`.

### E. `commitBulkPreadd()` — drop the `isMD` branch

Iterate `bulkPreaddRows` exactly as today, but remove the `if (r.isMD) …` line (md rows now write
their own `nn|md` marker via the `role==='md'` branch). Result markers are identical to before for
every scenario. Everything else (vocal mic, `nn|vocal`, `nn|typeKey`, md `onStage`) unchanged.

### F. CSS

Add `.bulk-person`, `.bulk-person-head`, `.bulk-pos-list`, `.bulk-pos`, `.bulk-pos-label`,
`.bulk-addpos` rules in the existing bulk-modal style block, matching the app's clean/flat tone
(reuse existing `.bulk-*` tokens where possible). No emoji (functional glyphs ▸ ▾ ✕ + only).

## Testing

**`tests/bulkpreaddpco.js` (update):**
- `bulkRowsFromPcoTeamData`: Pat Reed (Keys + Music Director) → **two** rows: `{role:'band',
  typeKey:'keys'}` and `{role:'md', onStage:true}` (no `isMD` anywhere). Dana Lee (MD only) → one
  `md` row. Ava Chen (Vocals + WL) → one vocalist row. Val Singer (Vocals + MD) → a vocalist row
  **and** a separate md row. Video Host skipped.
- Dedupe vs `existingKeys` (`nn|band|bass`, `nn|md|`) still holds.
- `fetchPcoRegulars`: same in-window/declined/6-mo behavior; after it runs, `bulkPeople` has one
  entry per distinct full name and every row carries that person's `pid`.
- MD chip on/off-stage: expanding an md chip shows the select; setting "off" then `commitBulkPreadd`
  writes `musicianPreferences['dana lee|md'].onStage === false`.
- People-search still resolves a `.bulk-name` field to the canonical PCO name (now on the card).
- `#bulkRegulars` disabled without PCO.

**`tests/bulkpreadd.js` (update):**
- `openBulkPreadd()` builds `#bulkPreaddModal` with `#bulkAddRow`, `#bulkSeedRoster`, `#bulkSave`.
- "Add person" appends a `.bulk-person` card (not a flat role-select row).
- Adding a position via the card's `.bulk-addpos-select` + `.bulk-addpos-btn` appends a `.bulk-pos`
  chip; expanding a band chip mounts `.bulk-editor` and toggling an option writes to
  `state.setupItems[stableSetupKey(name,'band','bass')]`.
- Vocalist chip shows `.bulk-mic`; after commit `micPrefFor(name).remembered` matches and
  `musicianPreferences['<nn>|vocal']` exists; the pre-added vocalist isn't re-prompted by
  `buildPostPullSteps`.

**New grouping checks (either file):**
- Two positions (e.g. Vocals + Keys) for one PCO person render under **one** `.bulk-person` card as
  two `.bulk-pos` chips.
- A band+MD person renders a Bass chip and an MD chip under one card; commit writes both
  `nn|bass` and `nn|md`.

Full `npm run check` + `npm test` green (allow `curve.js`).

## Scope / non-goals

- No change to `commitBulkPreadd`'s marker/bucket contract beyond removing the redundant `isMD`
  branch. No new persisted keys — `bulkPeople` is session-only.
- No change to the post-pull prompt flow, mic model, or `classifyPosition`.
- `strings` remains addable manually (via `+ add position`) though `classifyPosition` never emits it
  from PCO — unchanged from today.
- Two distinct people who share a full name still group into one card (consistent with the app's
  full-name identity model); the `pid` layer only prevents blank-name collisions and enables rename.
